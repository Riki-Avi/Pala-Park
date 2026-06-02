import * as THREE from "three";
import type { Player } from "../entities/Player";

export class CameraController {
  private readonly target = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  update(
    localPlayer: Player,
    yaw: number,
    pitch: number,
    alpha: number,
    options: { fullOrbit?: boolean } = {}
  ): void {
    this.target.copy(localPlayer.mesh.position);
    this.target.y += 0.55;

    const distance = 7.2;
    if (options.fullOrbit) {
      const horizontal = Math.cos(pitch);
      this.forward.set(
        -Math.sin(yaw) * horizontal,
        Math.sin(pitch),
        -Math.cos(yaw) * horizontal
      ).normalize();

      this.desired.copy(this.target).addScaledVector(this.forward, -distance);
      this.camera.position.lerp(this.desired, 1 - Math.pow(0.000001, alpha));
      this.lookTarget.copy(this.target).addScaledVector(this.forward, 3.0);
      this.camera.lookAt(this.lookTarget);
      return;
    }

    const height = 2.4 + Math.sin(-pitch) * 3.8;
    const backX = Math.sin(yaw) * distance;
    const backZ = Math.cos(yaw) * distance;

    this.desired.set(this.target.x + backX, this.target.y + height, this.target.z + backZ);
    this.camera.position.lerp(this.desired, 1 - Math.pow(0.000001, alpha));

    this.lookTarget.set(this.target.x, this.target.y + Math.sin(pitch) * 2, this.target.z);
    this.camera.lookAt(this.lookTarget);
  }
}
