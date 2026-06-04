import * as THREE from "three";
import type { Player } from "../entities/Player";

interface RopeChain {
  pA: Player;
  pB: Player;
  visualLine: THREE.Line;
  maxLength: number;
}

interface RopeAbilityOptions {
  maxLength?: number;
  visualPoints?: number;
}

const DEFAULT_MAX_LENGTH = 3.2;
const DEFAULT_VISUAL_POINTS = 10;
const OBSTACLE_MARGIN = 0.08;
const WAYPOINT_OFFSET = 0.14;

export class RopeAbility {
  private ropeChains: RopeChain[] = [];
  private players: Player[] = [];
  private readonly maxLength: number;
  private readonly visualPoints: number;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly getSurfaces: () => THREE.Object3D[] = () => [],
    options: RopeAbilityOptions = {}
  ) {
    this.maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
    this.visualPoints = options.visualPoints ?? DEFAULT_VISUAL_POINTS;
  }

  start(players: Player[]): void {
    this.dispose();
    this.players = players;

    if (players.length < 2) {
      return;
    }

    for (let index = 0; index < players.length - 1; index += 1) {
      this.createChain(players[index], players[index + 1]);
    }
  }

  prepareReset(players: Player[]): void {
    this.start(players);
  }

  update(): void {
    this.applyStableRopeLimits();
  }

  syncMeshes(): void {
    for (const chain of this.ropeChains) {
      const posA = getPlayerRopePoint(chain.pA);
      const posB = getPlayerRopePoint(chain.pB);
      const path = this.findCollisionPath(posA, posB);
      const pathLength = getPathLength(path);

      if (pathLength <= 0.05) {
        chain.visualLine.visible = false;
        continue;
      }

      const sagAmount = path.length === 2 ? Math.max(0, (chain.maxLength - pathLength) * 0.15) : 0;
      updateVisualLine(chain.visualLine, path, sagAmount);
    }
  }

  dispose(): void {
    for (const chain of this.ropeChains) {
      this.scene.remove(chain.visualLine);
      chain.visualLine.geometry.dispose();
      disposeMaterial(chain.visualLine.material);
    }
    this.ropeChains = [];
    this.players = [];
  }

  private createChain(pA: Player, pB: Player): void {
    const visualLine = this.createVisualLine();

    this.ropeChains.push({
      pA,
      pB,
      visualLine,
      maxLength: this.maxLength
    });
  }

  private createVisualLine(): THREE.Line {
    const points: THREE.Vector3[] = [];
    for (let index = 0; index < this.visualPoints; index += 1) {
      points.push(new THREE.Vector3());
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: "#c69c6d",
      linewidth: 3
    });
    const visualLine = new THREE.Line(geometry, material);
    visualLine.castShadow = true;
    visualLine.frustumCulled = false;
    visualLine.visible = false;
    this.scene.add(visualLine);
    return visualLine;
  }

  private applyStableRopeLimits(): void {
    for (const chain of this.ropeChains) {
      const posA = getPlayerRopePoint(chain.pA);
      const posB = getPlayerRopePoint(chain.pB);
      const path = this.findCollisionPath(posA, posB);
      const distance = getPathLength(path);

      if (path.length < 2 || distance <= chain.maxLength || distance <= 0.0001) {
        continue;
      }

      const excess = distance - chain.maxLength;
      const idxA = this.players.indexOf(chain.pA);
      const idxB = this.players.indexOf(chain.pB);

      if (idxA === -1 || idxB === -1) {
        continue;
      }

      const groupA = this.players.slice(0, idxA + 1);
      const groupB = this.players.slice(idxB);
      const dirA = path[1].clone().sub(posA).normalize();
      const dirB = path[path.length - 2].clone().sub(posB).normalize();
      const pullDirA = dirA.clone().negate();
      const pullDirB = dirB.clone().negate();
      const strengthA = getGroupStrength(groupA, pullDirA);
      const strengthB = getGroupStrength(groupB, pullDirB);

      let fA_xz = 0.5;
      let fB_xz = 0.5;

      if (strengthA > strengthB + 0.1) {
        fA_xz = 0.05;
        fB_xz = 0.95;
      } else if (strengthB > strengthA + 0.1) {
        fA_xz = 0.95;
        fB_xz = 0.05;
      }

      let fA_y = 0.5;
      let fB_y = 0.5;

      if (chain.pA.isGrounded && !chain.pB.isGrounded) {
        fA_y = 0.0;
        fB_y = 1.0;
      } else if (chain.pB.isGrounded && !chain.pA.isGrounded) {
        fA_y = 1.0;
        fB_y = 0.0;
      }

      const stiffness = 12.0;
      const pullPosition = excess * stiffness;
      const velocityA = chain.pA.body.linvel();
      const velocityB = chain.pB.body.linvel();
      const projA = velocityA.x * dirA.x + velocityA.y * dirA.y + velocityA.z * dirA.z;
      const projB = velocityB.x * dirB.x + velocityB.y * dirB.y + velocityB.z * dirB.z;
      const pullVelocityA = projA < 0 ? -projA : 0;
      const pullVelocityB = projB < 0 ? -projB : 0;
      const maxPull = 5.5;
      const clampCorrection = (value: number) => Math.max(-maxPull, Math.min(maxPull, value));

      chain.pA.body.setLinvel(
        {
          x: clampVelocity(velocityA.x + clampCorrection(dirA.x * (pullVelocityA + pullPosition) * fA_xz)),
          y: clampVelocity(velocityA.y + clampCorrection(dirA.y * (pullVelocityA + pullPosition) * fA_y)),
          z: clampVelocity(velocityA.z + clampCorrection(dirA.z * (pullVelocityA + pullPosition) * fA_xz))
        },
        true
      );

      chain.pB.body.setLinvel(
        {
          x: clampVelocity(velocityB.x + clampCorrection(dirB.x * (pullVelocityB + pullPosition) * fB_xz)),
          y: clampVelocity(velocityB.y + clampCorrection(dirB.y * (pullVelocityB + pullPosition) * fB_y)),
          z: clampVelocity(velocityB.z + clampCorrection(dirB.z * (pullVelocityB + pullPosition) * fB_xz))
        },
        true
      );
    }
  }

  private findCollisionPath(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
    const obstacleBoxes = this.getObstacleBoxes();

    if (obstacleBoxes.length === 0 || isSegmentClear(from, to, obstacleBoxes)) {
      return [from, to];
    }

    const nodes = [
      from.clone(),
      to.clone(),
      ...createWaypointCandidates(obstacleBoxes)
    ];
    const path = findShortestClearPath(nodes, obstacleBoxes);

    return path ?? [from];
  }

  private getObstacleBoxes(): THREE.Box3[] {
    return this.getSurfaces()
      .filter((surface): surface is THREE.Mesh => surface instanceof THREE.Mesh)
      .map((surface) => new THREE.Box3().setFromObject(surface).expandByScalar(OBSTACLE_MARGIN));
  }
}

