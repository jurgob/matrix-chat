import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  layout("routes/layout.tsx", [
    index("routes/home.tsx"),
    route("/browse", "routes/browse.tsx"),
    route("/room/:roomId", "routes/room.tsx"),
    route("/createroom", "routes/createroom.tsx"),
  ]),
  route("/login", "routes/login.tsx"),
  route("/logout", "routes/logout.tsx"),
  route("/health", "routes/health.tsx")
] satisfies RouteConfig;
