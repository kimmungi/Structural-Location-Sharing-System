const socket = io("https://structural-location-sharing-system.onrender.com");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const messages = document.getElementById("messages");

messageForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const message = messageInput.value;
  if (message) {
    socket.emit("chatMessage", message);
    messageInput.value = "";
  }
});

socket.on("chatMessage", (message) => {
  const messageElement = document.createElement("div");
  messageElement.textContent = message;
  messages.appendChild(messageElement);
  messages.scrollTop = messages.scrollHeight;
});