function getGroupStrength(players: Player[], pullDirection: THREE.Vector3): number {
  let pull = 0;
  let weight = 0;

  for (const player of players) {
    if (!player.isGrounded) {
      pull += 0.05;
      continue;
    }

    const velocity = player.body.linvel();
    const velocityXZ = new THREE.Vector3(velocity.x, 0, velocity.z);
    const pullDirectionXZ = new THREE.Vector3(pullDirection.x, 0, pullDirection.z);
    const pullDirectionLength = pullDirectionXZ.length();
    const projection = pullDirectionLength > 0.001
      ? velocityXZ.dot(pullDirectionXZ.normalize())
      : 0;

    if (projection > 0.4) {
      pull += 1.0;
    } else {
      weight += 1.0;
    }
  }

  return weight + 2.0 * pull;
}

function createWaypointCandidates(boxes: THREE.Box3[]): THREE.Vector3[] {
  const candidates: THREE.Vector3[] = [];
  const edges = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7]
  ];

  for (const box of boxes) {
    const { min, max } = box;
    const center = new THREE.Vector3();
    box.getCenter(center);

    const corners = [
      new THREE.Vector3(min.x, min.y, min.z),
      new THREE.Vector3(max.x, min.y, min.z),
      new THREE.Vector3(min.x, max.y, min.z),
      new THREE.Vector3(max.x, max.y, min.z),
      new THREE.Vector3(min.x, min.y, max.z),
      new THREE.Vector3(max.x, min.y, max.z),
      new THREE.Vector3(min.x, max.y, max.z),
      new THREE.Vector3(max.x, max.y, max.z)
    ];

    for (const corner of corners) {
      candidates.push(offsetAwayFromBox(corner, center));
    }

    for (const [a, b] of edges) {
      candidates.push(offsetAwayFromBox(corners[a].clone().lerp(corners[b], 0.5), center));
    }

    candidates.push(
      offsetAwayFromBox(new THREE.Vector3(min.x, center.y, center.z), center),
      offsetAwayFromBox(new THREE.Vector3(max.x, center.y, center.z), center),
      offsetAwayFromBox(new THREE.Vector3(center.x, min.y, center.z), center),
      offsetAwayFromBox(new THREE.Vector3(center.x, max.y, center.z), center),
      offsetAwayFromBox(new THREE.Vector3(center.x, center.y, min.z), center),
      offsetAwayFromBox(new THREE.Vector3(center.x, center.y, max.z), center)
    );
  }

  return dedupePoints(candidates);
}

