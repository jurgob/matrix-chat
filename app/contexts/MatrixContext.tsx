import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient, MatrixClient, RoomEvent, Room, ClientEvent, SyncState } from 'matrix-js-sdk';

interface Message {
  id: string;
  sender: string;
  body: string;
  timestamp: Date;
}

interface MatrixContextType {
  client: MatrixClient | null;
  isLoggedIn: boolean;
  loading: boolean;
  error: string;
  rooms: Room[];
  currentRoom: string;
  messages: Message[];
  allMessages: {[roomId: string]: Message[]};
  login: (username: string, password: string, matrixBaseUrl: string, matrixHomeserver: string) => Promise<void>;
  register: (username: string, password: string, matrixBaseUrl: string, matrixHomeserver: string) => Promise<void>;
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
}

export const MatrixProvider: React.FC<MatrixProviderProps> = ({ children }) => {
  const [client, setClient] = useState<MatrixClient | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoomState] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [allMessages, setAllMessages] = useState<{[roomId: string]: Message[]}>({});

  const performRegistration = async (user: string, pass: string, baseUrl: string, homeserver: string) => {
    try {
      const matrixClient = createClient({
        baseUrl: baseUrl,
      });

      await matrixClient.register(user, pass, null, { type: 'm.login.dummy' });
      
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
        password: userPassword,
      });

      matrixClient.setAccessToken(loginResponse.access_token);      
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
            if (prevRoom === roomId) {
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
      setError(`Login failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const register = useCallback(async (username: string, password: string, matrixBaseUrl: string, matrixHomeserver: string) => {
    setLoading(true);
    setError('');
    await performRegistration(username, password, matrixBaseUrl, matrixHomeserver);
  }, []);

  const login = useCallback(async (username: string, password: string, matrixBaseUrl: string, matrixHomeserver: string) => {
    setLoading(true);
    setError('');
    const userId = `@${username}:${matrixHomeserver}`;
    await performLogin(userId, password, matrixBaseUrl);
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
    setCurrentRoomState('');
    setMessages([]);
    setAllMessages({});
    
    localStorage.clear();
    window.location.reload();
  }, [client]);

  const joinRoom = useCallback(async (roomId: string) => {
    if (!client) return;

    setLoading(true);
    setError('');

    try {
      await client.joinRoom(roomId);
      
      // Set the current room only after successful join
      setCurrentRoomState(roomId);
      
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
        visibility: 'public',
        preset: 'public_chat',
      });
      
      setCurrentRoomState(room.room_id);
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
      await client.sendTextMessage(currentRoom, messageText);
    } catch (err: any) {
      setError(`Failed to send message: ${err.message}`);
    }
  }, [client, currentRoom]);

  const setCurrentRoom = useCallback((roomId: string) => {
    setCurrentRoomState(roomId);
    
    // Load messages for the room
    if (allMessages[roomId]) {
      setMessages(allMessages[roomId]);
    } else {
      setMessages([]);
    }
  }, [allMessages]);

  const leaveCurrentRoom = useCallback(() => {
    setCurrentRoomState('');
    setMessages([]);
  }, []);

  const value: MatrixContextType = {
    client,
    isLoggedIn,
    loading,
    error,
    rooms,
    currentRoom,
    messages,
    allMessages,
    login,
    register,
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