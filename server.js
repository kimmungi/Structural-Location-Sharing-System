const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { ExpressPeerServer } = require("peer");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// CORS 설정
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  })
);

// Socket.IO 설정
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  allowEIO3: true,
  transports: ["websocket", "polling"],
});

// PeerJS 서버 설정
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: "/peerjs",
  allow_discovery: true,
  proxied: true,
  ssl: {},
});

app.use("/peerjs", peerServer);
app.use(express.static("public"));

// 소켓 연결
io.on("connection", (socket) => {
  console.log("사용자 연결됨");

  socket.on("disconnect", () => {
    console.log("사용자 연결 해제");
  });

  socket.on("locationUpdate", (location) => {
    socket.broadcast.emit("rescuerLocation", location);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
