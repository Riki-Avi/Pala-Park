import * as THREE from "three";
import { FIXED_DELTA, PLAYER_SIZE, type PlayerPose, type RoomPlayer, type Vec3 } from "@game/shared";
import { Player } from "../entities/Player";
import { InputManager } from "../input/InputManager";
import { createEmptyInput } from "../input/InputState";
import { LevelRuntime } from "../levels/LevelRuntime";
import { level01 } from "../levels/level-01";
import { level02 } from "../levels/level-02";
import { ClientSocket } from "../network/ClientSocket";
import { RemotePlayerInterpolator } from "../network/RemotePlayerInterpolator";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { CameraController } from "../render/CameraController";

interface OnlineSession {
  roomCode: string;
  playerId: string;
  players: RoomPlayer[];
}

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 150);
  private readonly cameraController = new CameraController(this.camera);
  private readonly clock = new THREE.Clock();
  private readonly input = new InputManager();
  private readonly physics = new PhysicsWorld();
  private readonly players: Player[] = [];
  private readonly levels = [level01, level02];
  private level: LevelRuntime;
  private currentLevelIndex = 1;
  private activePlayerIndex = 0;
  private network: ClientSocket | null = null;
  private onlineSession: OnlineSession | null = null;
  private readonly remotePlayerInterpolator = new RemotePlayerInterpolator();
  private pendingOnlineReset = false;
  private levelAdvanceTimer = -1;
  private accumulator = 0;
  private tick = 0;
  private frameCount = 0;
  private fpsTimer = 0;
  private animationFrame = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.background = new THREE.Color("#20242c");
    this.scene.fog = new THREE.Fog("#20242c", 20, 60);

    this.setupLighting();
    this.level = new LevelRuntime(this.levels[this.currentLevelIndex], this.scene, this.physics.world);
    this.createPlayers(this.level.definition.spawnPoints);
    this.input.enablePointerLook(this.canvas);
    this.setupSensitivityControl();
    this.resize();

    this.updateLevelText();
    window.addEventListener("resize", this.resize);
  }

  start(): void {
    this.clock.start();
    this.animationFrame = window.requestAnimationFrame(this.update);
  }

  attachNetwork(network: ClientSocket): void {
    this.network = network;
    network.onSession((session) => {
      this.onlineSession = session;
      this.remotePlayerInterpolator.clear();
      this.activePlayerIndex = this.playerIndexFromId(session.playerId);
      this.loadLevel(0);
      document.querySelector("#objective")!.textContent = `Online nivel 1 - controlas ${session.playerId}`;
    });

    network.onPlayers((players) => {
      if (this.onlineSession) {
        this.onlineSession.players = players;
      }
    });

    network.onPlayerPose((pose) => this.applyRemotePose(pose));
    network.onLevelReset((payload) => {
      this.pendingOnlineReset = false;
      this.resetLevel(`Nivel reiniciado por ${payload.byPlayerId}`);
    });
  }

  dispose(): void {
    window.cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("resize", this.resize);
    this.input.dispose();
    this.renderer.dispose();
  }

  private readonly update = (): void => {
    const delta = Math.min(this.clock.getDelta(), 0.1);
    this.accumulator += delta;

    while (this.accumulator >= FIXED_DELTA) {
      this.fixedUpdate();
      this.accumulator -= FIXED_DELTA;
    }

    this.interpolateRemotePlayers();

    for (const player of this.players) {
      player.syncMesh();
    }
    this.level.syncDynamicMeshes();

    this.cameraController.update(this.players[this.activePlayerIndex], this.input.yaw, this.input.pitch, delta);
    this.renderer.render(this.scene, this.camera);
    this.updateFps(delta);
    this.animationFrame = window.requestAnimationFrame(this.update);
  };

  private fixedUpdate(): void {
    if (this.input.consumeResetPressed()) {
      if (this.onlineSession) {
        this.requestOnlineReset("manual");
      } else {
        this.resetLevel();
      }
    }

    if (!this.onlineSession && this.input.consumeSwitchPlayerPressed()) {
      this.switchActivePlayer();
    }

    for (const [index, player] of this.players.entries()) {
      const isActivePlayer = index === this.activePlayerIndex;
      if (this.onlineSession && !isActivePlayer) {
        continue;
      }

      const playerInput = isActivePlayer ? this.input.getPrimaryInput() : createEmptyInput();
      player.applyInput(playerInput, this.input.yaw, isActivePlayer, FIXED_DELTA);
    }

    this.physics.step();
    this.tick += 1;
    this.dampenPlayerPush();
    this.updateGrounding();
    this.level.update(this.getPlayerPositions());
    this.updateGoal();
    this.recoverFallenPlayers();
    this.level.recoverFallenObjects();
    this.sendOnlinePose();
  }

  private createPlayers(spawnPoints: Vec3[]): void {
    const colors = ["#62a8ff", "#ffcf5c", "#69d38f", "#d96cff"];
    for (let index = 0; index < 4; index += 1) {
      const player = new Player(`p${index + 1}`, this.physics.world, spawnPoints[index], colors[index]);
      this.scene.add(player.mesh);
      this.players.push(player);
    }
  }

  private setupLighting(): void {
    const ambient = new THREE.HemisphereLight("#dce8ff", "#242a30", 2.2);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight("#ffffff", 3.4);
    sun.position.set(-5, 11, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    this.scene.add(sun);

    const grid = new THREE.GridHelper(42, 42, "#3d4654", "#2a313b");
    grid.position.y = 0.31;
    this.scene.add(grid);
  }

  private updateGrounding(): void {
    for (const [index, player] of this.players.entries()) {
      const position = player.body.translation();
      player.setGrounded(this.hasGroundBelow(position, index));
    }
  }

  private dampenPlayerPush(): void {
    for (let firstIndex = 0; firstIndex < this.players.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < this.players.length; secondIndex += 1) {
        const first = this.players[firstIndex];
        const second = this.players[secondIndex];
        const firstPosition = first.body.translation();
        const secondPosition = second.body.translation();
        const horizontalDistance = Math.hypot(
          firstPosition.x - secondPosition.x,
          firstPosition.z - secondPosition.z
        );
        const verticalDistance = Math.abs(firstPosition.y - secondPosition.y);

        if (horizontalDistance > PLAYER_SIZE.x * 1.05 || verticalDistance > PLAYER_SIZE.y * 0.85) {
          continue;
        }

        const firstVelocity = first.body.linvel();
        const secondVelocity = second.body.linvel();
        first.body.setLinvel(
          { x: firstVelocity.x * 0.45, y: firstVelocity.y, z: firstVelocity.z * 0.45 },
          true
        );
        second.body.setLinvel(
          { x: secondVelocity.x * 0.45, y: secondVelocity.y, z: secondVelocity.z * 0.45 },
          true
        );
      }
    }
  }

  private hasGroundBelow(position: Vec3, playerIndex: number): boolean {
    const playerBottom = position.y - PLAYER_SIZE.y / 2;
    const standingSurfaces = [
      ...this.level.platforms,
      ...this.level.buttons.map((button) => ({
        id: button.definition.id,
        position: button.definition.position,
        size: button.definition.size
      })),
      ...this.level.boxes.map((box) => ({
        id: box.definition.id,
        position: box.getPosition(),
        size: box.definition.size
      })),
      ...this.players
        .filter((_, index) => index !== playerIndex)
        .map((player) => ({
          id: player.id,
          position: player.body.translation(),
          size: PLAYER_SIZE
        }))
    ];

    return standingSurfaces.some((surface) => {
      const surfaceTop = surface.position.y + surface.size.y / 2;
      const nearTop = playerBottom >= surfaceTop - 0.09 && playerBottom <= surfaceTop + 0.18;
      const insideX = Math.abs(position.x - surface.position.x) <= surface.size.x / 2 + PLAYER_SIZE.x / 2;
      const insideZ = Math.abs(position.z - surface.position.z) <= surface.size.z / 2 + PLAYER_SIZE.z / 2;
      return nearTop && insideX && insideZ;
    });
  }

  private updateGoal(): void {
    const goal = this.level.goalZones[0];
    const playerPositions = this.getPlayerPositions();
    for (const [index, player] of this.players.entries()) {
      player.inGoal = goal.contains(playerPositions[index]);
    }

    const allInGoal = this.level.isCompleted(this.getGoalPlayerPositions());

    if (allInGoal && this.levelAdvanceTimer < 0) {
      this.levelAdvanceTimer = 0.8;
    }

    if (this.levelAdvanceTimer >= 0) {
      this.levelAdvanceTimer -= FIXED_DELTA;
      if (this.levelAdvanceTimer <= 0) {
        this.loadNextLevel();
        return;
      }
    }

    document.querySelector("#objective")!.textContent = allInGoal
      ? "Nivel completado"
      : this.level.doors.every((door) => door.open)
        ? "Cruzen juntos hasta la zona verde"
        : this.level.definition.objective;
  }

  private recoverFallenPlayers(): void {
    if (this.onlineSession) {
      const localPlayer = this.players[this.activePlayerIndex];
      if (localPlayer.body.translation().y < -8) {
        this.requestOnlineReset("fall");
      }
      return;
    }

    for (const [index, player] of this.players.entries()) {
      if (player.body.translation().y < -8) {
        player.reset(this.level.definition.spawnPoints[index]);
      }
    }
  }

  private resetLevel(message = "Nivel reiniciado"): void {
    for (const [index, player] of this.players.entries()) {
      player.reset(this.level.definition.spawnPoints[index]);
    }
    this.levelAdvanceTimer = -1;
    this.level.resetDynamicObjects();
    document.querySelector("#objective")!.textContent = message;
  }

  private switchActivePlayer(): void {
    this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
    const playerNames = ["Azul", "Amarillo", "Verde", "Violeta"];
    const playerName = playerNames[this.activePlayerIndex];
    document.querySelector("#objective")!.textContent = `Controlando jugador ${playerName}`;
  }

  private loadNextLevel(): void {
    this.loadLevel((this.currentLevelIndex + 1) % this.levels.length);
  }

  private loadLevel(levelIndex: number): void {
    this.currentLevelIndex = levelIndex;
    this.level.dispose();
    this.level = new LevelRuntime(this.levels[this.currentLevelIndex], this.scene, this.physics.world);
    this.resetLevel();
    this.updateLevelText();
  }

  private sendOnlinePose(): void {
    if (!this.network || !this.onlineSession || this.tick % 3 !== 0) {
      return;
    }

    const localPlayer = this.players[this.activePlayerIndex];
    this.network.sendPlayerPose(localPlayer.getNetworkPose(this.onlineSession.playerId, this.input.yaw));
  }

  private applyRemotePose(pose: PlayerPose): void {
    if (pose.playerId === this.onlineSession?.playerId) {
      return;
    }

    this.remotePlayerInterpolator.push(pose);
  }

  private interpolateRemotePlayers(): void {
    if (!this.onlineSession) {
      return;
    }

    this.remotePlayerInterpolator.apply(this.players, this.onlineSession.playerId, (playerId) =>
      this.playerIndexFromId(playerId)
    );
  }

  private requestOnlineReset(reason: "fall" | "manual"): void {
    if (!this.network || this.pendingOnlineReset) {
      return;
    }

    this.pendingOnlineReset = true;
    this.network.requestReset(reason);
  }

  private getGoalPlayerPositions(): Vec3[] {
    if (!this.onlineSession) {
      return this.getPlayerPositions();
    }

    return this.onlineSession.players
      .map((player) => this.players[this.playerIndexFromId(player.id)])
      .filter((player): player is Player => Boolean(player))
      .map((player) => {
        const position = player.body.translation();
        return { x: position.x, y: position.y, z: position.z };
      });
  }

  private playerIndexFromId(playerId: string): number {
    const index = Number(playerId.replace("p", "")) - 1;
    return Math.max(0, Math.min(this.players.length - 1, Number.isFinite(index) ? index : 0));
  }

  private getPlayerPositions(): Vec3[] {
    return this.players.map((player) => {
      const position = player.body.translation();
      return { x: position.x, y: position.y, z: position.z };
    });
  }

  private setupSensitivityControl(): void {
    const slider = document.querySelector<HTMLInputElement>("#mouse-sensitivity");
    if (!slider) {
      return;
    }

    slider.value = String(this.input.getSensitivity() * 1000);
    slider.addEventListener("input", () => {
      this.input.setSensitivity(Number(slider.value) / 1000);
    });
  }

  private updateLevelText(): void {
    document.querySelector("#level-name")!.textContent = this.level.definition.name;
  }

  private updateFps(delta: number): void {
    this.frameCount += 1;
    this.fpsTimer += delta;
    if (this.fpsTimer >= 0.5) {
      document.querySelector("#fps")!.textContent = `${Math.round(this.frameCount / this.fpsTimer)} FPS`;
      this.frameCount = 0;
      this.fpsTimer = 0;
    }
  }

  private readonly resize = (): void => {
    const { clientWidth, clientHeight } = this.canvas;
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight, false);
  };
}
