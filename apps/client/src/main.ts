import RAPIER from "@dimforge/rapier3d-compat";
import type { RoomStatePayload } from "@game/shared";
import { Game } from "./core/Game";
import { ClientSocket } from "./network/ClientSocket";
import "./styles.css";

async function loadLevelFiles(): Promise<string[]> {
  const response = await fetch("/levels/levels.json");
  if (!response.ok) {
    throw new Error(`Failed to fetch levels index: ${response.statusText}`);
  }
  return await response.json();
}

async function bootstrap(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>("#app");

  if (!app) {
    throw new Error("Missing #app element");
  }

  app.innerHTML = `
    <main class="shell">
      <section class="hud" aria-label="Estado de partida">
        <div>
          <strong>Pala Park</strong>
          <span id="level-name">Cargando nivel</span>
        </div>
        <div class="status">
          <span id="objective">Pisen el boton para abrir la puerta</span>
          <span id="fps">0 FPS</span>
        </div>
      </section>
      <canvas id="game"></canvas>
      <section class="network-panel" aria-label="Sala online">
        <button id="create-room" type="button">Crear sala</button>
        <input id="room-code" type="text" maxlength="4" placeholder="CODIGO" />
        <button id="join-room" type="button">Unirse</button>
        <button id="start-game" type="button" style="display: none; background: #2f9a56; border-color: #2b844c; font-weight: bold; margin-left: 4px;">Iniciar partida</button>
        <select id="level-select" style="display: none;" aria-label="Elegir nivel"></select>
        <div class="network-info">
          <span id="network-status">Modo local</span>
          <span id="server-target">Servidor: detectando...</span>
          <span id="room-slots">Sala: 0/2</span>
        </div>
      </section>
      <section class="controls" aria-label="Controles">
        <span>Click + mouse, WASD + Espacio</span>
        <span>Tab cambia jugador en local</span>
        <label class="sensitivity">
          Mouse
          <input id="mouse-sensitivity" type="range" min="0.8" max="6" step="0.1" value="2.4" />
        </label>
        <label id="ghost-select-container" class="sensitivity" style="display: none;">
          Rol Fantasma:
          <select id="ghost-select" style="background: rgb(255 255 255 / 8%); color: #f6f7fb; border: 1px solid rgb(255 255 255 / 16%); border-radius: 6px; padding: 2px 4px; font-family: inherit; font-size: inherit; cursor: pointer;">
            <option value="0">Azul (P1)</option>
            <option value="1">Amarillo (P2)</option>
            <option value="2">Verde (P3)</option>
            <option value="3">Violeta (P4)</option>
          </select>
        </label>
        <label id="blindness-toggle-container" class="sensitivity" style="display: none;">
          <input id="blindness-toggle" type="checkbox" style="cursor: pointer; margin-right: 6px;" />
          Ver todo (Sin ceguera)
        </label>
        <span>R reinicia</span>
      </section>
    </main>
  `;

  const canvas = document.querySelector<HTMLCanvasElement>("#game");

  if (!canvas) {
    throw new Error("Missing game canvas");
  }

  const network = new ClientSocket();
  await initializeRapier();

  const objective = document.querySelector<HTMLSpanElement>("#objective");
  if (objective) {
    objective.textContent = "Cargando niveles...";
  }

  const levelFiles = await loadLevelFiles();
  setupNetworkUi(network, levelFiles);

  const game = new Game(canvas, levelFiles);
  game.attachNetwork(network);
  await game.start();
}

async function initializeRapier(): Promise<void> {
  const objective = document.querySelector<HTMLSpanElement>("#objective");
  const networkStatus = document.querySelector<HTMLSpanElement>("#network-status");

  if (objective) {
    objective.textContent = "Cargando fisica...";
  }

  try {
    await withTimeout(RAPIER.init(), 8000, "Rapier tardo demasiado en inicializar");
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo iniciar Rapier";
    if (networkStatus) {
      networkStatus.textContent = message;
    }
    if (objective) {
      objective.textContent = "El navegador bloqueo la fisica. Proba localhost o HTTPS.";
    }
    throw error;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

function setupNetworkUi(network: ClientSocket, levelFiles: string[]): void {
  const createRoom = document.querySelector<HTMLButtonElement>("#create-room");
  const joinRoom = document.querySelector<HTMLButtonElement>("#join-room");
  const roomCode = document.querySelector<HTMLInputElement>("#room-code");
  const networkStatus = document.querySelector<HTMLSpanElement>("#network-status");
  const serverTarget = document.querySelector<HTMLSpanElement>("#server-target");
  const roomSlots = document.querySelector<HTMLSpanElement>("#room-slots");
  const startGame = document.querySelector<HTMLButtonElement>("#start-game");
  const levelSelect = document.querySelector<HTMLSelectElement>("#level-select");

  if (serverTarget) {
    serverTarget.textContent = `Servidor: ${network.getServerUrl()}`;
  }

  createRoom?.addEventListener("click", () => network.createRoom());
  joinRoom?.addEventListener("click", () => {
    if (roomCode?.value) {
      network.joinRoom(roomCode.value);
    }
  });
  startGame?.addEventListener("click", () => network.startGame());
  if (levelSelect) {
    levelSelect.innerHTML = levelFiles
      .map((_, index) => `<option value="${index}">Nivel ${index + 1}</option>`)
      .join("");
    levelSelect.value = "0";
    levelSelect.addEventListener("change", () => {
      network.requestLevelChange(Number(levelSelect.value));
    });
  }

  let localPlayerId = "";
  let currentRoomState: RoomStatePayload | null = null;

  const updateStartButtonVisibility = () => {
    if (!startGame) return;
    const isHost = Boolean(
      currentRoomState &&
      localPlayerId === currentRoomState.hostPlayerId
    );

    if (isHost && currentRoomState?.state === "WAITING") {
      startGame.style.display = "inline-block";
    } else {
      startGame.style.display = "none";
    }

    if (levelSelect) {
      levelSelect.style.display = isHost ? "inline-block" : "none";
      if (currentRoomState) {
        levelSelect.value = String(currentRoomState.levelIndex);
      }
    }
  };

  network.onSession((session) => {
    localPlayerId = session.playerId;
    currentRoomState = session.roomState;
    if (roomCode) {
      roomCode.value = session.roomCode;
    }
    updateStartButtonVisibility();
  });
  network.onStatus((message) => {
    if (networkStatus) {
      networkStatus.textContent = message;
    }
  });
  network.onRoomState((roomState) => {
    currentRoomState = roomState;
    updateStartButtonVisibility();
    if (!roomSlots) {
      return;
    }

    const connectedPlayers = roomState.players.filter((player) => player.connected).length;
    roomSlots.textContent =
      roomState.state === "PLAYING"
        ? "Sala completa"
        : `Sala: ${connectedPlayers}/${roomState.requiredPlayers}`;
  });
  network.onGameStarted((roomState) => {
    currentRoomState = roomState;
    updateStartButtonVisibility();
  });
  network.onLevelChanged((payload) => {
    if (levelSelect) {
      levelSelect.value = String(payload.levelIndex);
    }
  });
}

bootstrap().catch((error) => {
  console.error(error);
});
