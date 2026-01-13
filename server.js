import { createServer } from "http";
import { Server } from "socket.io";

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

/*
  rooms = {
    roomId: {
      socketId: username
    }
  }
*/
const rooms = {};

io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id);

  socket.on("join-room", ({ roomId, username }) => {
    if (!roomId || !username) return;

    if (!rooms[roomId]) rooms[roomId] = {};

    if (Object.keys(rooms[roomId]).length >= 2) {
      socket.emit("room-full");
      return;
    }

    socket.join(roomId);
    rooms[roomId][socket.id] = username;

    socket.to(roomId).emit("peer-joined", {
      socketId: socket.id,
      username
    });

    console.log(`👤 ${username} joined room ${roomId}`);
  });

  socket.on("offer", ({ to, offer }) => {
    io.to(to).emit("offer", { from: socket.id, offer });
  });

  socket.on("answer", ({ to, answer }) => {
    io.to(to).emit("answer", { from: socket.id, answer });
  });

  socket.on("icecandidate", ({ to, candidate }) => {
    io.to(to).emit("icecandidate", { from: socket.id, candidate });
  });

  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id);

    for (const roomId in rooms) {
      if (rooms[roomId][socket.id]) {
        delete rooms[roomId][socket.id];
        socket.to(roomId).emit("peer-left");

        if (Object.keys(rooms[roomId]).length === 0) {
          delete rooms[roomId];
        }
      }
    }
  });
});

const PORT = process.env.PORT || 9000;
httpServer.listen(PORT, () => {
  console.log("🚀 Baithak signaling server running on port", PORT);
});
