import type { Route } from "./+types/home";
import { Link, } from 'react-router';


export default function Home() {
  return (
    <div className="p-5">
      <h1>Welcome to Matrix Chat</h1>
      <p>A minimal Matrix chat application.</p>
      <Link to="/browse">Browse Rooms</Link>
    </div>
  );
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Matrix Chat" },
    { name: "description", content: "Minimal Matrix chat application" },
  ];
}

