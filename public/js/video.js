const socket = io("https://structural-location-sharing-system.onrender.com");
let peer = new Peer(undefined, {
  host: "structural-location-sharing-system.onrender.com",
  port: 443,
  path: "/peerjs",
  secure: true,
});

const myVideo = document.getElementById("myVideo");
const remoteVideo = document.getElementById("remoteVideo");

navigator.mediaDevices
  .getUserMedia({
    video: true,
    audio: true,
  })
  .then((stream) => {
    addVideoStream(myVideo, stream);

    peer.on("call", (call) => {
      call.answer(stream);
      call.on("stream", (userVideoStream) => {
        addVideoStream(remoteVideo, userVideoStream);
      });
    });
  });

function addVideoStream(video, stream) {
  video.srcObject = stream;
  video.addEventListener("loadedmetadata", () => {
    video.play();
  });
}
