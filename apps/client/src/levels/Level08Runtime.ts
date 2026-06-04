import type RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { FIXED_DELTA, type LevelCustomStatePayload, type Vec3 } from "@game/shared";
import { LevelRuntime } from "./LevelRuntime";
import type { Player } from "../entities/Player";
import type { InputManager } from "../input/InputManager";

interface MovingObstacle {
  id: string;
  mesh: THREE.Mesh;
  body: RAPIER.RigidBody;
  origin: THREE.Vector3;
  phase: number;
  speed: number;
  axis: "x" | "z";
  min: number;
  max: number;
  erratic: boolean;
  direction: number;
  nextDirectionChange: number;
  changeCount: number;
  minDirectionSeconds: number;
  maxDirectionSeconds: number;
}

interface MovingObstacleConfig
  extends Pick<MovingObstacle, "axis" | "min" | "max" | "speed" | "phase">,
    Partial<Pick<MovingObstacle, "erratic" | "minDirectionSeconds" | "maxDirectionSeconds">> {
  firstDirectionChange?: number;
  initialCoord?: number;
  initialDirection?: number;
}

interface PillarProfile {
  firstDirectionChange: number;
  initialCoord: number;
  initialDirection: number;
  maxDirectionSeconds: number;
  minDirectionSeconds: number;
  speed: number;
}

const FLOOR_TOP_Y = 0.31;
const HOLE_RADIUS = 0.42;
const PILLAR_ROUTE_MIN_X = 0.0;
const PILLAR_ROUTE_MAX_X = 70.0;
const WALL_ROUTE_MIN_Z = -6.4;
const WALL_ROUTE_MAX_Z = 6.4;
const PILLAR_MIN_SPEED = 3.4;
const PILLAR_MAX_SPEED = 10.6;
const WALL_MIN_SPEED = 2.4;
const WALL_MAX_SPEED = 10.0;
const PILLAR_MIN_DIRECTION_SECONDS = 0.35;
const PILLAR_MAX_DIRECTION_SECONDS = 20.05;
const WALL_MIN_DIRECTION_SECONDS = 0.55;
const WALL_MAX_DIRECTION_SECONDS = 10.25;
const PHASE_STEP = 0.077;

