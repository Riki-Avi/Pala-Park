import * as THREE from "three";
import type { Player } from "../entities/Player";
import type { InputManager } from "../input/InputManager";

interface WebTarget {
  position: THREE.Vector3;
}

interface SpiderWebAbilityOptions {
  range?: number;
  releaseDistance?: number;
  maxSpeed?: number;
  pointerDistance?: number;
}

const DEFAULT_RANGE = 18.0;
const DEFAULT_RELEASE_DISTANCE = 0.9;
const DEFAULT_MAX_SPEED = 13.5;
const DEFAULT_POINTER_DISTANCE = 5.5;
const POINTER_CAN_GRAB_COLOR = "#48ff7a";
const POINTER_CANNOT_GRAB_COLOR = "#ff4b5c";

export class SpiderWebAbility {
  private players: Player[] = [];
  private readonly activeTargetsByPlayer = new Map<string, WebTarget>();
  private readonly webLinesByPlayer = new Map<string, THREE.Line>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly range: number;
  private readonly releaseDistance: number;
  private readonly maxSpeed: number;
  private readonly pointerDistance: number;
  private pointerMesh: THREE.Group | null = null;
  private pointerMaterial: THREE.MeshBasicMaterial | null = null;
  private lastActivePlayerIndex?: number;
  private lastInputManager?: InputManager;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly getSurfaces: () => THREE.Object3D[],
    options: SpiderWebAbilityOptions = {}
  ) {
    this.range = options.range ?? DEFAULT_RANGE;
    this.releaseDistance = options.releaseDistance ?? DEFAULT_RELEASE_DISTANCE;
    this.maxSpeed = options.maxSpeed ?? DEFAULT_MAX_SPEED;
    this.pointerDistance = options.pointerDistance ?? DEFAULT_POINTER_DISTANCE;
  }

  start(players: Player[]): void {
    this.disposeObjects();
    this.players = players;
    this.createPlayerWebLines(players);
    this.pointerMesh = this.createPointerMesh();
    this.scene.add(this.pointerMesh);
  }

  prepareReset(players: Player[]): void {
    this.activeTargetsByPlayer.clear();
    this.players = players;
    for (const player of players) {
      const line = this.webLinesByPlayer.get(player.id);
      if (line) {
        line.visible = false;
      }
    }
  }

  update(activePlayerIndex?: number, inputManager?: InputManager): void {
    if (activePlayerIndex === undefined || !inputManager) {
      return;
    }

    this.lastActivePlayerIndex = activePlayerIndex;
    this.lastInputManager = inputManager;

    const player = this.players[activePlayerIndex];
    if (!player) {
      return;
    }

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

  syncMeshes(): void {
    this.syncPointer();
    this.syncWebLines();
  }

  dispose(): void {
    this.disposeObjects();
    this.players = [];
    this.lastActivePlayerIndex = undefined;
    this.lastInputManager = undefined;
  }

  private createPointerMesh(): THREE.Group {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({
      color: POINTER_CANNOT_GRAB_COLOR,
      transparent: true,
      opacity: 0.8,
      depthTest: false
    });
    this.pointerMaterial = material;

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.012, 8, 24), material);
    const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.42, 0.018), material);
    const horizontal = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.018, 0.018), material);
    group.add(ring, vertical, horizontal);
    group.renderOrder = 4;
    group.visible = false;
    return group;
  }

  private createPlayerWebLines(players: Player[]): void {
    for (const player of players) {
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3()
      ]);
      const material = new THREE.LineBasicMaterial({
        color: "#e7fbff",
        transparent: true,
        opacity: 0.88
      });
      const line = new THREE.Line(geometry, material);
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
    this.raycaster.far = this.range;

    const hits = this.raycaster.intersectObjects(this.getSurfaces(), false);
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
    return distance <= this.range + 1.0;
  }

  private pullPlayerTowardTarget(player: Player, target: WebTarget): void {
    const position = player.body.translation();
    const toTarget = new THREE.Vector3(
      target.position.x - position.x,
      target.position.y - position.y,
      target.position.z - position.z
    );
    const distance = toTarget.length();
    if (distance < this.releaseDistance) {
      return;
    }

    const direction = toTarget.normalize();
    const currentVelocity = player.body.linvel();
    const targetSpeed = Math.min(6.0 + distance * 0.9, this.maxSpeed);
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
    for (const player of this.players) {
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
    this.raycaster.far = this.range;
    const hits = this.raycaster.intersectObjects(this.getSurfaces(), false);
    const hit = hits.find((entry) => entry.distance > 0.65);
    return hit ? { position: hit.point.clone() } : null;
  }

  private syncPointer(): void {
    if (!this.pointerMesh || this.lastActivePlayerIndex === undefined || !this.lastInputManager) {
      return;
    }

    const player = this.players[this.lastActivePlayerIndex];
    if (!player) {
      this.pointerMesh.visible = false;
      return;
    }

    const pointerPosition = this.getPointerPosition(player, this.lastInputManager);
    const aimDirection = this.getAimDirection(this.lastInputManager);
    const canGrab = this.findWebTarget(player, this.lastInputManager) !== null;

    if (this.pointerMaterial) {
      this.pointerMaterial.color.set(canGrab ? POINTER_CAN_GRAB_COLOR : POINTER_CANNOT_GRAB_COLOR);
      this.pointerMaterial.opacity = canGrab ? 0.95 : 0.75;
    }

    this.pointerMesh.position.copy(pointerPosition);
    this.pointerMesh.lookAt(pointerPosition.clone().add(aimDirection));
    this.pointerMesh.visible = true;
  }

  private getPointerPosition(player: Player, inputManager: InputManager): THREE.Vector3 {
    return this.getWebOrigin(player)
      .addScaledVector(this.getAimDirection(inputManager), this.pointerDistance);
  }

  private disposeObjects(): void {
    this.activeTargetsByPlayer.clear();

    for (const line of this.webLinesByPlayer.values()) {
      this.scene.remove(line);
      line.geometry.dispose();
      disposeMaterial(line.material);
    }
    this.webLinesByPlayer.clear();

    if (this.pointerMesh) {
      this.scene.remove(this.pointerMesh);
      const disposedMaterials = new Set<THREE.Material>();
      this.pointerMesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          disposeMaterial(child.material, disposedMaterials);
        }
      });
      this.pointerMesh = null;
      this.pointerMaterial = null;
    }
  }

  private getWebOrigin(player: Player): THREE.Vector3 {
    const position = player.body.translation();
    return new THREE.Vector3(position.x, position.y + 0.35, position.z);
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

function disposeMaterial(
  material: THREE.Material | THREE.Material[],
  disposedMaterials = new Set<THREE.Material>()
): void {
  if (Array.isArray(material)) {
    material.forEach((entry) => disposeMaterial(entry, disposedMaterials));
    return;
  }

  if (disposedMaterials.has(material)) {
    return;
  }

  material.dispose();
  disposedMaterials.add(material);
}
