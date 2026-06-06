import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { FIXED_DELTA, type LevelCustomStatePayload, type Vec3 } from "@game/shared";
import { LevelRuntime } from "./LevelRuntime";
import type { Player } from "../entities/Player";
import type { InputManager } from "../input/InputManager";
import { createBox, standardMaterials } from "../render/MeshFactory";

export class Level11Runtime extends LevelRuntime {
  private levelPlayers: Player[] = [];
  private elapsed = 0;
  private ghostPlayerIndex = 0;
  private disableBlindness = false;

  // Fog & background preservation
  private originalFog: THREE.FogBase | null = null;
  private originalBackground: THREE.Color | THREE.Texture | null = null;

  // Tethers
  private tetherLines: THREE.Line[] = [];

  // Moving Lasers
  private laser1Mesh!: THREE.Mesh;
  private laser1Body!: RAPIER.RigidBody;
  private laser2Mesh!: THREE.Mesh;
  private laser2Body!: RAPIER.RigidBody;

  // Custom materials for disposal
  private laserMaterial!: THREE.MeshBasicMaterial;
  private wallMaterial!: THREE.MeshStandardMaterial;

  constructor(
    definition: any,
    scene: THREE.Scene,
    world: RAPIER.World
  ) {
    super(definition, scene, world);
    const ghostSelect = document.querySelector<HTMLSelectElement>("#ghost-select");
    this.ghostPlayerIndex = ghostSelect ? Number(ghostSelect.value) : 0;
    const blindnessToggle = document.querySelector<HTMLInputElement>("#blindness-toggle");
    this.disableBlindness = blindnessToggle ? blindnessToggle.checked : false;
    this.createCustomMaterials();
    this.buildMaze();
    this.createTethers();
    this.createLasers();
  }

  override getDeathThreshold(): number {
    return -8.0;
  }

  override prepareReset(players: Player[]): void {
    this.startLevelState(players);
  }

  override onLevelStart(players: Player[]): void {
    this.startLevelState(players);
  }

  override updateLocal(playerPositions: Vec3[], activePlayerIndex?: number, inputManager?: InputManager): void {
    this.updateLasersAndCollisions();
    this.updateFogAndTethers(activePlayerIndex);
  }

  override update(playerPositions: Vec3[], activePlayerIndex?: number, inputManager?: InputManager): void {
    this.updateLasersAndCollisions();
    this.updateFogAndTethers(activePlayerIndex);
    super.update(playerPositions, activePlayerIndex, inputManager);
  }

  override dispose(): void {
    // Restore scene properties
    this.scene.fog = this.originalFog;
    this.scene.background = this.originalBackground;

    // Dispose custom materials
    this.laserMaterial.dispose();
    this.wallMaterial.dispose();

    // Dispose tethers
    for (const line of this.tetherLines) {
      this.scene.remove(line);
      line.geometry.dispose();
      if (line.material instanceof THREE.Material) {
        line.material.dispose();
      }
    }
    this.tetherLines = [];

    // Dispose lasers
    this.scene.remove(this.laser1Mesh);
    this.laser1Mesh.geometry.dispose();
    this.scene.remove(this.laser2Mesh);
    this.laser2Mesh.geometry.dispose();

    this.levelPlayers = [];
    super.dispose();
  }

  protected override getCustomState(): LevelCustomStatePayload {
    return {
      type: "level-11",
      stage: 1,
      ghostIndex: this.ghostPlayerIndex,
      disableBlindness: this.disableBlindness
    };
  }

  protected override applyCustomState(state: LevelCustomStatePayload | undefined): void {
    if (state && state.type === "level-11") {
      if (state.ghostIndex !== undefined && this.ghostPlayerIndex !== state.ghostIndex) {
        this.ghostPlayerIndex = state.ghostIndex;
        this.applyGhostRoles();

        const ghostSelect = document.querySelector<HTMLSelectElement>("#ghost-select");
        if (ghostSelect) {
          ghostSelect.value = String(this.ghostPlayerIndex);
        }
      }
      if (state.disableBlindness !== undefined && this.disableBlindness !== state.disableBlindness) {
        this.disableBlindness = state.disableBlindness;
        const blindnessToggle = document.querySelector<HTMLInputElement>("#blindness-toggle");
        if (blindnessToggle) {
          blindnessToggle.checked = this.disableBlindness;
        }
      }
    }
  }