function findShortestClearPath(nodes: THREE.Vector3[], boxes: THREE.Box3[]): THREE.Vector3[] | null {
  const start = 0;
  const goal = 1;
  const distances = new Array<number>(nodes.length).fill(Infinity);
  const previous = new Array<number>(nodes.length).fill(-1);
  const visited = new Array<boolean>(nodes.length).fill(false);
  distances[start] = 0;

  for (let iteration = 0; iteration < nodes.length; iteration += 1) {
    let current = -1;
    let bestDistance = Infinity;

    for (let index = 0; index < nodes.length; index += 1) {
      if (!visited[index] && distances[index] < bestDistance) {
        current = index;
        bestDistance = distances[index];
      }
    }

    if (current === -1 || current === goal) {
      break;
    }

    visited[current] = true;

    for (let next = 0; next < nodes.length; next += 1) {
      if (visited[next] || next === current || !isSegmentClear(nodes[current], nodes[next], boxes)) {
        continue;
      }

      const candidateDistance = distances[current] + nodes[current].distanceTo(nodes[next]);
      if (candidateDistance < distances[next]) {
        distances[next] = candidateDistance;
        previous[next] = current;
      }
    }
  }

  if (!Number.isFinite(distances[goal])) {
    return null;
  }

  const path: THREE.Vector3[] = [];
  for (let current = goal; current !== -1; current = previous[current]) {
    path.push(nodes[current].clone());
  }
  return path.reverse();
}

function isSegmentClear(from: THREE.Vector3, to: THREE.Vector3, boxes: THREE.Box3[]): boolean {
  return boxes.every((box) => !lineIntersectsBox(from, to, box));
}

function updateVisualLine(line: THREE.Line, path: THREE.Vector3[], sagAmount: number): void {
  const positions = line.geometry.attributes.position.array as Float32Array;
  const pointCount = positions.length / 3;

  for (let index = 0; index < pointCount; index += 1) {
    const t = pointCount <= 1 ? 0 : index / (pointCount - 1);
    const point = samplePath(path, t);
    const sag = Math.sin(t * Math.PI) * sagAmount;
    positions[index * 3] = point.x;
    positions[index * 3 + 1] = point.y - sag;
    positions[index * 3 + 2] = point.z;
  }

  line.geometry.attributes.position.needsUpdate = true;
  line.geometry.computeBoundingSphere();
  line.geometry.computeBoundingBox();
  line.visible = true;
}

