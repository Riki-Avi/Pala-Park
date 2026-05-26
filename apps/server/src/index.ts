import RAPIER from "@dimforge/rapier3d-compat";
import type { PlayerPose } from "@game/shared";
import { Server as SocketServer } from "socket.io";
import { ServerGameLoop } from "./core/ServerGameLoop";
import { RoomManager } from "./rooms/RoomManager";

async function bootstrap(): Promise<void> {
  await RAPIER.init();

  const port = Number(process.env.PORT ?? 3000);
  const clientUrl = process.env.CLIENT_URL ?? "http://localhost:5173";
  const rooms = new RoomManager();

  const io = new SocketServer(port, {
    cors: {
      origin: clientUrl === "*" ? true : [clientUrl, /^http:\/\/localhost:\d+$/, /^http:\/\/\d+\.\d+\.\d+\.\d+:\d+$/]
    }
  });

  io.on("connection", (socket) => {
    socket.on("createRoom", ({ clientId }: { clientId: string }) => {
      const room = rooms.createRoom();
      const playerId = rooms.nextPlayerId(room);
      if (!playerId) {
        socket.emit("errorMessage", { message: "La sala esta llena." });
        return;
      }

      room.addPlayer(playerId, socket.id, clientId);
      socket.join(room.roomCode);
      socket.emit("roomCreated", { roomCode: room.roomCode, playerId, players: room.getPlayers() });
    });

    socket.on("joinRoom", ({ roomCode, clientId }: { roomCode: string; clientId: string }) => {
      const room = rooms.joinRoom(roomCode);
      if (!room) {
        socket.emit("errorMessage", { message: "No se pudo entrar a la sala." });
        return;
      }

      const existingPlayerId = room.getPlayerIdByClient(clientId);
      if (existingPlayerId && room.isPlayerConnected(existingPlayerId)) {
        socket.emit("errorMessage", { message: "Este cliente ya esta conectado a la sala." });
        return;
      }

      const playerId = existingPlayerId ?? rooms.nextPlayerId(room);
      if (!playerId) {
        socket.emit("errorMessage", { message: "La sala esta llena." });
        return;
      }

      room.addPlayer(playerId, socket.id, clientId);
      socket.join(room.roomCode);
      socket.emit("roomJoined", { roomCode: room.roomCode, playerId, players: room.getPlayers() });
      socket.to(room.roomCode).emit("playerJoined", { playerId, players: room.getPlayers() });
    });

    socket.on("playerPose", (pose: PlayerPose) => {
      const room = rooms.findRoomBySocket(socket.id);
      const playerId = room?.getPlayerIdBySocket(socket.id);
      if (!room || !playerId || pose.playerId !== playerId) {
        return;
      }

      socket.to(room.roomCode).emit("playerPose", pose);
    });

    socket.on("resetLevel", ({ reason }: { reason: "fall" | "manual" }) => {
      const room = rooms.findRoomBySocket(socket.id);
      const playerId = room?.getPlayerIdBySocket(socket.id);
      if (!room || !playerId) {
        return;
      }

      const now = Date.now();
      if (now - room.lastResetAt < 800) {
        return;
      }
      room.lastResetAt = now;

      io.to(room.roomCode).emit("levelReset", {
        roomCode: room.roomCode,
        byPlayerId: playerId,
        resetId: room.nextResetId(),
        reason
      });
    });

    socket.on("disconnect", () => {
      const room = rooms.findRoomBySocket(socket.id);
      const playerId = room?.getPlayerIdBySocket(socket.id);
      if (!room || !playerId) {
        return;
      }

      room.disconnectPlayer(playerId);
      socket.to(room.roomCode).emit("playerLeft", { playerId, players: room.getPlayers() });
    });
  });

  const loop = new ServerGameLoop(() => rooms.fixedUpdate());
  loop.start();

  console.log(`Pala Park server listening on ${port}`);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
