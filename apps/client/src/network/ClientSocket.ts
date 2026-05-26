import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  LevelResetPayload,
  PlayerPose,
  RoomJoinedPayload,
  RoomPlayer,
  ServerToClientEvents
} from "@game/shared";

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export class ClientSocket {
  private readonly socket: GameSocket;
  private readonly sessionHandlers: Array<(session: RoomJoinedPayload) => void> = [];
  private readonly playersHandlers: Array<(players: RoomPlayer[]) => void> = [];
  private readonly poseHandlers: Array<(pose: PlayerPose) => void> = [];
  private readonly resetHandlers: Array<(payload: LevelResetPayload) => void> = [];
  private readonly statusHandlers: Array<(message: string) => void> = [];

  constructor() {
    const serverUrl =
      import.meta.env.VITE_SERVER_URL ?? `${window.location.protocol}//${window.location.hostname}:3000`;

    this.socket = io(serverUrl, {
      autoConnect: true,
      transports: ["websocket", "polling"]
    });

    this.socket.on("connect", () => this.emitStatus("Servidor conectado"));
    this.socket.on("disconnect", () => this.emitStatus("Servidor desconectado"));
    this.socket.on("connect_error", () => this.emitStatus("No se pudo conectar al servidor"));
    this.socket.on("errorMessage", ({ message }) => this.emitStatus(message));

    this.socket.on("roomCreated", (session) => this.handleSession(session));
    this.socket.on("roomJoined", (session) => this.handleSession(session));
    this.socket.on("playerJoined", ({ players }) => {
      this.playersHandlers.forEach((handler) => handler(players));
      this.emitStatus(`Jugadores en sala: ${players.length}`);
    });
    this.socket.on("playerLeft", ({ players }) => {
      this.playersHandlers.forEach((handler) => handler(players));
      this.emitStatus(`Jugadores en sala: ${players.length}`);
    });
    this.socket.on("playerPose", (pose) => this.poseHandlers.forEach((handler) => handler(pose)));
    this.socket.on("levelReset", (payload) => this.resetHandlers.forEach((handler) => handler(payload)));
  }

  createRoom(): void {
    this.socket.emit("createRoom");
    this.emitStatus("Creando sala...");
  }

  joinRoom(roomCode: string): void {
    this.socket.emit("joinRoom", { roomCode: roomCode.trim().toUpperCase() });
    this.emitStatus("Uniendose a sala...");
  }

  sendPlayerPose(pose: PlayerPose): void {
    this.socket.emit("playerPose", pose);
  }

  requestReset(reason: "fall" | "manual"): void {
    this.socket.emit("resetLevel", { reason });
  }

  onSession(handler: (session: RoomJoinedPayload) => void): void {
    this.sessionHandlers.push(handler);
  }

  onPlayers(handler: (players: RoomPlayer[]) => void): void {
    this.playersHandlers.push(handler);
  }

  onPlayerPose(handler: (pose: PlayerPose) => void): void {
    this.poseHandlers.push(handler);
  }

  onLevelReset(handler: (payload: LevelResetPayload) => void): void {
    this.resetHandlers.push(handler);
  }

  onStatus(handler: (message: string) => void): void {
    this.statusHandlers.push(handler);
  }

  private handleSession(session: RoomJoinedPayload): void {
    this.sessionHandlers.forEach((handler) => handler(session));
    this.playersHandlers.forEach((handler) => handler(session.players));
    this.emitStatus(`Sala ${session.roomCode} - sos ${session.playerId}`);
  }

  private emitStatus(message: string): void {
    this.statusHandlers.forEach((handler) => handler(message));
  }
}
