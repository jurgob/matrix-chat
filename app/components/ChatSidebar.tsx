import React, { useState } from 'react';
import { Room } from 'matrix-js-sdk';
import ErrorMessage from './ErrorMessage';

interface ChatSidebarProps {
  rooms: Room[];
  currentRoom: { id: string; name: string } | null;
  onJoinRoom: (roomId: string) => void;
  onCreateRoom: (roomName: string) => void;
  loading: boolean;
  error: string;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({ 
  rooms, 
  currentRoom, 
  onJoinRoom, 
  onCreateRoom, 
  loading, 
  error 
}) => {
  const [newRoomName, setNewRoomName] = useState('');

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    await onCreateRoom(newRoomName);
    setNewRoomName('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateRoom();
    }
  };

  return (
    <div className="w-64 bg-gray-800 text-white flex flex-col h-screen">
      {/* Create Room Form */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-sm font-semibold mb-3 text-gray-300">CREATE ROOM</h2>
        <div className="space-y-2">
          <input
            type="text"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            placeholder="Enter room name"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            onKeyPress={handleKeyPress}
          />
          <button
            onClick={handleCreateRoom}
            disabled={loading || !newRoomName.trim()}
            className="w-full bg-green-600 text-white py-2 px-3 rounded-md hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-sm font-medium"
          >
            {loading ? 'Creating...' : 'Create Room'}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 border-b border-gray-700">
          <ErrorMessage message={error} />
        </div>
      )}

      {/* Rooms List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-sm font-semibold mb-3 text-gray-300">
            PUBLIC ROOMS ({rooms.length})
          </h3>
          <div className="space-y-1">
            {rooms.map((room) => (
              <button
                key={room.roomId}
                onClick={() => onJoinRoom(room.roomId)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  currentRoom?.id === room.roomId
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                # {room.name || room.roomId}
              </button>
            ))}
            {rooms.length === 0 && (
              <p className="text-gray-400 text-sm italic">No rooms available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatSidebar;