import type { Route } from "./+types/logout";
import { redirect } from 'react-router';

export async function loader({ request }: Route.LoaderArgs) {
  // Clear all Matrix-related cookies by setting them to expire
  return redirect('/login', {
    headers: {
      'Set-Cookie': [
        'matrix_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; HttpOnly; Secure; SameSite=Strict',
        'matrix_user_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; HttpOnly; Secure; SameSite=Strict',
        'matrix_base_url=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; HttpOnly; Secure; SameSite=Strict'
      ].join(', ')
    }
  });
}

// This component should never render since the loader always redirects
export default function Logout() {
  return null;
}