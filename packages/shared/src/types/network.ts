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
  connected: boolean;
}

export interface RoomStatePayload {
  roomCode: string;
  state: RoomLifecycleState;
  players: RoomPlayer[];
  requiredPlayers: number;
  hostPlayerId: string;
  levelIndex: number;
}

export interface RoomJoinedPayload {
  roomCode: string;
  playerId: string;
  players: RoomPlayer[];
  roomState: RoomStatePayload;
  levelState?: LevelStatePayload;
  goalProgress?: GoalProgressPayload;
}

export interface PlayerPose {
  playerId: string;
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  isActionActive: boolean;
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

export interface Level04StatePayload {
  type: "level-04";
  keyCollected: boolean;
}

export interface Level05EntityState {
  index: number;
  health: number;
  destroyed: boolean;
}

export interface Level05BarrierState {
  index: number;
  position: Vec3;
  active: boolean;
}

export interface Level05ProjectileState {
  id: string;
  position: Vec3;
}

export interface Level05StatePayload {
  type: "level-05";
  blocks: Level05EntityState[];
  turrets: Level05EntityState[];
  barriers: Level05BarrierState[];
  playerLasers: Level05ProjectileState[];
  enemyProjectiles: Level05ProjectileState[];
}

export type LevelCustomStatePayload = Level04StatePayload | Level05StatePayload;

export interface LevelStatePayload {
  roomCode: string;
  levelId: string;
  serverTick: number;
  boxes: BoxState[];
  buttons: ButtonState[];
  doors: DoorState[];
  custom?: LevelCustomStatePayload;
}

export interface GoalProgressPayload {
  roomCode: string;
  levelId: string;
  serverTick: number;
  requiredPlayers: number;
  playersInGoal: string[];
  completed: boolean;
}

export interface LevelResetPayload {
  roomCode: string;
  byPlayerId: string;
  resetId: number;
  reason: "fall" | "manual";
}

export interface LevelChangedPayload {
  roomCode: string;
  byPlayerId: string;
  levelIndex: number;
}

export interface ClientToServerEvents {
  createRoom: (payload: { clientId: string }) => void;
  joinRoom: (payload: { roomCode: string; clientId: string }) => void;
  playerInput: (payload: PlayerInput) => void;
  playerPose: (payload: PlayerPose) => void;
  levelState: (payload: LevelStatePayload) => void;
  goalProgress: (payload: GoalProgressPayload) => void;
  resetLevel: (payload: { reason: "fall" | "manual" }) => void;
  requestLevelChange: (payload: { levelIndex: number }) => void;
  playerReady: () => void;
  requestStartGame: () => void;
}

export interface ServerToClientEvents {
  roomCreated: (payload: RoomJoinedPayload) => void;
  roomJoined: (payload: RoomJoinedPayload) => void;
  playerJoined: (payload: { playerId: string; players: RoomPlayer[] }) => void;
  playerLeft: (payload: { playerId: string; players: RoomPlayer[] }) => void;
  roomState: (payload: RoomStatePayload) => void;
  gameStarted: (payload: RoomStatePayload) => void;
  playerPose: (payload: PlayerPose) => void;
  levelState: (payload: LevelStatePayload) => void;
  goalProgress: (payload: GoalProgressPayload) => void;
  levelReset: (payload: LevelResetPayload) => void;
  levelChanged: (payload: LevelChangedPayload) => void;
  gameSnapshot: (payload: GameSnapshot) => void;
  errorMessage: (payload: { message: string }) => void;
}
