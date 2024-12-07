const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { ExpressPeerServer } = require("peer");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// CORS 설정
app.use(cors());

// Socket.IO 설정
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["*"],
    credentials: true,
  },
  pingTimeout: 60000,
  transports: ["websocket", "polling"],
});

// PeerJS 서버 설정
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: "/",
  allow_discovery: true,
});

app.use("/peerjs", peerServer);
app.use(express.static("public"));

// 소켓 연결 처리
io.on("connection", (socket) => {
  console.log("사용자 연결됨");

  socket.on("join-room", (roomId, userId) => {
    socket.join(roomId);
    socket.to(roomId).emit("userJoined", userId);
  });

  socket.on("requestCall", (roomId) => {
    socket.to(roomId).emit("callRequested");
  });

  socket.on("locationUpdate", (data) => {
    socket.broadcast.emit("userLocation", {
      id: socket.id,
      latitude: data.latitude,
      longitude: data.longitude,
      role: data.role,
    });
  });

  socket.on("chatMessage", (message) => {
    io.emit("chatMessage", message);
  });

  socket.on("disconnect", () => {
    io.emit("userDisconnected", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
