import React from 'react';

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
                    <label htmlFor="roomName" className="block text-sm font-medium text-gray-700 mb-1">
                      Room Name
                    </label>
                    <input
                      id="roomName"
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

export default JoinOrCreateRoom;