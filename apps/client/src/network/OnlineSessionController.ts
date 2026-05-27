import type { LevelStatePayload, RoomJoinedPayload, RoomPlayer } from "@game/shared";
import type { Player } from "../entities/Player";
import type { LevelRuntime } from "../levels/LevelRuntime";
import { ClientSocket } from "./ClientSocket";
import { RemotePlayerInterpolator } from "./RemotePlayerInterpolator";

interface OnlineSessionCallbacks {
  onSessionStarted: (session: RoomJoinedPayload) => void;
  onLevelReset: (message: string) => void;
}

export class OnlineSessionController {
  private network: ClientSocket | null = null;
  private session: RoomJoinedPayload | null = null;
  private readonly remotePlayerInterpolator = new RemotePlayerInterpolator();
  private pendingReset = false;
  private lastPoseSentTick = -1;
  private lastLevelStateSentTick = -1;
  private pendingLevelState: LevelStatePayload | null = null;

  attach(network: ClientSocket, callbacks: OnlineSessionCallbacks): void {
    this.network = network;

    network.onSession((session) => {
      this.session = session;
      this.remotePlayerInterpolator.clear();
      this.pendingLevelState = session.levelState ?? null;
      callbacks.onSessionStarted(session);
    });

    network.onPlayers((players) => {
      if (this.session) {
        this.session.players = players;
      }
    });

    network.onPlayerPose((pose) => {
      if (pose.playerId !== this.session?.playerId) {
        this.remotePlayerInterpolator.push(pose);
      }
    });

    network.onLevelState((payload) => {
      if (payload.roomCode === this.session?.roomCode) {
        this.pendingLevelState = payload;
      }
    });

    network.onLevelReset((payload) => {
      this.pendingReset = false;
      this.pendingLevelState = null;
      callbacks.onLevelReset(`Nivel reiniciado por ${payload.byPlayerId}`);
    });
  }

  get isOnline(): boolean {
    return Boolean(this.session);
  }

  get playerId(): string | null {
    return this.session?.playerId ?? null;
  }

  get isHost(): boolean {
    return this.session?.playerId === "p1";
  }

  get players(): RoomPlayer[] {
    return this.session?.players ?? [];
  }

  sendPose(tick: number, player: Player, yaw: number): void {
    if (!this.network || !this.session || tick === this.lastPoseSentTick || tick % 2 !== 0) {
      return;
    }

    this.lastPoseSentTick = tick;
    this.network.sendPlayerPose(player.getNetworkPose(this.session.playerId, yaw));
  }

  sendLevelState(tick: number, level: LevelRuntime): void {
    if (!this.network || !this.session || !this.isHost || tick === this.lastLevelStateSentTick || tick % 3 !== 0) {
      return;
    }

    this.lastLevelStateSentTick = tick;
    this.network.sendLevelState(level.getLevelState(this.session.roomCode, tick));
  }

  applyLevelState(level: LevelRuntime): void {
    if (!this.pendingLevelState || this.isHost) {
      return;
    }

    level.applyLevelState(this.pendingLevelState);
  }

  interpolateRemotes(players: Player[], playerIndexFromId: (playerId: string) => number): void {
    if (!this.session) {
      return;
    }

    this.remotePlayerInterpolator.apply(players, this.session.playerId, playerIndexFromId);
  }

  requestReset(reason: "fall" | "manual"): void {
    if (!this.network || this.pendingReset) {
      return;
    }

    this.pendingReset = true;
    this.network.requestReset(reason);
  }
}
