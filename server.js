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

// 라우트 설정 추가
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/chat", (req, res) => {
  res.sendFile(__dirname + "/public/chat.html");
});

app.get("/video", (req, res) => {
  res.sendFile(__dirname + "/public/video.html");
});

app.get("/location", (req, res) => {
  res.sendFile(__dirname + "/public/location.html");
});

// 소켓 연결 처리
io.on("connection", (socket) => {
  console.log("사용자 연결됨");

  // 채팅 메시지 처리
  socket.on("chatMessage", (message) => {
    io.emit("chatMessage", message);
  });

  // 위치 업데이트 처리
  socket.on("locationUpdate", (location) => {
    socket.broadcast.emit("rescuerLocation", location);
  });

  // 화상 통화 룸 처리
  socket.on("joinRescueRoom", (peerId) => {
    socket.join("rescueRoom");
    socket.to("rescueRoom").emit("newRescuer", peerId);
  });

  // 연결 해제 처리
  socket.on("disconnect", () => {
    console.log("사용자 연결 해제");
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
