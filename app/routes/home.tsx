import type { Route } from "./+types/home";
import { useState, useEffect, useRef } from 'react';
import { useFetcher } from 'react-router';
import { createClient ,RoomEvent, Room,ClientEvent,SyncState} from 'matrix-js-sdk';

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;
  const action = formData.get('action') as string;
  
  // You can add logic here to determine the matrix server based on username/password
  // For now, return defaults or environment-based values
  const matrixBaseUrl = process.env.MATRIX_BASE_URL || 'http://localhost:6167';
  const matrixHomeserver = process.env.MATRIX_HOMESERVER || 'localhost';
  
  return {
    success: true,
    matrixBaseUrl,
    matrixHomeserver,
    action: action || 'login',
    message: 'Configuration retrieved successfully'
  };
}
export function meta({}: Route.MetaArgs) {
  return [
    { title: "Matrix Chat" },
    { name: "description", content: "Minimal Matrix chat application" },
  ];
}

const ErrorMessage = ({ message }: { message: string }) => (
  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
    {message}
  </div>
);


interface JoinOrCreateRoomProps {
  roomId: string;
  setRoomId: (roomId: string) => void;
  roomName: string;
  setRoomName: (roomName: string) => void;
  joinRoom: () => Promise<void>;
  createRoom: () => Promise<void>;
  loading: boolean;
  error: string;
}

const JoinOrCreateRoom: React.FC<JoinOrCreateRoomProps> = ({ roomId, setRoomId, roomName, setRoomName, joinRoom, createRoom, loading, error }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
            <h2 className="text-lg font-semibold mb-6">Join or Create Room</h2>
            
            {error && <ErrorMessage message={error} />} 
              
            <div className="space-y-6">
              {/* Join Room Form */}
              <div className="border rounded-lg p-4">
                <h3 className="text-md font-medium mb-3">Join Existing Room</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Room ID (e.g., !roomid:localhost)
                    </label>
                    <input
                      type="text"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      placeholder="!example:localhost"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => joinRoom()}
                    disabled={loading || !roomId}
                    className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
                  >
                    {loading ? 'Joining...' : 'Join Room'}
                  </button>
                </div>
              </div>

              {/* Create Room Form */}
              <div className="border rounded-lg p-4">
                <h3 className="text-md font-medium mb-3">Create New Room</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Room Name
                    </label>
                    <input
                      type="text"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      placeholder="Enter room name"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <button
                    onClick={createRoom}
                    disabled={loading || !roomName}
                    className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 disabled:bg-gray-400"
                  >
                    {loading ? 'Creating...' : 'Create Room'}
                  </button>
                </div>
              </div>
            </div>
      </div>
  );
};

