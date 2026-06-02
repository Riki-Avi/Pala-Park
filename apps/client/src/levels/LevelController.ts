import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import type { LevelDefinition } from "@game/shared";
import { LevelRuntime } from "./LevelRuntime";
import { Level03Runtime } from "./Level03Runtime";
import { Level04Runtime } from "./Level04Runtime";
import { Level05Runtime } from "./Level05Runtime";
import { Level06Runtime } from "./Level06Runtime";

export class LevelController {
  private runtime: LevelRuntime | null = null;
  private loadRequestId = 0;
  private activeLoad: Promise<LevelRuntime> | null = null;
  public currentIndex = 0;

  constructor(
    private readonly levelFiles: string[],
    private readonly scene: THREE.Scene,
    private readonly world: RAPIER.World
  ) {}

  get current(): LevelRuntime {
    if (!this.runtime) {
      throw new Error("No level loaded yet");
    }
    return this.runtime;
  }

  get currentDefinition(): LevelDefinition {
    return this.current.definition;
  }

  get levelsLength(): number {
    return this.levelFiles.length;
  }

  async load(index: number): Promise<LevelRuntime> {
    const requestId = ++this.loadRequestId;
    const load = this.loadRequested(index, requestId);
    this.activeLoad = load;
    return await load;
  }

  private async loadRequested(index: number, requestId: number): Promise<LevelRuntime> {
    const filename = this.levelFiles[index];
    const response = await fetch(`/levels/${filename}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch level ${filename}: ${response.statusText}`);
    }
    const definition = (await response.json()) as LevelDefinition;

    if (requestId !== this.loadRequestId) {
      return await (this.activeLoad ?? Promise.resolve(this.current));
    }

    this.runtime?.dispose();
    this.currentIndex = index;
    this.runtime = this.createRuntime(definition);
    return this.runtime;
  }

  async loadNext(): Promise<LevelRuntime> {
    return await this.load((this.currentIndex + 1) % this.levelFiles.length);
  }

  resetDynamicObjects(): void {
    this.runtime?.resetDynamicObjects();
  }

  private createRuntime(definition: LevelDefinition): LevelRuntime {
    if (definition.id === "level-03") {
      return new Level03Runtime(definition, this.scene, this.world);
    }
    if (definition.id === "level-04") {
      return new Level04Runtime(definition, this.scene, this.world);
    }
    if (definition.id === "level-05") {
      return new Level05Runtime(definition, this.scene, this.world);
    }
    if (definition.id === "level-06") {
      return new Level06Runtime(definition, this.scene, this.world);
    }
    return new LevelRuntime(definition, this.scene, this.world);
  }

  dispose(): void {
    this.runtime?.dispose();
  }
}
