import * as THREE from "three";
import type { LevelCustomStatePayload, Vec3 } from "@game/shared";
import { LevelRuntime } from "./LevelRuntime";
import type { Player } from "../entities/Player";
import { AudioManager } from "../core/AudioManager";
import type { InputManager } from "../input/InputManager";

interface RopeChain {
  pA: Player;
  pB: Player;
  visualLine: THREE.Line;
  maxLength: number;
}

export class Level04Runtime extends LevelRuntime {
  private keyCollected = false;
  private keyGroup: THREE.Group | null = null;
  
  private ropeChains: RopeChain[] = [];
  private levelPlayers: Player[] = [];

  override getDeathThreshold(): number {
    return -15.0; // Lower death threshold for Level 4
  }

  override prepareReset(players: Player[]): void {
    this.clearRopesAndJoints();
    this.levelPlayers = players;
  }

  override onLevelStart(players: Player[]): void {
    this.keyCollected = false;

    // Clear previous physics joints, bodies, and visual ropes first
    this.clearRopesAndJoints();

    this.levelPlayers = players;

    // Create the key group if not present
    if (!this.keyGroup) {
      this.createKeyMesh();
    } else {
      this.scene.add(this.keyGroup);
    }
    
    // Set initial position of key
    this.keyGroup!.position.set(-5.0, -2.5, -1.0);
    this.keyGroup!.rotation.set(0, 0, 0);

    // Ensure gate door is closed initially
    this.doors.forEach((door) => {
      if (door.definition.id === "door-gate") {
        door.setOpen(false);
      }
    });

    // Create stable visual ropes. Physical joint chains were too unstable and could launch players.
    if (players.length >= 4) {
      const maxRopeLength = 3.2;
      const visualPoints = 10;

      for (let i = 0; i < 3; i++) {
        const pA = players[i];
        const pB = players[i + 1];

        const points: THREE.Vector3[] = [];
        for (let k = 0; k < visualPoints; k++) {
          points.push(new THREE.Vector3());
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
          color: "#c69c6d", // Beige/cuerda
          linewidth: 3
        });
        const visualLine = new THREE.Line(geometry, material);
        visualLine.castShadow = true;
        visualLine.frustumCulled = false; // Prevent culling issues when players move away from origin
        this.scene.add(visualLine);

        this.ropeChains.push({
          pA,
          pB,
          visualLine,
          maxLength: maxRopeLength
        });
      }
    }
  }

  override updateLocal(playerPositions: Vec3[], activePlayerIndex?: number, inputManager?: InputManager): void {
    this.applyStableRopeLimits();
  }

  override update(playerPositions: Vec3[], activePlayerIndex?: number, inputManager?: InputManager): void {
    this.applyStableRopeLimits();

    // 1. Check key collection
    if (!this.keyCollected && this.keyGroup) {
      for (const pos of playerPositions) {
        const dx = pos.x - (-5.0);
        const dy = pos.y - (-2.5);
        const dz = pos.z - (-1.0);
        const dist = Math.hypot(dx, dy, dz);
        
        if (dist < 1.3) {
          this.setKeyCollected(true);
          AudioManager.playButton();
          
          const objElem = document.querySelector("#objective");
          if (objElem) {
            objElem.textContent = "¡Llave recogida! Crucen el puente hacia la meta.";
          }
          break;
        }
      }
    }

    // 2. Sincronizar recolección de llave desde red si la puerta ya fue abierta
    const gate = this.doors.find((d) => d.definition.id === "door-gate");
    if (gate && gate.open && !this.keyCollected) {
      this.setKeyCollected(true, false);
    }

    // 3. Open or close the door gate based on key state
    if (gate) {
      gate.setOpen(this.keyCollected);
    }

    super.update(playerPositions, activePlayerIndex, inputManager);
  }

  protected override updateStandardDoors(): void {
    // No-op to prevent the base class from closing our key-opened gate
  }

  override syncDynamicMeshes(): void {
    super.syncDynamicMeshes();

    // Update ropes positions to track player centers with a gentle sag.
    for (const chain of this.ropeChains) {
      const positions = chain.visualLine.geometry.attributes.position.array as Float32Array;
      const posA = chain.pA.body.translation();
      const posB = chain.pB.body.translation();
      const pointCount = positions.length / 3;

      for (let index = 0; index < pointCount; index += 1) {
        const t = pointCount <= 1 ? 0 : index / (pointCount - 1);
        const sag = Math.sin(t * Math.PI) * 0.18;
        positions[index * 3] = THREE.MathUtils.lerp(posA.x, posB.x, t);
        positions[index * 3 + 1] = THREE.MathUtils.lerp(posA.y, posB.y, t) - sag;
        positions[index * 3 + 2] = THREE.MathUtils.lerp(posA.z, posB.z, t);
      }

      chain.visualLine.geometry.attributes.position.needsUpdate = true;
      chain.visualLine.geometry.computeBoundingSphere();
      chain.visualLine.geometry.computeBoundingBox();
    }

    // Smoothly animate the door-gate sliding down into the floor when opened
    for (const door of this.doors) {
      if (door.definition.id === "door-gate") {
        // Slide down completely below the bridge level when open, otherwise remain at definition position
        const targetY = door.definition.position.y + (door.open ? -door.definition.size.y - 0.1 : 0);
        door.mesh.position.y = THREE.MathUtils.lerp(door.mesh.position.y, targetY, 0.12);
      }
    }

    // Animate key (rotation and floating)
    if (this.keyGroup && !this.keyCollected) {
      this.keyGroup.rotation.y += 0.02;
      this.keyGroup.position.y = -2.5 + Math.sin(Date.now() * 0.003) * 0.15;
    }
  }

  override dispose(): void {
    this.clearRopesAndJoints();

    if (this.keyGroup) {
      this.scene.remove(this.keyGroup);
      this.keyGroup = null;
    }

    super.dispose();
  }

  protected override getCustomState(): LevelCustomStatePayload {
    return {
      type: "level-04",
      keyCollected: this.keyCollected
    };
  }

  protected override applyCustomState(state: LevelCustomStatePayload | undefined): void {
    if (state?.type !== "level-04") {
      return;
    }

    this.setKeyCollected(state.keyCollected, false);
    this.doors.find((door) => door.definition.id === "door-gate")?.setOpen(state.keyCollected);
  }

  private createKeyMesh(): void {
    this.keyGroup = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({
      color: "#ffd700",
      roughness: 0.15,
      metalness: 0.85
    });

    // Ring/Handle
    const ringGeom = new THREE.TorusGeometry(0.18, 0.05, 8, 24);
    const ringMesh = new THREE.Mesh(ringGeom, goldMat);
    ringMesh.position.y = 0.22;
    ringMesh.castShadow = true;
    this.keyGroup.add(ringMesh);

    // Shaft
    const shaftGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.36, 8);
    const shaftMesh = new THREE.Mesh(shaftGeom, goldMat);
    shaftMesh.position.y = 0.02;
    shaftMesh.castShadow = true;
    this.keyGroup.add(shaftMesh);

    // Tooth/Bit
    const toothGeom = new THREE.BoxGeometry(0.08, 0.12, 0.06);
    const toothMesh = new THREE.Mesh(toothGeom, goldMat);
    toothMesh.position.set(0.08, -0.06, 0);
    toothMesh.castShadow = true;
    this.keyGroup.add(toothMesh);

    this.scene.add(this.keyGroup);
  }

  private setKeyCollected(collected: boolean, updateObjective = true): void {
    this.keyCollected = collected;

    if (collected) {
      if (this.keyGroup) {
        this.scene.remove(this.keyGroup);
      }
      return;
    }

    if (this.keyGroup && !this.keyGroup.parent) {
      this.scene.add(this.keyGroup);
    }

    if (updateObjective) {
      const objElem = document.querySelector("#objective");
      if (objElem) {
        objElem.textContent = this.definition.objective;
      }
    }
  }

  private clearRopesAndJoints(): void {
    for (const chain of this.ropeChains) {
      this.scene.remove(chain.visualLine);
      chain.visualLine.geometry.dispose();
      (chain.visualLine.material as THREE.Material).dispose();
    }
    this.ropeChains = [];
  }

  private applyStableRopeLimits(): void {
    for (const chain of this.ropeChains) {
      const posA = chain.pA.body.translation();
      const posB = chain.pB.body.translation();
      const dx = posB.x - posA.x;
      const dy = posB.y - posA.y;
      const dz = posB.z - posA.z;
      const distance = Math.hypot(dx, dy, dz);

      if (distance <= chain.maxLength || distance <= 0.0001) {
        continue;
      }

      const excess = Math.min(distance - chain.maxLength, 0.75);
      const nx = dx / distance;
      const ny = dy / distance;
      const nz = dz / distance;
      const pull = Math.min(excess * 4.5, 3.0);
      const velocityA = chain.pA.body.linvel();
      const velocityB = chain.pB.body.linvel();

      chain.pA.body.setLinvel(
        {
          x: clampVelocity(velocityA.x + nx * pull),
          y: clampVelocity(velocityA.y + ny * pull),
          z: clampVelocity(velocityA.z + nz * pull)
        },
        true
      );
      chain.pB.body.setLinvel(
        {
          x: clampVelocity(velocityB.x - nx * pull),
          y: clampVelocity(velocityB.y - ny * pull),
          z: clampVelocity(velocityB.z - nz * pull)
        },
        true
      );
    }
  }
}

function clampVelocity(value: number): number {
  return Math.max(-8, Math.min(8, value));
}
