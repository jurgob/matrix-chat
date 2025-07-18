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

interface MatrixContextType {
  client: MatrixClient | null;
  isLoggedIn: boolean;
  loading: boolean;
  error: string;
  rooms: Room[];
  currentRoom: CurrentRoom | null;
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
  const [currentRoom, setCurrentRoomState] = useState<CurrentRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [allMessages, setAllMessages] = useState<{[roomId: string]: Message[]}>({});


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
        }
      });

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
      
      // Set the current room only after successful join
      const room = rooms.find(r => r.roomId === roomId);
      if (room) {
        setCurrentRoomState({
          id: roomId,
          name: room.name || roomId
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
      
    } catch (err: any) {
      setError(`Failed to join room: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [client, allMessages]);

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
      
      setCurrentRoomState({
        id: room.room_id,
        name: roomName
      });
      setMessages([]);
      
    } catch (err: any) {
      setError(`Failed to create room: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [client]);

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
      setCurrentRoomState({
        id: roomId,
        name: room.name || roomId
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
    currentRoom,
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
  };

  return (
    <MatrixContext.Provider value={value}>
      {children}
    </MatrixContext.Provider>
  );
};