  private startLevelState(players: Player[]): void {
    this.levelPlayers = players;
    this.elapsed = 0;

    // Cache original fog and background
    if (this.originalFog === null) {
      this.originalFog = this.scene.fog;
      this.originalBackground = this.scene.background;
    }

    this.applyGhostRoles();
  }

  setGhostPlayerIndex(index: number): void {
    if (index >= 0 && index < 4) {
      this.ghostPlayerIndex = index;
      this.applyGhostRoles();
    }
  }

  setDisableBlindness(val: boolean): void {
    this.disableBlindness = val;
  }

  private applyGhostRoles(): void {
    for (let i = 0; i < this.levelPlayers.length; i++) {
      const player = this.levelPlayers[i];
      if (player) {
        player.setGhostMode(i === this.ghostPlayerIndex);
      }
    }
  }

  private createCustomMaterials(): void {
    this.laserMaterial = new THREE.MeshBasicMaterial({
      color: "#ff3333",
      transparent: true,
      opacity: 0.65
    });

    this.wallMaterial = new THREE.MeshStandardMaterial({
      color: "#2a343f",
      roughness: 0.62,
      metalness: 0.1
    });
  }

  private buildMaze(): void {
    // 1. Spawning Maze Floors
    const floors = [
      // Corridor 1 & start bridge (runs horizontally along X, so sizeZ is the width)
      { x: -5, z: -5, sizeX: 5.0, sizeZ: 5.0 },
      { x: 5, z: -5, sizeX: 5.0, sizeZ: 3.0 }, // Narrower
      { x: 10, z: -5, sizeX: 5.0, sizeZ: 2.0 }, // Very narrow
      
      // Corridor 2 (runs vertically along Z, so sizeX is the width)
      { x: 10, z: 0, sizeX: 2.0, sizeZ: 5.0 }, // Very narrow
      { x: 10, z: 10, sizeX: 5.0, sizeZ: 5.0 }, // Turn junction
      
      // Corridor 3 (runs horizontally along X, sizeZ is width)
      { x: 5, z: 10, sizeX: 5.0, sizeZ: 3.0 }, // Narrower
      { x: 0, z: 10, sizeX: 5.0, sizeZ: 5.0 }, // Junction
      
      // Corridor 4 (runs vertically along Z, sizeX is width)
      { x: 0, z: 15, sizeX: 3.0, sizeZ: 5.0 }, // Narrower
      { x: 0, z: 25, sizeX: 5.0, sizeZ: 5.0 }, // Junction
      
      // Corridor 5 (runs horizontally along X, sizeZ is width)
      { x: 5, z: 25, sizeX: 5.0, sizeZ: 4.0 },
      { x: 10, z: 25, sizeX: 5.0, sizeZ: 3.0 }, // Narrower
      { x: 20, z: 25, sizeX: 5.0, sizeZ: 2.0 }, // Very narrow
      { x: 30, z: 25, sizeX: 5.0, sizeZ: 3.0 }, // Narrower
      { x: 35, z: 25, sizeX: 5.0, sizeZ: 5.0 }, // Junction
      
      // Corridor 6 (runs vertically along Z, sizeX is width)
      { x: 35, z: 20, sizeX: 2.5, sizeZ: 5.0 }, // Narrower
      { x: 35, z: 10, sizeX: 3.5, sizeZ: 5.0 }, // Junction
      
      // Corridor 7 & Goal landing pad (runs horizontally, sizeZ is width)
      { x: 40, z: 10, sizeX: 5.0, sizeZ: 3.5 }, // Narrower
      { x: 45, z: 10, sizeX: 5.0, sizeZ: 5.0 }, // Goal landing
      { x: 45, z: 12, sizeX: 5.0, sizeZ: 5.0 },
      { x: 45, z: 14, sizeX: 5.0, sizeZ: 5.0 }
    ];

    for (const [idx, f] of floors.entries()) {
      this.spawnPlatform(
        `maze-floor-${idx}`,
        { x: f.x, y: 0.0, z: f.z },
        { x: f.sizeX, y: 0.6, z: f.sizeZ },
        standardMaterials.floor
      );
    }

    // Spawn tiny gap island in the middle of Corridor 6 (z=15)
    this.spawnPlatform(
      "maze-gap-island",
      { x: 35.0, y: 0.0, z: 15.0 },
      { x: 1.6, y: 0.6, z: 1.6 },
      standardMaterials.step
    );

    // Spawn tiny gap island in the middle of Corridor 2 (z=5)
    this.spawnPlatform(
      "maze-gap-island-2",
      { x: 10.0, y: 0.0, z: 5.0 },
      { x: 1.6, y: 0.6, z: 1.6 },
      standardMaterials.step
    );

    // Spawn tiny gap island in the middle of Corridor 1 (x=0)
    this.spawnPlatform(
      "maze-gap-island-3",
      { x: 0.0, y: 0.0, z: -5.0 },
      { x: 1.6, y: 0.6, z: 1.6 },
      standardMaterials.step
    );

    // Spawn tiny gap island in the middle of Corridor 4 (z=20)
    this.spawnPlatform(
      "maze-gap-island-4",
      { x: 0.0, y: 0.0, z: 20.0 },
      { x: 1.6, y: 0.6, z: 1.6 },
      standardMaterials.step
    );

    // Spawn tiny gap islands in Corridor 5 (x=15 and x=25)
    this.spawnPlatform(
      "maze-gap-island-5",
      { x: 15.0, y: 0.0, z: 25.0 },
      { x: 1.6, y: 0.6, z: 1.6 },
      standardMaterials.step
    );
    this.spawnPlatform(
      "maze-gap-island-6",
      { x: 25.0, y: 0.0, z: 25.0 },
      { x: 1.6, y: 0.6, z: 1.6 },
      standardMaterials.step
    );

    // 2. Spawning Maze Walls (Cleared for open-void platforming)
    const walls: any[] = [];

    for (const [idx, w] of walls.entries()) {
      this.spawnPlatform(
        `maze-wall-${idx}`,
        { x: w.x, y: 1.75, z: w.z },
        { x: w.sizeX, y: 3.5, z: w.sizeZ },
        this.wallMaterial
      );
    }
  }

