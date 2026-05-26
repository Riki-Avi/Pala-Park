import type { PlayerPose } from "@game/shared";
import type { Player } from "../entities/Player";
import { RemotePoseBuffer } from "./RemotePoseBuffer";

export class RemotePlayerInterpolator {
  private readonly buffers = new Map<string, RemotePoseBuffer>();

  clear(): void {
    this.buffers.clear();
  }

  push(pose: PlayerPose): void {
    let buffer = this.buffers.get(pose.playerId);
    if (!buffer) {
      buffer = new RemotePoseBuffer();
      this.buffers.set(pose.playerId, buffer);
    }

    buffer.push(pose);
  }

  apply(players: Player[], localPlayerId: string, playerIndexFromId: (playerId: string) => number): void {
    for (const [playerId, buffer] of this.buffers) {
      if (playerId === localPlayerId) {
        continue;
      }

      const pose = buffer.sample();
      if (!pose) {
        continue;
      }

      const player = players[playerIndexFromId(playerId)];
      player?.applyNetworkPose(pose);
    }
  }
}
