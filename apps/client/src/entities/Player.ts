import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import {
  PLAYER_JUMP_SPEED,
  PLAYER_MAX_FALL_SPEED,
  PLAYER_SIZE,
  PLAYER_SPEED,
  type NetworkedEntity,
  type PlayerPose,
  type PlayerSnapshot,
  type Vec3
} from "@game/shared";
import type { LocalInputState } from "../input/InputState";
import { createPlayerMesh } from "../render/MeshFactory";
import { AudioManager } from "../core/AudioManager";

export class Player implements NetworkedEntity<PlayerSnapshot> {
  readonly mesh: THREE.Group;
  readonly body: RAPIER.RigidBody;
  isGrounded = false;
  inGoal = false;
  isActionActive = false;
  lastProcessedInput = 0;
  lookYaw = 0;
  lookPitch = 0;
  private visualYaw = 0;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private wasJumpHeld = false;

  constructor(
    readonly id: string,
    world: RAPIER.World,
    spawn: Vec3,
    color: string
  ) {
    this.mesh = createPlayerMesh(color);
    const rigidBody = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawn.x, spawn.y, spawn.z)
      .setCanSleep(false)
      .lockRotations();
    this.body = world.createRigidBody(rigidBody);

    const borderRadius = 0.08;
    const collider = RAPIER.ColliderDesc.roundCuboid(
      PLAYER_SIZE.x / 2 - borderRadius,
      PLAYER_SIZE.y / 2 - borderRadius,
      PLAYER_SIZE.z / 2 - borderRadius,
      borderRadius
    )
      .setFriction(0)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min);
    world.createCollider(collider, this.body);
  }

  applyInput(input: LocalInputState, yaw = 0, pitch = 0, cameraRelative = false, delta = 1 / 60): void {
    this.isActionActive = input.interact;
    const velocity = this.body.linvel();
    let x = 0;
    let z = 0;

    if (input.left) x -= 1;
    if (input.right) x += 1;
    if (input.forward) z -= 1;
    if (input.backward) z += 1;

    const length = Math.hypot(x, z) || 1;
    const yVelocity = Math.max(velocity.y, PLAYER_MAX_FALL_SPEED);
    const normalizedX = x / length;
    const normalizedZ = z / length;
    let worldX = normalizedX;
    let worldZ = normalizedZ;

    if (cameraRelative) {
      this.lookYaw = yaw;
      this.lookPitch = pitch;
      this.visualYaw = yaw; // El cuerpo sigue siempre la dirección del mouse (cámara)
      const forwardX = -Math.sin(yaw);
      const forwardZ = -Math.cos(yaw);
      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);
      worldX = rightX * normalizedX + forwardX * -normalizedZ;
      worldZ = rightZ * normalizedX + forwardZ * -normalizedZ;
    } else {
      this.lookYaw = this.visualYaw;
      this.lookPitch = 0;
    }

    if (!cameraRelative && (x !== 0 || z !== 0)) {
      this.visualYaw = Math.atan2(worldX, -worldZ);
    }

    if (this.isGrounded) {
      this.coyoteTimer = 0.12;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - delta);
    }

    if (input.jump && !this.wasJumpHeld) {
      this.jumpBufferTimer = 0.12;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - delta);
    }
    this.wasJumpHeld = input.jump;

    let nextYVelocity = yVelocity;
    const shouldJump = this.jumpBufferTimer > 0 && this.coyoteTimer > 0;

    if (shouldJump) {
      nextYVelocity = PLAYER_JUMP_SPEED;
      this.isGrounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      if (this.body.gravityScale() !== 0) {
        AudioManager.playJump();
      }
    } else if (!this.isGrounded && nextYVelocity < 0) {
      nextYVelocity = Math.max(nextYVelocity - 18 * delta, PLAYER_MAX_FALL_SPEED);
    }

    const control = this.isGrounded ? 0.35 : 0.09;
    const currentVelocity = this.body.linvel();
    const targetX = worldX * PLAYER_SPEED;
    const targetZ = worldZ * PLAYER_SPEED;
    const nextX = currentVelocity.x + (targetX - currentVelocity.x) * control;
    const nextZ = currentVelocity.z + (targetZ - currentVelocity.z) * control;

    this.body.setLinvel({ x: nextX, y: nextYVelocity, z: nextZ }, true);
  }

  setGrounded(grounded: boolean): void {
    this.isGrounded = grounded;
  }

  reset(spawn: Vec3): void {
    this.body.setTranslation(spawn, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.isGrounded = false;
    this.inGoal = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.wasJumpHeld = false;
  }

  syncMesh(): void {
    const translation = this.body.translation();
    const rotation = this.body.rotation();
    this.mesh.position.set(translation.x, translation.y, translation.z);
    this.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    this.mesh.rotation.y = this.visualYaw;

    // Animar patas y cola en base al estado de movimiento y salto
    const legFL = this.mesh.getObjectByName("legFL");
    const legFR = this.mesh.getObjectByName("legFR");
    const legBL = this.mesh.getObjectByName("legBL");
    const legBR = this.mesh.getObjectByName("legBR");
    const tail = this.mesh.getObjectByName("tail");
    const bodyMesh = this.mesh.getObjectByName("body");

    const velocity = this.body.linvel();
    const speed = Math.hypot(velocity.x, velocity.z);
    const time = Date.now() * 0.008;

    if (!this.isGrounded) {
      // Animación en el aire (salto o caída)
      const jumpYOffset = 0.05; // Las patas se encogen un poco hacia el cuerpo
      const kickSpeed = Date.now() * 0.035; // Pataleo rápido y tierno
      
      if (velocity.y > 1.0) {
        // --- SUBIENDO: Salto heroico ---
        // El cuerpo se inclina ligeramente hacia arriba
        const t = Math.min(velocity.y / PLAYER_JUMP_SPEED, 1.0);
        const bodyPitch = -0.15 * t;
        
        if (bodyMesh) {
          bodyMesh.rotation.set(bodyPitch, 0, 0);
          bodyMesh.position.y = 0.1;
        }

        // Las patitas delanteras se estiran al frente, las traseras hacia atrás
        if (legFL) {
          legFL.position.set(-0.2, -0.4 + jumpYOffset, -0.2);
          legFL.rotation.set(0.5, 0, -0.1);
        }
        if (legFR) {
          legFR.position.set(0.2, -0.4 + jumpYOffset, -0.2);
          legFR.rotation.set(0.5, 0, 0.1);
        }
        if (legBL) {
          legBL.position.set(-0.2, -0.4 + jumpYOffset, 0.2);
          legBL.rotation.set(-0.5, 0, -0.05);
        }
        if (legBR) {
          legBR.position.set(0.2, -0.4 + jumpYOffset, 0.2);
          legBR.rotation.set(-0.5, 0, 0.05);
        }
        if (tail) {
          tail.rotation.set(0.2 + Math.sin(kickSpeed * 0.3) * 0.1, 0, 0);
        }
      } else {
        // --- CAYENDO / FLOTANDO: Pataleo desesperado ---
        // El cuerpo se inclina ligeramente hacia abajo (buscando el suelo)
        const fallT = Math.min(Math.abs(velocity.y) / 10, 1.0);
        const bodyPitch = 0.12 * fallT;
        
        if (bodyMesh) {
          bodyMesh.rotation.set(bodyPitch, 0, 0);
          bodyMesh.position.y = 0.1;
        }

        // Pataleo desfasado izquierda/derecha
        const swingL = Math.sin(kickSpeed) * 0.45;
        const swingR = -Math.sin(kickSpeed) * 0.45;
        // Las patitas se abren a los lados para dar sensación de caída libre
        const spread = 0.1 + fallT * 0.15;

        if (legFL) {
          legFL.position.set(-0.2, -0.4 + jumpYOffset, -0.2);
          legFL.rotation.set(swingL, 0, -spread);
        }
        if (legFR) {
          legFR.position.set(0.2, -0.4 + jumpYOffset, -0.2);
          legFR.rotation.set(swingR, 0, spread);
        }
        if (legBL) {
          legBL.position.set(-0.2, -0.4 + jumpYOffset, 0.2);
          legBL.rotation.set(swingR, 0, -spread * 0.8);
        }
        if (legBR) {
          legBR.position.set(0.2, -0.4 + jumpYOffset, 0.2);
          legBR.rotation.set(swingL, 0, spread * 0.8);
        }
        if (tail) {
          // La cola se mueve de lado a lado desesperadamente
          tail.rotation.set(0.6 + Math.sin(kickSpeed * 0.5) * 0.15, 0, Math.sin(kickSpeed) * 0.3);
        }
      }
    } else if (speed > 0.15) {
      // --- CAMINANDO: Balanceo de patas y rebote del cuerpo ---
      const swing = Math.sin(time * 1.5) * 0.45;
      
      // Rebote vertical sutil del cuerpo al caminar
      if (bodyMesh) {
        bodyMesh.rotation.set(0, 0, 0);
        bodyMesh.position.y = 0.1 + Math.sin(time * 3.0) * 0.02;
      }

      if (legFL) {
        legFL.position.set(-0.2, -0.4, -0.2);
        legFL.rotation.set(swing, 0, 0);
      }
      if (legFR) {
        legFR.position.set(0.2, -0.4, -0.2);
        legFR.rotation.set(-swing, 0, 0);
      }
      if (legBL) {
        legBL.position.set(-0.2, -0.4, 0.2);
        legBL.rotation.set(-swing, 0, 0);
      }
      if (legBR) {
        legBR.position.set(0.2, -0.4, 0.2);
        legBR.rotation.set(swing, 0, 0);
      }
      if (tail) {
        tail.rotation.set(0.4 + Math.sin(time) * 0.12, 0, 0);
      }
    } else {
      // --- REPOSO (Idle): Respiración sutil ---
      if (bodyMesh) {
        bodyMesh.rotation.set(0, 0, 0);
        bodyMesh.position.y = 0.1 + Math.sin(time * 0.5) * 0.005; // Efecto respiración sutil
      }

      if (legFL) {
        legFL.position.set(-0.2, -0.4, -0.2);
        legFL.rotation.set(0, 0, 0);
      }
      if (legFR) {
        legFR.position.set(0.2, -0.4, -0.2);
        legFR.rotation.set(0, 0, 0);
      }
      if (legBL) {
        legBL.position.set(-0.2, -0.4, 0.2);
        legBL.rotation.set(0, 0, 0);
      }
      if (legBR) {
        legBR.position.set(0.2, -0.4, 0.2);
        legBR.rotation.set(0, 0, 0);
      }
      if (tail) {
        tail.rotation.set(0.4 + Math.sin(time * 0.3) * 0.04, 0, 0);
      }
    }
  }

  getSnapshot(): PlayerSnapshot {
    const position = this.body.translation();
    const velocity = this.body.linvel();
    return {
      id: this.id,
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: 0, y: 0, z: 0 },
      velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
      isGrounded: this.isGrounded,
      inGoal: this.inGoal,
      lastProcessedInput: this.lastProcessedInput
    };
  }

  applySnapshot(snapshot: PlayerSnapshot): void {
    this.body.setTranslation(snapshot.position, true);
    this.body.setLinvel(snapshot.velocity, true);
    this.isGrounded = snapshot.isGrounded;
    this.inGoal = snapshot.inGoal;
    this.lastProcessedInput = snapshot.lastProcessedInput;
  }

  getNetworkPose(playerId: string, yaw: number): PlayerPose {
    const position = this.body.translation();
    const velocity = this.body.linvel();
    return {
      playerId,
      position: { x: position.x, y: position.y, z: position.z },
      velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
      yaw,
      isActionActive: this.isActionActive
    };
  }

  applyNetworkPose(pose: PlayerPose, smoothing = 1): void {
    const current = this.body.translation();
    const distance = Math.hypot(
      pose.position.x - current.x,
      pose.position.y - current.y,
      pose.position.z - current.z
    );
    const alpha = distance > 3 ? 1 : smoothing;
    const nextPosition = {
      x: current.x + (pose.position.x - current.x) * alpha,
      y: current.y + (pose.position.y - current.y) * alpha,
      z: current.z + (pose.position.z - current.z) * alpha
    };

    const previousVelocity = this.body.linvel();
    const isJumpingNow = pose.velocity.y > 4 && previousVelocity.y <= 0.1;
    if (isJumpingNow) {
      AudioManager.playJump();
    }

    this.body.setTranslation(nextPosition, true);
    this.body.setLinvel(pose.velocity, true);
    this.visualYaw = lerpAngle(this.visualYaw, pose.yaw, alpha);
    this.lookYaw = this.visualYaw;
    this.lookPitch = 0;
    this.isActionActive = !!pose.isActionActive;
  }
}

function lerpAngle(from: number, to: number, alpha: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * alpha;
}
