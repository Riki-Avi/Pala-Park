import * as THREE from "three";
import type { ButtonDefinition, Vec3 } from "@game/shared";
import { standardMaterials } from "../render/MeshFactory";
import { AudioManager } from "../core/AudioManager";

export class Button {
  pressed = false;

  private readonly normalMaterial: THREE.Material;
  private readonly pressedMaterial: THREE.Material;

  constructor(
    readonly definition: ButtonDefinition,
    readonly mesh: THREE.Mesh
  ) {
    this.normalMaterial = mesh.material as THREE.Material;
    this.pressedMaterial = definition.id === "button-unlock"
      ? standardMaterials.buttonBluePressed
      : standardMaterials.buttonPressed;
  }

  update(weightPositions: Vec3[]): void {
    if (this.definition.mode === "toggle" && this.pressed) {
      return;
    }

    this.setPressed(
      weightPositions.some((position) =>
        this.contains(position, {
          x: this.definition.size.x + 0.35,
          y: 2,
          z: this.definition.size.z + 0.35
        })
      )
    );
  }

  setPressed(pressed: boolean): void {
    if (!this.pressed && pressed) {
      AudioManager.playButton();
    }
    this.pressed = pressed;
    this.mesh.material = this.pressed ? this.pressedMaterial : this.normalMaterial;
    this.mesh.scale.y = this.pressed ? 0.45 : 1;
  }

  reset(): void {
    this.pressed = false;
    this.mesh.material = this.normalMaterial;
    this.mesh.scale.y = 1;
  }

  private contains(position: Vec3, size: Vec3): boolean {
    return (
      Math.abs(position.x - this.definition.position.x) <= size.x / 2 &&
      Math.abs(position.y - this.definition.position.y) <= size.y / 2 + 0.75 &&
      Math.abs(position.z - this.definition.position.z) <= size.z / 2
    );
  }
}
