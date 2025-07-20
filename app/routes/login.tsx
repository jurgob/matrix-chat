import type { Route } from "./+types/login";
import { useState } from 'react';
import { Form, redirect, createCookie } from 'react-router';
import ErrorMessage from '../components/ErrorMessage';

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

export async function loader({ request }: Route.LoaderArgs) {
  const token = await matrixTokenCookie.parse(request.headers.get('Cookie'));
  const userId = await matrixUserIdCookie.parse(request.headers.get('Cookie'));
  
  // If user already has valid cookies, redirect to home
  if (token && userId) {
    throw redirect('/');
  }
  
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;
  const intent = formData.get('intent') as string;
  
  const matrixBaseUrl = process.env.MATRIX_BASE_URL || 'http://localhost:6167';

  try {
    if (intent === 'register') {
      // First, make an initial registration request to get the session
      const initialResponse = await fetch(`${matrixBaseUrl}/_matrix/client/v3/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username,
          password: password,
        }),
      });

      const initialData = await initialResponse.json();

      if (initialResponse.status === 401 && initialData.session) {
        // UIAA challenge received, complete with registration token
        const authResponse = await fetch(`${matrixBaseUrl}/_matrix/client/v3/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: username,
            password: password,
            auth: {
              type: 'm.login.registration_token',
              session: initialData.session,
              token: 'dev-token-123',
            },
          }),
        });

        const authData = await authResponse.json();

        if (authResponse.ok) {
          // Set cookies using React Router's cookie helpers
          const headers = new Headers();
          headers.append('Set-Cookie', await matrixTokenCookie.serialize(authData.access_token));
          headers.append('Set-Cookie', await matrixUserIdCookie.serialize(authData.user_id));
          headers.append('Set-Cookie', await matrixBaseUrlCookie.serialize(matrixBaseUrl));
          
          return redirect('/', { headers });
        } else {
          return { error: authData.error || 'Registration failed' };
        }
      } else if (initialResponse.ok) {
        // Registration succeeded without UIAA
        const headers = new Headers();
        headers.append('Set-Cookie', await matrixTokenCookie.serialize(initialData.access_token));
        headers.append('Set-Cookie', await matrixUserIdCookie.serialize(initialData.user_id));
        headers.append('Set-Cookie', await matrixBaseUrlCookie.serialize(matrixBaseUrl));
        
        return redirect('/', { headers });
      } else {
        return { error: initialData.error || 'Registration failed' };
      }
    } else {
      // Login
      const response = await fetch(`${matrixBaseUrl}/_matrix/client/v3/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'm.login.password',
          user: username,
          password: password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Set cookies using React Router's cookie helpers
        const headers = new Headers();
        headers.append('Set-Cookie', await matrixTokenCookie.serialize(data.access_token));
        headers.append('Set-Cookie', await matrixUserIdCookie.serialize(data.user_id));
        headers.append('Set-Cookie', await matrixBaseUrlCookie.serialize(matrixBaseUrl));
        
        return redirect('/', { headers });
      } else {
        return { error: data.error || 'Login failed' };
      }
    }
  } catch (err) {
    return { error: 'Network error occurred' };
  }
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Login - Matrix Chat" },
    { name: "description", content: "Login or register for Matrix Chat" },
  ];
}


export default function Login({ actionData }: Route.ComponentProps) {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">Matrix Chat</h1>
        
        {actionData?.error && <ErrorMessage message={actionData.error} />}
        
        <Form method="post" className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div className="flex space-x-4">
            <button
              type="submit"
              name="intent"
              value="login"
              className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
            >
              Login
            </button>
            
            <button
              type="submit"
              name="intent"
              value="register"
              className="flex-1 bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600"
            >
              Register
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}