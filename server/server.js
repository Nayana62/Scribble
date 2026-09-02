require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  },
});

// Bind socket connection coordinator
require("./socket/index")(io);

// Safety net only — a bad/malformed socket payload should never take down
// every active room. This does not replace validating input at the call
// site; it just stops one bad message from killing the whole process.
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception (process kept alive):", err);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