  private spawnPlatform(
    id: string,
    position: { x: number; y: number; z: number },
    size: { x: number; y: number; z: number },
    material: THREE.Material
  ): void {
    const mesh = createBox(size, material);
    mesh.position.set(position.x, position.y, position.z);
    this.scene.add(mesh);
    this.objects.push(mesh);

    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z)
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2),
      body
    );
    this.physicsObjects.push({ id, body, collider });
    this.platforms.push({ id, position: { x: position.x, y: position.y, z: position.z }, size: { x: size.x, y: size.y, z: size.z } });
  }

  private createTethers(): void {
    // Tether colors matching player colors (Yellow: p2, Green: p3, Violet: p4)
    const colors = ["#ffcf5c", "#69d38f", "#d96cff"];
    for (let i = 0; i < 3; i++) {
      const geom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0)
      ]);
      const mat = new THREE.LineBasicMaterial({
        color: new THREE.Color(colors[i]),
        linewidth: 3,
        transparent: true,
        opacity: 0.8
      });
      const line = new THREE.Line(geom, mat);
      this.scene.add(line);
      this.tetherLines.push(line);
      this.objects.push(line);
    }
  }

  private createLasers(): void {
    // Laser 1: blocks Corridor 2 horizontally (blocks along X, slides along Z)
    const size1 = { x: 4.8, y: 1.5, z: 0.4 };
    this.laser1Mesh = createBox(size1, this.laserMaterial);
    this.scene.add(this.laser1Mesh);

    const body1Desc = RAPIER.RigidBodyDesc.fixed().setTranslation(10.0, 0.75, 0.0);
    this.laser1Body = this.world.createRigidBody(body1Desc);
    const col1Desc = RAPIER.ColliderDesc.cuboid(size1.x / 2, size1.y / 2, size1.z / 2);
    const collider1 = this.world.createCollider(col1Desc, this.laser1Body);
    this.physicsObjects.push({ id: "laser1", body: this.laser1Body, collider: collider1 });

    // Laser 2: blocks Corridor 5 vertically (blocks along Z, slides along X)
    const size2 = { x: 0.4, y: 1.5, z: 4.8 };
    this.laser2Mesh = createBox(size2, this.laserMaterial);
    this.scene.add(this.laser2Mesh);

    const body2Desc = RAPIER.RigidBodyDesc.fixed().setTranslation(10.0, 0.75, 25.0);
    this.laser2Body = this.world.createRigidBody(body2Desc);
    const col2Desc = RAPIER.ColliderDesc.cuboid(size2.x / 2, size2.y / 2, size2.z / 2);
    const collider2 = this.world.createCollider(col2Desc, this.laser2Body);
    this.physicsObjects.push({ id: "laser2", body: this.laser2Body, collider: collider2 });
  }

  private updateLasersAndCollisions(): void {
    this.elapsed += FIXED_DELTA;

    // 1. Patrolling motion for Laser 1 (slides along Z in Corridor 2, range Z: -3.5 to 8.5)
    const minZ = -3.5;
    const maxZ = 8.5;
    const speedZ = 2.4;
    const rangeZ = maxZ - minZ;
    const timeZ = (this.elapsed * speedZ) % (2 * rangeZ);
    const laser1Z = timeZ < rangeZ ? minZ + timeZ : maxZ - (timeZ - rangeZ);

    this.laser1Body.setTranslation({ x: 10.0, y: 0.75, z: laser1Z }, true);
    this.laser1Mesh.position.set(10.0, 0.75, laser1Z);

    // 2. Patrolling motion for Laser 2 (slides along X in Corridor 5, range X: 3.5 to 33.5)
    const minX = 3.5;
    const maxX = 33.5;
    const speedX = 3.6;
    const rangeX = maxX - minX;
    const timeX = (this.elapsed * speedX) % (2 * rangeX);
    const laser2X = timeX < rangeX ? minX + timeX : maxX - (timeX - rangeX);

    this.laser2Body.setTranslation({ x: laser2X, y: 0.75, z: 25.0 }, true);
    this.laser2Mesh.position.set(laser2X, 0.75, 25.0);

    // 3. Collision verification for players
    for (const player of this.levelPlayers) {
      if (player.isGhost) continue;
      const pPos = player.body.translation();

      // Check Laser 1 collision
      if (
        Math.abs(pPos.x - 10.0) < 2.5 &&
        Math.abs(pPos.z - laser1Z) < 0.65 &&
        pPos.y < 2.0
      ) {
        this.shouldReset = true;
      }

      // Check Laser 2 collision
      if (
        Math.abs(pPos.z - 25.0) < 2.5 &&
        Math.abs(pPos.x - laser2X) < 0.65 &&
        pPos.y < 2.0
      ) {
        this.shouldReset = true;
      }
    }
  }

  private updateFogAndTethers(activePlayerIndex?: number): void {
    if (this.levelPlayers.length === 0) return;

    const guidePlayer = this.levelPlayers[this.ghostPlayerIndex];
    if (!guidePlayer) return;
    const guidePos = guidePlayer.body.translation();

    // 1. Update Tethers
    let tetherIdx = 0;
    for (let i = 0; i < this.levelPlayers.length; i++) {
      if (i === this.ghostPlayerIndex) continue;

      const line = this.tetherLines[tetherIdx];
      tetherIdx++;
      if (!line) continue;

      const blindPlayer = this.levelPlayers[i];
      if (!blindPlayer) continue;

      const playerPos = blindPlayer.body.translation();

      const positions = line.geometry.attributes.position.array as Float32Array;
      positions[0] = guidePos.x;
      positions[1] = guidePos.y + 0.35; // guide's chest height
      positions[2] = guidePos.z;
      positions[3] = playerPos.x;
      positions[4] = playerPos.y + 0.35; // player's chest height
      positions[5] = playerPos.z;
      line.geometry.attributes.position.needsUpdate = true;
      line.geometry.computeBoundingBox();
      line.geometry.computeBoundingSphere();
    }

    // 2. Update Fog depending on who is currently controlled
    const activeIdx = activePlayerIndex ?? 0;
    if (activeIdx === this.ghostPlayerIndex || this.disableBlindness) {
      // Guide has standard visibility of the whole maze
      this.scene.fog = new THREE.Fog("#20242c", 28.0, 90.0);
      this.scene.background = new THREE.Color("#20242c");
    } else {
      // Blind player: very thick black fog
      const activePlayer = this.levelPlayers[activeIdx];
      if (activePlayer) {
        const activePos = activePlayer.body.translation();
        const distToGuide = Math.hypot(activePos.x - guidePos.x, activePos.z - guidePos.z);

        // Visibility bonus: see better if grouped near the Guide
        if (distToGuide < 6.5) {
          this.scene.fog = new THREE.Fog("#000000", 3.0, 16.0);
        } else {
          this.scene.fog = new THREE.Fog("#000000", 1.8, 8.5);
        }
      } else {
        this.scene.fog = new THREE.Fog("#000000", 1.8, 8.5);
      }
      this.scene.background = new THREE.Color("#000000");
    }
  }
}
