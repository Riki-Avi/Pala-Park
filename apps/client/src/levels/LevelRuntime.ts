import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import type {
  LevelCustomStatePayload,
  LevelDefinition,
  LevelStatePayload,
  PlatformDefinition,
  Vec3
} from "@game/shared";
import { Button } from "../entities/Button";
import { Door } from "../entities/Door";
import { GoalZone } from "../entities/GoalZone";
import { PushBox } from "../entities/PushBox";
import { createBox, createButtonMesh, standardMaterials } from "../render/MeshFactory";
import type { Player } from "../entities/Player";
import type { InputManager } from "../input/InputManager";

interface PhysicsObject {
  id: string;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
}

export class LevelRuntime {
  readonly objects: THREE.Object3D[] = [];
  readonly platforms: PlatformDefinition[] = [];
  readonly boxes: PushBox[] = [];
  readonly buttons: Button[] = [];
  readonly doors: Door[] = [];
  readonly goalZones: GoalZone[] = [];
  protected readonly physicsObjects: PhysicsObject[] = [];
  protected readonly platformMeshes = new Map<string, THREE.Mesh>();
  public shouldReset = false;

  constructor(
    readonly definition: LevelDefinition,
    protected readonly scene: THREE.Scene,
    protected readonly world: RAPIER.World
  ) {
    this.createPlatforms();
    this.createBoxes();
    this.createButtons();
    this.createDoors();
    this.createGoalZones();
  }

  updateLocal(playerPositions: Vec3[], activePlayerIndex?: number, inputManager?: InputManager): void {
    // Override in subclasses for player-local controls that must run on every client.
  }

  update(playerPositions: Vec3[], activePlayerIndex?: number, inputManager?: InputManager): void {
    const weightPositions = [...playerPositions, ...this.boxes.map((box) => box.getPosition())];

    for (const button of this.buttons) {
      button.update(weightPositions);
    }

    this.updateStandardDoors();
  }

  protected updateStandardDoors(): void {
    for (const door of this.doors) {
      const shouldOpen = this.buttons.some(
        (button) => button.definition.targetDoorIds.includes(door.definition.id) && button.pressed
      );
      door.setOpen(shouldOpen);
    }
  }

  protected updateAdvancedDoors(): void {
    for (const door of this.doors) {
      const targetButtons = this.buttons.filter((button) =>
        button.definition.targetDoorIds.includes(door.definition.id)
      );

      const toggleButtons = targetButtons.filter((b) => b.definition.mode === "toggle");
      const holdButtons = targetButtons.filter((b) => b.definition.mode === "hold");

      const togglePressed = toggleButtons.some((b) => b.pressed);
      const holdPressed = holdButtons.length > 0 && holdButtons.every((b) => b.pressed);

      const shouldOpen = togglePressed || holdPressed;
      door.setOpen(shouldOpen);
    }
  }

  isCompleted(playerPositions: Vec3[]): boolean {
    return this.goalZones.some((goalZone) => goalZone.isCompleted(playerPositions));
  }

  dispose(): void {
    for (const door of this.doors) {
      door.dispose();
    }

    for (const box of this.boxes) {
      box.dispose();
    }

    for (const object of this.objects) {
      this.scene.remove(object);
    }

    for (const { body, collider } of this.physicsObjects) {
      this.world.removeCollider(collider, true);
      this.world.removeRigidBody(body);
    }

    this.objects.length = 0;
    this.physicsObjects.length = 0;
    this.platformMeshes.clear();
  }

  syncDynamicMeshes(): void {
    for (const box of this.boxes) {
      box.syncMesh();
    }
  }

  getLevelState(roomCode: string, serverTick: number): LevelStatePayload {
    return {
      roomCode,
      levelId: this.definition.id,
      serverTick,
      boxes: this.boxes.map((box) => box.getState()),
      buttons: this.buttons.map((button) => ({
        id: button.definition.id,
        pressed: button.pressed
      })),
      doors: this.doors.map((door) => ({
        id: door.definition.id,
        open: door.open
      })),
      custom: this.getCustomState()
    };
  }

  applyLevelState(state: LevelStatePayload): void {
    if (state.levelId !== this.definition.id) {
      return;
    }

    for (const boxState of state.boxes) {
      this.boxes.find((box) => box.definition.id === boxState.id)?.applyState(boxState, 0.28);
    }

    for (const buttonState of state.buttons) {
      this.buttons.find((button) => button.definition.id === buttonState.id)?.setPressed(buttonState.pressed);
    }

    for (const doorState of state.doors) {
      this.doors.find((door) => door.definition.id === doorState.id)?.setOpen(doorState.open);
    }

    this.applyCustomState(state.custom);
  }

  protected getCustomState(): LevelCustomStatePayload | undefined {
    return undefined;
  }

  protected applyCustomState(state: LevelCustomStatePayload | undefined): void {
    // Override in subclasses for level-specific online state.
  }

