import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// ===== __dirname fix (ES modules) =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== Serve frontend =====
app.use(express.static(path.join(__dirname, "public")));

// Landing
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Alias so /link_connection works
app.get("/link_connection", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "link_connection.html"));
});

/*
 rooms = {
   roomId: {
     socketId: {
       username,
       muted
     }
   }
 }
*/
const rooms = {};

// ===== SOCKET.IO =====
io.on("connection", (socket) => {
  console.log("🟢 Connected:", socket.id);

  /* ---------- JOIN ROOM ---------- */
  socket.on("join-room", ({ roomId, username }) => {
    if (!roomId || !username) return;

    if (!rooms[roomId]) rooms[roomId] = {};

    socket.join(roomId);

    rooms[roomId][socket.id] = {
      username,
      muted: false
    };

    // 🔑 Initiator logic (first user only)
    const isInitiator = Object.keys(rooms[roomId]).length === 1;

    socket.emit("joined-room", {
      isInitiator,
      participants: rooms[roomId]
    });

    // Notify others
    socket.to(roomId).emit("peer-joined", {
      socketId: socket.id,
      username
    });

    console.log(`👤 ${username} joined room ${roomId}`);
  });

  /* ---------- OFFER ---------- */
  socket.on("offer", ({ to, offer }) => {
    io.to(to).emit("offer", {
      from: socket.id,
      offer
    });
  });

  /* ---------- ANSWER ---------- */
  socket.on("answer", ({ to, answer }) => {
    io.to(to).emit("answer", {
      from: socket.id,
      answer
    });
  });

  /* ---------- ICE ---------- */
  socket.on("icecandidate", ({ to, candidate }) => {
    io.to(to).emit("icecandidate", {
      from: socket.id,
      candidate
    });
  });

  /* ---------- MIC STATE ---------- */
  socket.on("mic-state", ({ roomId, muted }) => {
    if (!rooms[roomId]?.[socket.id]) return;

    rooms[roomId][socket.id].muted = muted;

    socket.to(roomId).emit("mic-state", {
      socketId: socket.id,
      muted
    });
  });

  /* ---------- DISCONNECT ---------- */
  socket.on("disconnect", () => {
    console.log("🔴 Disconnected:", socket.id);

    for (const roomId in rooms) {
      if (rooms[roomId][socket.id]) {
        const username = rooms[roomId][socket.id].username;

        delete rooms[roomId][socket.id];

        socket.to(roomId).emit("peer-left", {
          socketId: socket.id,
          username
        });

        if (Object.keys(rooms[roomId]).length === 0) {
          delete rooms[roomId];
        }
      }
    }
  });
});

// ===== START SERVER =====
const PORT = 9000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Baithak running on http://localhost:${PORT}`);
});
