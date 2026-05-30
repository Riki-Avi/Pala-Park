import RAPIER from "@dimforge/rapier3d-compat";
import type { GoalProgressPayload, LevelStatePayload, PlayerPose, RoomJoinedPayload } from "@game/shared";
import { Server as SocketServer } from "socket.io";
import { ServerGameLoop } from "./core/ServerGameLoop";
import { RoomManager } from "./rooms/RoomManager";

async function bootstrap(): Promise<void> {
  await RAPIER.init();

  const port = Number(process.env.PORT ?? 3001);
  const clientUrl = process.env.CLIENT_URL ?? "http://localhost:5173";
  const rooms = new RoomManager();

  const io = new SocketServer(port, {
    cors: {
      origin: clientUrl === "*" ? true : [clientUrl, /^http:\/\/localhost:\d+$/, /^http:\/\/\d+\.\d+\.\d+\.\d+:\d+$/]
    }
  });

  const buildSessionPayload = (roomCode: string, playerId: string): RoomJoinedPayload | null => {
    const room = rooms.getRoom(roomCode);
    if (!room) {
      return null;
    }

    return {
      roomCode: room.roomCode,
      playerId,
      players: room.getPlayers(),
      roomState: room.getRoomState(),
      levelState: room.levelState ?? undefined,
      goalProgress: room.goalProgress ?? undefined
    };
  };

  const emitRoomState = (roomCode: string): void => {
    const room = rooms.getRoom(roomCode);
    if (room) {
      io.to(room.roomCode).emit("roomState", room.getRoomState());
    }
  };

  const emitGameStarted = (roomCode: string): void => {
    const room = rooms.getRoom(roomCode);
    if (room) {
      io.to(room.roomCode).emit("gameStarted", room.getRoomState());
    }
  };

  io.on("connection", (socket) => {
    socket.on("createRoom", (payload: { clientId: string }) => {
      const clientId = payload?.clientId;
      if (!isValidClientId(clientId)) {
        socket.emit("errorMessage", { message: "Cliente invalido." });
        return;
      }

      if (rooms.findRoomBySocket(socket.id)) {
        socket.emit("errorMessage", { message: "Ya estas en una sala." });
        return;
      }

      const room = rooms.createRoom();
      const playerId = rooms.nextPlayerId(room);
      if (!playerId) {
        socket.emit("errorMessage", { message: "La sala esta llena." });
        return;
      }

      const started = room.addPlayer(playerId, socket.id, clientId);
      socket.join(room.roomCode);
      const session = buildSessionPayload(room.roomCode, playerId);
      if (session) {
        socket.emit("roomCreated", session);
      }
      emitRoomState(room.roomCode);
      if (started) {
        emitGameStarted(room.roomCode);
      }
    });

    socket.on("joinRoom", (payload: { roomCode: string; clientId: string }) => {
      const roomCode = payload?.roomCode;
      const clientId = payload?.clientId;
      if (!isValidRoomCode(roomCode) || !isValidClientId(clientId)) {
        socket.emit("errorMessage", { message: "Datos de sala invalidos." });
        return;
      }

      if (rooms.findRoomBySocket(socket.id)) {
        socket.emit("errorMessage", { message: "Ya estas en una sala." });
        return;
      }

      const room = rooms.joinRoom(roomCode);
      if (!room) {
        socket.emit("errorMessage", { message: "La sala no existe." });
        return;
      }

      const existingPlayerId = room.getPlayerIdByClient(clientId);
      if (existingPlayerId && room.isPlayerConnected(existingPlayerId)) {
        socket.emit("errorMessage", { message: "Este cliente ya esta conectado a la sala." });
        return;
      }

      const isReconnect = room.canReconnect(clientId);
      if (!isReconnect && !room.canAcceptNewPlayer()) {
        socket.emit("errorMessage", { message: "La sala ya empezo o esta llena." });
        return;
      }

      const playerId = existingPlayerId ?? rooms.nextPlayerId(room);
      if (!playerId) {
        socket.emit("errorMessage", { message: "La sala esta llena." });
        return;
      }

      const started = room.addPlayer(playerId, socket.id, clientId);
      socket.join(room.roomCode);
      const session = buildSessionPayload(room.roomCode, playerId);
      if (session) {
        socket.emit("roomJoined", session);
      }
      socket.to(room.roomCode).emit("playerJoined", { playerId, players: room.getPlayers() });
      emitRoomState(room.roomCode);
      if (started) {
        emitGameStarted(room.roomCode);
      } else if (room.state === "PLAYING") {
        socket.emit("gameStarted", room.getRoomState());
      }
    });

    socket.on("playerPose", (pose: PlayerPose) => {
      if (!isValidPlayerPose(pose)) {
        return;
      }

      const room = rooms.findRoomBySocket(socket.id);
      const playerId = room?.getPlayerIdBySocket(socket.id);
      if (!room || !playerId || room.state !== "PLAYING" || pose.playerId !== playerId) {
        return;
      }

      socket.to(room.roomCode).emit("playerPose", pose);
    });

    socket.on("levelState", (payload: LevelStatePayload) => {
      if (!isValidRoomCode(payload?.roomCode)) {
        return;
      }

      const room = rooms.findRoomBySocket(socket.id);
      const playerId = room?.getPlayerIdBySocket(socket.id);
      if (!room || !playerId || !room.canReceiveHostState(playerId, payload.roomCode)) {
        return;
      }

      room.levelState = payload;
      socket.to(room.roomCode).emit("levelState", payload);
    });

    socket.on("goalProgress", (payload: GoalProgressPayload) => {
      if (!isValidRoomCode(payload?.roomCode)) {
        return;
      }

      const room = rooms.findRoomBySocket(socket.id);
      const playerId = room?.getPlayerIdBySocket(socket.id);
      if (!room || !playerId || !room.canReceiveHostState(playerId, payload.roomCode)) {
        return;
      }

      room.goalProgress = payload;
      socket.to(room.roomCode).emit("goalProgress", payload);
    });

    socket.on("requestStartGame", () => {
      const room = rooms.findRoomBySocket(socket.id);
      const playerId = room?.getPlayerIdBySocket(socket.id);
      if (!room || !playerId || playerId !== room.hostPlayerId) {
        return;
      }

      const started = room.startGame();
      if (started) {
        emitGameStarted(room.roomCode);
      }
    });

    socket.on("requestLevelChange", (payload: { levelIndex: number }) => {
      const levelIndex = payload?.levelIndex;
      if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex > 20) {
        return;
      }

      const room = rooms.findRoomBySocket(socket.id);
      const playerId = room?.getPlayerIdBySocket(socket.id);
      if (!room || !playerId || playerId !== room.hostPlayerId) {
        return;
      }

      room.changeLevel(levelIndex);
      io.to(room.roomCode).emit("levelChanged", {
        roomCode: room.roomCode,
        byPlayerId: playerId,
        levelIndex
      });
      emitRoomState(room.roomCode);
    });

    socket.on("resetLevel", (payload: { reason: "fall" | "manual" }) => {
      const reason = payload?.reason;
      if (reason !== "fall" && reason !== "manual") {
        return;
      }

      const room = rooms.findRoomBySocket(socket.id);
      const playerId = room?.getPlayerIdBySocket(socket.id);
      if (!room || !playerId) {
        return;
      }

      if (!room.canReset(Date.now())) {
        return;
      }
      room.clearSyncedState();

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
      io.to(room.roomCode).emit("roomState", room.getRoomState());
    });
  });

  const loop = new ServerGameLoop(() => rooms.fixedUpdate());
  loop.start();

  console.log(`Pala Park server listening on ${port}`);
}

function isValidClientId(clientId: unknown): clientId is string {
  return typeof clientId === "string" && clientId.trim().length > 0 && clientId.length <= 128;
}

function isValidRoomCode(roomCode: unknown): roomCode is string {
  return typeof roomCode === "string" && /^[A-Z0-9]{4,8}$/i.test(roomCode.trim());
}

function isValidPlayerPose(pose: PlayerPose | null | undefined): pose is PlayerPose {
  return (
    Boolean(pose) &&
    typeof pose?.playerId === "string" &&
    isFiniteNumber(pose.position?.x) &&
    isFiniteNumber(pose.position?.y) &&
    isFiniteNumber(pose.position?.z) &&
    isFiniteNumber(pose.velocity?.x) &&
    isFiniteNumber(pose.velocity?.y) &&
    isFiniteNumber(pose.velocity?.z) &&
    isFiniteNumber(pose.yaw)
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
