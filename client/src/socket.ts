import { io, Socket } from "socket.io-client";

// One socket instance for the whole app — created once, imported everywhere
export const socket: Socket = io(import.meta.env.VITE_SERVER_URL || "http://localhost:3000");

