// Socket.IO 연결 부분을 수정
const socket = io("https://structural-location-sharing-system.onrender.com", {
  transports: ["websocket", "polling"], // websocket을 먼저 시도
  upgrade: true, // 업그레이드 허용
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

// Socket.IO 이벤트 리스너 강화
socket.on("connect", () => {
  console.log("[Socket] Connected successfully with ID:", socket.id);
  socket.emit("join-room", ROOM_ID, socket.id);

  // 연결 직후 현재 위치 전송
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((position) => {
      updateLocation(position);
      console.log("[Socket] Initial location sent after connection");
    }, handleLocationError);
  }
});

// 지도 초기화
function initMap() {
  console.log("[Map] Initializing map...");

  const mapContainer = document.getElementById("map");
  if (!mapContainer) {
    console.error(
      "[Map] Error: Map container not found! Check if element with id 'map' exists"
    );
    return;
  }

  console.log("[Map] Container dimensions:", {
    width: mapContainer.offsetWidth,
    height: mapContainer.offsetHeight,
  });

  try {
    const mapOption = {
      center: new kakao.maps.LatLng(37.566826, 126.978656),
      level: 3,
    };

    if (typeof kakao === "undefined" || !kakao.maps) {
      console.error("[Map] Error: Kakao maps SDK not loaded!");
      return;
    }

    map = new kakao.maps.Map(mapContainer, mapOption);
    console.log("[Map] Successfully created map instance");

    // 창 크기 변경 시 지도 크기 조정
    window.addEventListener("resize", () => {
      console.log("[Map] Window resized, adjusting map layout");
      map.relayout();
    });

    // 위치 추적 시작
    startLocationTracking();
  } catch (error) {
    console.error("[Map] Error during map initialization:", error);
  }
}

// 위치 추적 시작
function startLocationTracking() {
  console.log("[Location] Starting location tracking...");
  if (navigator.geolocation) {
    // 초기 위치 한 번 가져오기
    navigator.geolocation.getCurrentPosition(
      updateLocation,
      handleLocationError,
      { enableHighAccuracy: true }
    );

    // 주기적으로 위치 업데이트
    const watchId = navigator.geolocation.watchPosition(
      updateLocation,
      handleLocationError,
      {
        enableHighAccuracy: true,
        maximumAge: 1000, // 1초 이내의 캐시된 위치만 사용
        timeout: 5000, // 5초 이내에 응답이 없으면 에러
      }
    );

    // watchPosition ID 저장
    window.locationWatchId = watchId;

    console.log("[Location] Geolocation watch started with ID:", watchId);
  } else {
    console.error("[Location] Geolocation not supported by browser");
    alert("브라우저가 위치 추적을 지원하지 않습니다.");
  }
}

// 위치 에러 처리
function handleLocationError(error) {
  console.error("[Location] Error getting location:", error);
  const errorMessages = {
    1: "위치 정보 접근 권한이 거부되었습니다.",
    2: "위치 정보를 사용할 수 없습니다.",
    3: "위치 정보 요청 시간이 초과되었습니다.",
  };
  alert(errorMessages[error.code] || "알 수 없는 오류가 발생했습니다.");
}

// 마커 이미지 생성
function createMarkerImage(isRescuer, number = "") {
  console.log("[Marker] Creating marker image:", { isRescuer, number });
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
  console.log("[Location] Received new position:", {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
  });

  if (position.coords.accuracy > 1000) {
    alert("위치 데이터가 정확하지 않을 수 있습니다. 신호를 확인하세요.");
  }

  // 정확도가 낮아도 위치를 업데이트
  updateMapWithAccuracy(
    position.coords.latitude,
    position.coords.longitude,
    position.coords.accuracy
  );

  function updateMapWithAccuracy(lat, lng, accuracy) {
    const circle = new kakao.maps.Circle({
      center: new kakao.maps.LatLng(lat, lng),
      radius: accuracy, // 오차 범위를 반영
      strokeWeight: 1,
      strokeColor: "#FF0000",
      strokeOpacity: 0.8,
      fillColor: "#FF0000",
      fillOpacity: 0.2,
    });
    circle.setMap(map);
  }

  const currentPos = new kakao.maps.LatLng(
    position.coords.latitude,
    position.coords.longitude
  );

  if (!currentMarker) {
    console.log("[Marker] Creating new marker");
    const isRescuer = userRole.includes("rescuer");
    currentMarker = new kakao.maps.Marker({
      position: currentPos,
      image: createMarkerImage(isRescuer, rescuerNumber),
      map: map,
    });
  } else {
    console.log("[Marker] Updating marker position");
    currentMarker.setPosition(currentPos);
  }

  // 위치 정보와 함께 타임스탭 전송
  socket.emit("locationUpdate", {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    role: userRole,
    timestamp: Date.now(),
    accuracy: position.coords.accuracy,
  });
}

// 구조대 모드 토글
function toggleRescuerMode() {
  console.log("[Role] Toggling rescuer mode");
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
    console.log("[Role] Changed to rescuer mode:", rescuerNumber);
    alert(`구조대 ${rescuerNumber}번으로 전환되었습니다.`);
  }
}

// 구조대 번호 수정
function editRescuerNumber() {
  console.log("[Role] Editing rescuer number");
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
    console.log("[Role] Updated rescuer number:", rescuerNumber);
  }
}

