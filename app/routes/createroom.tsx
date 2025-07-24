import type { Route } from "./+types/createroom";
import { Form, useActionData, useNavigation } from 'react-router';
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

interface ActionData {
  error?: string;
}

interface LoaderData {
  pageTitle: string;
}

export async function loader({ request }: Route.LoaderArgs): Promise<LoaderData> {
  return {
    pageTitle: 'Create New Room'
  };
}

export async function action({ request }: Route.ActionArgs): Promise<ActionData | Response> {
  const token = await matrixTokenCookie.parse(request.headers.get('Cookie'));
  const baseUrl = await matrixBaseUrlCookie.parse(request.headers.get('Cookie'));
  
  // if (!token || !baseUrl) {
  //   throw redirect('/login');
  // }

  const formData = await request.formData();
  const roomName = formData.get('roomName') as string;
  const roomTopic = formData.get('roomTopic') as string;
  const isPublic = formData.get('visibility') === 'public';

  if (!roomName?.trim()) {
    return { error: 'Room name is required' };
  }

  try {
    // Create room via Matrix API
    const body = {
      name: roomName.trim(),
      topic: roomTopic?.trim() || undefined,
      visibility: isPublic ? 'public' : 'private',
      preset: isPublic ? 'public_chat' : 'private_chat',
      // Additional room settings
      initial_state: [
        {
          type: 'm.room.history_visibility',
          content: {
            history_visibility: isPublic ? 'world_readable' : 'shared'
          }
        }
      ]
    }
    console.log('Creating room with body:', body);  
    const response = await fetch(`${baseUrl}/_matrix/client/v3/createRoom`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
      return { error: `Failed to create room: ${errorMessage}` };
    }

    const data = await response.json();
    const roomId = data.room_id;

    // Redirect to the newly created room
    throw redirect(`/room/${roomId}`);
  } catch (error) {
    console.error('Room creation failed:', error);
    if (error instanceof Response) {
      throw error; // Re-throw redirects
    }
    return { error: 'Failed to create room. Please try again.' };
  }
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Create Room - Matrix Chat" },
    { name: "description", content: "Create a new Matrix chat room" },
  ];
}

export default function CreateRoom() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="p-6 border-b bg-gray-50">
        <h1 className="text-2xl font-bold mb-2">Create New Room</h1>
        <p className="text-gray-600">Set up a new chat room for your community</p>
      </div>

      {/* Form */}
      <div className="flex-1 p-6">
        <div className="max-w-md mx-auto">
          <Form method="post" className="space-y-6">
            {/* Room Name */}
            <div>
              <label htmlFor="roomName" className="block text-sm font-medium text-gray-700 mb-2">
                Room Name *
              </label>
              <input
                type="text"
                id="roomName"
                name="roomName"
                required
                placeholder="e.g. General Discussion"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>

            {/* Room Topic */}
            <div>
              <label htmlFor="roomTopic" className="block text-sm font-medium text-gray-700 mb-2">
                Room Topic (Optional)
              </label>
              <textarea
                id="roomTopic"
                name="roomTopic"
                rows={3}
                placeholder="Describe what this room is for..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>

            {/* Visibility */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Room Visibility
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="visibility"
                    value="public"
                    defaultChecked
                    className="mr-2"
                    disabled={isSubmitting}
                  />
                  <span className="text-sm">
                    <strong>Public</strong> - Anyone can find and join this room
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="visibility"
                    value="private"
                    className="mr-2"
                    disabled={isSubmitting}
                  />
                  <span className="text-sm">
                    <strong>Private</strong> - Only invited users can join
                  </span>
                </label>
              </div>
            </div>

            {/* Error Display */}
            {actionData?.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{actionData.error}</p>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed font-medium"
              >
                {isSubmitting ? 'Creating Room...' : 'Create Room'}
              </button>
              <a
                href="/browse"
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium text-center"
              >
                Cancel
              </a>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
}