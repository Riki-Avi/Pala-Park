import type { EntitySnapshot, PlayerInput, PlayerSnapshot } from "./entities";

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

export interface ClientToServerEvents {
  createRoom: () => void;
  joinRoom: (payload: { roomCode: string }) => void;
  playerInput: (payload: PlayerInput) => void;
  playerReady: () => void;
  requestStartGame: () => void;
}

export interface ServerToClientEvents {
  roomCreated: (payload: { roomCode: string; playerId: string }) => void;
  roomJoined: (payload: { roomCode: string; playerId: string }) => void;
  gameSnapshot: (payload: GameSnapshot) => void;
  errorMessage: (payload: { message: string }) => void;
}
