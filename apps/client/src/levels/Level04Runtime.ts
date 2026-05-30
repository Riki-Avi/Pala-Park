import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import type { LevelCustomStatePayload, Vec3 } from "@game/shared";
import { LevelRuntime } from "./LevelRuntime";
import type { Player } from "../entities/Player";
import { AudioManager } from "../core/AudioManager";
import type { InputManager } from "../input/InputManager";

interface RopeChain {
  pA: Player;
  pB: Player;
  links: RAPIER.RigidBody[];
  visualLine: THREE.Line;
}

export class Level04Runtime extends LevelRuntime {
  private keyCollected = false;
  private keyGroup: THREE.Group | null = null;
  
  private directJoints: RAPIER.ImpulseJoint[] = [];
  private ropeJoints: RAPIER.ImpulseJoint[] = [];
  private ropeChains: RopeChain[] = [];
  private levelPlayers: Player[] = [];
  private previousSolverIterations: number | null = null;

  override getDeathThreshold(): number {
    return -15.0; // Lower death threshold for Level 4
  }

  override onLevelStart(players: Player[]): void {
    this.keyCollected = false;

    // Clear previous physics joints, bodies, and visual ropes first
    this.clearRopesAndJoints();

    this.levelPlayers = players;

    // Make the physics joints extremely firm and prevent stretching
    this.previousSolverIterations ??= this.world.integrationParameters.numSolverIterations;
    this.world.integrationParameters.numSolverIterations = 16;

    // Configure player collision groups for Level 4
    // Group 1 (membership 0x0002, filter 0x0003): collides with platforms (Group 0) and players (Group 1)
    // Does NOT collide with rope links (Group 2)
    for (const player of players) {
      const numColliders = player.body.numColliders();
      for (let j = 0; j < numColliders; j++) {
        player.body.collider(j).setCollisionGroups(0x00020003);
      }
    }

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

    // Create physical rope joints, chain links, and visual lines
    if (players.length >= 4) {
      const maxRopeLength = 3.0; // Shorter rope to allow top players (with a 5m platform) to pull bottom players completely up
      const numLinks = 9; // 9 links for smooth visuals and draping
      const d = maxRopeLength / (numLinks + 1); // 0.3m spacing

      for (let i = 0; i < 3; i++) {
        const pA = players[i];
        const pB = players[i + 1];

        // 1. Direct Rope Joint between player A and B for ultimate constraint stability
        const directRopeData = RAPIER.JointData.rope(maxRopeLength, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
        const directJoint = this.world.createImpulseJoint(directRopeData, pA.body, pB.body, true);
        this.directJoints.push(directJoint);

        // 2. Chain of physical links to simulate collisions
        const posA = pA.body.translation();
        const posB = pB.body.translation();
        const dirX = (posB.x - posA.x) / (numLinks + 1);
        const dirY = (posB.y - posA.y) / (numLinks + 1);
        const dirZ = (posB.z - posA.z) / (numLinks + 1);

        const links: RAPIER.RigidBody[] = [];

        // Create link rigid bodies
        for (let j = 0; j < numLinks; j++) {
          const spawnX = posA.x + (j + 1) * dirX;
          const spawnY = posA.y + (j + 1) * dirY;
          const spawnZ = posA.z + (j + 1) * dirZ;

          const linkBodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(spawnX, spawnY, spawnZ)
            .setLinearDamping(1.5) // Lower damping for slippery and slidey rope movement
            .setAngularDamping(1.5)
            .setCcdEnabled(true)
            .lockRotations();
          const linkBody = this.world.createRigidBody(linkBodyDesc);

          // Group 2 (membership 0x0004, filter 0x0005): collides with platforms (Group 0) and other rope links (Group 2)
          // Does NOT collide with players (Group 1)
          const linkColliderDesc = RAPIER.ColliderDesc.ball(0.08)
            .setFriction(0.05) // EXTREMELY slippery friction so it slides effortlessly over platform corners
            .setRestitution(0.0)
            .setMass(0.008)
            .setCollisionGroups(0x00040005);
          this.world.createCollider(linkColliderDesc, linkBody);

          links.push(linkBody);
        }

        // Connect everything with ROPE joints at centers (no offsets)
        // Joint 0: Player A -> Link 0
        const j0Data = RAPIER.JointData.rope(d, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
        const j0 = this.world.createImpulseJoint(j0Data, pA.body, links[0], true);
        this.ropeJoints.push(j0);

        // Intermediate joints: Link j-1 -> Link j
        for (let j = 1; j < numLinks; j++) {
          const jjData = RAPIER.JointData.rope(d, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
          const jj = this.world.createImpulseJoint(jjData, links[j - 1], links[j], true);
          this.ropeJoints.push(jj);
        }

        // Final joint: Link 8 -> Player B
        const jfData = RAPIER.JointData.rope(d, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
        const jf = this.world.createImpulseJoint(jfData, links[numLinks - 1], pB.body, true);
        this.ropeJoints.push(jf);

        // 3. Visual Line connecting player A -> all links -> player B
        const points: THREE.Vector3[] = [];
        for (let k = 0; k < numLinks + 2; k++) {
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
          links,
          visualLine
        });
      }
    }
  }

  override update(playerPositions: Vec3[], activePlayerIndex?: number, inputManager?: InputManager): void {
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

    // Update ropes positions to track player centers and intermediate link bodies
    for (const chain of this.ropeChains) {
      const positions = chain.visualLine.geometry.attributes.position.array as Float32Array;

      // Point 0: Player A
      const posA = chain.pA.body.translation();
      positions[0] = posA.x;
      positions[1] = posA.y;
      positions[2] = posA.z;

      // Intermediate link positions
      for (let j = 0; j < chain.links.length; j++) {
        const posLink = chain.links[j].translation();
        positions[(j + 1) * 3] = posLink.x;
        positions[(j + 1) * 3 + 1] = posLink.y;
        positions[(j + 1) * 3 + 2] = posLink.z;
      }

      // Final Point: Player B
      const posB = chain.pB.body.translation();
      const lastIndex = chain.links.length + 1;
      positions[lastIndex * 3] = posB.x;
      positions[lastIndex * 3 + 1] = posB.y;
      positions[lastIndex * 3 + 2] = posB.z;

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
    this.restoreWorldSettings();

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

  private restoreWorldSettings(): void {
    if (this.previousSolverIterations === null) {
      return;
    }

    this.world.integrationParameters.numSolverIterations = this.previousSolverIterations;
    this.previousSolverIterations = null;
  }

  private clearRopesAndJoints(): void {
    // Restore player collision groups to default
    for (const player of this.levelPlayers) {
      try {
        const numColliders = player.body.numColliders();
        for (let j = 0; j < numColliders; j++) {
          player.body.collider(j).setCollisionGroups(0xFFFFFFFF);
        }
      } catch (e) {
        console.warn("Error restoring player collision groups:", e);
      }
    }

    // 1. Remove direct joints
    for (const joint of this.directJoints) {
      try {
        this.world.removeImpulseJoint(joint, true);
      } catch (e) {
        console.warn("Error removing direct joint:", e);
      }
    }
    this.directJoints = [];

    // 2. Remove rope joints
    for (const joint of this.ropeJoints) {
      try {
        this.world.removeImpulseJoint(joint, true);
      } catch (e) {
        console.warn("Error removing rope joint:", e);
      }
    }
    this.ropeJoints = [];

    // 3. Remove visual lines and rigid bodies of links
    for (const chain of this.ropeChains) {
      // Remove line from scene and dispose resources
      this.scene.remove(chain.visualLine);
      chain.visualLine.geometry.dispose();
      (chain.visualLine.material as THREE.Material).dispose();

      // Remove link bodies from Rapier world
      for (const link of chain.links) {
        try {
          this.world.removeRigidBody(link);
        } catch (e) {
          console.warn("Error removing link body:", e);
        }
      }
    }
    this.ropeChains = [];
  }
}
