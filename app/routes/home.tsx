import type { Route } from "./+types/home";
import { useState, useEffect, useRef, useCallback } from 'react';
import { redirect, useNavigate, Link, createCookie } from 'react-router';
import { RoomEvent, Room } from 'matrix-js-sdk';
import { useMatrix, MatrixProvider } from '../contexts/MatrixContext';
import ChatSidebar from '../components/ChatSidebar';
import ErrorMessage from '../components/ErrorMessage';

const matrixTokenCookie = createCookie("matrix_token", {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: "/",
  maxAge: 86400
});

const matrixUserIdCookie = createCookie("matrix_user_id", {
  httpOnly: true,
  secure: true,
  sameSite: "strict", 
  path: "/",
  maxAge: 86400
});

const matrixBaseUrlCookie = createCookie("matrix_base_url", {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: "/", 
  maxAge: 86400
});

export async function loader({ request }: Route.LoaderArgs) {
  const token = await matrixTokenCookie.parse(request.headers.get('Cookie'));
  const userId = await matrixUserIdCookie.parse(request.headers.get('Cookie'));
  const baseUrl = await matrixBaseUrlCookie.parse(request.headers.get('Cookie'));
  
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
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Auto-scroll when messages change
  useEffect(() => {
    setTimeout(() => scrollToBottom(), 100);
  }, [messages, scrollToBottom]);




  const handleJoinRoom = async (roomId: string) => {
    if (!roomId) return;
    await joinRoom(roomId);
  };

  const handleCreateRoom = async (roomName: string) => {
    if (!roomName.trim()) return;
    await createRoom(roomName);
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
    <div className="h-screen bg-gray-100 flex">
      {/* Discord-like Sidebar */}
      <ChatSidebar
        rooms={rooms}
        currentRoom={currentRoom}
        onJoinRoom={handleJoinRoom}
        onCreateRoom={handleCreateRoom}
        loading={loading}
        error={error}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm p-4 border-b">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold">
              {currentRoom ? `# ${currentRoom.name}` : 'Matrix Chat'}
            </h1>
            <Link
              to="/logout"
              className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
            >
              Logout
            </Link>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {!currentRoom ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center text-gray-500">
                <h2 className="text-2xl font-semibold mb-2">Welcome to Matrix Chat</h2>
                <p>Select a room from the sidebar or create a new one to start chatting.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
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
              
              {/* Message Input */}
              <div className="p-4 border-t bg-white">
                <div className="flex space-x-2">
                  <input
                    id="messageInput"
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={`Message # ${currentRoom.name}`}
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
            </>
          )}
        </div>
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

