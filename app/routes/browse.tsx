import type { Route } from "./+types/browse";
import { useLoaderData, useSearchParams, Form, Link, useNavigation } from 'react-router';
import { redirect, createCookie } from 'react-router';

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

interface PublicRoom {
  roomId: string;
  name: string;
  topic?: string;
  numJoinedMembers: number;
  isJoined: boolean;
}

interface BrowseData {
  publicRooms: PublicRoom[];
  filter: string;
  pageTitle: string;
}

export async function loader({ request }: Route.LoaderArgs): Promise<BrowseData> {
  const url = new URL(request.url);
  const filter = url.searchParams.get('filter') || '';
  
  // Get Matrix credentials from cookies
  const token = await matrixTokenCookie.parse(request.headers.get('Cookie'));
  const baseUrl = await matrixBaseUrlCookie.parse(request.headers.get('Cookie'));
  
  if (!token || !baseUrl) {
    throw new Error('Authentication required');
  }

  try {
    // Fetch public rooms from Matrix API
    const publicRoomsUrl = `${baseUrl}/_matrix/client/v3/publicRooms`;
    const requestBody = filter ? { 
      filter: { 
        generic_search_term: filter 
      },
      limit: 100
    } : { limit: 100 };

    const publicRoomsResponse = await fetch(publicRoomsUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!publicRoomsResponse.ok) {
      throw new Error('Failed to fetch public rooms');
    }

    const publicRoomsData = await publicRoomsResponse.json();

    // Fetch user's joined rooms to filter them out
    const joinedRoomsResponse = await fetch(`${baseUrl}/_matrix/client/v3/joined_rooms`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const joinedRoomsData = joinedRoomsResponse.ok ? await joinedRoomsResponse.json() : { joined_rooms: [] };
    const joinedRoomIds = new Set(joinedRoomsData.joined_rooms || []);

    // Convert Matrix API response to our interface format and filter out joined rooms
    const publicRooms: PublicRoom[] = (publicRoomsData.chunk || [])
      .filter((room: any) => !joinedRoomIds.has(room.room_id))
      .map((room: any) => ({
        roomId: room.room_id,
        name: room.name || room.canonical_alias || room.room_id,
        topic: room.topic,
        numJoinedMembers: room.num_joined_members || 0,
        isJoined: false
      }));

    return { 
      publicRooms, 
      filter,
      pageTitle: 'Browse Conversations And People'
    };
  } catch (error) {
    console.error('Error fetching public rooms:', error);
    // Return empty list on error
    return { 
      publicRooms: [], 
      filter,
      pageTitle: 'Browse Conversations And People'
    };
  }
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const actionType = formData.get('action') as string;
  const roomId = formData.get('roomId') as string;
  
  if (actionType === 'join' && roomId) {
    // Get Matrix credentials from cookies
    const token = await matrixTokenCookie.parse(request.headers.get('Cookie'));
    const baseUrl = await matrixBaseUrlCookie.parse(request.headers.get('Cookie'));
    
    if (!token || !baseUrl) {
      throw new Error('Authentication required');
    }

    try {
      // Join room via Matrix API
      const joinResponse = await fetch(`${baseUrl}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (joinResponse.ok) {
        // Redirect to the room after joining
        return redirect(`/room/${roomId}`);
      } else {
        const errorData = await joinResponse.json();
        console.error('Failed to join room:', errorData);
        return { error: errorData.error || 'Failed to join room' };
      }
    } catch (error) {
      console.error('Error joining room:', error);
      return { error: 'Network error occurred' };
    }
  }

  return null;
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Browse - Matrix Chat" },
    { name: "description", content: "Browse public rooms and users" },
  ];
}

export default function Browse() {
  const { publicRooms, filter } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="p-6 border-b bg-gray-50">        
        {/* Search Filter */}
        <div className="mb-4">
          <div className="flex gap-2 w-full max-w-md">
            <Form method="get" className="flex-1 flex">
              <input
                type="text"
                name="filter"
                defaultValue={filter}
                placeholder="Filter rooms..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white border border-blue-500 rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Search Rooms"
              >
                {navigation.state === 'loading' ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m100 50 A 40 40 0 0 1 60 90 A 40 40 0 0 1 20 50 A 40 40 0 0 1 60 10 A 40 40 0 0 1 100 50 z"></path>
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </button>
            </Form>
            <button
              type="button"
              onClick={() => window.location.href = '/browse'}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              View All
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Public Rooms</h2>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {publicRooms.map((room) => (
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
                    {room.isJoined ? (
                      <Link
                        to={`/room/${room.roomId}`}
                        className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
                      >
                        View
                      </Link>
                    ) : (
                      <Form method="post">
                        <input type="hidden" name="action" value="join" />
                        <input type="hidden" name="roomId" value={room.roomId} />
                        <button
                          type="submit"
                          className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
                        >
                          Join
                        </button>
                      </Form>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {publicRooms.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">
                {filter ? 'No rooms match your search.' : 'No public rooms available.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}