const socket = io("https://structural-location-sharing-system.onrender.com");
const locationInfo = document.getElementById("locationInfo");

navigator.geolocation.watchPosition(
  (position) => {
    const location = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };
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
