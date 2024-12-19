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

// 전역 변수 선언
let map;
let userRole = "victim";
let rescuerNumber = 0;
let currentMarker = null;
const otherMarkers = {};
const ROOM_ID = "default-room";

// Socket.IO 이벤트 리스너
socket.on("connect", () => {
  console.log("Socket connected");
  socket.emit("join-room", ROOM_ID, socket.id);
});

// 지도 초기화
function initMap() {
  const mapContainer = document.getElementById("map");
  const mapOption = {
    center: new kakao.maps.LatLng(37.566826, 126.978656),
    level: 3,
  };

  map = new kakao.maps.Map(mapContainer, mapOption);

  // 창 크기 변경 시 지도 크기 조정
  window.addEventListener("resize", () => map.relayout());

  // 위치 추적 시작
  startLocationTracking();
}

// 위치 추적 시작
function startLocationTracking() {
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
  const errorMessages = {
    1: "위치 정보 접근 권한이 거부되었습니다.",
    2: "위치 정보를 사용할 수 없습니다.",
    3: "위치 정보 요청 시간이 초과되었습니다.",
  };
  alert(errorMessages[error.code] || "알 수 없는 오류가 발생했습니다.");
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
    currentMarker = new kakao.maps.Marker({
      position: currentPos,
      image: createMarkerImage(isRescuer, rescuerNumber),
      map: map,
    });
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

    document.getElementById("headerTitle").innerHTML = `
      구조 위치공유 시스템 (<span id="rescuerLabel" 
        onclick="event.stopPropagation(); editRescuerNumber();" 
        style="text-decoration: underline; cursor: pointer;">구조대${rescuerNumber}</span>)
    `;

    if (currentMarker) {
      currentMarker.setImage(createMarkerImage(true, rescuerNumber));
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

    document.getElementById(
      "rescuerLabel"
    ).textContent = `구조대${rescuerNumber}`;

    if (currentMarker) {
      currentMarker.setImage(createMarkerImage(true, rescuerNumber));
    }

    socket.emit("userRole", { role: userRole });
  }
}

// 채팅 UI 관련 함수들
const chatUI = {
  toggle() {
    const chatIcon = document.getElementById("chatIcon");
    const chatContainer = document.getElementById("chatContainer");
    const isHidden =
      chatContainer.style.display === "none" ||
      chatContainer.style.display === "";

    chatContainer.style.display = isHidden ? "flex" : "none";
    chatIcon.style.display = isHidden ? "none" : "flex";
  },

  close() {
    document.getElementById("chatContainer").style.display = "none";
    document.getElementById("chatIcon").style.display = "flex";
  },

  sendMessage() {
    const chatInput = document.getElementById("chatInput");
    const message = chatInput.value.trim();

    if (message) {
      socket.emit("chatMessage", {
        text: message,
        role: userRole,
        sender: userRole.includes("rescuer")
          ? `구조대${rescuerNumber}`
          : "요구조자",
        type: "text",
      });
      chatInput.value = "";
    }
  },
};

// 이미지 처리
function handleImageUpload(file) {
  if (!file) return;

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
      let [width, height] = [img.width, img.height];

      if (width > 800) {
        height = Math.floor(height * (800 / width));
        width = 800;
      }

      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);

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

document.getElementById("imageInput").addEventListener("change", (e) => {
  handleImageUpload(e.target.files[0]);
});

// 메시지 표시 함수들
function displayImageMessage(imageData) {
  const messageElement = document.createElement("div");
  const imageElement = document.createElement("img");
  imageElement.src = imageData;
  imageElement.className = "message-image";
  messageElement.appendChild(imageElement);

  const chatMessages = document.getElementById("chatMessages");
  chatMessages.appendChild(messageElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Socket.IO 이벤트 핸들러
socket.on("userLocation", (data) => {
  if (!data?.role) return;

  const pos = new kakao.maps.LatLng(data.latitude, data.longitude);

  if (!otherMarkers[data.id]) {
    const isRescuer = data.role.includes("rescuer");
    otherMarkers[data.id] = new kakao.maps.Marker({
      position: pos,
      map: map,
      image: createMarkerImage(
        isRescuer,
        isRescuer ? data.role.split("-")[1] : ""
      ),
    });
  } else {
    otherMarkers[data.id].setPosition(pos);
  }
});

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

// 로딩 스피너 UI
const spinner = {
  show() {
    const existingSpinner = document.getElementById("location-spinner");
    if (existingSpinner) existingSpinner.remove();

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

    const spinnerElement = document.createElement("div");
    spinnerElement.style.cssText = `
      width: 50px;
      height: 50px;
      border: 5px solid rgba(0, 102, 255, 0.3);
      border-top: 5px solid #0066ff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    `;

    const text = document.createElement("div");
    text.textContent = "위치 찾는 중...";
    text.style.cssText = `
      margin-top: 10px;
      color: #0066ff;
      font-weight: bold;
    `;

    spinnerContainer.append(spinnerElement, text);
    document.body.appendChild(spinnerContainer);

    if (!document.getElementById("spinner-style")) {
      const styleSheet = document.createElement("style");
      styleSheet.id = "spinner-style";
      styleSheet.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(styleSheet);
    }
  },

  hide() {
    const spinner = document.getElementById("location-spinner");
    if (spinner) spinner.remove();
  },
};

const showLoadingSpinner = spinner.show;
const hideLoadingSpinner = spinner.hide;