export default function Home() {
  const fetcher = useFetcher();
  const [client, setClient] = useState<any>(null);
  const [matrixBaseUrl, setMatrixBaseUrl] = useState('');
  const [matrixHomeserver, setMatrixHomeserver] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [currentRoom, setCurrentRoom] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [allMessages, setAllMessages] = useState<{[roomId: string]: any[]}>({});
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check localStorage for stored credentials on component mount
  useEffect(() => {
    const storedUsername = localStorage.getItem('matrix-username');
    const storedPassword = localStorage.getItem('matrix-password');
    
    if (storedUsername && storedPassword) {
      setUsername(storedUsername);
      setPassword(storedPassword);
      
      // Use fetcher to get configuration for auto-login
      fetcher.submit(
        { username: storedUsername, password: storedPassword },
        { method: 'POST' }
      );
    }
  }, []);

  const handleAutoLogin = async (savedUsername: string, savedPassword: string) => {
    setLoading(true);
    setError('');
    const userId = `@${savedUsername}:${matrixHomeserver}`;
    
    try {
      const matrixClient = createClient({
        baseUrl: matrixBaseUrl,
        userId,
        deviceId: 'matrix-react-chat',
      });

      const loginResponse = await matrixClient.loginRequest({
        type: 'm.login.password',
        user: userId,
        password: savedPassword,
      });

      matrixClient.setAccessToken(loginResponse.access_token);      
      await matrixClient.startClient();
      
      setClient(matrixClient);
      setIsLoggedIn(true);
      
      // Set up event listeners
      matrixClient.on(RoomEvent.Timeline, (event: any, room: any) => {
        if (event.getType() === 'm.room.message') {
          const eventId = event.getId();
          const sender = event.getSender();
          const content = event.getContent();
          const roomId = room.roomId;
          
          const newMessage = {
            id: eventId,
            sender: sender,
            body: content.body,
            timestamp: new Date(event.getTs())
          };
          
          // Store message in allMessages by room
          setAllMessages(prev => {
            const roomMessages = prev[roomId] || [];
            // Check if message already exists to avoid duplicates
            if (roomMessages.some(msg => msg.id === eventId)) {
              return prev;
            }
            
            return {
              ...prev,
              [roomId]: [...roomMessages, newMessage]
            };
          });
          
          // Update current room messages if this event is for the current room
          setCurrentRoom(prevRoom => {
            if (prevRoom === roomId) {
              setMessages(prev => {
                // Check if message already exists to avoid duplicates
                if (prev.some(msg => msg.id === eventId)) {
                  return prev;
                }
                const updated = [...prev, newMessage];
                // Scroll to bottom when new message arrives in current room
                setTimeout(() => scrollToBottom(), 100);
                return updated;
              });
            }
            return prevRoom;
          });
        }
      });
      
      matrixClient.once(ClientEvent.Sync, (state) => {
        if (state === SyncState.Prepared) {
          const rooms = matrixClient.getRooms();
          console.log("Known rooms:", rooms.length);
          setRooms(rooms);
        }
      });

    } catch (err: any) {
      setError(`Auto-login failed: ${err.message}`);
      // Clear invalid credentials from localStorage
      localStorage.removeItem('matrix-username');
      localStorage.removeItem('matrix-password');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    
    // Use fetcher to get matrix configuration from server action
    fetcher.submit(
      { username, password },
      { method: 'POST' }
    );
  };

  // Handle fetcher response
  useEffect(() => {
    if (fetcher.data && fetcher.state === 'idle') {
      const result = fetcher.data;
      
      if (result.success) {
        setMatrixBaseUrl(result.matrixBaseUrl);
        setMatrixHomeserver(result.matrixHomeserver);
        
        if (result.action === 'register') {
          // Proceed with registration
          performRegistration(username, password, result.matrixBaseUrl, result.matrixHomeserver);
        } else {
          // Proceed with login using the retrieved configuration
          const userId = `@${username}:${result.matrixHomeserver}`;
          performLogin(userId, password, result.matrixBaseUrl);
        }
      } else {
        setError(result.message || 'Failed to get configuration');
        // Clear credentials on auto-login failure
        localStorage.removeItem('matrix-username');
        localStorage.removeItem('matrix-password');
        setLoading(false);
      }
    }
  }, [fetcher.data, fetcher.state, username, password]);

  const performRegistration = async (user: string, pass: string, baseUrl: string, homeserver: string) => {
    try {
      const matrixClient = createClient({
        baseUrl: baseUrl,
      });

      await matrixClient.register(user, pass, null, { type: 'm.login.dummy' });
      
      // After successful registration, perform login
      const userId = `@${user}:${homeserver}`;
      await performLogin(userId, pass, baseUrl);
      
    } catch (err: any) {
      setError(`Registration failed: ${err.message}`);
      setLoading(false);
    }
  };

  const performLogin = async (userId: string, userPassword: string, baseUrl: string) => {
    try {
      const matrixClient = createClient({
        baseUrl: baseUrl,
        userId,
        deviceId: 'matrix-react-chat',
      });

      const loginResponse = await matrixClient.loginRequest({
        type: 'm.login.password',
        user: userId,
        password: password,
      });


      matrixClient.setAccessToken(loginResponse.access_token);      
      await matrixClient.startClient();
      

      setClient(matrixClient);
      setIsLoggedIn(true);
      
      // Store credentials in localStorage
      localStorage.setItem('matrix-username', username);
      localStorage.setItem('matrix-password', password);
      
      // Set up event listeners
      matrixClient.on(RoomEvent.Timeline, (event: any, room: any) => {
        if (event.getType() === 'm.room.message') {
          const eventId = event.getId();
          const sender = event.getSender();
          const content = event.getContent();
          const roomId = room.roomId;
          
          const newMessage = {
            id: eventId,
            sender: sender,
            body: content.body,
            timestamp: new Date(event.getTs())
          };
          
          // Store message in allMessages by room
          setAllMessages(prev => {
            const roomMessages = prev[roomId] || [];
            // Check if message already exists to avoid duplicates
            if (roomMessages.some(msg => msg.id === eventId)) {
              return prev;
            }
            
            return {
              ...prev,
              [roomId]: [...roomMessages, newMessage]
            };
          });
          
          // Update current room messages if this event is for the current room
          setCurrentRoom(prevRoom => {
            if (prevRoom === roomId) {
              setMessages(prev => {
                // Check if message already exists to avoid duplicates
                if (prev.some(msg => msg.id === eventId)) {
                  return prev;
                }
                const updated = [...prev, newMessage];
                // Scroll to bottom when new message arrives in current room
                setTimeout(() => scrollToBottom(), 100);
                return updated;
              });
            }
            return prevRoom;
          });
        }
      });
      matrixClient.once(ClientEvent.Sync, (state) => {
        if (state === SyncState.Prepared) {
          const rooms = matrixClient.getRooms(); // Now filled
          console.log("Known rooms:", rooms.length);
          setRooms(rooms);
        }
      });
      // const _rooms = await matrixClient.getRooms();
      // const al = await matrixClient.getJoinedRooms();
      // console.log('Joined Rooms:', al);
      // setRooms(_rooms);

    } catch (err: any) {
      setError(`Login failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setLoading(true);
    setError('');

    // First, get the matrix configuration from the server, then register
    fetcher.submit(
      { username, password, action: 'register' },
      { method: 'POST' }
    );
  };

  const joinRoom = async (targetRoomId?: string) => {
    const roomToJoin = targetRoomId || roomId;
    if (!client || !roomToJoin) return;

    setLoading(true);
    setError('');

    try {
      await client.joinRoom(roomToJoin);
      
      // Set the current room only after successful join
      setCurrentRoom(roomToJoin);
      
      // Load messages from allMessages state if available, otherwise get room history
      setAllMessages(prev => {
        if (prev[roomToJoin]) {
          setMessages(prev[roomToJoin]);
          return prev;
        } else {
          // Get room history for first time joining
          const room = client.getRoom(roomToJoin);
          if (room) {
            const timeline = room.getLiveTimeline();
            const events = timeline.getEvents();
            
            const roomMessages = events
              .filter((event: any) => event.getType() === 'm.room.message')
              .map((event: any) => ({
                id: event.getId(),
                sender: event.getSender(),
                body: event.getContent().body,
                timestamp: new Date(event.getTs())
              }));
            
            setMessages(roomMessages);
            return {
              ...prev,
              [roomToJoin]: roomMessages
            };
          }
          setMessages([]);
          return prev;
        }
      });
      
    } catch (err: any) {
      setError(`Failed to join room: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async () => {
    if (!client || !roomName.trim()) return;

    setLoading(true);
    setError('');

    try {
      const room = await client.createRoom({
        name: roomName,
        visibility: 'public',
        preset: 'public_chat',
      });
      
      setRoomId(room.room_id);
      setCurrentRoom(room.room_id);
      setRoomName('');
      
    } catch (err: any) {
      setError(`Failed to create room: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!client || !currentRoom || !newMessage.trim()) return;

    const messageText = newMessage;
    setNewMessage('');

    try {
      const response = await client.sendTextMessage(currentRoom, messageText);
    } catch (err: any) {
      setError(`Failed to send message: ${err.message}`);
      // Restore the message text on error
      setNewMessage(messageText);
    }
  };

  const logout = () => {
    if (client) {
      client.stopClient();
    }
    setClient(null);
    setIsLoggedIn(false);
    setMessages([]);
    setAllMessages({});
    setRoomId('');
    setRoomName('');
    setCurrentRoom('');
    setUsername('');
    setPassword('');
    
    // Clear credentials from localStorage
    localStorage.removeItem('matrix-username');
    localStorage.removeItem('matrix-password');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-md">
          <h1 className="text-2xl font-bold text-center mb-6">Matrix Chat</h1>
          
          {error && <ErrorMessage message={error} />}
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div className="flex space-x-4">
              <button
                onClick={handleLogin}
                disabled={loading}
                className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
              
              <button
                onClick={handleRegister}
                disabled={loading}
                className="flex-1 bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 disabled:bg-gray-400"
              >
                {loading ? 'Registering...' : 'Register'}
              </button>
            </div>
          </div>
          
          <div className="mt-4 text-sm text-gray-600">
            <p>Make sure Conduit is running on localhost:6167</p>
            <p>Use <code>docker-compose up</code> to start the server</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow-sm p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">Matrix Chat</h1>
          <button
            onClick={logout}
            className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="flex-1 p-4">
        {!currentRoom ? (
          <div>
            <JoinOrCreateRoom 
              roomId={roomId}
              setRoomId={setRoomId}
              roomName={roomName}
              setRoomName={setRoomName}
              joinRoom={joinRoom}
              createRoom={createRoom}
              loading={loading}
              error={error}
            />
            <div className="mt-4">
            <h2 className="text-lg font-semibold mb-2">Available Rooms ({rooms.length})</h2>
              <ul className="space-y-2">
                {rooms.map((room) => (
                  <li key={room.roomId} className="flex items-center justify-between bg-gray-50 p-3 rounded-md shadow-sm">
                    <span>{room.name || room.roomId}</span>
                     <button
                      onClick={() => joinRoom(room.roomId)}
                      className="bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600"
                    >
                      Join
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md h-full flex flex-col">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="font-semibold">Room: {currentRoom}</h2>
              <button
                onClick={() => {
                  setCurrentRoom('');
                  setMessages([]);
                  setRoomId('');
                  setRoomName('');
                }}
                className="bg-gray-500 text-white px-3 py-1 rounded-md hover:bg-gray-600 text-sm"
              >
                Leave Room
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className="flex flex-col">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium text-sm text-blue-600">
                      {msg.sender}
                    </span>
                    <span className="text-xs text-gray-500">
                      {msg.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="bg-gray-100 rounded-lg p-3 max-w-xs lg:max-w-md">
                    {msg.body}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            
            <div className="p-4 border-t">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={handleKeyPress}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

