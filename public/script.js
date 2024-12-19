// Socket.IO 연결
const socket = io("https://structural-location-sharing-system.onrender.com", {
  transports: ["polling", "websocket"],
  upgrade: false,
  forceNew: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
});

// PeerJS 연결
const peer = new Peer(undefined, {
  host: "structural-location-sharing-system.onrender.com",
  port: 443,
  path: "/peerjs",
  secure: true,
  debug: 3,
  config: {
    iceServers: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
        ],
      },
      {
        urls: ["turn:relay.metered.ca:80", "turn:relay.metered.ca:443"],
        username: "e23d6e2a5f48431a5bce4ea6",
        credential: "xzwXvIV9bqDKGgdv",
      },
    ],
  },
});

// 전역 변수 선언
let map;
let marker;
let userRole = "victim";
let rescuerNumber = 0;
let currentMarker = null;
const otherMarkers = {};
const ROOM_ID = "default-room";

// PeerJS 이벤트 리스너
peer.on("error", (err) => {
  console.error("PeerJS error:", err);
});

peer.on("disconnected", () => {
  console.log("PeerJS disconnected. Attempting to reconnect...");
  peer.reconnect();
});

peer.on("close", () => {
  console.log("PeerJS connection closed");
});

// Socket.IO 이벤트 리스너
socket.on("connect", () => {
  console.log("Socket connected");
});

socket.on("connect_error", (error) => {
  console.log("Socket connection error:", error);
});

// PeerJS 연결 시 room 참가
peer.on("open", (id) => {
  console.log("My peer ID is:", id);
  socket.emit("join-room", ROOM_ID, id);
});

// 지도 초기화
function initMap() {
  const mapContainer = document.getElementById("map");
  const mapOption = {
    center: new kakao.maps.LatLng(37.566826, 126.978656),
    level: 3,
  };

  map = new kakao.maps.Map(mapContainer, mapOption);

  window.addEventListener("resize", function () {
    map.relayout();
  });

  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(updateLocation, handleLocationError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000,
    });
  }
}

// 위치 에러 처리
function handleLocationError(error) {
  console.error("위치 정보 오류:", error);
  let errorMessage = "";
  switch (error.code) {
    case error.PERMISSION_DENIED:
      errorMessage = "위치 정보 접근 권한이 거부되었습니다.";
      break;
    case error.POSITION_UNAVAILABLE:
      errorMessage = "위치 정보를 사용할 수 없습니다.";
      break;
    case error.TIMEOUT:
      errorMessage = "위치 정보 요청 시간이 초과되었습니다.";
      break;
    default:
      errorMessage = "알 수 없는 오류가 발생했습니다.";
  }
  alert(errorMessage);
}

// 마커 이미지 생성
function createMarkerImage(isRescuer, number = "") {
  const markerColor = isRescuer ? "#FF3B30" : "#0066ff";
  const svgContent = `
      <svg width="29" height="42" xmlns="http://www.w3.org/2000/svg">
          <path d="M14.5 0C6.5 0 0 6.5 0 14.5C0 25.4 14.5 42 14.5 42C14.5 42 29 25.4 29 14.5C29 6.5 22.5 0 14.5 0Z" fill="${markerColor}"/>
          ${
            isRescuer
              ? `<text x="14.5" y="21" text-anchor="middle" fill="white" font-size="12" font-family="Arial" dy=".3em">${number}</text>`
              : ""
          }
      </svg>`;

  return new kakao.maps.MarkerImage(
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgContent),
    new kakao.maps.Size(29, 42),
    { offset: new kakao.maps.Point(14, 42) }
  );
}

// 위치 업데이트
function updateLocation(position) {
  const currentPos = new kakao.maps.LatLng(
    position.coords.latitude,
    position.coords.longitude
  );

  if (!currentMarker) {
    const isRescuer = userRole.includes("rescuer");
    const markerImage = createMarkerImage(isRescuer, rescuerNumber);

    currentMarker = new kakao.maps.Marker({
      position: currentPos,
      image: markerImage,
    });
    currentMarker.setMap(map);
  } else {
    currentMarker.setPosition(currentPos);
  }

  socket.emit("locationUpdate", {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    role: userRole,
  });
}

// 구조대 모드 토글
function toggleRescuerMode() {
  if (userRole === "victim") {
    rescuerNumber++;
    userRole = `rescuer-${rescuerNumber}`;

    const headerTitle = document.getElementById("headerTitle");
    headerTitle.innerHTML = `
          구조 위치공유 시스템 (<span id="rescuerLabel" 
              onclick="event.stopPropagation(); editRescuerNumber();" 
              style="text-decoration: underline; cursor: pointer;">구조대${rescuerNumber}</span>)
      `;

    if (currentMarker) {
      const markerImage = createMarkerImage(true, rescuerNumber);
      currentMarker.setImage(markerImage);
    }

    socket.emit("userRole", { role: userRole });
    alert(`구조대 ${rescuerNumber}번으로 전환되었습니다.`);
  }
}

// 구조대 번호 수정
function editRescuerNumber() {
  const newNumber = prompt("구조대 번호를 입력하세요 (1-10):", rescuerNumber);
  if (newNumber && !isNaN(newNumber) && newNumber >= 1 && newNumber <= 10) {
    rescuerNumber = parseInt(newNumber);
    userRole = `rescuer-${rescuerNumber}`;

    const rescuerLabel = document.getElementById("rescuerLabel");
    rescuerLabel.textContent = `구조대${rescuerNumber}`;

    if (currentMarker) {
      const markerImage = createMarkerImage(true, rescuerNumber);
      currentMarker.setImage(markerImage);
    }

    socket.emit("userRole", { role: userRole });
  }
}

