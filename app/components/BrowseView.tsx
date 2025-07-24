import React, { useState, useEffect, useMemo } from 'react';

interface PublicRoom {
  roomId: string;
  name: string;
  topic?: string;
  numJoinedMembers: number;
  isJoined: boolean;
}

interface PublicUser {
  userId: string;
  displayName?: string;
  avatarUrl?: string;
}

interface BrowseViewProps {
  publicRooms: PublicRoom[];
  publicUsers: PublicUser[];
  onJoinRoom: (roomId: string) => void;
  onInviteUser: (roomId: string, userId: string) => void;
  onRefreshRooms: () => void;
  onSearchUsers: (query: string) => Promise<PublicUser[]>;
  currentRoomId?: string;
  loading: boolean;
}

const BrowseView: React.FC<BrowseViewProps> = ({
  publicRooms,
  publicUsers,
  onJoinRoom,
  onInviteUser,
  onRefreshRooms,
  onSearchUsers,
  currentRoomId,
  loading
}) => {
  const [filter, setFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'rooms' | 'users'>('rooms');
  const [searchedUsers, setSearchedUsers] = useState<PublicUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Filter rooms based on search query
  const filteredRooms = useMemo(() => {
    if (!filter.trim()) return publicRooms;
    const query = filter.toLowerCase();
    return publicRooms.filter(room => 
      room.name.toLowerCase().includes(query) ||
      room.topic?.toLowerCase().includes(query)
    );
  }, [publicRooms, filter]);

  // Search users when filter changes and users tab is active
  useEffect(() => {
    const searchUsersDebounced = async () => {
      if (activeTab === 'users' && filter.trim().length > 2) {
        setIsSearching(true);
        try {
          const users = await onSearchUsers(filter);
          setSearchedUsers(users);
        } catch (err) {
          console.error('Failed to search users:', err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchedUsers([]);
      }
    };

    const timeoutId = setTimeout(searchUsersDebounced, 500);
    return () => clearTimeout(timeoutId);
  }, [filter, activeTab, onSearchUsers]);

  const displayedUsers = filter.trim().length > 2 ? searchedUsers : publicUsers;

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="p-6 border-b bg-gray-50">        
        {/* Search Filter */}
        <div className="mb-4">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={activeTab === 'rooms' ? 'Filter rooms...' : 'Search users... (min 3 characters)'}
            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('rooms')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'rooms'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Rooms ({filteredRooms.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'users'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Users ({displayedUsers.length})
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'rooms' ? (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Public Rooms</h2>
              <button
                onClick={onRefreshRooms}
                disabled={loading}
                className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 text-sm"
              >
                {loading ? 'Refreshing...' : '🔄 Refresh'}
              </button>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredRooms.map((room) => (
                <div key={room.roomId} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-lg">#{room.name}</h3>
                    {room.isJoined && (
                      <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full">
                        Joined
                      </span>
                    )}
                  </div>
                  
                  {room.topic && (
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">{room.topic}</p>
                  )}
                  
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">
                      {room.numJoinedMembers} members
                    </span>
                    
                    <div className="flex space-x-2">
                      {!room.isJoined ? (
                        <button
                          onClick={() => onJoinRoom(room.roomId)}
                          disabled={loading}
                          className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 text-sm"
                        >
                          Join
                        </button>
                      ) : (
                        <button
                          onClick={() => onJoinRoom(room.roomId)}
                          className="px-3 py-1 bg-gray-500 text-white rounded-md hover:bg-gray-600 text-sm"
                        >
                          View
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {filteredRooms.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  {filter ? 'No rooms match your search.' : 'No public rooms available.'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold mb-4">Users</h2>
            
            {filter.trim().length <= 2 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">
                  Enter at least 3 characters to search for users.
                </p>
              </div>
            ) : isSearching ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Searching users...</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {displayedUsers.map((user) => (
                  <div key={user.userId} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                        {user.displayName?.[0] || user.userId[1]}
                      </div>
                      <div>
                        <h3 className="font-medium">{user.displayName || user.userId}</h3>
                        {user.displayName && (
                          <p className="text-sm text-gray-500">{user.userId}</p>
                        )}
                      </div>
                    </div>
                    
                    {currentRoomId && (
                      <button
                        onClick={() => onInviteUser(currentRoomId, user.userId)}
                        disabled={loading}
                        className="w-full px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 text-sm"
                      >
                        Invite to Current Room
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {displayedUsers.length === 0 && filter.trim().length > 2 && !isSearching && (
              <div className="text-center py-12">
                <p className="text-gray-500">No users found matching your search.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BrowseView;