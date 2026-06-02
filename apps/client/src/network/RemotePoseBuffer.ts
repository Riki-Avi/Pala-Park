import type { PlayerPose, Vec3 } from "@game/shared";

interface BufferedPose {
  receivedAt: number;
  pose: PlayerPose;
}

const INTERPOLATION_DELAY_MS = 100;
const MAX_BUFFERED_POSES = 24;

export class RemotePoseBuffer {
  private readonly poses: BufferedPose[] = [];

  push(pose: PlayerPose): void {
    this.poses.push({ receivedAt: performance.now(), pose });

    if (this.poses.length > MAX_BUFFERED_POSES) {
      this.poses.splice(0, this.poses.length - MAX_BUFFERED_POSES);
    }
  }

  sample(now = performance.now()): PlayerPose | null {
    if (this.poses.length === 0) {
      return null;
    }

    const renderTime = now - INTERPOLATION_DELAY_MS;

    while (this.poses.length >= 2 && this.poses[1].receivedAt <= renderTime) {
      this.poses.shift();
    }

    if (this.poses.length === 1) {
      return this.poses[0].pose;
    }

    const from = this.poses[0];
    const to = this.poses[1];
    const duration = Math.max(to.receivedAt - from.receivedAt, 1);
    const alpha = clamp01((renderTime - from.receivedAt) / duration);

    const isActionActive = from.pose.isActionActive || to.pose.isActionActive;

    return {
      playerId: to.pose.playerId,
      position: lerpVec3(from.pose.position, to.pose.position, alpha),
      velocity: lerpVec3(from.pose.velocity, to.pose.velocity, alpha),
      yaw: lerpAngle(from.pose.yaw, to.pose.yaw, alpha),
      pitch: from.pose.pitch + (to.pose.pitch - from.pose.pitch) * alpha,
      isActionActive
    };
  }
}

function lerpVec3(from: Vec3, to: Vec3, alpha: number): Vec3 {
  return {
    x: from.x + (to.x - from.x) * alpha,
    y: from.y + (to.y - from.y) * alpha,
    z: from.z + (to.z - from.z) * alpha
  };
}

function lerpAngle(from: number, to: number, alpha: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * alpha;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
