import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { FIXED_DELTA, type LevelCustomStatePayload, type Vec3 } from "@game/shared";
import { LevelRuntime } from "./LevelRuntime";
import type { Player } from "../entities/Player";
import type { InputManager } from "../input/InputManager";
import { createBox, standardMaterials } from "../render/MeshFactory";

const EMOJI_POOL = ["🍎", "🍌", "🍇", "🍊", "🍉", "🍓", "🍍", "🥝", "🍒", "🍑", "🍋", "🍏", "🍐", "🍈", "🥥", "🥭"] as const;

interface DoorInstance {
  mesh: THREE.Mesh;
  signMesh: THREE.Mesh;
  body: RAPIER.RigidBody | null;
  collider: RAPIER.Collider | null;
  emoji: string;
  isCorrect: boolean;
  isOpen: boolean;
  localZ: number;
}

interface WallInstance {
  index: number;
  baseX: number;
  currentX: number;
  speed: number;
  phase: number;
  amplitude: number;
  frameGroup: THREE.Group;
  frameBody: RAPIER.RigidBody;
  doors: DoorInstance[];
}

export class Level10Runtime extends LevelRuntime {
  private levelPlayers: Player[] = [];
  private sequence: string[] = [];
  private elapsed = 0;
  private walls: WallInstance[] = [];

  // Billboard
  private billboardMesh!: THREE.Mesh;
  private billboardPillars: THREE.Mesh[] = [];
  private billboardTexture: THREE.Texture | null = null;
  private billboardMaterial: THREE.MeshBasicMaterial | null = null;

  // Sign textures & materials to dispose
  private doorTextures: THREE.Texture[] = [];
  private doorMaterials: THREE.MeshStandardMaterial[] = [];

  constructor(
    definition: any,
    scene: THREE.Scene,
    world: RAPIER.World
  ) {
    super(definition, scene, world);
    this.createSpawnBillboard();
    this.createWallsAndDoors();
  }

  override getDeathThreshold(): number {
    return -10.0;
  }

  override prepareReset(players: Player[]): void {
    this.startLevelState(players);
  }

  override onLevelStart(players: Player[]): void {
    this.startLevelState(players);
  }

  override updateLocal(_playerPositions: Vec3[], _activePlayerIndex?: number, _inputManager?: InputManager): void {
    this.updateWalls();
  }

  override update(playerPositions: Vec3[], activePlayerIndex?: number, inputManager?: InputManager): void {
    this.updateWalls();
    super.update(playerPositions, activePlayerIndex, inputManager);
  }

  override dispose(): void {
    this.restorePlayers();

    // Dispose dynamic textures
    this.billboardTexture?.dispose();
    this.billboardMaterial?.dispose();

    for (const texture of this.doorTextures) {
      texture.dispose();
    }
    this.doorTextures = [];

    for (const material of this.doorMaterials) {
      material.dispose();
    }
    this.doorMaterials = [];

    // Dispose billboard
    this.scene.remove(this.billboardMesh);
    this.billboardMesh.geometry.dispose();

    for (const pillar of this.billboardPillars) {
      this.scene.remove(pillar);
      pillar.geometry.dispose();
      if (pillar.material instanceof THREE.Material) {
        pillar.material.dispose();
      }
    }
    this.billboardPillars = [];

    // Dispose walls & doors
    for (const wall of this.walls) {
      this.scene.remove(wall.frameGroup);
      wall.frameGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      });

      // Remove wall frame physics
      const framePhys = this.physicsObjects.find((p) => p.id === `wall-frame-${wall.index}`);
      if (framePhys) {
        this.world.removeCollider(framePhys.collider, true);
        this.world.removeRigidBody(framePhys.body);
      }

