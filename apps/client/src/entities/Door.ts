import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import type { DoorDefinition } from "@game/shared";
import { standardMaterials } from "../render/MeshFactory";

export class Door {
  open = false;
  private body: RAPIER.RigidBody | null;
  private collider: RAPIER.Collider | null;

  constructor(
    readonly definition: DoorDefinition,
    readonly mesh: THREE.Mesh,
    private readonly world: RAPIER.World
  ) {
    const physics = this.createPhysics();
    this.body = physics.body;
    this.collider = physics.collider;
  }

  setOpen(open: boolean): void {
    if (this.open === open) {
      return;
    }

    this.open = open;
    this.mesh.material = open ? standardMaterials.doorOpen : standardMaterials.door;
    this.mesh.position.y = this.definition.position.y + (open ? this.definition.size.y + 0.35 : 0);

    if (open) {
      this.removePhysics();
      return;
    }

    const physics = this.createPhysics();
    this.body = physics.body;
    this.collider = physics.collider;
  }

  dispose(): void {
    this.removePhysics();
  }

  private createPhysics(): { body: RAPIER.RigidBody; collider: RAPIER.Collider } {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(
        this.definition.position.x,
        this.definition.position.y,
        this.definition.position.z
      )
    );

    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        this.definition.size.x / 2,
        this.definition.size.y / 2,
        this.definition.size.z / 2
      ),
      body
    );

    return { body, collider };
  }

  private removePhysics(): void {
    if (this.collider) {
      this.world.removeCollider(this.collider, true);
      this.collider = null;
    }

    if (this.body) {
      this.world.removeRigidBody(this.body);
      this.body = null;
    }
  }
}
