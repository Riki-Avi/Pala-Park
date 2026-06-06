export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type EntityType =
  | "player"
  | "platform"
  | "button"
  | "door"
  | "goal-zone";

export interface PlayerInput {
  sequence: number;
  tick: number;
  left: boolean;
  right: boolean;
  forward: boolean;
  backward: boolean;
  jump: boolean;
  interact: boolean;
  down?: boolean;
}

export interface PlayerSnapshot {
  id: string;
  position: Vec3;
  rotation: Vec3;
  velocity: Vec3;
  isGrounded: boolean;
  inGoal: boolean;
  lastProcessedInput: number;
}

export interface EntitySnapshot {
  id: string;
  type: EntityType;
  position: Vec3;
  active: boolean;
}

export interface NetworkedEntity<TSnapshot> {
  id: string;
  getSnapshot(): TSnapshot;
  applySnapshot(snapshot: TSnapshot): void;
}
