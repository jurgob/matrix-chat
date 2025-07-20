import { type RouteConfig, index, route } from "@react-router/dev/routes";

import "./config"; // This will validate config on app startup

export default [
  index("routes/home.tsx"),
  route("/login", "routes/login.tsx"),
  route("/logout", "routes/logout.tsx"),
  route("/health", "routes/health.tsx")
] satisfies RouteConfig;
