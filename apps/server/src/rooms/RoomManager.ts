import { GameRoom } from "./GameRoom";
import { generateRoomCode } from "./RoomCodeGenerator";

export class RoomManager {
  readonly rooms = new Map<string, GameRoom>();
  private readonly disconnectedPlayerTtlMs = 30_000;

  createRoom(): GameRoom {
    let code = generateRoomCode();
    while (this.rooms.has(code)) {
      code = generateRoomCode();
    }

    const room = new GameRoom(code);
    this.rooms.set(code, room);
    return room;
  }

  joinRoom(roomCode: string): GameRoom | null {
    return this.getRoom(roomCode);
  }

  getRoom(roomCode: string): GameRoom | null {
    return this.rooms.get(roomCode.toUpperCase()) ?? null;
  }

  findRoomBySocket(socketId: string): GameRoom | null {
    for (const room of this.rooms.values()) {
      if (room.getPlayerIdBySocket(socketId)) {
        return room;
      }
    }

    return null;
  }

  nextPlayerId(room: GameRoom): string | null {
    return room.nextAvailablePlayerId();
  }

  fixedUpdate(): void {
    for (const [code, room] of this.rooms) {
      room.fixedUpdate();
      room.pruneDisconnected(this.disconnectedPlayerTtlMs);
      if (room.state === "CLOSED") {
        this.rooms.delete(code);
      }
    }
  }
}
