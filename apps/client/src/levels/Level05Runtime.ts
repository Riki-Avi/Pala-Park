import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import type { Vec3 } from "@game/shared";
import { LevelRuntime } from "./LevelRuntime";
import type { Player } from "../entities/Player";
import { AudioManager } from "../core/AudioManager";

interface DestructibleBlock {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  mesh: THREE.Mesh;
  health: number;
  destroyed: boolean;
}

interface EnemyTurret {
  head: THREE.Group;
  baseMesh: THREE.Mesh;
  position: THREE.Vector3;
  health: number;
  fireCooldownMs: number;
  lastShotTime: number;
  destroyed: boolean;
}

interface LaserProjectile {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  spawnTime: number;
}

interface LaserBarrier {
  mesh: THREE.Object3D;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  origin: THREE.Vector3;
  position: THREE.Vector3;
  height: number;
  amplitude: number;
  speed: number;
  phase: number;
  active: boolean;
}

export class Level05Runtime extends LevelRuntime {
  private levelPlayers: Player[] = [];
  private blocks: DestructibleBlock[] = [];
  private turrets: EnemyTurret[] = [];
  private playerLasers: LaserProjectile[] = [];
  private enemyProjectiles: LaserProjectile[] = [];
  
  private playerLastShotTimes: number[] = [0, 0, 0, 0];
  
  private laserBarriers: LaserBarrier[] = [];
  
  private lastActivePlayerIndex?: number;
  private lastInputManager?: any;

  override getDeathThreshold(): number {
    return -15.0; // Same death threshold as level 4
  }

  override onLevelStart(players: Player[]): void {
    // Clear everything first
    this.clearAllObjects();
    this.levelPlayers = players;

    // 1. Configure spaceships for players
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      player.body.setGravityScale(0, true);

      // Hide default legs and tail
      const legFL = player.mesh.getObjectByName("legFL");
      const legFR = player.mesh.getObjectByName("legFR");
      const legBL = player.mesh.getObjectByName("legBL");
      const legBR = player.mesh.getObjectByName("legBR");
      const tail = player.mesh.getObjectByName("tail");
      if (legFL) legFL.visible = false;
      if (legFR) legFR.visible = false;
      if (legBL) legBL.visible = false;
      if (legBR) legBR.visible = false;
      if (tail) tail.visible = false;

      // Find player color
      let colorStr = "#ffffff";
      const pBody = player.mesh.getObjectByName("body");
      if (pBody && pBody instanceof THREE.Mesh && pBody.material instanceof THREE.MeshStandardMaterial) {
        colorStr = "#" + pBody.material.color.getHexString();
      }

      // Attach spaceship model
      const role = i < 2 ? "attacker" : "defender";
      const ship = this.createShipMesh(colorStr, role);
      ship.name = "spaceship";
      player.mesh.add(ship);
    }

    // 2. Spawn Destructible Walls
    this.spawnBlockGrid(-10.0); // Wall 1
    this.spawnBlockGrid(22.0); // Wall 3
 
    // 3. Spawn Laser Beam Barriers
    this.laserBarriers = [];
    this.spawnLaserBarrier(new THREE.Vector3(2.0, 2.5, 0.0), 5.0, 2.2, 1.35, 0.0);
    this.spawnLaserBarrier(new THREE.Vector3(12.0, -2.5, 0.0), 5.0, 2.2, 1.15, Math.PI);
 