const HOLES = [
  { x: 6.0, z: -4.8 }, { x: 8.5, z: 2.2 },
  { x: 11.0, z: 5.0 }, { x: 14.5, z: -1.6 },
  { x: 18.0, z: -5.2 }, { x: 21.5, z: 1.4 },
  { x: 25.0, z: 4.8 }, { x: 28.5, z: -3.2 },
  { x: 32.0, z: -0.4 }, { x: 35.5, z: 5.4 },
  { x: 39.0, z: -5.5 }, { x: 42.5, z: 2.6 },
  { x: 46.0, z: -1.8 }, { x: 49.5, z: 4.4 },
  { x: 53.0, z: -4.2 }, { x: 57.0, z: 0.8 },
  { x: 61.0, z: 5.1 }, { x: 65.0, z: -2.4 },
  { x: 69.0, z: 2.9 }, { x: 73.0, z: -5.0 },
  { x: 7.2, z: -0.8 }, { x: 10.0, z: -6.4 },
  { x: 12.8, z: 1.3 }, { x: 16.2, z: 3.8 },
  { x: 19.5, z: -0.6 }, { x: 23.2, z: -6.0 },
  { x: 26.7, z: 0.9 }, { x: 30.2, z: 6.1 },
  { x: 33.7, z: -4.7 }, { x: 37.3, z: 1.7 },
  { x: 40.8, z: -2.1 }, { x: 44.2, z: 5.8 },
  { x: 47.8, z: -5.6 }, { x: 51.2, z: 0.2 },
  { x: 55.0, z: 3.5 }, { x: 59.0, z: -6.2 },
  { x: 63.0, z: 1.8 }, { x: 67.0, z: -5.8 },
  { x: 71.0, z: 6.0 }, { x: 75.0, z: -0.8 },
  { x: 5.0, z: 4.9 }, { x: 8.0, z: -2.7 },
  { x: 13.6, z: -5.7 }, { x: 17.0, z: 0.9 },
  { x: 20.7, z: 5.7 }, { x: 24.2, z: -1.9 },
  { x: 27.8, z: -5.9 }, { x: 31.3, z: 2.8 },
  { x: 34.9, z: 6.4 }, { x: 38.4, z: -3.6 },
  { x: 41.9, z: -6.1 }, { x: 45.4, z: 1.0 },
  { x: 48.9, z: 6.2 }, { x: 52.4, z: -2.9 },
  { x: 56.5, z: -5.1 }, { x: 60.5, z: 4.4 },
  { x: 64.5, z: -0.9 }, { x: 68.5, z: -6.3 },
  { x: 72.5, z: 4.6 }, { x: 78.0, z: -3.4 },
  { x: 4.2, z: -6.7 }, { x: 6.8, z: 1.9 },
  { x: 9.4, z: 6.5 }, { x: 15.3, z: -5.0 },
  { x: 18.9, z: 2.7 }, { x: 22.6, z: 6.6 },
  { x: 29.1, z: -1.2 }, { x: 36.1, z: -6.6 },
  { x: 43.1, z: -4.9 }, { x: 50.1, z: 5.1 },
  { x: 54.3, z: -0.7 }, { x: 58.3, z: 6.4 },
  { x: 62.3, z: -4.3 }, { x: 66.3, z: 3.7 },
  { x: 70.3, z: -1.5 }, { x: 74.3, z: 6.7 },
  { x: 76.4, z: 1.6 }, { x: 78.8, z: 4.1 },
  { x: 39.3, z: -6.4 }, { x: 30.0, z: -0.2 },
  { x: 4.8, z: -3.9 }, { x: 5.7, z: 0.6 },
  { x: 7.6, z: 5.8 }, { x: 9.8, z: -5.5 },
  { x: 11.7, z: -1.9 }, { x: 13.1, z: 6.4 },
  { x: 15.9, z: 1.9 }, { x: 17.6, z: -6.2 },
  { x: 19.1, z: 4.2 }, { x: 21.1, z: -3.8 },
  { x: 22.9, z: 2.4 }, { x: 24.8, z: 6.5 },
  { x: 26.2, z: -2.7 }, { x: 28.1, z: 1.8 },
  { x: 30.8, z: -6.5 }, { x: 32.4, z: 4.0 },
  { x: 34.1, z: -1.1 }, { x: 35.9, z: -5.8 },
  { x: 37.8, z: 6.2 }, { x: 39.7, z: 0.5 },
  { x: 41.4, z: 3.9 }, { x: 43.7, z: -2.8 },
  { x: 45.9, z: -6.5 }, { x: 47.2, z: 2.3 },
  { x: 49.1, z: -0.8 }, { x: 50.8, z: -5.9 },
  { x: 52.9, z: 4.9 }, { x: 55.8, z: 1.4 },
  { x: 57.6, z: -2.8 }, { x: 59.4, z: 6.5 },
  { x: 61.6, z: -6.0 }, { x: 63.8, z: 4.0 },
  { x: 65.7, z: 0.7 }, { x: 67.9, z: -3.8 },
  { x: 69.7, z: 6.4 }, { x: 71.8, z: -6.6 },
  { x: 73.7, z: 1.3 }, { x: 75.6, z: -2.6 },
  { x: 77.4, z: 6.6 }, { x: 79.0, z: 2.4 },
  { x: 10.9, z: 3.6 }, { x: 16.9, z: -2.4 },
  { x: 23.8, z: 0.2 }, { x: 30.0, z: 5.2 },
  { x: 36.9, z: -3.2 }, { x: 44.8, z: 6.6 },
  { x: 51.7, z: 2.0 }, { x: 58.7, z: -0.3 },
  { x: 66.8, z: 5.4 }, { x: 74.8, z: -5.3 },
  { x: 4.5, z: 2.9 }, { x: 6.2, z: -5.9 },
  { x: 7.9, z: -1.5 }, { x: 9.6, z: 3.5 },
  { x: 11.3, z: -6.7 }, { x: 13.0, z: -3.4 },
  { x: 14.7, z: 2.6 }, { x: 16.4, z: 6.7 },
  { x: 18.1, z: -0.8 }, { x: 19.8, z: -4.9 },
  { x: 21.5, z: 0.8 }, { x: 23.2, z: 4.7 },
  { x: 24.9, z: -6.7 }, { x: 26.6, z: -0.4 },
  { x: 28.3, z: 5.6 }, { x: 30.0, z: -4.4 },
  { x: 31.7, z: 0.9 }, { x: 33.4, z: -6.8 },
  { x: 35.1, z: 2.2 }, { x: 36.8, z: 5.8 },
  { x: 38.5, z: -0.9 }, { x: 40.2, z: -4.7 },
  { x: 41.9, z: 2.2 }, { x: 43.6, z: -6.8 },
  { x: 45.3, z: 4.4 }, { x: 47.0, z: -3.5 },
  { x: 48.7, z: 1.6 }, { x: 50.4, z: 6.8 },
  { x: 52.1, z: -4.4 }, { x: 53.8, z: -1.6 },
  { x: 55.5, z: 6.0 }, { x: 57.2, z: 2.7 },
  { x: 58.9, z: -6.8 }, { x: 60.6, z: -3.4 },
  { x: 62.3, z: 2.8 }, { x: 64.0, z: 6.7 },
  { x: 65.7, z: -1.8 }, { x: 67.4, z: -5.0 },
  { x: 69.1, z: 0.3 }, { x: 70.8, z: 4.8 },
  { x: 72.5, z: -6.8 }, { x: 74.2, z: -0.3 },
  { x: 75.9, z: 5.6 }, { x: 77.6, z: -4.4 },
  { x: 79.3, z: 0.7 }, { x: 20.8, z: 6.3 },
  { x: 12.1, z: 0.1 }, { x: 27.4, z: 3.3 },
  { x: 30.7, z: -1.3 }, { x: 30.1, z: -0.1 }
] as const;

