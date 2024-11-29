const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { ExpressPeerServer } = require("peer");

const app = express();
const server = http.createServer(app);

// Socket.IO 설정
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
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

  socket.on("locationUpdate", (location) => {
    socket.broadcast.emit("rescuerLocation", location);
  });

  socket.on("chatMessage", (message) => {
    io.emit("chatMessage", message);
  });

  socket.on("joinRescueRoom", (peerId) => {
    socket.join("rescueRoom");
    socket.to("rescueRoom").emit("newRescuer", peerId);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
