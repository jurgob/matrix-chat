import type { Route } from "./+types/room";
import { useLoaderData, Form, useNavigation, useActionData } from 'react-router';
import { redirect, createCookie } from 'react-router';
import { useState, useEffect } from 'react';
import { useMatrixSync } from '../hooks/useMatrixSync';

// Cookie definitions
const matrixTokenCookie = createCookie("matrix_token", {
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

interface Message {
  id: string;
  sender: string;
  body: string;
  timestamp: Date;
}

interface RoomData {
  room: {
    id: string;
    name: string;
  };
  messages: Message[];
  pageTitle: string;
  matrixConfig: {
    token: string;
    baseUrl: string;
  };
}

export async function loader({ params, request }: Route.LoaderArgs): Promise<RoomData> {
  const { roomId } = params;
  const token = await matrixTokenCookie.parse(request.headers.get('Cookie'));
  const baseUrl = await matrixBaseUrlCookie.parse(request.headers.get('Cookie'));
  
  if (!roomId) {
    throw redirect('/');
  }

  if (!token || !baseUrl) {
    throw redirect('/login');
  }

  // Fetch room name from Matrix API
  let roomName = '';
  try {
    const stateResponse = await fetch(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.name`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (stateResponse.ok) {
      const nameData = await stateResponse.json();
      roomName = nameData.name || '';
    }

    // Fallback to cleaned room ID if no name
    if (!roomName) {
      roomName = roomId.replace(/^[!#]/, '').split(':')[0];
    }
  } catch (error) {
    console.error(`Failed to get name for room ${roomId}:`, error);
    roomName = roomId.replace(/^[!#]/, '').split(':')[0];
  }

  const room = {
    id: roomId,
    name: roomName
  };

  // Fetch messages from Matrix API
  let messages: Message[] = [];
  try {
    const messagesResponse = await fetch(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=50`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (messagesResponse.ok) {
      const messagesData = await messagesResponse.json();
      messages = messagesData.chunk
        .filter((event: any) => event.type === 'm.room.message')
        .reverse() // Reverse to show oldest first
        .map((event: any) => ({
          id: event.event_id,
          sender: event.sender,
          body: event.content.body,
          timestamp: new Date(event.origin_server_ts)
        }));
    }
  } catch (error) {
    console.error(`Failed to fetch messages for room ${roomId}:`, error);
    messages = [];
  }

  return { 
    room, 
    messages, 
    pageTitle: `# ${roomName}`,
    matrixConfig: {
      token,
      baseUrl
    }
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { roomId } = params;
  const token = await matrixTokenCookie.parse(request.headers.get('Cookie'));
  const baseUrl = await matrixBaseUrlCookie.parse(request.headers.get('Cookie'));
  const formData = await request.formData();
  const message = formData.get('message') as string;

  if (!message?.trim() || !roomId) {
    return { messageText: message || '', error: null };
  }

  if (!token || !baseUrl) {
    throw redirect('/login');
  }

  try {
    // Generate a transaction ID for the message
    const txnId = `m${Date.now()}`;
    
    // Send message via Matrix API
    const response = await fetch(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msgtype: 'm.text',
        body: message.trim()
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Failed to send message:', errorData);
      return { 
        messageText: message, // Keep the message text on error
        error: 'Failed to send message' 
      };
    }

    console.log(`Message sent successfully to room ${roomId}`);
    
    // Success: return empty message text to clear the input
    return { 
      messageText: '', 
      error: null 
    };
  } catch (error) {
    console.error('Error sending message:', error);
    return { 
      messageText: message, // Keep the message text on error
      error: 'Failed to send message' 
    };
  }
}

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `Room ${params.roomId?.slice(-8)} - Matrix Chat` },
    { name: "description", content: "Matrix chat room" },
  ];
}

export default function Room() {
  const { room, messages: initialMessages, matrixConfig } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const isSubmitting = navigation.state === 'submitting';
  const [messageText, setMessageText] = useState('');

  // Use Matrix sync hook for real-time updates
  const { messages, isConnected, error: syncError } = useMatrixSync({
    roomId: room.id,
    initialEvents: initialMessages,
    token: matrixConfig.token,
    baseUrl: matrixConfig.baseUrl
  });

  // Sync with action data - clear on success, restore on error
  useEffect(() => {
    if (actionData?.messageText !== undefined) {
      setMessageText(actionData.messageText);
    }
  }, [actionData]);

  return (
    <div className="flex-1 flex flex-col">
      {/* Room header - title will be set by layout */}
      <div className="hidden">
        <h1>#{room.name}</h1>
      </div>

      {/* Connection Status */}
      <div className="px-4 py-2 bg-gray-50 border-b text-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {syncError && (
            <span className="text-red-600 text-xs">
              Sync error: {syncError}
            </span>
          )}
        </div>
      </div>

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
        {messages.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No messages yet. Start the conversation!</p>
          </div>
        )}
      </div>
      
      {/* Message Input */}
      <div className="p-4 border-t bg-white">
        {actionData?.error && (
          <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{actionData.error}</p>
          </div>
        )}
        <Form method="post" className="flex space-x-2">
          <input type="hidden" name="roomName" value={room.name} />
          <input
            name="message"
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder={`Message # ${room.name}`}
            aria-label="Message input"
            required
            disabled={isSubmitting}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Sending...' : 'Send'}
          </button>
        </Form>
      </div>
    </div>
  );
}