// 채팅 관련 함수들
function toggleChat() {
  const chatIcon = document.getElementById("chatIcon");
  const chatContainer = document.getElementById("chatContainer");

  if (
    chatContainer.style.display === "none" ||
    chatContainer.style.display === ""
  ) {
    chatContainer.style.display = "flex";
    chatIcon.style.display = "none";
  } else {
    chatContainer.style.display = "none";
    chatIcon.style.display = "flex";
  }
}

function closeChat() {
  const chatIcon = document.getElementById("chatIcon");
  const chatContainer = document.getElementById("chatContainer");

  chatContainer.style.display = "none";
  chatIcon.style.display = "flex";
}

function sendMessage() {
  const chatInput = document.getElementById("chatInput");
  const message = chatInput.value.trim();

  if (message !== "") {
    const messageData = {
      text: message,
      role: userRole,
      sender: userRole.includes("rescuer")
        ? `구조대${rescuerNumber}`
        : "요구조자",
      type: "text",
    };

    socket.emit("chatMessage", messageData);
    chatInput.value = "";
  }
}

// 이미지 처리
document.getElementById("imageInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (file) {
    if (file.size > 5 * 1024 * 1024) {
      alert("파일 크기는 5MB를 초과할 수 없습니다.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 전송할 수 있습니다.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > 800) {
          height = Math.floor(height * (800 / width));
          width = 800;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const compressedImage = canvas.toDataURL("image/jpeg", 0.7);
        socket.emit("chatMessage", {
          type: "image",
          data: compressedImage,
        });

        displayImageMessage(compressedImage);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
});

function displayImageMessage(imageData) {
  const chatMessages = document.getElementById("chatMessages");
  const messageElement = document.createElement("div");
  const imageElement = document.createElement("img");
  imageElement.src = imageData;
  imageElement.className = "message-image";
  messageElement.appendChild(imageElement);
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 다른 사용자의 위치 업데이트 수신
socket.on("userLocation", (data) => {
  if (!data || !data.role) return;

  const pos = new kakao.maps.LatLng(data.latitude, data.longitude);

  if (!otherMarkers[data.id]) {
    const isRescuer = data.role.includes("rescuer");
    const markerImage = createMarkerImage(
      isRescuer,
      isRescuer ? data.role.split("-")[1] : ""
    );

    otherMarkers[data.id] = new kakao.maps.Marker({
      position: pos,
      map: map,
      image: markerImage,
    });
  } else {
    otherMarkers[data.id].setPosition(pos);
  }
});

// 채팅 메시지 수신
socket.on("chatMessage", (message) => {
  const chatMessages = document.getElementById("chatMessages");
  const messageElement = document.createElement("div");

  if (message.type === "image") {
    const img = document.createElement("img");
    img.src = message.data;
    img.className = "message-image";
    messageElement.appendChild(img);
  } else {
    messageElement.className = message.role.includes("rescuer")
      ? "rescuer-message"
      : "victim-message";

    const senderElement = document.createElement("div");
    senderElement.className = "message-sender";
    senderElement.textContent = message.sender;
    messageElement.appendChild(senderElement);

    const contentElement = document.createElement("div");
    contentElement.className = "message-content";
    contentElement.textContent = message.text;
    messageElement.appendChild(contentElement);
  }

  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

// 사용자 연결 해제
socket.on("userDisconnected", (userId) => {
  if (otherMarkers[userId]) {
    otherMarkers[userId].setMap(null);
    delete otherMarkers[userId];
  }
});

// 내 위치로 이동
function moveToMyLocation() {
  showLoadingSpinner();

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const currentPos = new kakao.maps.LatLng(
          position.coords.latitude,
          position.coords.longitude
        );
        map.setCenter(currentPos);
        map.setLevel(3);
        hideLoadingSpinner();
      },
      (error) => {
        console.error("위치 정보 오류:", error);
        hideLoadingSpinner();
        handleLocationError(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0,
      }
    );
  } else {
    alert("위치 정보를 지원하지 않는 브라우저입니다.");
    hideLoadingSpinner();
  }
}

// 로딩 스피너 관련 함수들
function showLoadingSpinner() {
  const existingSpinner = document.getElementById("location-spinner");
  if (existingSpinner) {
    existingSpinner.remove();
  }

  const spinnerContainer = document.createElement("div");
  spinnerContainer.id = "location-spinner";
  spinnerContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
  `;

  const spinner = document.createElement("div");
  spinner.style.cssText = `
      width: 50px;
      height: 50px;
      border: 5px solid rgba(0, 102, 255, 0.3);
      border-top: 5px solid #0066ff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
  `;

  // 텍스트 생성
  const text = document.createElement("div");
  text.textContent = "위치 찾는 중...";
  text.style.cssText = `
      margin-top: 10px;
      color: #0066ff;
      font-weight: bold;
  `;

  // 스피너와 텍스트를 컨테이너에 추가
  spinnerContainer.appendChild(spinner);
  spinnerContainer.appendChild(text);

  // 문서에 추가
  document.body.appendChild(spinnerContainer);

  // 스피너 애니메이션 스타일 추가
  const styleSheet = document.createElement("style");
  styleSheet.textContent = `
      @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
      }
  `;
  document.head.appendChild(styleSheet);
}

// 로딩 스피너 제거 함수
function hideLoadingSpinner() {
  const spinner = document.getElementById("location-spinner");
  if (spinner) {
    spinner.remove();
  }
}
