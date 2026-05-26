import { MAX_PLAYERS_PER_ROOM } from "@game/shared";
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
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room || room.players.size >= MAX_PLAYERS_PER_ROOM || room.state !== "WAITING") {
      return null;
    }
    return room;
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
    for (let index = 1; index <= MAX_PLAYERS_PER_ROOM; index += 1) {
      const playerId = `p${index}`;
      if (!room.players.has(playerId)) {
        return playerId;
      }
    }

    return null;
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
