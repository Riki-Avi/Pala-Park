import * as THREE from "three";
import type { Vec3 } from "@game/shared";
import { LevelRuntime } from "./LevelRuntime";
import type { Player } from "../entities/Player";
import type { InputManager } from "../input/InputManager";

interface WebTarget {
  position: THREE.Vector3;
}

const WEB_RANGE = 18.0;
const WEB_RELEASE_DISTANCE = 0.9;
const WEB_MAX_SPEED = 13.5;
const POINTER_DISTANCE = 5.5;

export class Level06Runtime extends LevelRuntime {
  private levelPlayers: Player[] = [];
  private readonly activeTargetsByPlayer = new Map<string, WebTarget>();
  private readonly webLinesByPlayer = new Map<string, THREE.Line>();
  private readonly webPointersByPlayer = new Map<string, THREE.Vector3>();
  private readonly raycaster = new THREE.Raycaster();
  private pointerMesh: THREE.Group | null = null;
  private lastActivePlayerIndex?: number;
  private lastInputManager?: InputManager;

  override getDeathThreshold(): number {
    return -12.0;
  }

  override onLevelStart(players: Player[]): void {
    this.clearSpiderWebObjects();
    this.levelPlayers = players;
    this.createPlayerWebLines(players);
    this.pointerMesh = this.createPointerMesh();
    this.scene.add(this.pointerMesh);
  }

  override prepareReset(players: Player[]): void {
    this.activeTargetsByPlayer.clear();
    this.levelPlayers = players;
    for (const player of players) {
      const line = this.webLinesByPlayer.get(player.id);
      if (line) {
        line.visible = false;
      }
    }
  }

  override updateLocal(playerPositions: Vec3[], activePlayerIndex?: number, inputManager?: InputManager): void {
    this.updateSpiderWeb(playerPositions, activePlayerIndex, inputManager);
  }

  override update(playerPositions: Vec3[], activePlayerIndex?: number, inputManager?: InputManager): void {
    this.updateSpiderWeb(playerPositions, activePlayerIndex, inputManager);
    super.update(playerPositions, activePlayerIndex, inputManager);
  }

  override syncDynamicMeshes(): void {
    super.syncDynamicMeshes();
    this.syncPointer();
    this.syncWebLines();
  }

  override dispose(): void {
    this.clearSpiderWebObjects();
    super.dispose();
  }

  private updateSpiderWeb(
    _playerPositions: Vec3[],
    activePlayerIndex?: number,
    inputManager?: InputManager
  ): void {
    if (activePlayerIndex === undefined || !inputManager) {
      return;
    }

    this.lastActivePlayerIndex = activePlayerIndex;
    this.lastInputManager = inputManager;

    const player = this.levelPlayers[activePlayerIndex];
    if (!player) {
      return;
    }

    this.webPointersByPlayer.set(player.id, this.getPointerPosition(player, inputManager));

    const input = inputManager.getPrimaryInput();
    if (!input.interact) {
      this.activeTargetsByPlayer.delete(player.id);
      return;
    }

    const currentTarget = this.activeTargetsByPlayer.get(player.id);
    const target =
      currentTarget && this.isTargetReachable(player, currentTarget)
        ? currentTarget
        : this.findWebTarget(player, inputManager);

    if (!target) {
      this.activeTargetsByPlayer.delete(player.id);
      return;
    }

    this.activeTargetsByPlayer.set(player.id, target);
    this.pullPlayerTowardTarget(player, target);
  }

