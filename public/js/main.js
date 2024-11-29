// Socket.IO 연결
const socket = io("https://structural-location-sharing-system.onrender.com", {
  transports: ["websocket", "polling"],
  upgrade: true,
  rememberUpgrade: true,
  secure: true,
  rejectUnauthorized: false,
});

// 연결 상태 확인
socket.on("connect", () => {
  console.log("Socket.IO 연결 성공!");
});

socket.on("connect_error", (error) => {
  console.error("Socket.IO 연결 오류:", error);
});

// 카카오맵 초기화
var mapContainer = document.getElementById("map");
var mapOption = {
  center: new kakao.maps.LatLng(37.566826, 126.9786567),
  level: 3,
};
var map = new kakao.maps.Map(mapContainer, mapOption);
var marker = new kakao.maps.Marker();

// 위치 정보 처리
navigator.geolocation.watchPosition(
  (position) => {
    const location = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };

    // 지도에 현재 위치 표시
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
