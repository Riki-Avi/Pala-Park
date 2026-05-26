import * as THREE from "three";
import type { GoalZoneDefinition, Vec3 } from "@game/shared";

export class GoalZone {
  constructor(
    readonly definition: GoalZoneDefinition,
    readonly mesh: THREE.Mesh
  ) {}

  contains(position: Vec3): boolean {
    return (
      Math.abs(position.x - this.definition.position.x) <= this.definition.size.x / 2 &&
      Math.abs(position.y - this.definition.position.y) <= this.definition.size.y / 2 + 0.75 &&
      Math.abs(position.z - this.definition.position.z) <= this.definition.size.z / 2
    );
  }

  isCompleted(playerPositions: Vec3[]): boolean {
    const playersInside = playerPositions.filter((position) => this.contains(position)).length;
    const required =
      this.definition.requiredPlayers === "all" ? playerPositions.length : this.definition.requiredPlayers;
    return playersInside >= required;
  }
}
