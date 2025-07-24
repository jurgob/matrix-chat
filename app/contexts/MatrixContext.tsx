import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient, MatrixClient, RoomEvent, Room, ClientEvent, SyncState ,Visibility, Preset} from 'matrix-js-sdk';

interface Message {
  id: string;
  sender: string;
  body: string;
  timestamp: Date;
}

interface CurrentRoom {
  id: string;
  name: string;
}

interface PublicRoom {
  roomId: string;
  name: string;
  topic?: string;
  numJoinedMembers: number;
  isJoined: boolean;
}

interface InvitedRoom {
  roomId: string;
  name: string;
  inviter: string;
}

interface PublicUser {
  userId: string;
  displayName?: string;
  avatarUrl?: string;
}

interface MatrixContextType {
  client: MatrixClient | null;
  isLoggedIn: boolean;
  loading: boolean;
  error: string;
  rooms: Room[];
  sortedRooms: Room[];
  publicRooms: PublicRoom[];
  invitedRooms: InvitedRoom[];
  publicUsers: PublicUser[];
  currentRoom: CurrentRoom | null;
  currentView: 'chat' | 'browse';
  messages: Message[];
  allMessages: {[roomId: string]: Message[]};
  initializeWithToken: (token: string, userId: string, baseUrl: string) => Promise<void>;
  logout: () => void;
  setError: (error: string) => void;
  setLoading: (loading: boolean) => void;
  joinRoom: (roomId: string) => Promise<void>;
  createRoom: (roomName: string) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  setCurrentRoom: (roomId: string) => void;
  leaveCurrentRoom: () => void;
  refreshPublicRooms: () => Promise<void>;
  inviteUser: (roomId: string, userId: string) => Promise<void>;
  acceptInvite: (roomId: string) => Promise<void>;
  rejectInvite: (roomId: string) => Promise<void>;
  setCurrentView: (view: 'chat' | 'browse') => void;
  searchUsers: (query: string) => Promise<PublicUser[]>;
}

const MatrixContext = createContext<MatrixContextType | undefined>(undefined);

export const useMatrix = () => {
  const context = useContext(MatrixContext);
  if (context === undefined) {
    throw new Error('useMatrix must be used within a MatrixProvider');
  }
  return context;
};

interface MatrixProviderProps {
  children: React.ReactNode;
  token?: string;
  userId?: string;
  baseUrl?: string;
}