    // 4. Spawn Turrets
    this.spawnTurret(new THREE.Vector3(-15.0, 7.5, 0.0));
    this.spawnTurret(new THREE.Vector3(-4.0, -7.5, -2.0));
    this.spawnTurret(new THREE.Vector3(7.0, 7.5, 2.0));
    this.spawnTurret(new THREE.Vector3(17.0, -7.5, -2.0));
    this.spawnTurret(new THREE.Vector3(27.0, 7.5, 0.0));
    this.spawnTurret(new THREE.Vector3(3.5, 7.5, -3.2), 950);
    this.spawnTurret(new THREE.Vector3(21.0, -7.5, 3.2), 950);
  }

  override update(playerPositions: Vec3[], activePlayerIndex?: number, inputManager?: any): void {
    this.lastActivePlayerIndex = activePlayerIndex;
    this.lastInputManager = inputManager;
    const delta = 1 / 60;
    const now = Date.now();

    // 1. Process active player flight controls
    if (activePlayerIndex !== undefined && inputManager) {
      const activePlayer = this.levelPlayers[activePlayerIndex];
      const input = inputManager.getPrimaryInput();

      if (activePlayer) {
        const yaw = inputManager.yaw;
        const forwardX = -Math.sin(yaw);
        const forwardZ = -Math.cos(yaw);
        const rightX = Math.cos(yaw);
        const rightZ = -Math.sin(yaw);
        
        let moveX = 0;
        let moveZ = 0;
        if (input.forward) { moveX += forwardX; moveZ += forwardZ; }
        if (input.backward) { moveX -= forwardX; moveZ -= forwardZ; }
        if (input.left) { moveX -= rightX; moveZ -= rightZ; }
        if (input.right) { moveX += rightX; moveZ += rightZ; }
        
        const len = Math.hypot(moveX, moveZ);
        if (len > 0) {
          moveX /= len;
          moveZ /= len;
        }
        
        let targetY = -0.5; // Hover downward drift
        if (input.jump) {
          targetY = 4.2; // Ascend
        }
        
        const speed = 7.0;
        const currentVel = activePlayer.body.linvel();
        const targetVelX = moveX * speed;
        const targetVelZ = moveZ * speed;
        
        const nextVelX = currentVel.x + (targetVelX - currentVel.x) * 0.15;
        const nextVelZ = currentVel.z + (targetVelZ - currentVel.z) * 0.15;
        const nextVelY = currentVel.y + (targetY - currentVel.y) * 0.12;
        
        activePlayer.body.setLinvel({ x: nextVelX, y: nextVelY, z: nextVelZ }, true);
      }

      // Hover all inactive players in local mode
      for (let i = 0; i < this.levelPlayers.length; i++) {
        if (i !== activePlayerIndex) {
          this.levelPlayers[i].body.setLinvel({ x: 0, y: 0.0, z: 0 }, true);
        }
      }
    }

    // 2. Firing weapons & toggling shields for all players based on isActionActive state
    for (let i = 0; i < this.levelPlayers.length; i++) {
      const player = this.levelPlayers[i];
      const role = i < 2 ? "attacker" : "defender";
      
      const ship = player.mesh.getObjectByName("spaceship");
      if (!ship) continue;

      if (role === "attacker") {
        if (player.isActionActive && now - this.playerLastShotTimes[i] > 700) {
          this.playerLastShotTimes[i] = now;
          this.firePlayerLaser(player);
          AudioManager.playLaser();
        }
      } else {
        // Toggle shield visibility
        const shield = ship.getObjectByName("shield");
        if (shield) {
          shield.visible = player.isActionActive;
        }
      }
    }

    // 3. Update player lasers
    for (let i = this.playerLasers.length - 1; i >= 0; i--) {
      const laser = this.playerLasers[i];
      laser.position.addScaledVector(laser.velocity, delta);
      laser.mesh.position.copy(laser.position);

      let laserHit = false;

      // Check collision with active defender shields (allied fire gets blocked)
      for (let j = 2; j < 4; j++) {
        const defender = this.levelPlayers[j];
        if (defender && defender.isActionActive) {
          if (laser.position.distanceTo(defender.mesh.position) < 1.7) {
            laserHit = true;
            AudioManager.playButton(); // Play feedback sound
            break;
          }
        }
      }

      // Check collision with destructible blocks
      if (!laserHit) {
        for (const block of this.blocks) {
        if (block.destroyed) continue;
        if (laser.position.distanceTo(block.mesh.position) < 0.9) {
          block.health--;
          laserHit = true;
          AudioManager.playButton();

          // Flash color briefly
          if (block.mesh.material instanceof THREE.MeshStandardMaterial) {
            block.mesh.material.emissive.setHex(0xff3300);
            setTimeout(() => {
              if (!block.destroyed && block.mesh.material instanceof THREE.MeshStandardMaterial) {
                block.mesh.material.emissive.setHex(0x200e00);
              }
            }, 80);
          }

          if (block.health <= 0) {
            this.world.removeCollider(block.collider, true);
            this.world.removeRigidBody(block.body);
            this.scene.remove(block.mesh);
            block.destroyed = true;
          }
          break;
        }
      }
      }

      // Check collision with turrets
      if (!laserHit) {
        for (const turret of this.turrets) {
          if (turret.destroyed) continue;
          if (laser.position.distanceTo(turret.position) < 1.0) {
            turret.health--;
            laserHit = true;
            AudioManager.playButton();

            if (turret.health <= 0) {
              this.scene.remove(turret.head);
              this.scene.remove(turret.baseMesh);
              turret.destroyed = true;
            }
            break;
          }
        }
      }

      if (laserHit || now - laser.spawnTime > 2500 || laser.position.x > 35.0) {
        this.scene.remove(laser.mesh);
        laser.mesh.geometry.dispose();
        (laser.mesh.material as THREE.Material).dispose();
        this.playerLasers.splice(i, 1);
      }
    }

    // 4. Move laser barriers and check if Defender shields block them
    for (const barrier of this.laserBarriers) {
      const offsetY = Math.sin(now * 0.001 * barrier.speed + barrier.phase) * barrier.amplitude;
      barrier.position.set(barrier.origin.x, barrier.origin.y + offsetY, barrier.origin.z);
      barrier.body.setTranslation(barrier.position, true);
      barrier.mesh.position.copy(barrier.position);

      let laserCurrentlyBlocked = false;
      for (let i = 2; i < 4; i++) {
        const defender = this.levelPlayers[i];
        if (defender && defender.isActionActive) {
          const dPos = defender.body.translation();
          const dx = Math.abs(dPos.x - barrier.position.x);
          const dy = Math.abs(dPos.y - barrier.position.y);
          const dz = Math.abs(dPos.z - barrier.position.z);
          // Check if defender is close to the laser barrier position and blocks it
          if (dx < 1.8 && dy < 3.2 && dz < 5.5) {
            laserCurrentlyBlocked = true;
            break;
          }
        }
      }

      barrier.active = !laserCurrentlyBlocked;
      barrier.mesh.visible = barrier.active;
      barrier.collider.setSensor(!barrier.active); // Disable physics when blocked

      if (barrier.active && this.isPlayerTouchingLaserBarrier(barrier)) {
        this.shouldReset = true;
      }
    }

    // 5. Update Turrets and fire projectiles
    for (const turret of this.turrets) {
      if (turret.destroyed) continue;

      // Find nearest player
      let targetPlayer: Player | null = null;
      let minDist = 999.0;
      for (const p of this.levelPlayers.slice(0, 2)) {
        const dist = turret.position.distanceTo(p.mesh.position);
        if (dist < minDist) {
          minDist = dist;
          targetPlayer = p;
        }
      }

      if (targetPlayer && minDist < 20.0) {
        // Point head towards player
        turret.head.lookAt(targetPlayer.mesh.position);

        // Fire projectile
        if (now - turret.lastShotTime > turret.fireCooldownMs) {
          turret.lastShotTime = now;
          this.fireEnemyProjectile(turret, targetPlayer.mesh.position);
        }
      }
    }

    // 6. Update Enemy Projectiles
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const proj = this.enemyProjectiles[i];
      proj.position.addScaledVector(proj.velocity, delta);
      proj.mesh.position.copy(proj.position);

      let projDestroyed = false;

      // Check collision with defender shields
      for (let j = 2; j < 4; j++) {
        const defender = this.levelPlayers[j];
        if (defender && defender.isActionActive) {
          if (proj.position.distanceTo(defender.mesh.position) < 1.7) {
            projDestroyed = true;
            AudioManager.playButton();
            break;
          }
        }
      }

      // Check collision with players
      if (!projDestroyed) {
        for (const player of this.levelPlayers) {
          if (proj.position.distanceTo(player.mesh.position) < 0.6) {
            projDestroyed = true;
            this.shouldReset = true; // Request level reset
            break;
          }
        }
      }

      if (projDestroyed || now - proj.spawnTime > 3500) {
        this.scene.remove(proj.mesh);
        proj.mesh.geometry.dispose();
        (proj.mesh.material as THREE.Material).dispose();
        this.enemyProjectiles.splice(i, 1);
      }
    }

    // 7. Check Laser barrier damage (removed, laser is a solid wall now)

    super.update(playerPositions, activePlayerIndex, inputManager);
  }

  override syncDynamicMeshes(): void {
    super.syncDynamicMeshes();

    // Sync active player visual rotation smoothly with camera yaw at 144Hz (render rate)
    if (this.lastActivePlayerIndex !== undefined && this.lastInputManager) {
      const activePlayer = this.levelPlayers[this.lastActivePlayerIndex];
      if (activePlayer) {
        activePlayer.mesh.rotation.y = this.lastInputManager.yaw;
      }
    }

    // Scale engine flames depending on speed and handle pitch tilt
    for (let i = 0; i < this.levelPlayers.length; i++) {
      const player = this.levelPlayers[i];
      const ship = player.mesh.getObjectByName("spaceship");
      if (!ship) continue;

      // Gentle pitch tilt based on vertical movement for the active player, reset to 0 for inactive
      const vel = player.body.linvel();
      if (i === this.lastActivePlayerIndex) {
        const pitch = vel.y * 0.05;
        ship.rotation.x = -pitch;
      } else {
        ship.rotation.x = 0;
      }

      const flameL = ship.getObjectByName("flameL");
      const flameR = ship.getObjectByName("flameR");
      if (flameL && flameR) {
        const speed = Math.hypot(vel.x, vel.y, vel.z);
        const scaleZ = 0.5 + speed * 0.15;
        flameL.scale.set(1.0, scaleZ, 1.0);
        flameR.scale.set(1.0, scaleZ, 1.0);
      }
    }
  }

  override dispose(): void {
    this.clearAllObjects();
    super.dispose();
  }

  private firePlayerLaser(player: Player): void {
    const pPos = player.body.translation();
    const yaw = player.mesh.rotation.y;
    
    // Spawn starting position slightly ahead of ship nose
    const dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const startPos = new THREE.Vector3(pPos.x, pPos.y - 0.15, pPos.z).addScaledVector(dir, 0.7);

    // Cyan glowing beam
    const geom = new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8);
    geom.rotateX(Math.PI / 2); // align along Z
    const mat = new THREE.MeshBasicMaterial({ color: "#00ffff" });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(startPos);
    mesh.lookAt(startPos.clone().add(dir));
    this.scene.add(mesh);

    this.playerLasers.push({
      mesh,
      position: startPos,
      velocity: dir.multiplyScalar(18.0),
      spawnTime: Date.now()
    });
  }

  private fireEnemyProjectile(turret: EnemyTurret, playerPos: THREE.Vector3): void {
    const startPos = turret.position.clone();
    
    // Direction from turret head pointing towards player
    const dir = new THREE.Vector3().subVectors(playerPos, startPos).normalize();
    startPos.addScaledVector(dir, 0.4);

    // Glowing red sphere
    const geom = new THREE.SphereGeometry(0.12, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: "#ff1122" });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(startPos);
    this.scene.add(mesh);

    this.enemyProjectiles.push({
      mesh,
      position: startPos,
      velocity: dir.multiplyScalar(5.5),
      spawnTime: Date.now()
    });
  }

  private spawnBlockGrid(x: number): void {
    const startY = -2.5;
    const startZ = -4.5;
    const spacingY = 1.0;
    const spacingZ = 1.0;
 
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 10; c++) {
        const y = startY + r * spacingY;
        const z = startZ + c * spacingZ;

        const blockBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
        const body = this.world.createRigidBody(blockBodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.cuboid(0.4, 0.5, 0.5);
        const collider = this.world.createCollider(colliderDesc, body);

        const geom = new THREE.BoxGeometry(0.8, 1.0, 1.0);
        const mat = new THREE.MeshStandardMaterial({
          color: "#ff7b00",
          roughness: 0.5,
          metalness: 0.2,
          emissive: "#200e00"
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        this.blocks.push({
          body,
          collider,
          mesh,
          health: 3,
          destroyed: false
        });
      }
    }
  }

  private spawnTurret(pos: THREE.Vector3, fireCooldownMs = 1700): void {
    const baseGeom = new THREE.CylinderGeometry(0.24, 0.24, 0.3, 8);
    const mat = new THREE.MeshStandardMaterial({ color: "#3a3d40", roughness: 0.6, metalness: 0.7 });
    const baseMesh = new THREE.Mesh(baseGeom, mat);
    baseMesh.position.copy(pos);
    baseMesh.castShadow = true;
    this.scene.add(baseMesh);

    const head = new THREE.Group();
    head.position.copy(pos);
    
    const headMeshGeom = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const headMesh = new THREE.Mesh(headMeshGeom, new THREE.MeshStandardMaterial({ color: "#222426", roughness: 0.4, metalness: 0.8 }));
    headMesh.castShadow = true;
    head.add(headMesh);

    const barrelGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8);
    barrelGeom.translate(0, 0.175, 0); 
    const barrel = new THREE.Mesh(barrelGeom, new THREE.MeshStandardMaterial({ color: "#111", roughness: 0.5 }));
    barrel.rotation.x = Math.PI / 2; 
    barrel.position.set(0, 0, -0.15);
    head.add(barrel);

    this.scene.add(head);

    this.turrets.push({
      head,
      baseMesh,
      position: pos.clone(),
      health: 3,
      fireCooldownMs,
      lastShotTime: 0,
      destroyed: false
    });
  }

  private createShipMesh(color: string, role: "attacker" | "defender"): THREE.Group {
    const group = new THREE.Group();

    const mat = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.3,
      metalness: 0.6
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: "#202226",
      roughness: 0.5,
      metalness: 0.8
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: "#aae7ff",
      transparent: true,
      opacity: 0.5,
      roughness: 0.1
    });

    const fuseGeom = new THREE.BoxGeometry(0.7, 0.28, 0.7);
    const fuselage = new THREE.Mesh(fuseGeom, mat);
    fuselage.position.y = -0.15;
    fuselage.castShadow = true;
    fuselage.receiveShadow = true;
    group.add(fuselage);

    const wingGeom = new THREE.BoxGeometry(0.5, 0.08, 0.3);
    const leftWing = new THREE.Mesh(wingGeom, mat);
    leftWing.position.set(-0.55, -0.15, 0.0);
    leftWing.rotation.z = -0.15;
    leftWing.castShadow = true;
    group.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeom, mat);
    rightWing.position.set(0.55, -0.15, 0.0);
    rightWing.rotation.z = 0.15;
    rightWing.castShadow = true;
    group.add(rightWing);

    const canopyGeom = new THREE.SphereGeometry(0.2, 8, 8);
    const canopy = new THREE.Mesh(canopyGeom, glassMat);
    canopy.position.set(0, 0.05, -0.15);
    canopy.scale.set(1.0, 0.7, 1.6);
    group.add(canopy);

    const engineGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.2, 8);
    const leftEngine = new THREE.Mesh(engineGeom, darkMat);
    leftEngine.position.set(-0.25, -0.15, 0.35);
    leftEngine.rotation.x = Math.PI / 2;
    group.add(leftEngine);

    const rightEngine = new THREE.Mesh(engineGeom, darkMat);
    rightEngine.position.set(0.25, -0.15, 0.35);
    rightEngine.rotation.x = Math.PI / 2;
    group.add(rightEngine);

    const flameGeom = new THREE.ConeGeometry(0.06, 0.2, 8);
    flameGeom.translate(0, -0.1, 0); 
    const flameMat = new THREE.MeshBasicMaterial({
      color: "#ff5b00",
      transparent: true,
      opacity: 0.8
    });

    const leftFlame = new THREE.Mesh(flameGeom, flameMat);
    leftFlame.name = "flameL";
    leftFlame.position.set(-0.25, -0.15, 0.45);
    leftFlame.rotation.x = -Math.PI / 2;
    group.add(leftFlame);

    const rightFlame = new THREE.Mesh(flameGeom, flameMat);
    rightFlame.name = "flameR";
    rightFlame.position.set(0.25, -0.15, 0.45);
    rightFlame.rotation.x = -Math.PI / 2;
    group.add(rightFlame);

    if (role === "attacker") {
      const gunGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8);
      const leftGun = new THREE.Mesh(gunGeom, darkMat);
      leftGun.position.set(-0.75, -0.15, -0.15);
      leftGun.rotation.x = Math.PI / 2;
      group.add(leftGun);

      const rightGun = new THREE.Mesh(gunGeom, darkMat);
      rightGun.position.set(0.75, -0.15, -0.15);
      rightGun.rotation.x = Math.PI / 2;
      group.add(rightGun);
    } else {
      const emitterGeom = new THREE.TorusGeometry(0.12, 0.03, 6, 12);
      const emitter = new THREE.Mesh(emitterGeom, new THREE.MeshBasicMaterial({ color: "#00ffff" }));
      emitter.position.set(0, -0.15, -0.4);
      group.add(emitter);

      const shieldGeom = new THREE.BoxGeometry(2.2, 2.2, 0.08);
      const shieldMat = new THREE.MeshBasicMaterial({
        color: "#00ffff",
        transparent: true,
        opacity: 0.35
      });
      const shield = new THREE.Mesh(shieldGeom, shieldMat);
      shield.name = "shield";
      shield.position.set(0, 0.0, -0.85);
      shield.visible = false;
      group.add(shield);
    }

    return group;
  }

  private clearAllObjects(): void {
    // Restore players
    for (const player of this.levelPlayers) {
      try {
        player.body.setGravityScale(1.0, true);
        
        // Restore legs & tail visibility
        const legFL = player.mesh.getObjectByName("legFL");
        const legFR = player.mesh.getObjectByName("legFR");
        const legBL = player.mesh.getObjectByName("legBL");
        const legBR = player.mesh.getObjectByName("legBR");
        const tail = player.mesh.getObjectByName("tail");
        if (legFL) legFL.visible = true;
        if (legFR) legFR.visible = true;
        if (legBL) legBL.visible = true;
        if (legBR) legBR.visible = true;
        if (tail) tail.visible = true;

        // Remove spaceship
        const ship = player.mesh.getObjectByName("spaceship");
        if (ship) {
          player.mesh.remove(ship);
          // Recursively dispose meshes in ship
          ship.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach((m) => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          });
        }
      } catch (e) {
        console.warn("Error restoring player in Level 5 cleanup:", e);
      }
    }

    // Clear blocks
    for (const block of this.blocks) {
      if (!block.destroyed) {
        try {
          this.world.removeCollider(block.collider, true);
          this.world.removeRigidBody(block.body);
          this.scene.remove(block.mesh);
          block.mesh.geometry.dispose();
          (block.mesh.material as THREE.Material).dispose();
        } catch (e) {
          console.warn("Error removing block body:", e);
        }
      }
    }
    this.blocks = [];

    // Clear laser barriers
    for (const barrier of this.laserBarriers) {
      try {
        this.world.removeCollider(barrier.collider, true);
        this.world.removeRigidBody(barrier.body);
        this.scene.remove(barrier.mesh);
        barrier.mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
          }
        });
      } catch (e) {
        console.warn("Error removing laser barrier:", e);
      }
    }
    this.laserBarriers = [];

    // Clear turrets
    for (const turret of this.turrets) {
      if (!turret.destroyed) {
        this.scene.remove(turret.head);
        this.scene.remove(turret.baseMesh);
        // dispose head meshes
        turret.head.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
          }
        });
        turret.baseMesh.geometry.dispose();
        (turret.baseMesh.material as THREE.Material).dispose();
      }
    }
    this.turrets = [];

    // Clear player lasers
    for (const laser of this.playerLasers) {
      this.scene.remove(laser.mesh);
      laser.mesh.geometry.dispose();
      (laser.mesh.material as THREE.Material).dispose();
    }
    this.playerLasers = [];

    // Clear enemy projectiles
    for (const proj of this.enemyProjectiles) {
      this.scene.remove(proj.mesh);
      proj.mesh.geometry.dispose();
      (proj.mesh.material as THREE.Material).dispose();
    }
    this.enemyProjectiles = [];

    this.levelPlayers = [];
  }

  private spawnLaserBarrier(pos: THREE.Vector3, height: number, amplitude: number, speed: number, phase: number): void {
    const laserBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z);
    const body = this.world.createRigidBody(laserBodyDesc);
    const laserColliderDesc = RAPIER.ColliderDesc.cuboid(0.2, height / 2, 5.0); // 5.0 is half-width for Z=10.0 tunnel
    const collider = this.world.createCollider(laserColliderDesc, body);
 
    const laserGroup = new THREE.Group();
    const laserPanelGeom = new THREE.BoxGeometry(0.08, height, 10.0);
    const laserPanelMat = new THREE.MeshBasicMaterial({
      color: "#ff0033",
      transparent: true,
      opacity: 0.32,
      depthWrite: false
    });

    const laserPanel = new THREE.Mesh(laserPanelGeom, laserPanelMat);
    laserGroup.add(laserPanel);

    const edgeGeometry = new THREE.EdgesGeometry(laserPanelGeom);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: "#ff6f8a",
      transparent: true,
      opacity: 0.95
    });
    laserGroup.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));

    laserGroup.position.copy(pos);
    this.scene.add(laserGroup);
 
    this.laserBarriers.push({
      mesh: laserGroup,
      body,
      collider,
      origin: pos.clone(),
      position: pos.clone(),
      height,
      amplitude,
      speed,
      phase,
      active: true
    });
  }

  private isPlayerTouchingLaserBarrier(barrier: LaserBarrier): boolean {
    for (const player of this.levelPlayers) {
      const pos = player.body.translation();
      const dx = Math.abs(pos.x - barrier.position.x);
      const dy = Math.abs(pos.y - barrier.position.y);
      const dz = Math.abs(pos.z - barrier.position.z);

      if (dx < 0.7 && dy < barrier.height / 2 + 0.45 && dz < 5.15) {
        return true;
      }
    }

    return false;
  }
}
