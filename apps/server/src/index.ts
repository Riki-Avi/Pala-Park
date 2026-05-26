import RAPIER from "@dimforge/rapier3d-compat";
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
      origin: clientUrl
    }
  });

  io.on("connection", (socket) => {
    socket.on("createRoom", () => {
      const room = rooms.createRoom();
      const playerId = `p-${socket.id.slice(0, 6)}`;
      room.addPlayer(playerId, socket.id);
      socket.join(room.roomCode);
      socket.emit("roomCreated", { roomCode: room.roomCode, playerId });
    });

    socket.on("joinRoom", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.joinRoom(roomCode);
      if (!room) {
        socket.emit("errorMessage", { message: "No se pudo entrar a la sala." });
        return;
      }

      const playerId = `p-${socket.id.slice(0, 6)}`;
      room.addPlayer(playerId, socket.id);
      socket.join(room.roomCode);
      socket.emit("roomJoined", { roomCode: room.roomCode, playerId });
      socket.to(room.roomCode).emit("playerJoined", { playerId });
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