export class Level08Runtime extends LevelRuntime {
  private levelPlayers: Player[] = [];
  private holeMeshes: THREE.Mesh[] = [];
  private movingObstacles: MovingObstacle[] = [];
  private elapsed = 0;

  override getDeathThreshold(): number {
    return -12.0;
  }

  override prepareReset(players: Player[]): void {
    this.startLevelState(players);
  }

  override onLevelStart(players: Player[]): void {
    this.startLevelState(players);
  }

  override updateLocal(_playerPositions: Vec3[], _activePlayerIndex?: number, _inputManager?: InputManager): void {
    this.updateMovingObstacles();
    this.dropPlayersInHoles();
  }

  override update(playerPositions: Vec3[], activePlayerIndex?: number, inputManager?: InputManager): void {
    this.updateMovingObstacles();
    this.dropPlayersInHoles();
    super.update(playerPositions, activePlayerIndex, inputManager);
  }

  override dispose(): void {
    for (const hole of this.holeMeshes) {
      this.scene.remove(hole);
      hole.geometry.dispose();
      disposeHoleMaterial(hole.material);
    }
    this.levelPlayers = [];
    this.holeMeshes = [];
    this.movingObstacles = [];
    super.dispose();
  }

  protected override getCustomState(): LevelCustomStatePayload {
    return {
      type: "level-08",
      obstacles: this.movingObstacles.map((obstacle) => ({
        id: obstacle.id,
        position: vectorToVec3(obstacle.mesh.position),
        ...(obstacle.erratic
          ? {
              direction: obstacle.direction,
              turnIn: Math.max(0, obstacle.nextDirectionChange - this.elapsed),
              changeCount: obstacle.changeCount
            }
          : {})
      }))
    };
  }

  protected override applyCustomState(state: LevelCustomStatePayload | undefined): void {
    if (state?.type !== "level-08") {
      return;
    }

    for (const obstacleState of state.obstacles) {
      const obstacle = this.movingObstacles.find((current) => current.id === obstacleState.id);
      if (!obstacle) {
        continue;
      }

      this.applyObstaclePosition(
        obstacle,
        new THREE.Vector3(
          obstacleState.position.x,
          obstacleState.position.y,
          obstacleState.position.z
        )
      );

      if (typeof obstacleState.direction === "number") {
        obstacle.direction = obstacleState.direction >= 0 ? 1 : -1;
      }
      if (typeof obstacleState.turnIn === "number") {
        obstacle.nextDirectionChange = this.elapsed + obstacleState.turnIn;
      }
      if (typeof obstacleState.changeCount === "number") {
        obstacle.changeCount = obstacleState.changeCount;
      }
    }
  }

  private startLevelState(players: Player[]): void {
    this.levelPlayers = players;
    this.elapsed = 0;
    this.setupHoles();
    this.setupMovingObstacles();
    this.updateMovingObstacles();
  }

  private setupHoles(): void {
    if (this.holeMeshes.length > 0) {
      return;
    }

    for (const hole of HOLES) {
      const material = new THREE.MeshBasicMaterial({
        color: "#050608",
        depthWrite: false
      });
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(HOLE_RADIUS, 28), material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(hole.x, FLOOR_TOP_Y, hole.z);
      mesh.renderOrder = 3;
      this.scene.add(mesh);
      this.holeMeshes.push(mesh);
    }
  }