// 채팅 UI 관련 함수들
const chatUI = {
  toggle() {
    console.log("[Chat] Toggling chat UI");
    const chatIcon = document.getElementById("chatIcon");
    const chatContainer = document.getElementById("chatContainer");
    const isHidden =
      chatContainer.style.display === "none" ||
      chatContainer.style.display === "";

    chatContainer.style.display = isHidden ? "flex" : "none";
    chatIcon.style.display = isHidden ? "none" : "flex";
  },

  close() {
    console.log("[Chat] Closing chat UI");
    document.getElementById("chatContainer").style.display = "none";
    document.getElementById("chatIcon").style.display = "flex";
  },

  sendMessage() {
    const chatInput = document.getElementById("chatInput");
    const message = chatInput.value.trim();

    if (message) {
      console.log("[Chat] Sending message:", message);
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
  console.log("[Image] Processing image upload");
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    console.error("[Image] File size exceeds 5MB limit");
    alert("파일 크기는 5MB를 초과할 수 없습니다.");
    return;
  }

  if (!file.type.startsWith("image/")) {
    console.error("[Image] Invalid file type:", file.type);
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
      console.log("[Image] Image processed and sent");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

document.getElementById("imageInput").addEventListener("change", (e) => {
  handleImageUpload(e.target.files[0]);
});

// Socket.IO 이벤트 핸들러
socket.on("userLocation", (data) => {
  console.log("[Socket] Received user location:", data);
  if (!data?.role) return;

  // 오래된 위치 데이터 무시 (30초 이상)
  if (Date.now() - data.timestamp > 30000) {
    console.warn("[Location] Received outdated location data");
    return;
  }

  const pos = new kakao.maps.LatLng(data.latitude, data.longitude);

  if (!otherMarkers[data.id]) {
    console.log("[Marker] Creating new marker for user:", data.id);
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
    console.log("[Marker] Updating marker position for user:", data.id);
    otherMarkers[data.id].setPosition(pos);
  }
});

socket.on("chatMessage", (message) => {
  console.log("[Chat] Received message:", message);
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
  console.log("[Socket] User disconnected:", userId);
  if (otherMarkers[userId]) {
    otherMarkers[userId].setMap(null);
    delete otherMarkers[userId];
  }
});

// Socket.IO 연결 재시도 로직 강화
socket.io.on("reconnect_attempt", () => {
  console.log("[Socket] Attempting to reconnect...");
});

socket.io.on("reconnect", () => {
  console.log("[Socket] Reconnected successfully");
  // 재연결 시 현재 위치 즉시 전송
  navigator.geolocation.getCurrentPosition(updateLocation, handleLocationError);
});

// 내 위치로 이동
function moveToMyLocation() {
  console.log("[Location] Moving to current location");
  showLoadingSpinner();

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("[Location] Got current position:", {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        const currentPos = new kakao.maps.LatLng(
          position.coords.latitude,
          position.coords.longitude
        );
        map.setCenter(currentPos);
        map.setLevel(3);
        hideLoadingSpinner();
      },
      (error) => {
        console.error("[Location] Error getting current position:", error);
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
    console.error("[Location] Geolocation not supported");
    alert("위치 정보를 지원하지 않는 브라우저입니다.");
    hideLoadingSpinner();
  }
}

// DOM이 로드된 후 초기화
document.addEventListener("DOMContentLoaded", () => {
  console.log("[Init] DOM Content Loaded");
  if (typeof kakao === "undefined") {
    console.error("[Init] Error: Kakao maps SDK not loaded!");
    alert("카카오맵 SDK가 로드되지 않았습니다. 페이지를 새로고침 해주세요.");
    return;
  }
  initMap();
});

// 페이지 종료 시 위치 추적 중지
window.addEventListener("beforeunload", () => {
  if (window.locationWatchId) {
    navigator.geolocation.clearWatch(window.locationWatchId);
    console.log("[Location] Cleared location watch");
  }
});

// 로딩 스피너 UI
const spinner = {
  show() {
    console.log("[UI] Showing loading spinner");
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

    console.log("[UI] Loading spinner created and shown");
  },

  hide() {
    console.log("[UI] Hiding loading spinner");
    const spinner = document.getElementById("location-spinner");
    if (spinner) {
      spinner.remove();
      console.log("[UI] Loading spinner removed");
    } else {
      console.log("[UI] No spinner found to hide");
    }
  },
};

const showLoadingSpinner = spinner.show;
const hideLoadingSpinner = spinner.hide;

// 디버깅을 위한 전역 에러 핸들러
window.onerror = function (msg, url, lineNo, columnNo, error) {
  console.error("[Global Error]", {
    message: msg,
    url: url,
    line: lineNo,
    column: columnNo,
    error: error,
  });
  return false;
};

// 카카오맵 로드 상태 체크
window.addEventListener("load", () => {
  console.log("[Init] Window loaded");
  console.log("[Kakao] SDK Status:", {
    isDefined: typeof kakao !== "undefined",
    hasMapObject: typeof kakao !== "undefined" && kakao.hasOwnProperty("maps"),
  });
});

// 전역 함수 설정
window.toggleChat = chatUI.toggle;
window.closeChat = chatUI.close;
window.sendMessage = chatUI.sendMessage;