      for (const door of wall.doors) {
        this.scene.remove(door.mesh);
        door.mesh.geometry.dispose();
        if (door.mesh.material instanceof THREE.Material) {
          door.mesh.material.dispose();
        }
        door.signMesh.geometry.dispose();

        if (door.collider) {
          this.world.removeCollider(door.collider, true);
        }
        if (door.body) {
          this.world.removeRigidBody(door.body);
        }
      }
    }

    this.walls = [];
    this.levelPlayers = [];

    super.dispose();
  }

  protected override getCustomState(): LevelCustomStatePayload {
    this.ensureSequence();
    return {
      type: "level-10",
      sequence: [...this.sequence]
    };
  }

  protected override applyCustomState(state: LevelCustomStatePayload | undefined): void {
    if (state?.type !== "level-10") {
      return;
    }

    const isSame =
      this.sequence.length === state.sequence.length &&
      this.sequence.every((emoji, idx) => emoji === state.sequence[idx]);

    if (!isSame) {
      this.sequence = [...state.sequence];
      this.reapplySequence();
    }
  }

  private startLevelState(players: Player[]): void {
    this.levelPlayers = players;
    this.elapsed = 0;
    this.generateNewSequence();
    this.reapplySequence();
  }

  private ensureSequence(): void {
    if (this.sequence.length === 0) {
      this.generateNewSequence();
    }
  }

  private generateNewSequence(): void {
    const pool = [...EMOJI_POOL];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = pool[i];
      pool[i] = pool[j];
      pool[j] = temp;
    }
    this.sequence = pool.slice(0, 13);
  }

  private reapplySequence(): void {
    this.drawBillboardTexture();

    const GOAL_DEPTH = 1.2;

    for (const wall of this.walls) {
      const correctEmoji = this.sequence[wall.index];
      const correctSlot = (correctEmoji.charCodeAt(0) + wall.index) % 3;

      // Deterministic wrong emojis
      const pool = EMOJI_POOL.filter((e) => e !== correctEmoji);
      const charCode = correctEmoji.charCodeAt(0) || 0;
      const hash1 = (charCode + wall.index * 7) % pool.length;
      const hash2 = (charCode + wall.index * 13 + 3) % pool.length;
      const wrong1 = pool[hash1];
      const wrong2 = pool[hash1 === hash2 ? (hash2 + 1) % pool.length : hash2];

      const emojis = ["", "", ""];
      emojis[correctSlot] = correctEmoji;
      emojis[(correctSlot + 1) % 3] = wrong1;
      emojis[(correctSlot + 2) % 3] = wrong2;

      for (let j = 0; j < 3; j++) {
        const door = wall.doors[j];
        door.emoji = emojis[j];
        door.isCorrect = j === correctSlot;

        // Dispose previous sign material and texture
        const oldMat = door.signMesh.material;
        if (oldMat instanceof THREE.MeshStandardMaterial) {
          oldMat.map?.dispose();
          oldMat.dispose();
          const texIdx = this.doorTextures.indexOf(oldMat.map as THREE.Texture);
          if (texIdx > -1) this.doorTextures.splice(texIdx, 1);
          const matIdx = this.doorMaterials.indexOf(oldMat);
          if (matIdx > -1) this.doorMaterials.splice(matIdx, 1);
        }

        // Create new texture and material for the door sign
        const texture = this.createDoorSignTexture(door.emoji, door.isCorrect ? "#69d38f" : "#d85454");
        const material = new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.52,
          metalness: 0.08
        });

        this.doorTextures.push(texture);
        this.doorMaterials.push(material);
        door.signMesh.material = material;
        door.isOpen = false;
        door.mesh.material = standardMaterials.door;

        // Recreate door physics if it was destroyed
        if (!door.body) {
          const bodyDesc = RAPIER.RigidBodyDesc.fixed()
            .setTranslation(wall.currentX, 1.75, door.localZ);
          door.body = this.world.createRigidBody(bodyDesc);

          const colliderDesc = RAPIER.ColliderDesc.cuboid(0.15, 1.75, 2.0)
            .setRestitution(0.2)
            .setFriction(0.2);
          door.collider = this.world.createCollider(colliderDesc, door.body);
        } else {
          door.body.setTranslation({ x: wall.currentX, y: 1.75, z: door.localZ }, true);
        }
      }
    }
  }

  private createSpawnBillboard(): void {
    // Pillars for billboard support
    const pillarMat = new THREE.MeshStandardMaterial({ color: "#2e3a47", roughness: 0.72 });
    const pGeom = new THREE.BoxGeometry(0.3, 3.0, 0.3);
    const p1 = new THREE.Mesh(pGeom, pillarMat);
    p1.position.set(1.0, 1.5, -5.8);
    const p2 = new THREE.Mesh(pGeom, pillarMat);
    p2.position.set(1.0, 1.5, 5.8);
    this.scene.add(p1, p2);
    this.billboardPillars.push(p1, p2);

    // Board backplane
    const boardMat = new THREE.MeshStandardMaterial({ color: "#1e242c", roughness: 0.65 });
    const boardGeom = new THREE.BoxGeometry(0.2, 2.5, 12.0);
    const board = new THREE.Mesh(boardGeom, boardMat);
    board.position.set(1.0, 3.25, 0.0);
    this.scene.add(board);
    this.billboardPillars.push(board); // Keep track for disposal

    // Text face plane
    const planeGeom = new THREE.PlaneGeometry(11.9, 2.4);
    this.billboardMesh = new THREE.Mesh(planeGeom);
    this.billboardMesh.position.set(0.89, 3.25, 0.0);
    this.billboardMesh.rotation.y = -Math.PI / 2; // Face spawn points at -X
    this.scene.add(this.billboardMesh);
  }

  private drawBillboardTexture(): void {
    this.billboardTexture?.dispose();
    this.billboardMaterial?.dispose();

    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Background
      ctx.fillStyle = "#161b22";
      ctx.fillRect(0, 0, 1024, 128);

      // Gold frame
      ctx.strokeStyle = "#e9c46a";
      ctx.lineWidth = 8;
      ctx.strokeRect(0, 0, 1024, 128);

      // Label text
      ctx.fillStyle = "#a8b3c4";
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("SECUENCIA CORRECTA", 512, 30);

      // Emojis
      ctx.font = "bold 44px sans-serif, \"Segoe UI Emoji\", \"Apple Color Emoji\", \"Noto Color Emoji\"";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const padding = 60;
      const spacing = (1024 - 2 * padding) / 12;
      for (let i = 0; i < 13; i++) {
        const x = padding + i * spacing;
        ctx.fillText(this.sequence[i], x, 80);
      }
    }

    this.billboardTexture = new THREE.CanvasTexture(canvas);
    this.billboardMaterial = new THREE.MeshBasicMaterial({
      map: this.billboardTexture,
      side: THREE.DoubleSide
    });
    this.billboardMesh.material = this.billboardMaterial;
  }

  private createDoorSignTexture(emoji: string, color: string): THREE.Texture {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#1e242c";
      ctx.fillRect(0, 0, 128, 128);

      ctx.strokeStyle = color;
      ctx.lineWidth = 10;
      ctx.strokeRect(0, 0, 128, 128);

      ctx.font = "bold 80px sans-serif, \"Segoe UI Emoji\", \"Apple Color Emoji\", \"Noto Color Emoji\"";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(emoji, 64, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  private createWallsAndDoors(): void {
    const WALL_SPACING = 10.0;
    const FIRST_WALL_X = 15.0;

    for (let i = 0; i < 13; i++) {
      const baseX = FIRST_WALL_X + i * WALL_SPACING;

      // Create visual group for the wall frame
      const frameGroup = new THREE.Group();

      const pillarMat = new THREE.MeshStandardMaterial({ color: "#3a4754", roughness: 0.65 });
      const pillarGeom = new THREE.BoxGeometry(0.6, 3.5, 0.6);

      // 4 Pillars
      const zCoords = [-7.0, -2.33, 2.33, 7.0];
      for (const z of zCoords) {
        const pillar = new THREE.Mesh(pillarGeom, pillarMat);
        pillar.position.set(0, 1.75, z);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        frameGroup.add(pillar);
      }

      // Side blockers extending into the void to prevent cheating
      const blockerGeom = new THREE.BoxGeometry(0.6, 3.5, 18.0);
      const leftBlocker = new THREE.Mesh(blockerGeom, pillarMat);
      leftBlocker.position.set(0, 1.75, -16.3);
      leftBlocker.castShadow = true;
      leftBlocker.receiveShadow = true;
      
      const rightBlocker = new THREE.Mesh(blockerGeom, pillarMat);
      rightBlocker.position.set(0, 1.75, 16.3);
      rightBlocker.castShadow = true;
      rightBlocker.receiveShadow = true;
      
      frameGroup.add(leftBlocker, rightBlocker);

      // Crossbar
      const crossbarGeom = new THREE.BoxGeometry(0.6, 0.6, 14.6);
      const crossbar = new THREE.Mesh(crossbarGeom, pillarMat);
      crossbar.position.set(0, 3.5, 0);
      crossbar.castShadow = true;
      crossbar.receiveShadow = true;
      frameGroup.add(crossbar);

      frameGroup.position.set(baseX, 0, 0);
      this.scene.add(frameGroup);

      // Create Rapier rigid body for the wall frame
      const bodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(baseX, 0, 0);
      const frameBody = this.world.createRigidBody(bodyDesc);

      // Attach 4 pillar colliders and 1 crossbar collider to the single body
      for (const z of zCoords) {
        const colDesc = RAPIER.ColliderDesc.cuboid(0.3, 1.75, 0.3)
          .setTranslation(0, 1.75, z)
          .setRestitution(0.3);
        this.world.createCollider(colDesc, frameBody);
      }
      
      // Attach side blockers colliders
      const leftColDesc = RAPIER.ColliderDesc.cuboid(0.3, 1.75, 9.0)
        .setTranslation(0, 1.75, -16.3)
        .setRestitution(0.3);
      this.world.createCollider(leftColDesc, frameBody);
      
      const rightColDesc = RAPIER.ColliderDesc.cuboid(0.3, 1.75, 9.0)
        .setTranslation(0, 1.75, 16.3)
        .setRestitution(0.3);
      this.world.createCollider(rightColDesc, frameBody);

      const crossColDesc = RAPIER.ColliderDesc.cuboid(0.3, 0.3, 7.3)
        .setTranslation(0, 3.5, 0)
        .setRestitution(0.3);
      const mainCollider = this.world.createCollider(crossColDesc, frameBody);

      // Add frame physics to level runtime tracker so it gets disposed automatically
      this.physicsObjects.push({
        id: `wall-frame-${i}`,
        body: frameBody,
        collider: mainCollider
      });

      // Create 3 doors
      const doorZCoords = [-4.67, 0.0, 4.67];
      const doors: DoorInstance[] = [];

      for (let j = 0; j < 3; j++) {
        const z = doorZCoords[j];

        // Door mesh
        const doorGeom = new THREE.BoxGeometry(0.3, 3.5, 4.0);
        const doorMesh = new THREE.Mesh(doorGeom, standardMaterials.door);
        doorMesh.position.set(baseX, 1.75, z);
        doorMesh.castShadow = true;
        doorMesh.receiveShadow = true;
        this.scene.add(doorMesh);

        // Sign mesh (front face of the door facing spawn points)
        const signGeom = new THREE.PlaneGeometry(1.2, 1.2);
        const signMesh = new THREE.Mesh(signGeom);
        signMesh.position.set(-0.16, 0.5, 0);
        signMesh.rotation.y = -Math.PI / 2; // Match facing direction
        doorMesh.add(signMesh);

        // Door physics body & collider
        const doorBodyDesc = RAPIER.RigidBodyDesc.fixed()
          .setTranslation(baseX, 1.75, z);
        const doorBody = this.world.createRigidBody(doorBodyDesc);

        const doorColDesc = RAPIER.ColliderDesc.cuboid(0.15, 1.75, 2.0)
          .setRestitution(0.2)
          .setFriction(0.2);
        const doorCollider = this.world.createCollider(doorColDesc, doorBody);

        doors.push({
          mesh: doorMesh,
          signMesh,
          body: doorBody,
          collider: doorCollider,
          emoji: "",
          isCorrect: false,
          isOpen: false,
          localZ: z
        });
      }

      this.walls.push({
        index: i,
        baseX,
        currentX: baseX,
        speed: 1.0 + i * 0.15,
        phase: i * 0.6,
        amplitude: 2.2,
        frameGroup,
        frameBody,
        doors
      });
    }
  }

  private updateWalls(): void {
    this.elapsed += FIXED_DELTA;

    // Hide billboard after 8 seconds
    this.setBillboardVisible(this.elapsed < 8.0);

    const spawnPoint = this.getRandomSpawnPoint();

    for (const wall of this.walls) {
      // Oscillate along X
      const wallX = wall.baseX + Math.sin(this.elapsed * wall.speed + wall.phase) * wall.amplitude;
      wall.currentX = wallX;

      // Update wall frame physics and mesh
      wall.frameBody.setTranslation({ x: wallX, y: 0.0, z: 0.0 }, true);
      wall.frameGroup.position.set(wallX, 0, 0);

      // Update doors
      for (const door of wall.doors) {
        if (door.isCorrect) {
          // Check player distance to open
          const isPlayerNear = this.levelPlayers.some((player) => {
            const pPos = player.body.translation();
            return Math.abs(pPos.x - wallX) < 2.0 && Math.abs(pPos.z - door.localZ) < 2.2;
          });

          this.setDoorOpenState(wall, door, isPlayerNear);
        } else {
          // Check player collision to reset level
          for (const player of this.levelPlayers) {
            const pPos = player.body.translation();
            if (
              Math.abs(pPos.x - wallX) < 0.65 &&
              Math.abs(pPos.z - door.localZ) < 2.0 &&
              pPos.y < 3.5
            ) {
              this.shouldReset = true;
            }
          }
        }

        // Animate door position
        if (door.isOpen) {
          door.mesh.position.set(wallX, 5.25, door.localZ); // Slide up
        } else {
          door.mesh.position.set(wallX, 1.75, door.localZ); // Closed position
          door.body?.setTranslation({ x: wallX, y: 1.75, z: door.localZ }, true);
        }
      }
    }
  }

  private setDoorOpenState(wall: WallInstance, door: DoorInstance, open: boolean): void {
    if (door.isOpen === open) {
      return;
    }

    door.isOpen = open;
    door.mesh.material = open ? standardMaterials.doorOpen : standardMaterials.door;

    if (open) {
      if (door.collider) {
        this.world.removeCollider(door.collider, true);
        door.collider = null;
      }
      if (door.body) {
        this.world.removeRigidBody(door.body);
        door.body = null;
      }
    } else {
      const bodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(wall.currentX, 1.75, door.localZ);
      door.body = this.world.createRigidBody(bodyDesc);

      const colliderDesc = RAPIER.ColliderDesc.cuboid(0.15, 1.75, 2.0)
        .setRestitution(0.2)
        .setFriction(0.2);
      door.collider = this.world.createCollider(colliderDesc, door.body);
    }
  }

  private getRandomSpawnPoint(): Vec3 {
    const points = this.definition.spawnPoints;
    if (points.length === 0) {
      return { x: 0, y: 1.05, z: 0 };
    }
    const idx = Math.floor(Math.random() * points.length);
    return points[idx];
  }

  private restorePlayers(): void {
    this.levelPlayers = [];
  }

  private setBillboardVisible(visible: boolean): void {
    if (this.billboardMesh) {
      this.billboardMesh.visible = visible;
    }
    for (const pillar of this.billboardPillars) {
      pillar.visible = visible;
    }
  }
}