function getPlayerRopePoint(player: Player): THREE.Vector3 {
  const position = player.body.translation();
  return new THREE.Vector3(position.x, position.y + 0.2, position.z);
}

function getPathLength(path: THREE.Vector3[]): number {
  let totalLength = 0;
  for (let index = 0; index < path.length - 1; index += 1) {
    totalLength += path[index].distanceTo(path[index + 1]);
  }
  return totalLength;
}

function samplePath(path: THREE.Vector3[], t: number): THREE.Vector3 {
  if (path.length === 0) {
    return new THREE.Vector3();
  }
  if (path.length === 1) {
    return path[0].clone();
  }

  let totalLength = 0;
  const lengths: number[] = [];
  for (let index = 0; index < path.length - 1; index += 1) {
    const length = path[index].distanceTo(path[index + 1]);
    lengths.push(length);
    totalLength += length;
  }

  if (totalLength <= 0.0001) {
    return path[0].clone();
  }

  let targetLength = THREE.MathUtils.clamp(t, 0, 1) * totalLength;
  for (let index = 0; index < lengths.length; index += 1) {
    if (targetLength > lengths[index]) {
      targetLength -= lengths[index];
      continue;
    }

    const segmentT = lengths[index] <= 0.0001 ? 0 : targetLength / lengths[index];
    return path[index].clone().lerp(path[index + 1], segmentT);
  }

  return path[path.length - 1].clone();
}

function lineIntersectsBox(p1: THREE.Vector3, p2: THREE.Vector3, box: THREE.Box3): boolean {
  const direction = p2.clone().sub(p1);
  const length = direction.length();
  if (length < 0.0001) {
    return false;
  }
  direction.normalize();

  let tMin = -Infinity;
  let tMax = Infinity;
  const shrink = 0.01;
  const min = [box.min.x + shrink, box.min.y + shrink, box.min.z + shrink];
  const max = [box.max.x - shrink, box.max.y - shrink, box.max.z - shrink];
  const origin = [p1.x, p1.y, p1.z];
  const dir = [direction.x, direction.y, direction.z];

  for (let axis = 0; axis < 3; axis += 1) {
    if (Math.abs(dir[axis]) < 0.000001) {
      if (origin[axis] < min[axis] || origin[axis] > max[axis]) {
        return false;
      }
      continue;
    }

    const invDirection = 1.0 / dir[axis];
    let t1 = (min[axis] - origin[axis]) * invDirection;
    let t2 = (max[axis] - origin[axis]) * invDirection;
    if (t1 > t2) {
      const temp = t1;
      t1 = t2;
      t2 = temp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) {
      return false;
    }
  }

  const epsilon = 0.01;
  return tMax >= epsilon && tMin <= length - epsilon;
}

function offsetAwayFromBox(point: THREE.Vector3, center: THREE.Vector3): THREE.Vector3 {
  const direction = point.clone().sub(center);
  if (direction.lengthSq() <= 0.0001) {
    return point.clone();
  }
  return point.clone().addScaledVector(direction.normalize(), WAYPOINT_OFFSET);
}

function dedupePoints(points: THREE.Vector3[]): THREE.Vector3[] {
  const seen = new Set<string>();
  const result: THREE.Vector3[] = [];

  for (const point of points) {
    const key = `${point.x.toFixed(3)}:${point.y.toFixed(3)}:${point.z.toFixed(3)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(point);
  }

  return result;
}

function clampVelocity(value: number): number {
  return Math.max(-8, Math.min(8, value));
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
    return;
  }

  material.dispose();
}
