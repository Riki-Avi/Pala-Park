import type { EntitySnapshot, PlayerInput, PlayerSnapshot, Vec3 } from "./entities";

export type RoomLifecycleState =
  | "WAITING"
  | "READY"
  | "PLAYING"
  | "LEVEL_COMPLETED"
  | "FINISHED"
  | "CLOSED";

export interface GameSnapshot {
  serverTick: number;
  players: PlayerSnapshot[];
  entities: EntitySnapshot[];
}

export interface RoomPlayer {
  id: string;
}

export interface RoomJoinedPayload {
  roomCode: string;
  playerId: string;
  players: RoomPlayer[];
  levelState?: LevelStatePayload;
}

export interface PlayerPose {
  playerId: string;
  position: Vec3;
  velocity: Vec3;
  yaw: number;
}

export interface BoxState {
  id: string;
  position: Vec3;
  velocity: Vec3;
}

export interface ButtonState {
  id: string;
  pressed: boolean;
}

export interface DoorState {
  id: string;
  open: boolean;
}

export interface LevelStatePayload {
  roomCode: string;
  levelId: string;
  serverTick: number;
  boxes: BoxState[];
  buttons: ButtonState[];
  doors: DoorState[];
}

export interface LevelResetPayload {
  roomCode: string;
  byPlayerId: string;
  resetId: number;
  reason: "fall" | "manual";
}

export interface ClientToServerEvents {
  createRoom: (payload: { clientId: string }) => void;
  joinRoom: (payload: { roomCode: string; clientId: string }) => void;
  playerInput: (payload: PlayerInput) => void;
  playerPose: (payload: PlayerPose) => void;
  levelState: (payload: LevelStatePayload) => void;
  resetLevel: (payload: { reason: "fall" | "manual" }) => void;
  playerReady: () => void;
  requestStartGame: () => void;
}

export interface ServerToClientEvents {
  roomCreated: (payload: RoomJoinedPayload) => void;
  roomJoined: (payload: RoomJoinedPayload) => void;
  playerJoined: (payload: { playerId: string; players: RoomPlayer[] }) => void;
  playerLeft: (payload: { playerId: string; players: RoomPlayer[] }) => void;
  playerPose: (payload: PlayerPose) => void;
  levelState: (payload: LevelStatePayload) => void;
  levelReset: (payload: LevelResetPayload) => void;
  gameSnapshot: (payload: GameSnapshot) => void;
  errorMessage: (payload: { message: string }) => void;
}
