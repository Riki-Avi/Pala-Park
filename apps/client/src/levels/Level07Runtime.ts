import * as THREE from "three";
import type { Vec3 } from "@game/shared";
import { SpiderWebAbility } from "../abilities/SpiderWebAbility";
import { LevelRuntime } from "./LevelRuntime";
import type { Player } from "../entities/Player";
import type { InputManager } from "../input/InputManager";

export class Level07Runtime extends LevelRuntime {
  private readonly spiderWeb = new SpiderWebAbility(
    this.scene,
    () => this.getWebSurfaces()
  );

  override getDeathThreshold(): number {
    return -12.0;
  }

  override onLevelStart(players: Player[]): void {
    this.spiderWeb.start(players);
  }

  override prepareReset(players: Player[]): void {
    this.spiderWeb.prepareReset(players);
  }

  override updateLocal(_playerPositions: Vec3[], activePlayerIndex?: number, inputManager?: InputManager): void {
    this.spiderWeb.update(activePlayerIndex, inputManager);
  }

  override update(playerPositions: Vec3[], activePlayerIndex?: number, inputManager?: InputManager): void {
    this.spiderWeb.update(activePlayerIndex, inputManager);
    super.update(playerPositions, activePlayerIndex, inputManager);
  }

  override syncDynamicMeshes(): void {
    super.syncDynamicMeshes();
    this.spiderWeb.syncMeshes();
  }

  override dispose(): void {
    this.spiderWeb.dispose();
    super.dispose();
  }

  private getWebSurfaces(): THREE.Object3D[] {
    return this.objects.filter((object) => object.visible && object instanceof THREE.Mesh);
  }
}
