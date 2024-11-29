const socket = io("https://structural-location-sharing-system.onrender.com");
const locationInfo = document.getElementById("locationInfo");

// 카카오맵 초기화
var mapContainer = document.getElementById("map");
var mapOption = {
  center: new kakao.maps.LatLng(37.566826, 126.9786567),
  level: 3,
};
var map = new kakao.maps.Map(mapContainer, mapOption);
var marker = new kakao.maps.Marker();

navigator.geolocation.watchPosition(
  (position) => {
    const location = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };

    // 지도에 마커 표시
    var markerPosition = new kakao.maps.LatLng(location.lat, location.lng);
    marker.setPosition(markerPosition);
    marker.setMap(map);
    map.setCenter(markerPosition);

    socket.emit("locationUpdate", location);
    locationInfo.textContent = `위도: ${location.lat}, 경도: ${location.lng}`;
  },
  (error) => {
    console.error("위치 정보 오류:", error);
    locationInfo.textContent = "위치 정보를 가져올 수 없습니다.";
  },
  {
    enableHighAccuracy: true,
    maximumAge: 30000,
    timeout: 27000,
  }
);
