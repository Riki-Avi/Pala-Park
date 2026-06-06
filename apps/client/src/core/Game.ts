import * as THREE from "three";
import {
  FIXED_DELTA,
  type LevelChangedPayload,
  type LevelDefinition,
  type RoomJoinedPayload,
  type Vec3
} from "@game/shared";
import { GameRulesController } from "./GameRulesController";
import { AudioManager } from "./AudioManager";
import { Player } from "../entities/Player";
import { InputManager } from "../input/InputManager";
import { createEmptyInput } from "../input/InputState";
import { LevelController } from "../levels/LevelController";
import { Level11Runtime } from "../levels/Level11Runtime";
import { ClientSocket } from "../network/ClientSocket";
import { OnlineSessionController } from "../network/OnlineSessionController";
import { PhysicsWorld } from "../physics/PhysicsWorld";
import { CameraController } from "../render/CameraController";

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 150);
  private readonly cameraController = new CameraController(this.camera);
  private readonly clock = new THREE.Clock();
  private readonly input = new InputManager();
  private readonly physics = new PhysicsWorld();
  private readonly rules = new GameRulesController();
  private readonly online = new OnlineSessionController();
  private readonly players: Player[] = [];
  private readonly levelController: LevelController;
  private activePlayerIndex = 0;
  private levelAdvanceTimer = -1;
  private accumulator = 0;
  private tick = 0;
  private frameCount = 0;
  private fpsTimer = 0;
  private animationFrame = 0;
  private pendingLevelChange = false;
  private levelLoadRequestId = 0;
  private levelIniciatation = 0;

  constructor(private readonly canvas: HTMLCanvasElement, levelFiles: string[]) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene.background = new THREE.Color("#20242c");
    this.scene.fog = new THREE.Fog("#20242c", 20, 60);

    this.setupLighting();
    this.levelController = new LevelController(levelFiles, this.scene, this.physics.world);
    this.createPlayers([
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 }
    ]);
    this.input.enablePointerLook(this.canvas);
    this.setupSensitivityControl();
    this.setupGhostSelectControl();
    this.setupBlindnessToggleControl();
    this.resize();

    window.addEventListener("resize", this.resize);
  }

  async start(): Promise<void> {
    await this.loadLevel(this.clampLevelIndex(this.levelIniciatation)); 
    this.clock.start();
    this.animationFrame = window.requestAnimationFrame(this.update);
  }

  attachNetwork(network: ClientSocket): void {
    this.online.attach(network, {
      onSessionStarted: (session) => {
        void this.handleSessionStarted(session);
      },
      onLevelReset: (message) => this.resetLevel(message),
      onLevelChanged: (payload) => {
        void this.handleLevelChanged(payload);
      }
    });
  }

  dispose(): void {
    window.cancelAnimationFrame(this.animationFrame);
    window.removeEventListener("resize", this.resize);
    this.input.dispose();
    this.levelController.dispose();
    this.renderer.dispose();
  }

  private get level() {
    return this.levelController.current;
  }

  private async handleSessionStarted(session: RoomJoinedPayload): Promise<void> {
    try {
      this.activePlayerIndex = this.playerIndexFromId(session.playerId);
      const startIndex = this.clampLevelIndex(session.roomState.levelIndex);
      const loaded = await this.loadLevel(startIndex);
      if (loaded) {
        document.querySelector("#objective")!.textContent =
          `Online nivel ${startIndex + 1} - controlas ${session.playerId} - esperando ${session.roomState.requiredPlayers} jugadores`;
      }
    } catch (error) {
      this.showLevelLoadError(error);
    }
  }

  private async handleLevelChanged(payload: LevelChangedPayload): Promise<void> {
    try {
      const nextIndex = this.clampLevelIndex(payload.levelIndex);
      const loaded = await this.loadLevel(nextIndex);
      if (loaded) {
        document.querySelector("#objective")!.textContent =
          `Nivel ${nextIndex + 1} cargado por ${payload.byPlayerId}`;
      }
    } catch (error) {
      this.showLevelLoadError(error);
    }
  }

  private readonly update = (): void => {
    const delta = Math.min(this.clock.getDelta(), 0.1);
    this.accumulator += delta;

    while (this.accumulator >= FIXED_DELTA) {
      this.fixedUpdate();
      this.accumulator -= FIXED_DELTA;
    }

    this.online.interpolateRemotes(this.players, (playerId) => this.playerIndexFromId(playerId));

    for (const player of this.players) {
      player.syncMesh();
    }
    this.level.syncDynamicMeshes();

    const isSpiderWebLevel =
      this.level.definition.id === "level-06" || this.level.definition.id === "level-07";
    this.input.setFullPitchLook(isSpiderWebLevel);
    this.cameraController.update(
      this.players[this.activePlayerIndex],
      this.input.yaw,
      this.input.pitch,
      delta,
      { fullOrbit: isSpiderWebLevel }
    );
    this.renderer.render(this.scene, this.camera);
    this.updateFps(delta);
    this.animationFrame = window.requestAnimationFrame(this.update);
  };

  private fixedUpdate(): void {
    if (this.online.isOnline && !this.online.isPlaying) {
      document.querySelector("#objective")!.textContent =
        `Esperando jugadores ${this.online.connectedPlayerCount}/${this.online.requiredPlayerCount}`;
      this.tick += 1;
      return;
    }

    if (this.input.consumeResetPressed()) {
      if (this.online.isOnline) {
        if (this.online.isHost) {
          this.online.requestReset("manual");
        } else {
          document.querySelector("#objective")!.textContent = "Solo el creador de la sala puede reiniciar";
        }
      } else {
        this.resetLevel();
      }
    }

    if (!this.online.isOnline && this.input.consumeSwitchPlayerPressed()) {
      this.switchActivePlayer();
    }

    for (const [index, player] of this.players.entries()) {
      const isActivePlayer = index === this.activePlayerIndex;
      if (!isActivePlayer) {
        if (!this.online.isOnline) {
          player.body.setLinearDamping(1.5);
        }
        continue;
      }

      player.body.setLinearDamping(0.0);
      const playerInput = this.input.getPrimaryInput();
      player.applyInput(playerInput, this.input.yaw, this.input.pitch, isActivePlayer, FIXED_DELTA);
    }

    this.physics.step();
    this.tick += 1;
    this.rules.dampenPlayerPush(this.players);
    this.rules.updateGrounding(this.players, this.level);
    this.updateLevelState();
    this.updateGoal();
    this.recoverFallenPlayers();
    if ((!this.online.isOnline || this.online.isHost) && this.level.definition.rules.respawnBoxesFromSky) {
      this.level.recoverFallenObjects();
    }
    this.online.sendPose(this.tick, this.players[this.activePlayerIndex], this.input.yaw, this.input.pitch);
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
  }

  private updateGoal(): void {
    if (this.pendingLevelChange) {
      document.querySelector("#objective")!.textContent =
        this.online.isOnline && !this.online.isHost
          ? "Nivel completado - esperando cambio de nivel"
          : "Nivel completado - cargando siguiente nivel";
      return;
    }

    if (this.online.isOnline && !this.online.isHost) {
      const progress = this.online.getGoalProgress();
      if (progress?.levelId === this.level.definition.id) {
        this.updateGoalFromProgress(progress.completed);
        return;
      }
    }

    const previousTimer = this.levelAdvanceTimer;
    const result = this.rules.updateGoal(
      this.players,
      this.level,
      this.getGoalPlayerPositions(),
      this.levelAdvanceTimer
    );
    this.levelAdvanceTimer = result.timer;
    const progress = this.getGoalProgress();

    if (previousTimer < 0 && this.levelAdvanceTimer >= 0) {
      AudioManager.playVictory();
    }

    if (result.shouldAdvance) {
      this.loadNextLevel();
      return;
    }

    this.online.sendGoalProgress(this.tick, progress);
    document.querySelector("#objective")!.textContent = this.getGoalObjective(result.objective, progress);
  }

  private updateGoalFromProgress(completed: boolean): void {
    if (completed && this.pendingLevelChange) {
      document.querySelector("#objective")!.textContent = "Nivel completado - esperando cambio de nivel";
      return;
    }

    const previousTimer = this.levelAdvanceTimer;
    if (completed && this.level.definition.rules.autoAdvanceOnComplete && this.levelAdvanceTimer < 0) {
      this.levelAdvanceTimer = 3.0; // 3 segundos de espera para clientes online
    }

    if (previousTimer < 0 && this.levelAdvanceTimer >= 0) {
      AudioManager.playVictory();
    }

    if (this.levelAdvanceTimer >= 0) {
      this.levelAdvanceTimer -= FIXED_DELTA;
      if (this.levelAdvanceTimer <= 0) {
        this.loadNextLevel();
        return;
      }
    }

    const progress = this.online.getGoalProgress();
    document.querySelector("#objective")!.textContent =
      progress && progress.levelId === this.level.definition.id
        ? this.getGoalObjective(completed ? "Nivel completado" : "Cruzen juntos hasta la zona verde", progress)
        : "Cruzen juntos hasta la zona verde";
  }

  private getGoalProgress() {
    const goal = this.level.goalZones[0];
    const positions = this.getGoalPlayerPositions();
    const players = this.online.isOnline
      ? this.online.players
      : this.players.map((player) => ({ id: player.id, connected: true }));
    const requiredPlayers =
      goal.definition.requiredPlayers === "all" ? positions.length : goal.definition.requiredPlayers;
    const playersInGoal = players
      .filter((_, index) => positions[index] && goal.contains(positions[index]))
      .map((player) => player.id);

    return {
      levelId: this.level.definition.id,
      requiredPlayers,
      playersInGoal,
      completed: playersInGoal.length >= requiredPlayers
    };
  }

  private getGoalObjective(fallback: string, progress: { requiredPlayers: number; playersInGoal: string[]; completed: boolean }): string {
    if (progress.completed) {
      return "Nivel completado";
    }

    if (!this.level.doors.every((door) => door.open)) {
      return fallback;
    }

    const missing = Math.max(0, progress.requiredPlayers - progress.playersInGoal.length);
    return `Meta ${progress.playersInGoal.length}/${progress.requiredPlayers} - faltan ${missing}`;
  }

  private updateLevelState(): void {
    if (this.online.isOnline && !this.online.isHost) {
      this.level.updateLocal(
        this.rules.getPlayerPositions(this.players),
        this.activePlayerIndex,
        this.input
      );
      this.online.applyLevelState(this.level);
      return;
    }

    this.level.update(
      this.rules.getPlayerPositions(this.players),
      this.activePlayerIndex,
      this.input
    );

    if (this.level.shouldReset) {
      this.level.shouldReset = false;
      if (this.online.isOnline) {
        this.online.requestReset("fall");
      } else {
        this.resetLevel("Reinicio solicitado por el nivel");
      }
    }

    this.online.sendLevelState(this.tick, this.level);
  }

  private recoverFallenPlayers(): void {
    this.rules.recoverFallenPlayers(this.players, this.level, {
      activePlayerIndex: this.activePlayerIndex,
      isOnline: this.online.isOnline,
      requestOnlineReset: () => this.online.requestReset("fall"),
      requestLocalReset: () => this.resetLevel("Jugador cayó al vacío")
    });
  }

  private resetLevel(message = "Nivel reiniciado"): void {
    this.pendingLevelChange = false;
    this.level.prepareReset(this.players);
    for (const [index, player] of this.players.entries()) {
      player.reset(this.level.definition.spawnPoints[index]);
      if (this.level.definition.id !== "level-11") {
        player.setGhostMode(false);
      }
    }
    this.levelAdvanceTimer = -1;
    this.level.resetDynamicObjects();
    this.level.onLevelStart(this.players);
    document.querySelector("#objective")!.textContent = message;
  }

  private switchActivePlayer(): void {
    this.activePlayerIndex = (this.activePlayerIndex + 1) % this.players.length;
    const playerNames = ["Azul", "Amarillo", "Verde", "Violeta"];
    const playerName = playerNames[this.activePlayerIndex];
    document.querySelector("#objective")!.textContent = `Controlando jugador ${playerName}`;
  }

  private async loadNextLevel(): Promise<void> {
    if (this.pendingLevelChange) {
      return;
    }

    const nextIndex = this.clampLevelIndex(this.levelController.currentIndex + 1);
    if (this.online.isOnline) {
      if (!this.online.isHost) {
        this.pendingLevelChange = true;
        document.querySelector("#objective")!.textContent = "Nivel completado - esperando cambio de nivel";
        return;
      }

      if (this.online.requestLevelChange(nextIndex)) {
        this.pendingLevelChange = true;
        document.querySelector("#objective")!.textContent = "Nivel completado - cargando siguiente nivel";
      } else {
        document.querySelector("#objective")!.textContent =
          "Nivel completado - no se pudo pedir el siguiente nivel";
      }
      return;
    }

    try {
      await this.loadLevel(nextIndex);
    } catch (error) {
      this.showLevelLoadError(error);
    }
  }

  private async loadLevel(levelIndex: number): Promise<boolean> {
    const requestId = ++this.levelLoadRequestId;
    this.pendingLevelChange = true;
    await this.levelController.load(levelIndex);
    if (requestId !== this.levelLoadRequestId) {
      return false;
    }

    this.pendingLevelChange = false;
    this.resetLevel();
    this.updateLevelText();

    const levelId = this.levelController.currentDefinition.id;
    const ghostContainer = document.querySelector<HTMLDivElement>("#ghost-select-container");
    const ghostSelect = document.querySelector<HTMLSelectElement>("#ghost-select");
    const blindnessContainer = document.querySelector<HTMLDivElement>("#blindness-toggle-container");
    const blindnessToggle = document.querySelector<HTMLInputElement>("#blindness-toggle");
    if (ghostContainer && ghostSelect && blindnessContainer && blindnessToggle) {
      if (levelId === "level-11") {
        ghostContainer.style.display = "inline-flex";
        ghostSelect.disabled = this.online.isOnline && !this.online.isHost;
        ghostSelect.value = "0";

        blindnessContainer.style.display = "inline-flex";
        blindnessToggle.disabled = this.online.isOnline && !this.online.isHost;
        blindnessToggle.checked = false;
      } else {
        ghostContainer.style.display = "none";
        blindnessContainer.style.display = "none";
      }
    }

    return true;
  }

  private showLevelLoadError(error: unknown): void {
    console.error("Level load failed", error);
    this.pendingLevelChange = false;
    document.querySelector("#objective")!.textContent = "Error cargando nivel - recarga la pagina";
  }

  private getGoalPlayerPositions(): Vec3[] {
    if (!this.online.isOnline) {
      return this.rules.getPlayerPositions(this.players);
    }

    return this.online.players
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

  private setupGhostSelectControl(): void {
    const ghostSelect = document.querySelector<HTMLSelectElement>("#ghost-select");
    if (!ghostSelect) {
      return;
    }

    ghostSelect.addEventListener("change", () => {
      const val = Number(ghostSelect.value);
      if (this.level && this.level.definition.id === "level-11") {
        (this.level as Level11Runtime).setGhostPlayerIndex(val);
      }
    });
  }

  private setupBlindnessToggleControl(): void {
    const blindnessToggle = document.querySelector<HTMLInputElement>("#blindness-toggle");
    if (!blindnessToggle) {
      return;
    }

    blindnessToggle.addEventListener("change", () => {
      const val = blindnessToggle.checked;
      if (this.level && this.level.definition.id === "level-11") {
        (this.level as Level11Runtime).setDisableBlindness(val);
      }
    });
  }

  private updateLevelText(): void {
    document.querySelector("#level-name")!.textContent = this.level.definition.name;
  }

  private clampLevelIndex(index: number): number {
    return Math.max(0, Math.min(this.levelController.levelsLength - 1, index));
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
