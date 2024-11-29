// Socket.IO 연결 (localhost 대신 Render 주소 사용)
const socket = io("https://structural-location-sharing-system.onrender.com", {
  transports: ["websocket", "polling"],
});

// 연결 상태 확인
socket.on("connect", () => {
  console.log("Socket.IO 연결 성공!");
});

socket.on("connect_error", (error) => {
  console.error("Socket.IO 연결 오류:", error);
});

// PeerJS 초기화 (로컬 테스트용)
let peer = new Peer(undefined, {
  host: "localhost",
  port: 3000,
  path: "/peerjs",
  secure: false,
});

// DOM 요소
const chatContainer = document.getElementById("chatContainer");
const videoContainer = document.getElementById("videoContainer");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const messages = document.getElementById("messages");
const myVideo = document.getElementById("myVideo");
const remoteVideo = document.getElementById("remoteVideo");

// 전역 변수
let myStream;
let currentCall;

// 카카오맵 초기화
var mapContainer = document.getElementById("map");
var mapOption = {
  center: new kakao.maps.LatLng(37.566826, 126.9786567),
  level: 3,
};
var map = new kakao.maps.Map(mapContainer, mapOption);
var marker = new kakao.maps.Marker();

// 채팅 토글
function toggleChat() {
  chatContainer.classList.toggle("active");
}

// 채팅 메시지 전송
messageForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const message = messageInput.value.trim();
  if (message) {
    socket.emit("chatMessage", message);
    messageInput.value = "";
  }
});

// 채팅 메시지 수신
socket.on("chatMessage", (message) => {
  const messageElement = document.createElement("div");
  messageElement.textContent = message;
  messageElement.className = "message";
  messages.appendChild(messageElement);
  messages.scrollTop = messages.scrollHeight;
});

// 비디오 통화 시작
async function startVideoCall() {
  try {
    myStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    myVideo.srcObject = myStream;
    videoContainer.classList.add("active");

    // PeerJS 연결
    peer.on("call", (call) => {
      call.answer(myStream);
      call.on("stream", (userVideoStream) => {
        remoteVideo.srcObject = userVideoStream;
      });
      currentCall = call;
    });

    // 다른 사용자에게 통화 요청
    socket.emit("joinRescueRoom", peer.id);
  } catch (error) {
    console.error("카메라/마이크 접근 오류:", error);
    alert("카메라와 마이크 접근 권한이 필요합니다.");
  }
}

// 통화 종료
function endCall() {
  if (currentCall) {
    currentCall.close();
  }
  if (myStream) {
    myStream.getTracks().forEach((track) => track.stop());
  }
  myVideo.srcObject = null;
  remoteVideo.srcObject = null;
  videoContainer.classList.remove("active");
}

// 위치 정보 처리
navigator.geolocation.watchPosition(
  (position) => {
    const location = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };

    // 도에 현재 위치 표시
    var markerPosition = new kakao.maps.LatLng(location.lat, location.lng);
    marker.setPosition(markerPosition);
    marker.setMap(map);
    map.setCenter(markerPosition);

    // 위치 정보 서버로 전송
    socket.emit("locationUpdate", location);
  },
  (error) => {
    console.error("위치 정보 오류:", error);
  },
  {
    enableHighAccuracy: true,
    maximumAge: 30000,
    timeout: 27000,
  }
);

// 다른 사용자 위치 수신
socket.on("rescuerLocation", (location) => {
  // 다른 사용자의 위치를 지도에 표시하는 로직 추가
  var rescuerPosition = new kakao.maps.LatLng(location.lat, location.lng);
  var rescuerMarker = new kakao.maps.Marker({
    position: rescuerPosition,
    map: map,
  });
});

// 이미지 전송 기능
function sendImage() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        socket.emit("chatMessage", {
          type: "image",
          data: event.target.result,
        });
      };
      reader.readAsDataURL(file);
    }
  };
  input.click();
}

// 창 크기 변경 시 지도 크기 조정
window.addEventListener("resize", function () {
  map.relayout();
});
