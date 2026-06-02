# Explicacion de estructura de carpetas

El proyecto esta dividido en tres bloques grandes.

## apps/client

Contiene todo lo que corre en el navegador.

Archivos importantes:

- `src/main.ts`: arma el HTML inicial, inicializa Rapier, carga niveles y crea `Game`.
- `src/core/Game.ts`: loop principal del juego.
- `src/entities/Player.ts`: jugador fisico, visual y pose online.
- `src/levels/LevelRuntime.ts`: comportamiento base de niveles.
- `src/levels/LevelController.ts`: carga el runtime correcto para cada nivel.
- `src/network/ClientSocket.ts`: wrapper de Socket.IO en cliente.
- `src/network/OnlineSessionController.ts`: estado online desde el punto de vista del juego.
- `src/input/InputManager.ts`: teclado, mouse y pointer lock.
- `src/render/CameraController.ts`: camara del juego.

## apps/client/public/levels

Contiene los niveles en JSON.

Ejemplo:

- `level-01.json`
- `level-02.json`
- `level-06.json`
- `levels.json`

`levels.json` es el indice que dice que niveles existen y en que orden aparecen.

## apps/server

Contiene todo lo que corre en Node.js.

Archivos importantes:

- `src/index.ts`: configura Socket.IO y todos los eventos.
- `src/rooms/GameRoom.ts`: representa una sala concreta.
- `src/rooms/RoomManager.ts`: administra salas activas.
- `src/core/ServerGameLoop.ts`: loop fijo del servidor.
- `src/core/TimeAccumulator.ts`: acumulador de tiempo para ticks fijos.

## packages/shared

Contiene codigo compartido entre cliente y servidor.

Archivos importantes:

- `src/types/network.ts`: eventos y payloads online.
- `src/types/level.ts`: forma de los JSON de niveles.
- `src/types/entities.ts`: tipos de jugador, input y snapshots.
- `src/constants/player.ts`: constantes del jugador.
- `src/constants/physics.ts`: gravedad y fisica.
- `src/constants/game.ts`: valores generales de juego.

## Por que shared es importante

Si el cliente y el servidor tienen definiciones separadas, se pueden desincronizar. Por ejemplo, el cliente podria mandar una pose con campos distintos a los que el servidor espera.

Con `@game/shared`, los dos lados usan el mismo contrato.

## Continuacion

Para ver la estructura con enlaces directos a explicaciones, seguir con `07-EstructuraProyectoConLinks.md`.

Luego continuar con `04-ExplicacionClienteGameLoop.md`.
