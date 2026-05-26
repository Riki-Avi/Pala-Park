import * as THREE from "three";
import type { Vec3 } from "@game/shared";

const standardMaterials = {
  floor: new THREE.MeshStandardMaterial({ color: "#5e6d7b", roughness: 0.72 }),
  step: new THREE.MeshStandardMaterial({ color: "#7c8c6a", roughness: 0.72 }),
  button: new THREE.MeshStandardMaterial({ color: "#d9b34c", roughness: 0.58 }),
  buttonPressed: new THREE.MeshStandardMaterial({ color: "#5ed38f", roughness: 0.48 }),
  box: new THREE.MeshStandardMaterial({ color: "#b78755", roughness: 0.7 }),
  door: new THREE.MeshStandardMaterial({ color: "#d85454", roughness: 0.45 }),
  doorOpen: new THREE.MeshStandardMaterial({ color: "#4fb1de", roughness: 0.45, transparent: true, opacity: 0.34 }),
  goal: new THREE.MeshStandardMaterial({ color: "#62d7c8", roughness: 0.36, transparent: true, opacity: 0.42 })
};

export function createBox(size: Vec3, material: THREE.Material): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createPlayerMesh(color: string): THREE.Group {
  const group = new THREE.Group();
  const body = createBox({ x: 0.72, y: 0.92, z: 0.72 }, new THREE.MeshStandardMaterial({ color, roughness: 0.52 }));
  const face = createBox({ x: 0.38, y: 0.14, z: 0.04 }, new THREE.MeshStandardMaterial({ color: "#101216", roughness: 0.5 }));

  body.position.y = 0;
  face.position.set(0, 0.12, -0.382);
  group.add(body, face);
  return group;
}

export { standardMaterials };
