const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

// Express 앱 및 HTTP 서버 생성
const app = express();
const server = http.createServer(app);

// CORS 및 기본 미들웨어 설정
app.use(cors());
app.use(express.static("public"));

// Socket.IO 서버 설정
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

// 활성 사용자 관리를 위한 Map
const activeUsers = new Map();

// Socket.IO 이벤트 핸들러
io.on("connection", (socket) => {
  console.log(`사용자 연결됨: ${socket.id}`);

  // 사용자 정보 초기화
  activeUsers.set(socket.id, {
    room: null,
    role: null,
  });

  // 룸 참가 처리
  socket.on("join-room", (roomId, userId) => {
    const user = activeUsers.get(socket.id);
    if (user) {
      user.room = roomId;
      socket.join(roomId);
      socket.to(roomId).emit("userJoined", userId);
      console.log(`사용자 ${userId}가 룸 ${roomId}에 참가함`);
    }
  });

  // 위치 업데이트 처리
  socket.on("locationUpdate", (data) => {
    const user = activeUsers.get(socket.id);
    if (user) {
      user.role = data.role;
      socket.broadcast.emit("userLocation", {
        id: socket.id,
        latitude: data.latitude,
        longitude: data.longitude,
        role: data.role,
      });
    }
  });

  // 채팅 메시지 처리
  socket.on("chatMessage", (message) => {
    // 메시지 유효성 검사
    if (!message || (message.type === "text" && !message.text)) {
      return;
    }

    io.emit("chatMessage", {
      ...message,
      timestamp: new Date().toISOString(),
    });
  });

  // 연결 해제 처리
  socket.on("disconnect", () => {
    console.log(`사용자 연결 해제됨: ${socket.id}`);

    const user = activeUsers.get(socket.id);
    if (user && user.room) {
      socket.to(user.room).emit("userDisconnected", socket.id);
    }

    activeUsers.delete(socket.id);
  });

  // 에러 처리
  socket.on("error", (error) => {
    console.error(`Socket ${socket.id} 에러:`, error);
  });
});

// 서버 시작
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다`);
});

// 예기치 않은 에러 처리
process.on("uncaughtException", (error) => {
  console.error("예기치 않은 에러:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("처리되지 않은 Promise 거부:", error);
});