  private createPointerMesh(): THREE.Group {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.9,
      depthTest: false
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.012, 8, 24), material);
    const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.42, 0.018), material);
    const horizontal = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.018, 0.018), material);
    group.add(ring, vertical, horizontal);
    group.renderOrder = 4;
    group.visible = false;
    return group;
  }

  private createPlayerWebLines(players: Player[]): void {
    const material = new THREE.LineBasicMaterial({
      color: "#e7fbff",
      transparent: true,
      opacity: 0.88
    });

    for (const player of players) {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3()
      ]);
      const line = new THREE.Line(geometry, material.clone());
      line.visible = false;
      line.frustumCulled = false;
      this.scene.add(line);
      this.webLinesByPlayer.set(player.id, line);
    }
  }

  private findWebTarget(player: Player, inputManager: InputManager): WebTarget | null {
    const origin = this.getWebOrigin(player);
    const aimDirection = this.getAimDirection(inputManager);
    this.raycaster.set(origin, aimDirection);
    this.raycaster.far = WEB_RANGE;

    const hits = this.raycaster.intersectObjects(this.getWebSurfaces(), false);
    const hit = hits.find((entry) => entry.distance > 0.65);
    return hit ? { position: hit.point.clone() } : null;
  }

  private getAimDirection(inputManager: InputManager): THREE.Vector3 {
    return getDirectionFromAngles(inputManager.yaw, inputManager.pitch);
  }

  private isTargetReachable(player: Player, target: WebTarget): boolean {
    const position = player.body.translation();
    const distance = Math.hypot(
      target.position.x - position.x,
      target.position.y - position.y,
      target.position.z - position.z
    );
    return distance <= WEB_RANGE + 1.0;
  }

  private pullPlayerTowardTarget(player: Player, target: WebTarget): void {
    const position = player.body.translation();
    const toTarget = new THREE.Vector3(
      target.position.x - position.x,
      target.position.y - position.y,
      target.position.z - position.z
    );
    const distance = toTarget.length();
    if (distance < WEB_RELEASE_DISTANCE) {
      return;
    }

    const direction = toTarget.normalize();
    const currentVelocity = player.body.linvel();
    const targetSpeed = Math.min(6.0 + distance * 0.9, WEB_MAX_SPEED);
    const targetVelocity = direction.multiplyScalar(targetSpeed);
    const blend = 0.2;

    player.body.setLinvel(
      {
        x: lerp(currentVelocity.x, targetVelocity.x, blend),
        y: lerp(currentVelocity.y, targetVelocity.y + 0.8, blend),
        z: lerp(currentVelocity.z, targetVelocity.z, blend)
      },
      true
    );
  }

  private syncWebLines(): void {
    for (const player of this.levelPlayers) {
      const line = this.webLinesByPlayer.get(player.id);
      if (!line) {
        continue;
      }

      const target = this.activeTargetsByPlayer.get(player.id) ?? this.getRemoteVisualTarget(player);
      if (!target) {
        line.visible = false;
        continue;
      }

      const position = player.body.translation();
      const positions = line.geometry.attributes.position.array as Float32Array;
      positions[0] = position.x;
      positions[1] = position.y + 0.2;
      positions[2] = position.z;
      positions[3] = target.position.x;
      positions[4] = target.position.y;
      positions[5] = target.position.z;
      line.geometry.attributes.position.needsUpdate = true;
      line.geometry.computeBoundingSphere();
      line.visible = true;
    }
  }

  private getRemoteVisualTarget(player: Player): WebTarget | null {
    if (!player.isActionActive) {
      return null;
    }

    const origin = this.getWebOrigin(player);
    this.raycaster.set(origin, getDirectionFromAngles(player.lookYaw, player.lookPitch));
    this.raycaster.far = WEB_RANGE;
    const hits = this.raycaster.intersectObjects(this.getWebSurfaces(), false);
    const hit = hits.find((entry) => entry.distance > 0.65);
    return hit ? { position: hit.point.clone() } : null;
  }

  private syncPointer(): void {
    if (!this.pointerMesh || this.lastActivePlayerIndex === undefined || !this.lastInputManager) {
      return;
    }

    const player = this.levelPlayers[this.lastActivePlayerIndex];
    if (!player) {
      this.pointerMesh.visible = false;
      return;
    }

    const pointerPosition = this.getPointerPosition(player, this.lastInputManager);
    const aimDirection = this.getAimDirection(this.lastInputManager);
    this.pointerMesh.position.copy(pointerPosition);
    this.pointerMesh.lookAt(pointerPosition.clone().add(aimDirection));
    this.pointerMesh.visible = true;
  }

  private getPointerPosition(player: Player, inputManager: InputManager): THREE.Vector3 {
    return this.getWebOrigin(player)
      .addScaledVector(this.getAimDirection(inputManager), POINTER_DISTANCE);
  }

  private clearSpiderWebObjects(): void {
    this.activeTargetsByPlayer.clear();
    this.webPointersByPlayer.clear();

    for (const line of this.webLinesByPlayer.values()) {
      this.scene.remove(line);
      line.geometry.dispose();
      disposeMaterial(line.material);
    }
    this.webLinesByPlayer.clear();

    if (this.pointerMesh) {
      this.scene.remove(this.pointerMesh);
      this.pointerMesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          disposeMaterial(child.material);
        }
      });
      this.pointerMesh = null;
    }
  }

  private getWebOrigin(player: Player): THREE.Vector3 {
    const position = player.body.translation();
    return new THREE.Vector3(position.x, position.y + 0.35, position.z);
  }

  private getWebSurfaces(): THREE.Object3D[] {
    return this.objects.filter((object) => object.visible && object instanceof THREE.Mesh);
  }
}

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

function getDirectionFromAngles(yaw: number, pitch: number): THREE.Vector3 {
  const horizontal = Math.cos(pitch);
  return new THREE.Vector3(
    -Math.sin(yaw) * horizontal,
    Math.sin(pitch),
    -Math.cos(yaw) * horizontal
  ).normalize();
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
    return;
  }

  material.dispose();
}
