const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { ExpressPeerServer } = require("peer");
const Peer = require("peerjs");

const app = express();
const server = http.createServer(app);

// Render에서 제공하는 PORT 환경변수 사용
const PORT = process.env.PORT || 5000;

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// PeerJS 서버 설정
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: "/peerjs",
});

app.use("/peerjs", peerServer);
app.use(express.static("public"));

peer = new Peer({
  host: "여기에-render-도메인-입력",
  port: 443, // HTTPS 포트
  path: "/peerjs",
  secure: true, // HTTPS 사용
});

io.on("connection", (socket) => {
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

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
