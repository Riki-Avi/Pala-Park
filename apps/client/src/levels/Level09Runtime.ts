import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import type { LevelCustomStatePayload, Vec3 } from "@game/shared";
import { LevelRuntime } from "./LevelRuntime";
import type { Player } from "../entities/Player";
import type { InputManager } from "../input/InputManager";

const BALL_RADIUS = 0.48;
const BALL_SPAWN: Vec3 = { x: 0, y: 1.05, z: 0 };
const GOAL_HALF_WIDTH = 2.25;
const GOAL_LIMIT_X = 10.8;
const GOAL_LIMIT_Z = 7.8;
const ELIMINATION_GOALS = 3;
const SCORE_COOLDOWN_SECONDS = 0.9;

const PLAYER_NAMES = ["Azul", "Amarillo", "Verde", "Violeta"] as const;
const PLAYER_COLORS = ["#62a8ff", "#ffcf5c", "#69d38f", "#d96cff"] as const;

interface GoalDefinition {
  ownerIndex: number;
  position: THREE.Vector3;
  rotationY: number;
}

export class Level09Runtime extends LevelRuntime {
  private ballBody: RAPIER.RigidBody | null = null;
  private ballCollider: RAPIER.Collider | null = null;
  private ballMesh: THREE.Mesh | null = null;
  private readonly goalFrames: THREE.Object3D[] = [];
  private levelPlayers: Player[] = [];
  private scores = [0, 0, 0, 0];
  private eliminated = [false, false, false, false];
  private winnerIndex: number | null = null;
  private scoreCooldown = 0;

  override getDeathThreshold(): number {
    return -20;
  }

  override prepareReset(players: Player[]): void {
    this.resetMatch(players);
  }

  override onLevelStart(players: Player[]): void {
    this.resetMatch(players);
  }

  override updateLocal(_playerPositions: Vec3[], _activePlayerIndex?: number, _inputManager?: InputManager): void {
    this.keepEliminatedPlayersOut();
  }

  override update(playerPositions: Vec3[], activePlayerIndex?: number, inputManager?: InputManager): void {
    this.updateLocal(playerPositions, activePlayerIndex, inputManager);
    this.updateBallRules();
    super.update(playerPositions, activePlayerIndex, inputManager);
  }

  override syncDynamicMeshes(): void {
    super.syncDynamicMeshes();

    if (!this.ballBody || !this.ballMesh) {
      return;
    }

    const position = this.ballBody.translation();
    const rotation = this.ballBody.rotation();
    this.ballMesh.position.set(position.x, position.y, position.z);
    this.ballMesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
  }

  override isCompleted(_playerPositions: Vec3[]): boolean {
    return false;
  }

