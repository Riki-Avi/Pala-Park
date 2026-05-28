import * as THREE from "three";
import type { Vec3 } from "@game/shared";

const standardMaterials = {
  floor: new THREE.MeshStandardMaterial({ color: "#5e6d7b", roughness: 0.72 }),
  step: new THREE.MeshStandardMaterial({ color: "#5e6d7b", roughness: 0.72 }),
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

export function createButtonMesh(size: Vec3, material: THREE.Material): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  // Desplazar la geometría en Y de modo que el pivote (0,0,0) esté en la cara inferior
  geometry.translate(0, size.y / 2, 0);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createPlayerMesh(color: string): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.52 });
  const pinkMat = new THREE.MeshStandardMaterial({ color: "#ffb3c6", roughness: 0.6 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: "#101216", roughness: 0.3 });
  const snoutMat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.6 });

  // Cuerpo principal (cabeza y torso unidos en estilo voxel, uno solo!)
  // Modificamos a y: 0.80 y posición en y: 0.10 para que coincida exactamente con la física (parte superior en y: 0.5)
  const body = createBox({ x: 0.65, y: 0.8, z: 0.65 }, mat);
  body.name = "body";
  body.position.y = 0.1;
  group.add(body);

  // Orejas al costado de la cabeza (dejando la parte superior plana) - Hijas de body
  const earL = createBox({ x: 0.1, y: 0.16, z: 0.16 }, mat);
  earL.position.set(-0.375, 0.22, 0);
  const earR = createBox({ x: 0.1, y: 0.16, z: 0.16 }, mat);
  earR.position.set(0.375, 0.22, 0);

  const innerEarL = createBox({ x: 0.02, y: 0.1, z: 0.1 }, pinkMat);
  innerEarL.position.set(-0.375, 0.22, -0.085);
  const innerEarR = createBox({ x: 0.02, y: 0.1, z: 0.1 }, pinkMat);
  innerEarR.position.set(0.375, 0.22, -0.085);

  body.add(earL, earR, innerEarL, innerEarR);

  // Ojos (negros con brillo) - Hijos de body
  const eyeL = createBox({ x: 0.09, y: 0.09, z: 0.02 }, eyeMat);
  eyeL.position.set(-0.16, 0.13, -0.33);
  const eyeR = createBox({ x: 0.09, y: 0.09, z: 0.02 }, eyeMat);
  eyeR.position.set(0.16, 0.13, -0.33);
  body.add(eyeL, eyeR);

  // Hocico blanco y nariz rosa - Hijos de body
  const snout = createBox({ x: 0.22, y: 0.11, z: 0.04 }, snoutMat);
  snout.position.set(0, 0, -0.335);
  const nose = createBox({ x: 0.07, y: 0.05, z: 0.02 }, pinkMat);
  nose.position.set(0, 0.03, -0.36);
  body.add(snout, nose);

  // Patitas (4 patas cúbicas en la base) - Hijas de group
  const legFL = createBox({ x: 0.13, y: 0.2, z: 0.13 }, mat);
  legFL.name = "legFL";
  legFL.position.set(-0.2, -0.4, -0.2);

  const legFR = createBox({ x: 0.13, y: 0.2, z: 0.13 }, mat);
  legFR.name = "legFR";
  legFR.position.set(0.2, -0.4, -0.2);

  const legBL = createBox({ x: 0.13, y: 0.2, z: 0.13 }, mat);
  legBL.name = "legBL";
  legBL.position.set(-0.2, -0.4, 0.2);

  const legBR = createBox({ x: 0.13, y: 0.2, z: 0.13 }, mat);
  legBR.name = "legBR";
  legBR.position.set(0.2, -0.4, 0.2);

  group.add(legFL, legFR, legBL, legBR);

  // Cola - Hija de body
  const tail = createBox({ x: 0.07, y: 0.32, z: 0.07 }, mat);
  tail.name = "tail";
  tail.position.set(0, -0.07, 0.35);
  tail.rotation.x = 0.4; // inclinada hacia atrás
  body.add(tail);

  return group;
}

export { standardMaterials };
