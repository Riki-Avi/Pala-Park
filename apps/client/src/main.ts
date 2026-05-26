import RAPIER from "@dimforge/rapier3d-compat";
import { Game } from "./core/Game";
import "./styles.css";

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
      <section class="controls" aria-label="Controles">
        <span>Click + mouse, WASD + Espacio</span>
        <span>Tab cambia entre 4 jugadores</span>
        <label class="sensitivity">
          Mouse
          <input id="mouse-sensitivity" type="range" min="0.8" max="6" step="0.1" value="2.4" />
        </label>
        <span>R reinicia</span>
      </section>
    </main>
  `;

  await RAPIER.init();

  const canvas = document.querySelector<HTMLCanvasElement>("#game");

  if (!canvas) {
    throw new Error("Missing game canvas");
  }

  const game = new Game(canvas);
  game.start();
}

bootstrap().catch((error) => {
  console.error(error);
});
