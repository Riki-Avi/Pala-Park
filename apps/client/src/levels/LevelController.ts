import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import type { LevelDefinition } from "@game/shared";
import { LevelRuntime } from "./LevelRuntime";

export class LevelController {
  private runtime: LevelRuntime;

  constructor(
    private readonly levels: LevelDefinition[],
    private readonly scene: THREE.Scene,
    private readonly world: RAPIER.World,
    private currentIndex: number
  ) {
    this.runtime = new LevelRuntime(this.currentDefinition, this.scene, this.world);
  }

  get current(): LevelRuntime {
    return this.runtime;
  }

  get currentDefinition(): LevelDefinition {
    return this.levels[this.currentIndex];
  }

  load(index: number): LevelRuntime {
    this.currentIndex = index;
    this.runtime.dispose();
    this.runtime = new LevelRuntime(this.currentDefinition, this.scene, this.world);
    return this.runtime;
  }

  loadNext(): LevelRuntime {
    return this.load((this.currentIndex + 1) % this.levels.length);
  }

  resetDynamicObjects(): void {
    this.runtime.resetDynamicObjects();
  }

  dispose(): void {
    this.runtime.dispose();
  }
}
