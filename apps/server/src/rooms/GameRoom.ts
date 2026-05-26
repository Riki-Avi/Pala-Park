import type { RoomLifecycleState } from "@game/shared";

export class GameRoom {
  readonly players = new Map<string, string>();
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
}