  private setupMovingObstacles(): void {
    this.movingObstacles = [];

    const pillarIds = this.platforms
      .map((platform) => platform.id)
      .filter((id) => /^pilar\d+$/.test(id))
      .sort((a, b) => getNumberSuffix(a) - getNumberSuffix(b));

    const wallIds = this.platforms
      .map((platform) => platform.id)
      .filter((id) => /^muro-horizontal-\d+$/.test(id))
      .sort((a, b) => getNumberSuffix(a) - getNumberSuffix(b));

    pillarIds.forEach((id, index) => {
      const profile = getPillarProfile(index, pillarIds.length);

      this.addMovingObstacle(id, {
        axis: "x",
        min: PILLAR_ROUTE_MIN_X,
        max: PILLAR_ROUTE_MAX_X,
        speed: profile.speed,
        phase: index * PHASE_STEP,
        erratic: true,
        minDirectionSeconds: profile.minDirectionSeconds,
        maxDirectionSeconds: profile.maxDirectionSeconds,
        initialCoord: profile.initialCoord,
        initialDirection: profile.initialDirection,
        firstDirectionChange: profile.firstDirectionChange
      });
    });

    wallIds.forEach((id, index) => {
      this.addMovingObstacle(id, {
        axis: "z",
        min: WALL_ROUTE_MIN_Z,
        max: WALL_ROUTE_MAX_Z,
        speed: getSeededSpeed(id, WALL_MIN_SPEED, WALL_MAX_SPEED),
        phase: index * PHASE_STEP * 2.4,
        erratic: true,
        minDirectionSeconds: WALL_MIN_DIRECTION_SECONDS,
        maxDirectionSeconds: WALL_MAX_DIRECTION_SECONDS
      });
    });
  }

  private addMovingObstacle(id: string, config: MovingObstacleConfig): void {
    const mesh = this.platformMeshes.get(id);
    const physics = this.physicsObjects.find((object) => object.id === id);

    if (!mesh || !physics) {
      return;
    }

    if (typeof config.initialCoord === "number") {
      const startPosition = mesh.position.clone();
      startPosition[config.axis] = config.initialCoord;
      mesh.position.copy(startPosition);
      physics.body.setTranslation(startPosition, true);
    }

    this.movingObstacles.push({
      id,
      mesh,
      body: physics.body,
      origin: mesh.position.clone(),
      erratic: false,
      direction: config.initialDirection ?? seededDirection(id, 0),
      changeCount: 0,
      minDirectionSeconds: WALL_MIN_DIRECTION_SECONDS,
      maxDirectionSeconds: WALL_MAX_DIRECTION_SECONDS,
      nextDirectionChange: 0,
      ...config
    });

    const obstacle = this.movingObstacles[this.movingObstacles.length - 1];
    obstacle.nextDirectionChange = config.firstDirectionChange ?? this.getNextDirectionChange(obstacle, 0);
  }

  private updateMovingObstacles(): void {
    this.elapsed += FIXED_DELTA;

    for (const obstacle of this.movingObstacles) {
      if (obstacle.erratic) {
        this.updateErraticObstacle(obstacle);
        continue;
      }

      const progress = pingPong01(this.elapsed * obstacle.speed + obstacle.phase);
      const position = obstacle.origin.clone();
      position[obstacle.axis] = THREE.MathUtils.lerp(obstacle.min, obstacle.max, progress);
      this.applyObstaclePosition(obstacle, position);
    }
  }

  private updateErraticObstacle(obstacle: MovingObstacle): void {
    if (this.elapsed >= obstacle.nextDirectionChange) {
      obstacle.changeCount += 1;
      obstacle.direction = getNextDirection(obstacle.id, obstacle.changeCount, obstacle.direction);
      obstacle.nextDirectionChange = this.elapsed + this.getNextDirectionChange(obstacle, obstacle.changeCount);
    }

    const position = obstacle.mesh.position.clone();
    let nextCoord = position[obstacle.axis] + obstacle.direction * obstacle.speed * FIXED_DELTA;

    if (nextCoord <= obstacle.min) {
      nextCoord = obstacle.min;
      obstacle.direction = 1;
      obstacle.nextDirectionChange = Math.min(
        obstacle.nextDirectionChange,
        this.elapsed + obstacle.minDirectionSeconds
      );
    } else if (nextCoord >= obstacle.max) {
      nextCoord = obstacle.max;
      obstacle.direction = -1;
      obstacle.nextDirectionChange = Math.min(
        obstacle.nextDirectionChange,
        this.elapsed + obstacle.minDirectionSeconds
      );
    }

    position[obstacle.axis] = nextCoord;
    this.applyObstaclePosition(obstacle, position);
  }

