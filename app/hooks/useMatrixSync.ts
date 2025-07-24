import { useState, useEffect, useRef, useCallback } from 'react';

interface MatrixEvent {
  event_id: string;
  type: string;
  sender: string;
  origin_server_ts: number;
  content: any;
}

interface Message {
  id: string;
  sender: string;
  body: string;
  timestamp: Date;
}

interface SyncResponse {
  next_batch: string;
  rooms?: {
    join?: {
      [roomId: string]: {
        timeline?: {
          events: MatrixEvent[];
        };
      };
    };
  };
}

interface UseMatrixSyncOptions {
  roomId: string;
  initialEvents: Message[];
  token: string;
  baseUrl: string;
}

export function useMatrixSync({ roomId, initialEvents, token, baseUrl }: UseMatrixSyncOptions) {
  const [messages, setMessages] = useState<Message[]>(initialEvents);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const nextBatchRef = useRef<string | null>(null);
  const isRunningRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const convertEventToMessage = useCallback((event: MatrixEvent): Message | null => {
    if (event.type !== 'm.room.message' || !event.content?.body) {
      return null;
    }

    return {
      id: event.event_id,
      sender: event.sender,
      body: event.content.body,
      timestamp: new Date(event.origin_server_ts)
    };
  }, []);

  const performSync = useCallback(async (since?: string): Promise<void> => {
    if (!token || !baseUrl) {
      setError('Missing authentication credentials');
      return;
    }

    try {
      const syncUrl = new URL(`${baseUrl}/_matrix/client/v3/sync`);
      syncUrl.searchParams.set('timeout', '30000'); // 30 second long polling
      syncUrl.searchParams.set('filter', JSON.stringify({
        room: {
          rooms: [roomId], // Only sync the specific room
          timeline: {
            limit: 10
          }
        }
      }));
      
      if (since) {
        syncUrl.searchParams.set('since', since);
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch(syncUrl.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Authentication failed');
          return;
        }
        throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
      }

      const syncData: SyncResponse = await response.json();
      
      // Update next batch token
      nextBatchRef.current = syncData.next_batch;

      // Process room events
      const roomData = syncData.rooms?.join?.[roomId];
      if (roomData?.timeline?.events) {
        const newMessages = roomData.timeline.events
          .map(convertEventToMessage)
          .filter((msg): msg is Message => msg !== null);

        if (newMessages.length > 0) {
          setMessages(prev => {
            // Deduplicate messages by ID
            const existingIds = new Set(prev.map(msg => msg.id));
            const uniqueNewMessages = newMessages.filter(msg => !existingIds.has(msg.id));
            
            if (uniqueNewMessages.length === 0) {
              return prev;
            }

            // Add new messages and sort by timestamp
            const combined = [...prev, ...uniqueNewMessages];
            return combined.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
          });
        }
      }

      setError(null);
      setIsConnected(true);
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          // Sync was cancelled, not an error
          return;
        }
        console.error('Sync error:', err.message);
        setError(err.message);
      } else {
        console.error('Unknown sync error:', err);
        setError('Unknown sync error');
      }
      setIsConnected(false);
    }
  }, [token, baseUrl, roomId, convertEventToMessage]);

  const startSync = useCallback(async () => {
    if (isRunningRef.current) {
      return;
    }

    isRunningRef.current = true;
    setError(null);

    // Initial sync without since token
    await performSync();

    // Continue syncing with long polling
    while (isRunningRef.current) {
      try {
        await performSync(nextBatchRef.current || undefined);
        
        // Small delay before next sync if we don't have a next_batch token
        if (!nextBatchRef.current) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (err) {
        console.error('Sync loop error:', err);
        // Wait before retrying on error
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }, [performSync]);

  const stopSync = useCallback(() => {
    isRunningRef.current = false;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Start sync when component mounts and dependencies change
  useEffect(() => {
    if (!token || !baseUrl || !roomId) {
      return;
    }

    startSync();

    return () => {
      stopSync();
    };
  }, [token, baseUrl, roomId, startSync, stopSync]);

  // Update messages when initialEvents change
  useEffect(() => {
    setMessages(initialEvents);
  }, [initialEvents]);

  return {
    messages,
    isConnected,
    error,
    refresh: () => performSync(nextBatchRef.current || undefined)
  };
}