export const MatrixProvider: React.FC<MatrixProviderProps> = ({ children, token, userId, baseUrl }) => {
  const [client, setClient] = useState<MatrixClient | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [sortedRooms, setSortedRooms] = useState<Room[]>([]);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [invitedRooms, setInvitedRooms] = useState<InvitedRoom[]>([]);
  const [publicUsers, setPublicUsers] = useState<PublicUser[]>([]);
  const [currentRoom, setCurrentRoomState] = useState<CurrentRoom | null>(null);
  const [currentView, setCurrentView] = useState<'chat' | 'browse'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [allMessages, setAllMessages] = useState<{[roomId: string]: Message[]}>({});

  const refreshPublicRoomsInternal = useCallback(async (matrixClient: MatrixClient) => {
    try {
      const response = await matrixClient.publicRooms({
        limit: 500,
        // The Matrix protocol doesn't directly support ordering by recent activity in publicRooms,
        // but we can sort the results after fetching them
      });
      const joinedRoomIds = matrixClient.getRooms().map(r => r.roomId);
      
      let publicRoomsList: PublicRoom[] = response.chunk.map((room: any) => ({
        roomId: room.room_id,
        name: room.name || room.canonical_alias || room.room_id,
        topic: room.topic,
        numJoinedMembers: room.num_joined_members || 0,
        isJoined: joinedRoomIds.includes(room.room_id)
      }));
      
      // Sort by most recent activity and member count
      publicRoomsList = publicRoomsList.sort((a, b) => {
        // First, prioritize joined rooms
        if (a.isJoined && !b.isJoined) return -1;
        if (!a.isJoined && b.isJoined) return 1;
        
        // For joined rooms, try to get actual timeline activity
        if (a.isJoined && b.isJoined) {
          const roomA = matrixClient.getRoom(a.roomId);
          const roomB = matrixClient.getRoom(b.roomId);
          
          if (roomA && roomB) {
            try {
              const aTimeline = roomA.getLiveTimeline();
              const bTimeline = roomB.getLiveTimeline();
              
              const aEvents = aTimeline.getEvents();
              const bEvents = bTimeline.getEvents();
              
              // Get the most recent message event
              const aLastMessageEvent = aEvents.reverse().find(e => e.getType() === 'm.room.message');
              const bLastMessageEvent = bEvents.reverse().find(e => e.getType() === 'm.room.message');
              
              const aTime = aLastMessageEvent ? aLastMessageEvent.getTs() : 0;
              const bTime = bLastMessageEvent ? bLastMessageEvent.getTs() : 0;
              
              if (aTime !== bTime) {
                return bTime - aTime; // Most recent first
              }
            } catch (error) {
              console.log("Error getting timeline for joined rooms:", error);
            }
          }
        }
        
        // Fallback to member count (higher member count = more activity)
        return b.numJoinedMembers - a.numJoinedMembers;
      });
      
      console.log("Public rooms found:", publicRoomsList.length);
      setPublicRooms(publicRoomsList);
    } catch (err: any) {
      console.error("Failed to fetch public rooms:", err.message);
    }
  }, []);

  const refreshPublicRooms = useCallback(async () => {
    if (!client) return;
    await refreshPublicRoomsInternal(client);
  }, [client, refreshPublicRoomsInternal]);

  const sortRoomsByActivity = useCallback((roomsList: Room[]) => {
    return [...roomsList].sort((a, b) => {
      const aTimeline = a.getLiveTimeline();
      const bTimeline = b.getLiveTimeline();
      
      const aEvents = aTimeline.getEvents();
      const bEvents = bTimeline.getEvents();
      
      const aLastEvent = aEvents.length > 0 ? aEvents[aEvents.length - 1] : null;
      const bLastEvent = bEvents.length > 0 ? bEvents[bEvents.length - 1] : null;
      
      const aTime = aLastEvent ? aLastEvent.getTs() : 0;
      const bTime = bLastEvent ? bLastEvent.getTs() : 0;
      
      return bTime - aTime; // Most recent first
    });
  }, []);

  // Update sorted rooms whenever rooms change
  useEffect(() => {
    setSortedRooms(sortRoomsByActivity(rooms));
  }, [rooms, sortRoomsByActivity]);

  const initializeWithToken = useCallback(async (accessToken: string, matrixUserId: string, matrixBaseUrl: string) => {
    setLoading(true);
    setError('');
    
    try {
      const matrixClient = createClient({
        baseUrl: matrixBaseUrl,
        userId: matrixUserId,
        deviceId: 'matrix-react-chat',
        accessToken: accessToken,
      });

      await matrixClient.startClient();
      
      // Set up message event listener
      matrixClient.on(RoomEvent.Timeline, (event: any, room: any) => {
        if (event.getType() === 'm.room.message') {
          const eventId = event.getId();
          const sender = event.getSender();
          const content = event.getContent();
          const roomId = room.roomId;
          
          const newMessage: Message = {
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
          setCurrentRoomState(prevRoom => {
            if (prevRoom?.id === roomId) {
              setMessages(prev => {
                // Check if message already exists to avoid duplicates
                if (prev.some(msg => msg.id === eventId)) {
                  return prev;
                }
                return [...prev, newMessage];
              });
            }
            return prevRoom;
          });
        }
      });
      
      setClient(matrixClient);
      setIsLoggedIn(true);
      
      matrixClient.once(ClientEvent.Sync, (state) => {
        if (state === SyncState.Prepared) {
          const rooms = matrixClient.getRooms();
          console.log("Known rooms:", rooms.length);
          setRooms(rooms);
          // Fetch public rooms after sync is complete
          refreshPublicRoomsInternal(matrixClient);
        }
      });

      // Listen for room events to update the rooms list in real-time
      matrixClient.on(ClientEvent.Room, (room: Room) => {
        console.log("New room joined/created:", room.name || room.roomId);
        setRooms(prev => {
          // Check if room already exists to avoid duplicates
          const exists = prev.some(r => r.roomId === room.roomId);
          if (exists) return prev;
          return [...prev, room];
        });
        
        // Refresh public rooms when a new room is detected
        // This will help other users see newly created public rooms
        refreshPublicRoomsInternal(matrixClient);
      });

      // Set up periodic refresh of public rooms to catch changes from other users
      const refreshInterval = setInterval(() => {
        refreshPublicRoomsInternal(matrixClient);
      }, 10000); // Refresh every 10 seconds

      // Cleanup interval when client is stopped
      const originalStop = matrixClient.stopClient.bind(matrixClient);
      matrixClient.stopClient = function() {
        clearInterval(refreshInterval);
        return originalStop();
      };

    } catch (err: any) {
      setError(`Failed to initialize client: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);


  const logout = useCallback(() => {
    if (client) {
      client.stopClient();
    }
    setClient(null);
    setIsLoggedIn(false);
    setRooms([]);
    setSortedRooms([]);
    setPublicRooms([]);
    setInvitedRooms([]);
    setPublicUsers([]);
    setCurrentView('chat');
    setError('');
    setLoading(false);
    setCurrentRoomState(null);
    setMessages([]);
    setAllMessages({});
  }, [client]);

  const joinRoom = useCallback(async (roomId: string) => {
    if (!client) return;

    setLoading(true);
    setError('');

    try {
      await client.joinRoom(roomId);
      
      // Get the room object and add it to the list if not already there
      const roomObj = client.getRoom(roomId);
      if (roomObj) {
        setRooms(prev => {
          const exists = prev.some(r => r.roomId === roomId);
          if (exists) return prev;
          return [...prev, roomObj];
        });
      }
      
      // Set the current room only after successful join
      const room = rooms.find(r => r.roomId === roomId) || roomObj;
      if (room) {
        // Try to get a proper room name, fallback to a cleaned up room ID
        let roomName = room.name;
        if (!roomName || roomName.trim() === '') {
          // If no name, use the room ID but clean it up
          // Remove the server part and leading characters to make it more readable
          roomName = roomId.replace(/^[!#]/, '').split(':')[0];
        }
        
        setCurrentRoomState({
          id: roomId,
          name: roomName
        });
      }
      
      // Load messages from allMessages state if available, otherwise get room history
      if (allMessages[roomId]) {
        setMessages(allMessages[roomId]);
      } else {
        // Get room history for first time joining
        const room = client.getRoom(roomId);
        if (room) {
          const timeline = room.getLiveTimeline();
          const events = timeline.getEvents();
          
          const roomMessages: Message[] = events
            .filter((event: any) => event.getType() === 'm.room.message')
            .map((event: any) => ({
              id: event.getId(),
              sender: event.getSender(),
              body: event.getContent().body,
              timestamp: new Date(event.getTs())
            }));
          
          setMessages(roomMessages);
          setAllMessages(prev => ({
            ...prev,
            [roomId]: roomMessages
          }));
        } else {
          setMessages([]);
        }
      }
      
      // Refresh public rooms to update join status
      await refreshPublicRoomsInternal(client);
      
    } catch (err: any) {
      setError(`Failed to join room: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [client, allMessages, rooms, refreshPublicRoomsInternal]);

  const createRoom = useCallback(async (roomName: string) => {
    if (!client || !roomName.trim()) return;

    setLoading(true);
    setError('');

    try {
      const room = await client.createRoom({
        name: roomName,
        visibility: Visibility.Public,
        preset: Preset.PublicChat,
      });
      
      // Get the actual room object from the client
      const createdRoom = client.getRoom(room.room_id);
      if (createdRoom) {
        // Add the room to the rooms list immediately
        setRooms(prev => {
          const exists = prev.some(r => r.roomId === room.room_id);
          if (exists) return prev;
          return [...prev, createdRoom];
        });
      }
      
      setCurrentRoomState({
        id: room.room_id,
        name: roomName
      });
      setMessages([]);
      
      // Refresh public rooms to show the new room
      await refreshPublicRoomsInternal(client);
      
    } catch (err: any) {
      setError(`Failed to create room: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [client, refreshPublicRoomsInternal]);

  const sendMessage = useCallback(async (messageText: string) => {
    if (!client || !currentRoom || !messageText.trim()) return;

    try {
      await client.sendTextMessage(currentRoom.id, messageText);
    } catch (err: any) {
      setError(`Failed to send message: ${err.message}`);
    }
  }, [client, currentRoom]);

  const setCurrentRoom = useCallback((roomId: string) => {
    const room = rooms.find(r => r.roomId === roomId);
    if (room) {
      // Try to get a proper room name, fallback to a cleaned up room ID
      let roomName = room.name;
      if (!roomName || roomName.trim() === '') {
        // If no name, use the room ID but clean it up
        // Remove the server part and leading characters to make it more readable
        roomName = roomId.replace(/^[!#]/, '').split(':')[0];
      }
      
      setCurrentRoomState({
        id: roomId,
        name: roomName
      });
      
      // Load messages for the room
      if (allMessages[roomId]) {
        setMessages(allMessages[roomId]);
      } else {
        setMessages([]);
      }
    }
  }, [allMessages, rooms]);

  const leaveCurrentRoom = useCallback(() => {
    setCurrentRoomState(null);
    setMessages([]);
  }, []);

  const inviteUser = useCallback(async (roomId: string, userId: string) => {
    if (!client) return;
    try {
      await client.invite(roomId, userId);
    } catch (err: any) {
      setError(`Failed to invite user: ${err.message}`);
    }
  }, [client]);

  const acceptInvite = useCallback(async (roomId: string) => {
    if (!client) return;
    try {
      await client.joinRoom(roomId);
      // Remove from invited rooms and add to regular rooms
      setInvitedRooms(prev => prev.filter(r => r.roomId !== roomId));
      const room = client.getRoom(roomId);
      if (room) {
        setRooms(prev => [...prev, room]);
      }
    } catch (err: any) {
      setError(`Failed to accept invite: ${err.message}`);
    }
  }, [client]);

  const rejectInvite = useCallback(async (roomId: string) => {
    if (!client) return;
    try {
      await client.leave(roomId);
      setInvitedRooms(prev => prev.filter(r => r.roomId !== roomId));
    } catch (err: any) {
      setError(`Failed to reject invite: ${err.message}`);
    }
  }, [client]);

  const searchUsers = useCallback(async (query: string): Promise<PublicUser[]> => {
    if (!client || !query.trim()) return [];
    try {
      const response = await client.searchUserDirectory({ term: query });
      return response.results.map((user: any) => ({
        userId: user.user_id,
        displayName: user.display_name,
        avatarUrl: user.avatar_url
      }));
    } catch (err: any) {
      console.error("Failed to search users:", err.message);
      return [];
    }
  }, [client]);

  // Initialize with token if provided via props
  useEffect(() => {
    if (token && userId && baseUrl && !isLoggedIn) {
      initializeWithToken(token, userId, baseUrl);
    }
  }, [token, userId, baseUrl, isLoggedIn, initializeWithToken]);

  const value: MatrixContextType = {
    client,
    isLoggedIn,
    loading,
    error,
    rooms,
    sortedRooms,
    publicRooms,
    invitedRooms,
    publicUsers,
    currentRoom,
    currentView,
    messages,
    allMessages,
    initializeWithToken,
    logout,
    setError,
    setLoading,
    joinRoom,
    createRoom,
    sendMessage,
    setCurrentRoom,
    leaveCurrentRoom,
    refreshPublicRooms,
    inviteUser,
    acceptInvite,
    rejectInvite,
    setCurrentView,
    searchUsers,
  };

  return (
    <MatrixContext.Provider value={value}>
      {children}
    </MatrixContext.Provider>
  );
};