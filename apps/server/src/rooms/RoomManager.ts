import { MAX_PLAYERS_PER_ROOM } from "@game/shared";
import { GameRoom } from "./GameRoom";
import { generateRoomCode } from "./RoomCodeGenerator";

export class RoomManager {
  readonly rooms = new Map<string, GameRoom>();

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

  fixedUpdate(): void {
    for (const [code, room] of this.rooms) {
      room.fixedUpdate();
      if (room.state === "CLOSED") {
        this.rooms.delete(code);
      }
    }
  }
}
