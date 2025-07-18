import type { Route } from "./+types/home";
import { useState, useEffect, useRef, useCallback } from 'react';
import { redirect, useNavigate, Link } from 'react-router';
import { RoomEvent, Room } from 'matrix-js-sdk';
import { useMatrix, MatrixProvider } from '../contexts/MatrixContext';
import JoinOrCreateRoom from '../components/JoinOrCreateRoom';
import ErrorMessage from '../components/ErrorMessage';

export async function loader({ request }: Route.LoaderArgs) {
  const cookieHeader = request.headers.get('Cookie');
  
  if (!cookieHeader) {
    throw redirect('/login');
  }
  
  // Parse cookies
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map(cookie => {
      const [name, value] = cookie.split('=');
      return [name, decodeURIComponent(value)];
    })
  );
  
  const token = cookies.matrix_token;
  const userId = cookies.matrix_user_id;
  const baseUrl = cookies.matrix_base_url;
  
  if (!token || !userId || !baseUrl) {
    throw redirect('/login');
  }
  
  return { token, userId, baseUrl };
}
export function meta({}: Route.MetaArgs) {
  return [
    { title: "Matrix Chat" },
    { name: "description", content: "Minimal Matrix chat application" },
  ];
}


function HomeContent({ token, userId }: { token?: string; userId?: string }) {
  const navigate = useNavigate();
  const { 
    client, 
    isLoggedIn, 
    loading, 
    error, 
    rooms, 
    currentRoom, 
    messages, 
    logout, 
    setError, 
    setLoading, 
    joinRoom, 
    createRoom, 
    sendMessage, 
    setCurrentRoom, 
    leaveCurrentRoom,
    initializeWithToken
  } = useMatrix();
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    setTimeout(() => scrollToBottom(), 100);
  }, [messages, scrollToBottom]);




  const handleJoinRoom = async (targetRoomId?: string) => {
    const roomToJoin = targetRoomId || roomId;
    if (!roomToJoin) return;
    await joinRoom(roomToJoin);
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim()) return;
    await createRoom(roomName);
    setRoomName('');
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageText = newMessage;
    setNewMessage('');

    try {
      await sendMessage(messageText);
    } catch (err: any) {
      // Restore the message text on error
      setNewMessage(messageText);
    }
  };


  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-md text-center">
          <h1 className="text-2xl font-bold mb-6">Matrix Chat</h1>
          <p>Connecting...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-md text-center">
          <h1 className="text-2xl font-bold mb-6">Matrix Chat</h1>
          <ErrorMessage message={error} />
          <button
            onClick={() => navigate('/login')}
            className="bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-md text-center">
          <h1 className="text-2xl font-bold mb-6">Matrix Chat</h1>
          <p>Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow-sm p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">Matrix Chat</h1>
          <Link
            to="/logout"
            className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
          >
            Logout
          </Link>
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
              joinRoom={handleJoinRoom}
              createRoom={handleCreateRoom}
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
                      onClick={() => handleJoinRoom(room.roomId)}
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
              <h2 className="font-semibold">Room: {currentRoom?.name}</h2>
              <button
                onClick={() => {
                  leaveCurrentRoom();
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
                  id="messageInput"
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  aria-label="Message"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyPress={handleKeyPress}
                />
                <button
                  onClick={handleSendMessage}
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

export default function Home({ loaderData }: Route.ComponentProps) {
  const { token, userId, baseUrl } = loaderData;
  
  return (
    <MatrixProvider token={token} userId={userId} baseUrl={baseUrl}>
      <HomeContent token={token} userId={userId} />
    </MatrixProvider>
  );
}

