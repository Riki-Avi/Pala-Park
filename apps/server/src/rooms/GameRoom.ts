import {
  MAX_PLAYERS_PER_ROOM,
  type GoalProgressPayload,
  type LevelStatePayload,
  type RoomLifecycleState,
  type RoomPlayer,
  type RoomStatePayload
} from "@game/shared";

export class GameRoom {
  readonly players = new Map<string, string>();
  readonly clientIds = new Map<string, string>();
  private readonly disconnectedAt = new Map<string, number>();
  resetId = 0;
  lastResetAt = 0;
  levelState: LevelStatePayload | null = null;
  goalProgress: GoalProgressPayload | null = null;
  state: RoomLifecycleState = "WAITING";
  tick = 0;
  hostPlayerId = "p1";
  levelIndex = 0;
  private readonly requiredPlayers = 4;

  constructor(readonly roomCode: string) {}

  updateHost(): void {
    if (this.players.has(this.hostPlayerId)) {
      return;
    }
    for (let index = 1; index <= MAX_PLAYERS_PER_ROOM; index += 1) {
      const id = `p${index}`;
      if (this.players.has(id)) {
        this.hostPlayerId = id;
        return;
      }
    }
  }

  addPlayer(playerId: string, socketId: string, clientId: string): boolean {
    const wasWaiting = this.state === "WAITING";
    this.players.set(playerId, socketId);
    this.clientIds.set(playerId, clientId);
    this.disconnectedAt.delete(playerId);
    if (wasWaiting && this.clientIds.size >= this.requiredPlayers) {
      this.state = "PLAYING";
    }
    this.updateHost();

    return wasWaiting && this.state === "PLAYING";
  }

  startGame(): boolean {
    if (this.state === "WAITING" && this.clientIds.size > 0) {
      this.state = "PLAYING";
      return true;
    }
    return false;
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
    this.updateHost();
    if (this.players.size === 0) {
      this.state = "CLOSED";
    }
  }

  disconnectPlayer(playerId: string): void {
    this.players.delete(playerId);
    this.disconnectedAt.set(playerId, Date.now());
    this.updateHost();
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
    return [...this.clientIds.keys()].map((id) => ({
      id,
      connected: this.players.has(id)
    }));
  }

  getRoomState(): RoomStatePayload {
    return {
      roomCode: this.roomCode,
      state: this.state,
      players: this.getPlayers(),
      requiredPlayers: this.requiredPlayers,
      hostPlayerId: this.hostPlayerId,
      levelIndex: this.levelIndex
    };
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

  hasPlayerSlot(playerId: string): boolean {
    return this.clientIds.has(playerId);
  }

  hasOpenSlot(): boolean {
    return this.clientIds.size < MAX_PLAYERS_PER_ROOM;
  }

  canAcceptNewPlayer(): boolean {
    return this.state === "WAITING" && this.hasOpenSlot();
  }

  canReconnect(clientId: string): boolean {
    const playerId = this.getPlayerIdByClient(clientId);
    return Boolean(playerId && !this.isPlayerConnected(playerId));
  }

  nextAvailablePlayerId(): string | null {
    for (let index = 1; index <= MAX_PLAYERS_PER_ROOM; index += 1) {
      const playerId = `p${index}`;
      if (!this.hasPlayerSlot(playerId)) {
        return playerId;
      }
    }

    return null;
  }

  canReceiveHostState(playerId: string, roomCode: string): boolean {
    return this.state === "PLAYING" && playerId === this.hostPlayerId && roomCode === this.roomCode;
  }

  canReset(now: number): boolean {
    if (this.state !== "PLAYING" || now - this.lastResetAt < 800) {
      return false;
    }

    this.lastResetAt = now;
    return true;
  }

  clearSyncedState(): void {
    this.levelState = null;
    this.goalProgress = null;
  }

  changeLevel(levelIndex: number): void {
    this.levelIndex = levelIndex;
    this.clearSyncedState();
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
    this.updateHost();

    if (this.players.size === 0 && this.clientIds.size === 0) {
      this.state = "CLOSED";
    }
  }

  nextResetId(): number {
    this.resetId += 1;
    return this.resetId;
  }
}