  resetDynamicObjects(): void {
    for (const box of this.boxes) {
      box.reset();
    }
  }

  onLevelStart(players: Player[]): void {
    // Override in subclasses for level-specific start/reset logic
  }

  prepareReset(players: Player[]): void {
    // Override in subclasses to clear constraints before players are teleported to spawn.
  }

  getDeathThreshold(): number {
    return -8.0;
  }

  recoverFallenObjects(): void {
    for (const box of this.boxes) {
      if (box.getPosition().y < this.getDeathThreshold()) {
        box.respawnFromSky();
      }
    }
  }

  private createPlatforms(): void {
    for (const platform of this.definition.platforms) {
      const material = this.getPlatformMaterial(platform);
      const mesh = createBox(platform.size, material);
      mesh.position.set(platform.position.x, platform.position.y, platform.position.z);
      if (platform.id.includes("invisible")) {
        mesh.visible = false;
      }
      if (this.isTunnelGlass(platform)) {
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.renderOrder = -1;
      }
      if (this.isInternalLaserWall(platform)) {
        this.addWallEdges(mesh, platform);
      }
      this.scene.add(mesh);
      this.objects.push(mesh);
      this.platforms.push(platform);
      this.platformMeshes.set(platform.id, mesh);

      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(
          platform.position.x,
          platform.position.y,
          platform.position.z
        )
      );
      const collider = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(
          platform.size.x / 2,
          platform.size.y / 2,
          platform.size.z / 2
        ),
        body
      );
      this.physicsObjects.push({ id: platform.id, body, collider });
    }
  }

  private getPlatformMaterial(platform: PlatformDefinition): THREE.Material {
    if (this.isTunnelGlass(platform)) {
      return new THREE.MeshStandardMaterial({
        color: "#89b8d8",
        roughness: 0.18,
        metalness: 0.05,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
        side: THREE.DoubleSide
      });
    }

    return platform.id.includes("step") ? standardMaterials.step : standardMaterials.floor;
  }

  private isTunnelGlass(platform: PlatformDefinition): boolean {
    return (
      platform.id.startsWith("tunnel-wall") ||
      platform.id === "tunnel-ceiling" ||
      this.isInternalLaserWall(platform)
    );
  }

  private isInternalLaserWall(platform: PlatformDefinition): boolean {
    return /^wall\d+-/.test(platform.id);
  }

  private addWallEdges(mesh: THREE.Mesh, platform: PlatformDefinition): void {
    const edgeGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(platform.size.x, platform.size.y, platform.size.z));
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: "#d3e3ee",
      transparent: true,
      opacity: 0.72
    });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edges.renderOrder = 2;
    mesh.add(edges);
  }

  private getFloorHeightAt(x: number, z: number): number {
    let maxHeight = -999;
    for (const platform of this.definition.platforms) {
      const halfX = platform.size.x / 2;
      const halfZ = platform.size.z / 2;
      if (
        x >= platform.position.x - halfX &&
        x <= platform.position.x + halfX &&
        z >= platform.position.z - halfZ &&
        z <= platform.position.z + halfZ
      ) {
        const top = platform.position.y + platform.size.y / 2;
        if (top > maxHeight) {
          maxHeight = top;
        }
      }
    }
    return maxHeight === -999 ? 0 : maxHeight;
  }

  private createButtons(): void {
    for (const definition of this.definition.buttons) {
      const material = definition.id === "button-unlock"
        ? standardMaterials.buttonBlue
        : standardMaterials.button;
      const mesh = createButtonMesh(definition.size, material);
      const floorY = this.getFloorHeightAt(definition.position.x, definition.position.z);
      mesh.position.set(definition.position.x, floorY, definition.position.z);
      this.scene.add(mesh);
      this.objects.push(mesh);
      this.buttons.push(new Button(definition, mesh));
    }
  }

  private createBoxes(): void {
    for (const definition of this.definition.boxes) {
      const box = new PushBox(definition, this.world);
      this.scene.add(box.mesh);
      this.objects.push(box.mesh);
      this.boxes.push(box);
    }
  }

  private createDoors(): void {
    for (const definition of this.definition.doors) {
      const mesh = createBox(definition.size, standardMaterials.door);
      mesh.position.set(definition.position.x, definition.position.y, definition.position.z);
      this.scene.add(mesh);
      this.objects.push(mesh);
      this.doors.push(new Door(definition, mesh, this.world));
    }
  }

  private createGoalZones(): void {
    for (const definition of this.definition.goalZones) {
      const mesh = createBox(definition.size, standardMaterials.goal);
      mesh.position.set(definition.position.x, definition.position.y, definition.position.z);
      this.scene.add(mesh);
      this.objects.push(mesh);
      this.goalZones.push(new GoalZone(definition, mesh));
    }
  }
}