  private applyObstaclePosition(obstacle: MovingObstacle, position: THREE.Vector3): void {
    obstacle.mesh.position.copy(position);
    obstacle.body.setTranslation(position, true);
  }

  private dropPlayersInHoles(): void {
    for (const player of this.levelPlayers) {
      const position = player.body.translation();
      if (position.y > 1.6 || position.y < -0.45) {
        continue;
      }

      for (const hole of HOLES) {
        if (Math.hypot(position.x - hole.x, position.z - hole.z) > HOLE_RADIUS * 0.82) {
          continue;
        }

        const velocity = player.body.linvel();
        player.body.setTranslation({ x: position.x, y: -0.85, z: position.z }, true);
        player.body.setLinvel({ x: velocity.x * 0.4, y: -4.5, z: velocity.z * 0.4 }, true);
        player.setGrounded(false);
        break;
      }
    }
  }

  private getNextDirectionChange(obstacle: MovingObstacle, changeCount: number): number {
    const random = seededRandom(`${obstacle.id}:turn`, changeCount);
    return THREE.MathUtils.lerp(
      obstacle.minDirectionSeconds,
      obstacle.maxDirectionSeconds,
      random
    );
  }
}

function pingPong01(value: number): number {
  const cycle = value % 2;
  return cycle <= 1 ? cycle : 2 - cycle;
}

function getNumberSuffix(id: string): number {
  const match = id.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function seededDirection(id: string, changeCount: number): number {
  return seededRandom(id, changeCount) < 0.5 ? -1 : 1;
}

function getPillarProfile(index: number, total: number): PillarProfile {
  const speedT = getUniqueUnit(index, total, 17);
  const startT = getUniqueUnit(index, total, 23);
  const turnT = getUniqueUnit(index, total, 29);
  const turnWindowT = getUniqueUnit(index, total, 31);
  const firstTurnT = getUniqueUnit(index, total, 37);
  const minDirectionSeconds = THREE.MathUtils.lerp(
    PILLAR_MIN_DIRECTION_SECONDS,
    PILLAR_MAX_DIRECTION_SECONDS * 0.72,
    turnT
  );
  const turnWindow = THREE.MathUtils.lerp(
    0.2,
    Math.max(0.2, PILLAR_MAX_DIRECTION_SECONDS * 0.18),
    turnWindowT
  );
  const maxDirectionSeconds = Math.min(
    PILLAR_MAX_DIRECTION_SECONDS,
    minDirectionSeconds + turnWindow
  );

  return {
    firstDirectionChange: THREE.MathUtils.lerp(
      PILLAR_MIN_DIRECTION_SECONDS,
      maxDirectionSeconds,
      firstTurnT
    ),
    initialCoord: THREE.MathUtils.lerp(PILLAR_ROUTE_MIN_X, PILLAR_ROUTE_MAX_X, startT),
    initialDirection: index % 2 === 0 ? 1 : -1,
    maxDirectionSeconds,
    minDirectionSeconds,
    speed: THREE.MathUtils.lerp(PILLAR_MIN_SPEED, PILLAR_MAX_SPEED, speedT)
  };
}

function getNextDirection(id: string, changeCount: number, currentDirection: number): number {
  const nextDirection = seededDirection(id, changeCount);
  return nextDirection === currentDirection ? -currentDirection : nextDirection;
}

function getSeededSpeed(id: string, min: number, max: number): number {
  return THREE.MathUtils.lerp(min, max, seededRandom(`${id}:speed`, 0));
}

function seededRandom(id: string, changeCount: number): number {
  let hash = 2166136261;
  const key = `${id}:${changeCount}`;

  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

function getUniqueUnit(index: number, total: number, preferredStride: number): number {
  if (total <= 1) {
    return 0.5;
  }

  const stride = getCoprimeStride(total, preferredStride);
  return (((index * stride) % total) + 0.5) / total;
}

function getCoprimeStride(total: number, preferredStride: number): number {
  let stride = Math.max(1, preferredStride % total);

  while (greatestCommonDivisor(stride, total) !== 1) {
    stride = (stride + 1) % total || 1;
  }

  return stride;
}

function greatestCommonDivisor(a: number, b: number): number {
  let left = Math.abs(a);
  let right = Math.abs(b);

  while (right !== 0) {
    const next = left % right;
    left = right;
    right = next;
  }

  return left || 1;
}

function vectorToVec3(vector: THREE.Vector3): Vec3 {
  return { x: vector.x, y: vector.y, z: vector.z };
}

function disposeHoleMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
    return;
  }

  material.dispose();
}