  override dispose(): void {
    this.restorePlayers();
    this.disposeBall();

    for (const frame of this.goalFrames) {
      this.scene.remove(frame);
      frame.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          disposeMaterial(child.material);
        }
      });
    }
    this.goalFrames.length = 0;

    super.dispose();
  }

  protected override getCustomState(): LevelCustomStatePayload | undefined {
    if (!this.ballBody) {
      return undefined;
    }

    const ballPosition = this.ballBody.translation();
    const ballVelocity = this.ballBody.linvel();
    return {
      type: "level-09",
      ballPosition: { x: ballPosition.x, y: ballPosition.y, z: ballPosition.z },
      ballVelocity: { x: ballVelocity.x, y: ballVelocity.y, z: ballVelocity.z },
      eliminated: [...this.eliminated],
      scores: [...this.scores],
      winnerIndex: this.winnerIndex
    };
  }

  protected override applyCustomState(state: LevelCustomStatePayload | undefined): void {
    if (state?.type !== "level-09" || !this.ballBody) {
      return;
    }

    this.scores = [...state.scores];
    this.eliminated = [...state.eliminated];
    this.winnerIndex = state.winnerIndex;
    this.ballBody.setTranslation(state.ballPosition, true);
    this.ballBody.setLinvel(state.ballVelocity, true);
    this.keepEliminatedPlayersOut();
    this.updateObjectiveText();
  }

  private resetMatch(players: Player[]): void {
    this.levelPlayers = players;
    this.scores = [0, 0, 0, 0];
    this.eliminated = [false, false, false, false];
    this.winnerIndex = null;
    this.scoreCooldown = 0;

    for (const player of players) {
      player.mesh.visible = true;
      player.body.setGravityScale(1, true);
    }

    this.ensureBall();
    this.ensureGoalFrames();
    this.resetBall();
    this.updateObjectiveText();
  }

  private ensureBall(): void {
    if (this.ballBody && this.ballMesh) {
      return;
    }

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(BALL_SPAWN.x, BALL_SPAWN.y, BALL_SPAWN.z)
      .setCanSleep(false)
      .setLinearDamping(0.45)
      .setAngularDamping(0.55);
    this.ballBody = this.world.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.ball(BALL_RADIUS)
      .setRestitution(0.72)
      .setFriction(0.22);
    this.ballCollider = this.world.createCollider(colliderDesc, this.ballBody);

    const material = new THREE.MeshStandardMaterial({
      color: "#f3f7fb",
      roughness: 0.36,
      metalness: 0.04
    });
    this.ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 24, 16), material);
    this.ballMesh.castShadow = true;
    this.ballMesh.receiveShadow = true;
    this.scene.add(this.ballMesh);
  }

  private ensureGoalFrames(): void {
    if (this.goalFrames.length > 0) {
      return;
    }

    const goals: GoalDefinition[] = [
      { ownerIndex: 0, position: new THREE.Vector3(-10.7, 0.5, 0), rotationY: Math.PI / 2 },
      { ownerIndex: 1, position: new THREE.Vector3(10.7, 0.5, 0), rotationY: -Math.PI / 2 },
      { ownerIndex: 2, position: new THREE.Vector3(0, 0.5, -7.7), rotationY: 0 },
      { ownerIndex: 3, position: new THREE.Vector3(0, 0.5, 7.7), rotationY: Math.PI }
    ];

    const GOAL_DEPTH = 1.2;

    for (const goal of goals) {
      // Visual group
      const frame = this.createGoalFrame(PLAYER_COLORS[goal.ownerIndex]);
      frame.position.copy(goal.position);
      frame.rotation.y = goal.rotationY;
      this.scene.add(frame);
      this.goalFrames.push(frame);

      // Rotation quaternion for the walls
      const rotationQ = {
        w: Math.cos(goal.rotationY / 2),
        x: 0,
        y: Math.sin(goal.rotationY / 2),
        z: 0
      };

      // Helper to transform local offset to world position
      const getWorldPos = (lx: number, ly: number, lz: number) => {
        const cos = Math.cos(goal.rotationY);
        const sin = Math.sin(goal.rotationY);
        return {
          x: goal.position.x + lx * cos + lz * sin,
          y: goal.position.y + ly,
          z: goal.position.z - lx * sin + lz * cos
        };
      };

      // Create 3 physical walls matching the nets
      const wallConfigs = [
        {
          id: `goal-wall-back-${goal.ownerIndex}`,
          pos: getWorldPos(0, 0.6, -GOAL_DEPTH),
          size: { hx: GOAL_HALF_WIDTH, hy: 0.9, hz: 0.05 }
        },
        {
          id: `goal-wall-left-${goal.ownerIndex}`,
          pos: getWorldPos(-GOAL_HALF_WIDTH, 0.6, -GOAL_DEPTH / 2),
          size: { hx: 0.05, hy: 0.9, hz: GOAL_DEPTH / 2 }
        },
        {
          id: `goal-wall-right-${goal.ownerIndex}`,
          pos: getWorldPos(GOAL_HALF_WIDTH, 0.6, -GOAL_DEPTH / 2),
          size: { hx: 0.05, hy: 0.9, hz: GOAL_DEPTH / 2 }
        }
      ];

      for (const config of wallConfigs) {
        const bodyDesc = RAPIER.RigidBodyDesc.fixed()
          .setTranslation(config.pos.x, config.pos.y, config.pos.z)
          .setRotation(rotationQ);
        const body = this.world.createRigidBody(bodyDesc);

        const colliderDesc = RAPIER.ColliderDesc.cuboid(config.size.hx, config.size.hy, config.size.hz)
          .setRestitution(0.4)
          .setFriction(0.2);
        const collider = this.world.createCollider(colliderDesc, body);

        this.physicsObjects.push({ id: config.id, body, collider });
      }
    }
  }

  private createGoalFrame(color: string): THREE.Group {
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.38,
      metalness: 0.05,
      emissive: color,
      emissiveIntensity: 0.12
    });
    // Front posts and crossbar aligned along the local X-axis
    const postGeometry = new THREE.BoxGeometry(0.18, 1.8, 0.18);
    const crossbarGeometry = new THREE.BoxGeometry(GOAL_HALF_WIDTH * 2 + 0.18, 0.18, 0.18);
    const left = new THREE.Mesh(postGeometry, material);
    const right = new THREE.Mesh(postGeometry, material);
    const top = new THREE.Mesh(crossbarGeometry, material);

    left.position.set(-GOAL_HALF_WIDTH, 0.6, 0);
    right.position.set(GOAL_HALF_WIDTH, 0.6, 0);
    top.position.set(0, 1.42, 0);
    group.add(left, right, top);

    // Support structure (depth extending into local -Z, towards the void)
    const GOAL_DEPTH = 1.2;
    const dy = 1.42 - (-0.24);
    const dz = GOAL_DEPTH;
    const L = Math.sqrt(dy * dy + dz * dz);
    const angle = Math.atan2(dz, dy);

    const bottomBarMat = material.clone();
    bottomBarMat.emissiveIntensity = 0.06;

    const sideBottomGeom = new THREE.BoxGeometry(0.12, 0.12, GOAL_DEPTH);
    const backBottomGeom = new THREE.BoxGeometry(GOAL_HALF_WIDTH * 2 + 0.12, 0.12, 0.12);

    const leftBottom = new THREE.Mesh(sideBottomGeom, bottomBarMat);
    leftBottom.position.set(-GOAL_HALF_WIDTH, -0.24, -GOAL_DEPTH / 2);

    const rightBottom = new THREE.Mesh(sideBottomGeom, bottomBarMat);
    rightBottom.position.set(GOAL_HALF_WIDTH, -0.24, -GOAL_DEPTH / 2);

    const backBottom = new THREE.Mesh(backBottomGeom, bottomBarMat);
    backBottom.position.set(0, -0.24, -GOAL_DEPTH);

    const slopeGeom = new THREE.BoxGeometry(0.12, L, 0.12);
    const leftSlope = new THREE.Mesh(slopeGeom, bottomBarMat);
    leftSlope.position.set(-GOAL_HALF_WIDTH, 0.59, -GOAL_DEPTH / 2);
    leftSlope.rotation.x = -angle;

    const rightSlope = new THREE.Mesh(slopeGeom, bottomBarMat);
    rightSlope.position.set(GOAL_HALF_WIDTH, 0.59, -GOAL_DEPTH / 2);
    rightSlope.rotation.x = -angle;

    group.add(leftBottom, rightBottom, backBottom, leftSlope, rightSlope);

    // Net texture & materials
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.fillRect(0, 0, 32, 32);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(0, 0, 32, 32);
    }
    const netTexture = new THREE.CanvasTexture(canvas);
    netTexture.wrapS = THREE.RepeatWrapping;
    netTexture.wrapT = THREE.RepeatWrapping;

    const netMat = new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    // Left net panel (Triangle)
    const leftNetGeom = new THREE.BufferGeometry();
    const leftVertices = new Float32Array([
      -GOAL_HALF_WIDTH, 1.42, 0,
      -GOAL_HALF_WIDTH, -0.24, 0,
      -GOAL_HALF_WIDTH, -0.24, -GOAL_DEPTH
    ]);
    const leftUvs = new Float32Array([
      0, 1,
      0, 0,
      1, 0
    ]);
    leftNetGeom.setAttribute("position", new THREE.BufferAttribute(leftVertices, 3));
    leftNetGeom.setAttribute("uv", new THREE.BufferAttribute(leftUvs, 2));
    leftNetGeom.computeVertexNormals();

    const leftNetTexture = netTexture.clone();
    leftNetTexture.repeat.set(4, 4);
    leftNetTexture.needsUpdate = true;
    const leftNetMat = netMat.clone();
    leftNetMat.map = leftNetTexture;
    const leftNetMesh = new THREE.Mesh(leftNetGeom, leftNetMat);

    // Right net panel (Triangle)
    const rightNetGeom = new THREE.BufferGeometry();
    const rightVertices = new Float32Array([
      GOAL_HALF_WIDTH, 1.42, 0,
      GOAL_HALF_WIDTH, -0.24, 0,
      GOAL_HALF_WIDTH, -0.24, -GOAL_DEPTH
    ]);
    const rightUvs = new Float32Array([
      0, 1,
      0, 0,
      1, 0
    ]);
    rightNetGeom.setAttribute("position", new THREE.BufferAttribute(rightVertices, 3));
    rightNetGeom.setAttribute("uv", new THREE.BufferAttribute(rightUvs, 2));
    rightNetGeom.computeVertexNormals();

    const rightNetTexture = netTexture.clone();
    rightNetTexture.repeat.set(4, 4);
    rightNetTexture.needsUpdate = true;
    const rightNetMat = netMat.clone();
    rightNetMat.map = rightNetTexture;
    const rightNetMesh = new THREE.Mesh(rightNetGeom, rightNetMat);

    // Back sloping net panel (Rectangle)
    const backNetTexture = netTexture.clone();
    backNetTexture.repeat.set(8, 4);
    backNetTexture.needsUpdate = true;
    const backNetMat = netMat.clone();
    backNetMat.map = backNetTexture;
    const backNetGeom = new THREE.PlaneGeometry(GOAL_HALF_WIDTH * 2, L);
    const backNetMesh = new THREE.Mesh(backNetGeom, backNetMat);
    backNetMesh.position.set(0, 0.59, -GOAL_DEPTH / 2);
    backNetMesh.rotation.x = -angle;

    netTexture.dispose();

    group.add(leftNetMesh, rightNetMesh, backNetMesh);

    return group;
  }

  private updateBallRules(): void {
    if (!this.ballBody || this.winnerIndex !== null) {
      this.updateObjectiveText();
      return;
    }

    this.scoreCooldown = Math.max(0, this.scoreCooldown - 1 / 60);
    this.clampBallSpeed();
    const position = this.ballBody.translation();
    const ownerIndex = this.getGoalOwner(position);

    if (ownerIndex !== null && this.scoreCooldown <= 0) {
      this.registerGoal(ownerIndex);
      return;
    }

    if (Math.abs(position.x) > 14 || Math.abs(position.z) > 11 || position.y < -5) {
      this.resetBall();
    }

    this.updateObjectiveText();
  }

  private getGoalOwner(position: Vec3): number | null {
    if (position.x < -GOAL_LIMIT_X && Math.abs(position.z) <= GOAL_HALF_WIDTH) {
      return 0;
    }
    if (position.x > GOAL_LIMIT_X && Math.abs(position.z) <= GOAL_HALF_WIDTH) {
      return 1;
    }
    if (position.z < -GOAL_LIMIT_Z && Math.abs(position.x) <= GOAL_HALF_WIDTH) {
      return 2;
    }
    if (position.z > GOAL_LIMIT_Z && Math.abs(position.x) <= GOAL_HALF_WIDTH) {
      return 3;
    }
    return null;
  }

  private registerGoal(ownerIndex: number): void {
    if (this.eliminated[ownerIndex]) {
      this.resetBall();
      return;
    }

    this.scores[ownerIndex] += 1;
    if (this.scores[ownerIndex] >= ELIMINATION_GOALS) {
      this.eliminated[ownerIndex] = true;
      this.eliminatePlayer(ownerIndex);
    }

    const alive = this.getAlivePlayerIndexes();
    if (alive.length <= 1) {
      this.winnerIndex = alive[0] ?? this.getLowestScorePlayerIndex();
    }

    this.resetBall();
    this.updateObjectiveText();
  }

  private eliminatePlayer(index: number): void {
    const player = this.levelPlayers[index];
    if (!player) {
      return;
    }

    player.mesh.visible = false;
    player.body.setTranslation(this.getSpectatorPosition(index), true);
    player.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    player.body.setGravityScale(0, true);
  }

  private keepEliminatedPlayersOut(): void {
    for (const [index, eliminated] of this.eliminated.entries()) {
      if (!eliminated) {
        continue;
      }

      this.eliminatePlayer(index);
    }
  }

  private restorePlayers(): void {
    for (const player of this.levelPlayers) {
      player.mesh.visible = true;
      player.body.setGravityScale(1, true);
    }
    this.levelPlayers = [];
  }

  private resetBall(): void {
    if (!this.ballBody) {
      return;
    }

    this.ballBody.setTranslation(BALL_SPAWN, true);
    this.ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.scoreCooldown = SCORE_COOLDOWN_SECONDS;
  }

  private clampBallSpeed(): void {
    if (!this.ballBody) {
      return;
    }

    const velocity = this.ballBody.linvel();
    const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
    if (horizontalSpeed <= 11) {
      return;
    }

    const scale = 11 / horizontalSpeed;
    this.ballBody.setLinvel({ x: velocity.x * scale, y: velocity.y, z: velocity.z * scale }, true);
  }

  private getAlivePlayerIndexes(): number[] {
    return this.eliminated
      .map((eliminated, index) => ({ eliminated, index }))
      .filter((entry) => !entry.eliminated)
      .map((entry) => entry.index);
  }

  private getLowestScorePlayerIndex(): number {
    let winner = 0;
    for (let index = 1; index < this.scores.length; index += 1) {
      if (this.scores[index] < this.scores[winner]) {
        winner = index;
      }
    }
    return winner;
  }

  private updateObjectiveText(): void {
    const scoreText = this.scores
      .map((score, index) => {
        const status = this.eliminated[index] ? "X" : String(score);
        return `${PLAYER_NAMES[index]} ${status}/${ELIMINATION_GOALS}`;
      })
      .join(" | ");

    this.definition.objective =
      this.winnerIndex === null
        ? `Defende tu arco - ${scoreText}`
        : `Gana ${PLAYER_NAMES[this.winnerIndex]} - ${scoreText}`;
  }

  private getSpectatorPosition(index: number): Vec3 {
    return { x: -12 + index * 2, y: 4, z: 10.5 };
  }

  private disposeBall(): void {
    if (this.ballCollider) {
      this.world.removeCollider(this.ballCollider, true);
      this.ballCollider = null;
    }
    if (this.ballBody) {
      this.world.removeRigidBody(this.ballBody);
      this.ballBody = null;
    }
    if (this.ballMesh) {
      this.scene.remove(this.ballMesh);
      this.ballMesh.geometry.dispose();
      disposeMaterial(this.ballMesh.material);
      this.ballMesh = null;
    }
  }
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach((entry) => {
      if ("map" in entry && entry.map && entry.map instanceof THREE.Texture) {
        entry.map.dispose();
      }
      entry.dispose();
    });
    return;
  }

  if ("map" in material && material.map && material.map instanceof THREE.Texture) {
    material.map.dispose();
  }
  material.dispose();
}
