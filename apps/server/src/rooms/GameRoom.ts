import type { LevelStatePayload, RoomLifecycleState, RoomPlayer } from "@game/shared";

export class GameRoom {
  readonly players = new Map<string, string>();
  readonly clientIds = new Map<string, string>();
  private readonly disconnectedAt = new Map<string, number>();
  resetId = 0;
  lastResetAt = 0;
  levelState: LevelStatePayload | null = null;
  state: RoomLifecycleState = "WAITING";
  tick = 0;

  constructor(readonly roomCode: string) {}

  addPlayer(playerId: string, socketId: string, clientId: string): void {
    this.players.set(playerId, socketId);
    this.clientIds.set(playerId, clientId);
    this.disconnectedAt.delete(playerId);
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
    if (this.players.size === 0) {
      this.state = "CLOSED";
    }
  }

  disconnectPlayer(playerId: string): void {
    this.players.delete(playerId);
    this.disconnectedAt.set(playerId, Date.now());
  }

  fixedUpdate(): void {
    if (this.state === "PLAYING") {
      this.tick += 1;
    }
  }

  getPlayerIdBySocket(socketId: string): string | null {
    for (const [playerId, currentSocketId] of this.players) {
      if (currentSocketId === socketId) {
        return playerId;
      }
    }

    return null;
  }

  getPlayers(): RoomPlayer[] {
    return [...this.clientIds.keys()].map((id) => ({ id }));
  }

  getPlayerIdByClient(clientId: string): string | null {
    for (const [playerId, currentClientId] of this.clientIds) {
      if (currentClientId === clientId) {
        return playerId;
      }
    }

    return null;
  }

  isPlayerConnected(playerId: string): boolean {
    return this.players.has(playerId);
  }

  pruneDisconnected(maxAgeMs: number): void {
    const now = Date.now();
    for (const [playerId, disconnectedAt] of this.disconnectedAt) {
      if (now - disconnectedAt < maxAgeMs) {
        continue;
      }

      this.disconnectedAt.delete(playerId);
      this.clientIds.delete(playerId);
    }

    if (this.players.size === 0 && this.clientIds.size === 0) {
      this.state = "CLOSED";
    }
  }

  nextResetId(): number {
    this.resetId += 1;
    return this.resetId;
  }
}
