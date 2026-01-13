import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const app = express();
const server = createServer(app);
const io = new Server(server);

// ================= PATH FIX =================
const __dirname = dirname(fileURLToPath(import.meta.url));

// ================= STATIC FILES =================
app.use(express.static(join(__dirname, "public")));

// ================= ROUTES =================

// Landing page
app.get("/", (req, res) => {
  res.sendFile(join(__dirname, "public", "index.html"));
});

// Link connection page (JOIN VIA LINK)
app.get("/link_connection", (req, res) => {
  res.sendFile(join(__dirname, "public", "link_connection.html"));
});

// (Optional but clean) Direct room access safeguard
app.get("/baithak-room.html", (req, res) => {
  res.sendFile(join(__dirname, "public", "baithak-room.html"));
});

/*
  rooms = {
    roomId: {
      socketId1: username,
      socketId2: username
    }
  }
*/
const rooms = {};

// ================= SOCKET.IO =================
io.on("connection", socket => {
  console.log("🟢 Connected:", socket.id);

  /* -------- JOIN ROOM -------- */
  socket.on("join-room", ({ roomId, username }) => {
    if (!roomId || !username) return;

    if (!rooms[roomId]) {
      rooms[roomId] = {};
    }

    // Max 2 participants
    if (Object.keys(rooms[roomId]).length >= 2) {
      socket.emit("room-full");
      return;
    }

    socket.join(roomId);
    rooms[roomId][socket.id] = username;

    console.log(`👤 ${username} joined room ${roomId}`);

    socket.to(roomId).emit("peer-joined", {
      socketId: socket.id,
      username
    });
  });

  /* -------- OFFER -------- */
  socket.on("offer", ({ to, offer }) => {
    io.to(to).emit("offer", {
      from: socket.id,
      offer
    });
  });

  /* -------- ANSWER -------- */
  socket.on("answer", ({ to, answer }) => {
    io.to(to).emit("answer", {
      from: socket.id,
      answer
    });
  });

  /* -------- ICE CANDIDATE -------- */
  socket.on("icecandidate", ({ to, candidate }) => {
    io.to(to).emit("icecandidate", {
      from: socket.id,
      candidate
    });
  });

  /* -------- DISCONNECT -------- */
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

// ================= START SERVER =================
server.listen(9000, () => {
  console.log("🚀 Baithak server running on http://localhost:9000");
});
