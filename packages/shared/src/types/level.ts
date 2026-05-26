import type { Vec3 } from "./entities";

export interface PlatformDefinition {
  id: string;
  position: Vec3;
  size: Vec3;
}

export interface ButtonDefinition {
  id: string;
  position: Vec3;
  size: Vec3;
  targetDoorIds: string[];
  mode: "hold" | "toggle";
}

export interface DoorDefinition {
  id: string;
  position: Vec3;
  size: Vec3;
}

export interface GoalZoneDefinition {
  id: string;
  position: Vec3;
  size: Vec3;
  requiredPlayers: "all" | number;
}

export interface BoxDefinition {
  id: string;
  position: Vec3;
  size: Vec3;
}

export interface LevelDefinition {
  id: string;
  name: string;
  objective: string;
  spawnPoints: Vec3[];
  platforms: PlatformDefinition[];
  boxes: BoxDefinition[];
  buttons: ButtonDefinition[];
  doors: DoorDefinition[];
  goalZones: GoalZoneDefinition[];
}
