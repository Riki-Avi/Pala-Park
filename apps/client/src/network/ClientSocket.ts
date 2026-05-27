import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  LevelResetPayload,
  LevelStatePayload,
  PlayerPose,
  RoomJoinedPayload,
  RoomPlayer,
  RoomStatePayload,
  ServerToClientEvents
} from "@game/shared";

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export class ClientSocket {
  private readonly socket: GameSocket;
  private readonly clientId = getOrCreateClientId();
  private readonly serverUrl: string;
  private readonly sessionHandlers: Array<(session: RoomJoinedPayload) => void> = [];
  private readonly playersHandlers: Array<(players: RoomPlayer[]) => void> = [];
  private readonly roomStateHandlers: Array<(payload: RoomStatePayload) => void> = [];
  private readonly gameStartedHandlers: Array<(payload: RoomStatePayload) => void> = [];
  private readonly poseHandlers: Array<(pose: PlayerPose) => void> = [];
  private readonly levelStateHandlers: Array<(payload: LevelStatePayload) => void> = [];
  private readonly resetHandlers: Array<(payload: LevelResetPayload) => void> = [];
  private readonly statusHandlers: Array<(message: string) => void> = [];

  constructor() {
    this.serverUrl = import.meta.env.VITE_SERVER_URL ?? `${window.location.protocol}//${window.location.hostname}:3001`;

    this.socket = io(this.serverUrl, {
      autoConnect: true,
      transports: ["websocket", "polling"]
    });

    this.socket.on("connect", () => this.emitStatus(`Servidor conectado: ${this.serverUrl}`));
    this.socket.on("disconnect", () => this.emitStatus("Servidor desconectado"));
    this.socket.on("connect_error", () => this.emitStatus(`No se pudo conectar a ${this.serverUrl}`));
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
    this.socket.on("roomState", (payload) => {
      this.roomStateHandlers.forEach((handler) => handler(payload));
      this.emitLobbyStatus(payload);
    });
    this.socket.on("gameStarted", (payload) => {
      this.roomStateHandlers.forEach((handler) => handler(payload));
      this.gameStartedHandlers.forEach((handler) => handler(payload));
      this.emitStatus("Partida iniciada");
    });
    this.socket.on("playerPose", (pose) => this.poseHandlers.forEach((handler) => handler(pose)));
    this.socket.on("levelState", (payload) => this.levelStateHandlers.forEach((handler) => handler(payload)));
    this.socket.on("levelReset", (payload) => this.resetHandlers.forEach((handler) => handler(payload)));
  }

  createRoom(): void {
    this.socket.emit("createRoom", { clientId: this.clientId });
    this.emitStatus("Creando sala...");
  }

  joinRoom(roomCode: string): void {
    this.socket.emit("joinRoom", { roomCode: roomCode.trim().toUpperCase(), clientId: this.clientId });
    this.emitStatus("Uniendose a sala...");
  }

  sendPlayerPose(pose: PlayerPose): void {
    this.socket.emit("playerPose", pose);
  }

  sendLevelState(payload: LevelStatePayload): void {
    this.socket.emit("levelState", payload);
  }

  requestReset(reason: "fall" | "manual"): void {
    this.socket.emit("resetLevel", { reason });
  }

  getServerUrl(): string {
    return this.serverUrl;
  }

  onSession(handler: (session: RoomJoinedPayload) => void): void {
    this.sessionHandlers.push(handler);
  }

  onPlayers(handler: (players: RoomPlayer[]) => void): void {
    this.playersHandlers.push(handler);
  }

  onRoomState(handler: (payload: RoomStatePayload) => void): void {
    this.roomStateHandlers.push(handler);
  }

  onGameStarted(handler: (payload: RoomStatePayload) => void): void {
    this.gameStartedHandlers.push(handler);
  }

  onPlayerPose(handler: (pose: PlayerPose) => void): void {
    this.poseHandlers.push(handler);
  }

  onLevelState(handler: (payload: LevelStatePayload) => void): void {
    this.levelStateHandlers.push(handler);
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
    this.roomStateHandlers.forEach((handler) => handler(session.roomState));
    this.emitLobbyStatus(session.roomState, `Sala ${session.roomCode} - sos ${session.playerId}`);
  }

  private emitStatus(message: string): void {
    this.statusHandlers.forEach((handler) => handler(message));
  }

  private emitLobbyStatus(payload: RoomStatePayload, prefix?: string): void {
    const connectedPlayers = payload.players.filter((player) => player.connected).length;
    const state =
      payload.state === "PLAYING"
        ? "Partida iniciada"
        : `Esperando jugadores ${connectedPlayers}/${payload.requiredPlayers}`;
    this.emitStatus(prefix ? `${prefix} - ${state}` : state);
  }
}

function getOrCreateClientId(): string {
  const key = "pala-park-client-id";
  const existing = window.localStorage.getItem(key);
  if (existing) {
    return existing;
  }

  const id = createClientId();
  window.localStorage.setItem(key, id);
  return id;
}

function createClientId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
