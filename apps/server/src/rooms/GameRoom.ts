import type { RoomLifecycleState, RoomPlayer } from "@game/shared";

export class GameRoom {
  readonly players = new Map<string, string>();
  resetId = 0;
  state: RoomLifecycleState = "WAITING";
  tick = 0;

  constructor(readonly roomCode: string) {}

  addPlayer(playerId: string, socketId: string): void {
    this.players.set(playerId, socketId);
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
    if (this.players.size === 0) {
      this.state = "CLOSED";
    }
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
    return [...this.players.keys()].map((id) => ({ id }));
  }

  nextResetId(): number {
    this.resetId += 1;
    return this.resetId;
  }
}
