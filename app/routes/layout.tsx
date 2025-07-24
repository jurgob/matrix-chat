import type { Route } from "./+types/layout";
import { Outlet, Link, useLoaderData, Form, useLocation, useMatches } from 'react-router';
import { redirect, createCookie } from 'react-router';
import { Room } from 'matrix-js-sdk';

// Cookie definitions
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

interface LayoutData {
  token: string;
  userId: string;
  baseUrl: string;
  rooms: Array<{
    id: string;
    name: string;
  }>;
}

export async function loader({ request }: Route.LoaderArgs): Promise<LayoutData> {
  console.log('Layout loader called');
  const token = await matrixTokenCookie.parse(request.headers.get('Cookie'));
  const userId = await matrixUserIdCookie.parse(request.headers.get('Cookie'));
  const baseUrl = await matrixBaseUrlCookie.parse(request.headers.get('Cookie'));
  
  console.log('Layout loader called with token:', token, 'userId:', userId, 'baseUrl:', baseUrl);
  if (!token || !userId || !baseUrl) {
    throw redirect('/login');
  }

  // Fetch joined rooms from Matrix API
  try {
    const response = await fetch(`${baseUrl}/_matrix/client/v3/joined_rooms`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Matrix API error: ${response.status}`);
    }

    const data = await response.json();
    const roomIds = data.joined_rooms || [];

    // For each room, get the room name
    const rooms: Array<{ id: string; name: string }> = await Promise.all(
      roomIds.map(async (roomId: string) => {
        try {
          // Fetch room name from state
          const stateResponse = await fetch(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.name`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          let roomName = '';
          if (stateResponse.ok) {
            const nameData = await stateResponse.json();
            roomName = nameData.name || '';
          }

          // Fallback to cleaned room ID if no name
          if (!roomName) {
            roomName = roomId.replace(/^[!#]/, '').split(':')[0];
          }

          return { id: roomId, name: roomName };
        } catch (error) {
          console.error(`Failed to get name for room ${roomId}:`, error);
          return { 
            id: roomId, 
            name: roomId.replace(/^[!#]/, '').split(':')[0] 
          };
        }
      })
    );

    return { token, userId, baseUrl, rooms };
  } catch (error) {
    console.error('Failed to fetch rooms from Matrix API:', error);
    // Return empty rooms list on error, but don't break the app
    return { token, userId, baseUrl, rooms: [] };
  }
}

export async function action({ request }: Route.ActionArgs) {
  console.log('Layout action called');
  const token = await matrixTokenCookie.parse(request.headers.get('Cookie'));
  const baseUrl = await matrixBaseUrlCookie.parse(request.headers.get('Cookie'));
  
  if (!token || !baseUrl) {
    throw redirect('/login');
  }

  const formData = await request.formData();
  const action = formData.get('action') as string;
  const roomName = formData.get('roomName') as string;

  if (action === 'create-room' && roomName?.trim()) {
    try {
      // Create room via Matrix API
      const response = await fetch(`${baseUrl}/_matrix/client/v3/createRoom`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: roomName.trim(),
          visibility: 'public',
          preset: 'public_chat',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create room: ${error}`);
      }

      const data = await response.json();
      const roomId = data.room_id;

      // Explicitly publish the room to the public directory
      try {
        await fetch(`${baseUrl}/_matrix/client/v3/directory/list/room/${encodeURIComponent(roomId)}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ visibility: 'public' }),
        });
      } catch (error) {
        console.warn('Failed to publish room to directory:', error);
        // Don't fail the room creation if directory publishing fails
      }

      // Redirect to the newly created room
      return redirect(`/room/${roomId}`);
    } catch (error) {
      console.error('Room creation failed:', error);
      // Return error - we could enhance this with proper error handling
      return { error: 'Failed to create room' };
    }
  }

  return null;
}

export default function Layout() {
  const { userId, rooms } = useLoaderData<typeof loader>();
  const matches = useMatches();
  const location = useLocation();
  
  // Get the title from the current child route
  const getCurrentTitle = () => {
    const currentMatch = matches[matches.length - 1];
    const data = currentMatch?.data as any;
    return data?.pageTitle || 'Matrix Chat';
  };
  
  return (
    <div className="h-screen bg-gray-100 flex">
      {/* Discord-like Sidebar */}
      <div className="w-64 bg-gray-800 text-white flex flex-col h-screen">
        {/* Logo */}
        <div className="p-4 border-b border-gray-700">
          <Link
            to="/"
            className="flex items-center space-x-3 hover:bg-gray-700 p-2 rounded-md transition-colors"
          >
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <span className="text-xl font-bold">Matrix Chat</span>
          </Link>
        </div>

        {/* Browse Link */}
        <div className="p-4 border-b border-gray-700">
          <Link
            to="/browse"
            className="w-full bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium flex items-center justify-center p-2"
          >
            <span className="px-2 text-lg">🔍</span>
            <span className='border-l border-indigo-900 pl-5 text-left'>Browse Conversations And Users</span>
          </Link>
        </div>

        {/* Create Room Form */}
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-sm font-semibold mb-3 text-gray-300">CREATE ROOM</h2>
          <Form method="post" action="/createroom" className="space-y-2">
            <input
              type="text"
              name="roomName"
              placeholder="Enter room name"
              required
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <input type="hidden" name="visibility" value="public" />
            <button
              type="submit"
              className="w-full bg-green-600 text-white py-2 px-3 rounded-md hover:bg-green-700 text-sm font-medium"
            >
              Create Room
            </button>
          </Form>
        </div>

        {/* Joined Conversations */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-semibold mb-3 text-gray-300">
              CONVERSATIONS ({rooms.length})
            </h3>
            <div className="space-y-1 mb-6">
              {rooms.map((room) => (
                <Link
                  key={room.id}
                  to={`/room/${room.id}`}
                  className="w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-300 hover:bg-gray-700 hover:text-white block"
                >
                  # {room.name}
                </Link>
              ))}
              {rooms.length === 0 && (
                <p className="text-gray-400 text-sm italic">No conversations yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm p-4 border-b">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold">
              <Link 
                to={location.pathname + location.search} 
                reloadDocument
                className="text-xl font-bold hover:text-gray-700 transition-colors"
              >
                {getCurrentTitle()}
              </Link>
            </h1>
            <div className="flex flex-col items-end space-y-1">
              <div className="text-sm text-gray-600">
                {userId}
              </div>
              <Link
                to="/logout"
                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
              >
                Logout
              </Link>
            </div>
          </div>
        </header>

        {/* Content */}
        <Outlet />
      </div>
    </div>
  );
}