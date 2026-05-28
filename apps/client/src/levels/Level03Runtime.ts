import type { Vec3 } from "@game/shared";
import { LevelRuntime } from "./LevelRuntime";

export class Level03Runtime extends LevelRuntime {
  override update(playerPositions: Vec3[], activePlayerIndex?: number, inputManager?: any): void {
    const weightPositions = [...playerPositions, ...this.boxes.map((box) => box.getPosition())];

    for (const button of this.buttons) {
      button.update(weightPositions);
    }

    this.updateAdvancedDoors();
  }
}
