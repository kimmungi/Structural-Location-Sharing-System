const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { ExpressPeerServer } = require("peer");

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

// 소켓 연결 처리
io.on("connection", (socket) => {
  // 위치 업데이트 처리
  socket.on("locationUpdate", (location) => {
    socket.broadcast.emit("rescuerLocation", location);
  });

  // 채팅 메시지 처리
  socket.on("chatMessage", (message) => {
    io.emit("chatMessage", message);
  });

  // 영상통화를 위한 룸 처리
  socket.on("joinRescueRoom", (peerId) => {
    socket.join("rescueRoom");
    socket.to("rescueRoom").emit("newRescuer", peerId);
  });
});

// 서버 시작
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
