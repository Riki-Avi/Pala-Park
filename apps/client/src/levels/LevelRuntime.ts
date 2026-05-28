import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import type { LevelDefinition, LevelStatePayload, PlatformDefinition, Vec3 } from "@game/shared";
import { Button } from "../entities/Button";
import { Door } from "../entities/Door";
import { GoalZone } from "../entities/GoalZone";
import { PushBox } from "../entities/PushBox";
import { createBox, createButtonMesh, standardMaterials } from "../render/MeshFactory";

interface PhysicsObject {
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
  private readonly physicsObjects: PhysicsObject[] = [];

  constructor(
    readonly definition: LevelDefinition,
    private readonly scene: THREE.Scene,
    private readonly world: RAPIER.World
  ) {
    this.createPlatforms();
    this.createBoxes();
    this.createButtons();
    this.createDoors();
    this.createGoalZones();
  }

  update(playerPositions: Vec3[]): void {
    const weightPositions = [...playerPositions, ...this.boxes.map((box) => box.getPosition())];

    for (const button of this.buttons) {
      button.update(weightPositions);
    }

    for (const door of this.doors) {
      const shouldOpen = this.buttons.some(
        (button) => button.definition.targetDoorIds.includes(door.definition.id) && button.pressed
      );
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
      }))
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
  }

  resetDynamicObjects(): void {
    for (const box of this.boxes) {
      box.reset();
    }
  }

  recoverFallenObjects(): void {
    for (const box of this.boxes) {
      if (box.getPosition().y < -8) {
        box.respawnFromSky();
      }
    }
  }

  private createPlatforms(): void {
    for (const platform of this.definition.platforms) {
      const material = platform.id.includes("step") ? standardMaterials.step : standardMaterials.floor;
      const mesh = createBox(platform.size, material);
      mesh.position.set(platform.position.x, platform.position.y, platform.position.z);
      this.scene.add(mesh);
      this.objects.push(mesh);
      this.platforms.push(platform);

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
      this.physicsObjects.push({ body, collider });
    }
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
      const mesh = createButtonMesh(definition.size, standardMaterials.button);
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
