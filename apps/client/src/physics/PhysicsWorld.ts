import RAPIER from "@dimforge/rapier3d-compat";
import { GRAVITY } from "@game/shared";

export class PhysicsWorld {
  readonly world: RAPIER.World;

  constructor() {
    this.world = new RAPIER.World(GRAVITY);
  }

  step(): void {
    this.world.step();
  }
}
