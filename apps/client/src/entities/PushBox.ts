import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import type { BoxDefinition, BoxState, Vec3 } from "@game/shared";
import { createBox, standardMaterials } from "../render/MeshFactory";

export class PushBox {
  readonly mesh: THREE.Mesh;
  readonly body: RAPIER.RigidBody;
  private readonly collider: RAPIER.Collider;

  constructor(
    readonly definition: BoxDefinition,
    private readonly world: RAPIER.World
  ) {
    this.mesh = createBox(definition.size, standardMaterials.box);
    this.mesh.position.set(definition.position.x, definition.position.y, definition.position.z);

    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(definition.position.x, definition.position.y, definition.position.z)
        .setCanSleep(false)
        .lockRotations()
    );

    this.collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        definition.size.x / 2,
        definition.size.y / 2,
        definition.size.z / 2
      )
        .setDensity(0.45)
        .setFriction(0.6),
      this.body
    );
  }

  syncMesh(): void {
    const position = this.body.translation();
    this.mesh.position.set(position.x, position.y, position.z);
  }

  getPosition(): Vec3 {
    const position = this.body.translation();
    return { x: position.x, y: position.y, z: position.z };
  }

  getState(): BoxState {
    const position = this.body.translation();
    const velocity = this.body.linvel();
    return {
      id: this.definition.id,
      position: { x: position.x, y: position.y, z: position.z },
      velocity: { x: velocity.x, y: velocity.y, z: velocity.z }
    };
  }

  applyState(state: BoxState, smoothing = 1): void {
    if (smoothing >= 1) {
      this.body.setTranslation(state.position, true);
      this.body.setLinvel(state.velocity, true);
      return;
    }

    const current = this.body.translation();
    const distance = Math.hypot(
      state.position.x - current.x,
      state.position.y - current.y,
      state.position.z - current.z
    );

    const alpha = distance > 2.5 ? 1 : smoothing;
    const nextPosition = {
      x: current.x + (state.position.x - current.x) * alpha,
      y: current.y + (state.position.y - current.y) * alpha,
      z: current.z + (state.position.z - current.z) * alpha
    };

    this.body.setTranslation(nextPosition, true);
    this.body.setLinvel(state.velocity, true);
  }

  reset(): void {
    this.body.setTranslation(this.definition.position, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  respawnFromSky(): void {
    this.body.setTranslation(
      {
        x: this.definition.position.x,
        y: this.definition.position.y + 6,
        z: this.definition.position.z
      },
      true
    );
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  dispose(): void {
    this.world.removeCollider(this.collider, true);
    this.world.removeRigidBody(this.body);
  }
}
