import type { Route } from "./+types/health";

export async function loader({ request }: Route.LoaderArgs) {
  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "matrix-chat"
  };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Health Check - Matrix Chat" },
    { name: "description", content: "Health check endpoint for Matrix Chat" },
  ];
}

export default function Health({ loaderData }: Route.ComponentProps) {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-md text-center">
        <div className="mb-4">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-green-600 mb-2">Service Healthy</h1>
          <p className="text-gray-600 mb-4">{loaderData.service}</p>
        </div>
        
        <div className="space-y-2 text-sm text-gray-500">
          <div>
            <span className="font-medium">Status:</span> {loaderData.status}
          </div>
          <div>
            <span className="font-medium">Timestamp:</span> {loaderData.timestamp}
          </div>
        </div>
      </div>
    </div>
  );
}