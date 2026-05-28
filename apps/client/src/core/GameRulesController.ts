import { FIXED_DELTA, PLAYER_SIZE, type Vec3 } from "@game/shared";
import type { Player } from "../entities/Player";
import type { LevelRuntime } from "../levels/LevelRuntime";

interface GoalUpdateResult {
  objective: string;
  shouldAdvance: boolean;
  timer: number;
}

export class GameRulesController {
  updateGrounding(players: Player[], level: LevelRuntime): void {
    for (const [index, player] of players.entries()) {
      const position = player.body.translation();
      player.setGrounded(this.hasGroundBelow(position, index, players, level));
    }
  }

  dampenPlayerPush(players: Player[]): void {
    for (let firstIndex = 0; firstIndex < players.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < players.length; secondIndex += 1) {
        const first = players[firstIndex];
        const second = players[secondIndex];
        const firstPosition = first.body.translation();
        const secondPosition = second.body.translation();
        const horizontalDistance = Math.hypot(
          firstPosition.x - secondPosition.x,
          firstPosition.z - secondPosition.z
        );
        const verticalDistance = Math.abs(firstPosition.y - secondPosition.y);

        if (horizontalDistance > PLAYER_SIZE.x * 1.05 || verticalDistance > PLAYER_SIZE.y * 0.85) {
          continue;
        }

        const firstVelocity = first.body.linvel();
        const secondVelocity = second.body.linvel();
        first.body.setLinvel(
          { x: firstVelocity.x * 0.45, y: firstVelocity.y, z: firstVelocity.z * 0.45 },
          true
        );
        second.body.setLinvel(
          { x: secondVelocity.x * 0.45, y: secondVelocity.y, z: secondVelocity.z * 0.45 },
          true
        );
      }
    }
  }

  recoverFallenPlayers(
    players: Player[],
    level: LevelRuntime,
    options: {
      activePlayerIndex: number;
      isOnline: boolean;
      requestOnlineReset: () => void;
    }
  ): void {
    if (!level.definition.rules.resetOnAnyPlayerFall) {
      return;
    }

    if (options.isOnline) {
      const localPlayer = players[options.activePlayerIndex];
      if (localPlayer.body.translation().y < -8) {
        options.requestOnlineReset();
      }
      return;
    }

    for (const [index, player] of players.entries()) {
      if (player.body.translation().y < -8) {
        player.reset(level.definition.spawnPoints[index]);
      }
    }
  }

  updateGoal(
    players: Player[],
    level: LevelRuntime,
    goalPlayerPositions: Vec3[],
    timer: number
  ): GoalUpdateResult {
    const goal = level.goalZones[0];
    const playerPositions = this.getPlayerPositions(players);
    for (const [index, player] of players.entries()) {
      player.inGoal = goal.contains(playerPositions[index]);
    }

    const allInGoal = level.isCompleted(goalPlayerPositions);
    let nextTimer = timer;
    let shouldAdvance = false;

    if (allInGoal && level.definition.rules.autoAdvanceOnComplete && nextTimer < 0) {
      nextTimer = 3.0;
    }

    if (nextTimer >= 0) {
      nextTimer -= FIXED_DELTA;
      if (nextTimer <= 0) {
        shouldAdvance = true;
      }
    }

    return {
      objective: allInGoal
        ? "Nivel completado"
        : level.doors.every((door) => door.open)
          ? "Cruzen juntos hasta la zona verde"
          : level.definition.objective,
      shouldAdvance,
      timer: nextTimer
    };
  }

  getPlayerPositions(players: Player[]): Vec3[] {
    return players.map((player) => {
      const position = player.body.translation();
      return { x: position.x, y: position.y, z: position.z };
    });
  }

  private hasGroundBelow(position: Vec3, playerIndex: number, players: Player[], level: LevelRuntime): boolean {
    const playerBottom = position.y - PLAYER_SIZE.y / 2;
    const standingSurfaces = [
      ...level.platforms,
      ...level.buttons.map((button) => ({
        id: button.definition.id,
        position: button.definition.position,
        size: button.definition.size
      })),
      ...level.boxes.map((box) => ({
        id: box.definition.id,
        position: box.getPosition(),
        size: box.definition.size
      })),
      ...players
        .filter((_, index) => index !== playerIndex)
        .map((player) => ({
          id: player.id,
          position: player.body.translation(),
          size: PLAYER_SIZE
        }))
    ];

    return standingSurfaces.some((surface) => {
      const surfaceTop = surface.position.y + surface.size.y / 2;
      const nearTop = playerBottom >= surfaceTop - 0.09 && playerBottom <= surfaceTop + 0.18;
      const insideX = Math.abs(position.x - surface.position.x) <= surface.size.x / 2 + PLAYER_SIZE.x / 2;
      const insideZ = Math.abs(position.z - surface.position.z) <= surface.size.z / 2 + PLAYER_SIZE.z / 2;
      return nearTop && insideX && insideZ;
    });
  }
}
