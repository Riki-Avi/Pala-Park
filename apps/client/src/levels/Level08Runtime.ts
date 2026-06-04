import * as THREE from "three";
import type { Vec3 } from "@game/shared";
import { RopeAbility } from "../abilities/RopeAbility";
import { LevelRuntime } from "./LevelRuntime";
import type { Player } from "../entities/Player";
import type { InputManager } from "../input/InputManager";

export class Level08Runtime extends LevelRuntime {
  private readonly rope = new RopeAbility(
    this.scene,
    () => this.getRopeSurfaces()
  );

  override getDeathThreshold(): number {
    return -12.0;
  }

  override prepareReset(players: Player[]): void {
    this.rope.prepareReset(players);
  }

  override onLevelStart(players: Player[]): void {
    this.rope.start(players);
  }

  override updateLocal(_playerPositions: Vec3[], _activePlayerIndex?: number, _inputManager?: InputManager): void {
    this.rope.update();
  }

  override update(playerPositions: Vec3[], activePlayerIndex?: number, inputManager?: InputManager): void {
    this.rope.update();
    super.update(playerPositions, activePlayerIndex, inputManager);
  }

  override syncDynamicMeshes(): void {
    super.syncDynamicMeshes();
    this.rope.syncMeshes();
  }

  override dispose(): void {
    this.rope.dispose();
    super.dispose();
  }

  private getRopeSurfaces(): THREE.Object3D[] {
    const ignored = new Set<THREE.Object3D>([
      ...this.buttons.map((button) => button.mesh),
      ...this.goalZones.map((goalZone) => goalZone.mesh)
    ]);

    return this.objects.filter(
      (object) => object.visible && object instanceof THREE.Mesh && !ignored.has(object)
    );
  }
}
