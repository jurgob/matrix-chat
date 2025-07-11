import type { Route } from "./+types/home";
import { useState, useEffect, useRef } from 'react';
import { createClient ,RoomEvent, Room,ClientEvent,SyncState} from 'matrix-js-sdk';
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
  joinRoom: () => Promise<void>;
  createRoom: () => Promise<void>;
  loading: boolean;
  error: string;
}

const JoinOrCreateRoom: React.FC<JoinOrCreateRoomProps> = ({ roomId, setRoomId, joinRoom, createRoom, loading, error }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
            <h2 className="text-lg font-semibold mb-4">Join or Create Room</h2>
            
            {error && <ErrorMessage message={error} />} 
              
            
            <div className="space-y-4">
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
              
              <div className="flex space-x-4">
                <button
                  onClick={joinRoom}
                  disabled={loading || !roomId}
                  className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:bg-gray-400"
                >
                  {loading ? 'Joining...' : 'Join Room'}
                </button>
                
                <button
                  onClick={createRoom}
                  disabled={loading}
                  className="flex-1 bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 disabled:bg-gray-400"
                >
                  {loading ? 'Creating...' : 'Create Room'}
                </button>
              </div>
            </div>
      </div>
  );
};

export default function Home() {
  const [client, setClient] = useState<any>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roomId, setRoomId] = useState('');
  const [currentRoom, setCurrentRoom] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
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

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    const userId = `@${username}:localhost`;
    try {
      const matrixClient = createClient({
        baseUrl: 'http://localhost:6167',
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
      
      // Set up event listeners
      matrixClient.on(RoomEvent.Timeline, (event: any, room: any) => {
        if (event.getType() === 'm.room.message' && room.roomId === currentRoom) {
          const sender = event.getSender();
          const content = event.getContent();
          
          setMessages(prev => [...prev, {
            id: event.getId(),
            sender: sender,
            body: content.body,
            timestamp: new Date(event.getTs())
          }]);
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

    try {
      const matrixClient = createClient({
        baseUrl: 'http://localhost:6167',
      });

      await matrixClient.register(username, password, null, { type: 'm.login.dummy' });
      
      // After successful registration, login
      await handleLogin();
      
    } catch (err: any) {
      setError(`Registration failed: ${err.message}`);
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!client || !roomId) return;

    setLoading(true);
    setError('');

    try {
      await client.joinRoom(roomId);
      
      // Set the current room only after successful join
      setCurrentRoom(roomId);
      
      // Get room history
      const room = client.getRoom(roomId);
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
      }
      
    } catch (err: any) {
      setError(`Failed to join room: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async () => {
    if (!client) return;

    setLoading(true);
    setError('');

    try {
      const room = await client.createRoom({
        name: 'My Chat Room',
        visibility: 'public',
        preset: 'public_chat',
      });
      
      setRoomId(room.room_id);
      setCurrentRoom(room.room_id);
      
    } catch (err: any) {
      setError(`Failed to create room: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!client || !currentRoom || !newMessage.trim()) return;

    try {
      await client.sendTextMessage(currentRoom, newMessage);
      setNewMessage('');
    } catch (err: any) {
      setError(`Failed to send message: ${err.message}`);
    }
  };

  const logout = () => {
    if (client) {
      client.stopClient();
    }
    setClient(null);
    setIsLoggedIn(false);
    setMessages([]);
    setRoomId('');
    setCurrentRoom('');
    setUsername('');
    setPassword('');
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
                      onClick={() => {
                        setRoomId(room.roomId);
                        joinRoom();
                      }}
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
            <div className="p-4 border-b">
              <h2 className="font-semibold">Room: {currentRoom}</h2>
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

