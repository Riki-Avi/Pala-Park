# Estructura del proyecto con links

Este archivo es un mapa navegable del proyecto. La idea es poder ver una carpeta o archivo importante y saltar a la explicacion correspondiente.

## Raiz del proyecto

| Ruta | Que es | Explicacion |
| --- | --- | --- |
| [`package.json`](../package.json) | Scripts y workspaces del monorepo. | [`02-ExplicacionTecnologias.md`](02-ExplicacionTecnologias.md) |
| [`apps/client`](../apps/client) | Aplicacion del navegador. | [`04-ExplicacionClienteGameLoop.md`](04-ExplicacionClienteGameLoop.md) |
| [`apps/server`](../apps/server) | Servidor Node.js y Socket.IO. | [`05-ExplicacionOnlineServidor.md`](05-ExplicacionOnlineServidor.md) |
| [`packages/shared`](../packages/shared) | Tipos y constantes compartidas. | [`03-ExplicacionEstructuraCarpetas.md`](03-ExplicacionEstructuraCarpetas.md) |
| [`docs`](.) | Documentacion del proyecto. | [`00-IndiceDocumentacion.md`](00-IndiceDocumentacion.md) |

## Cliente

| Ruta | Que es | Explicacion |
| --- | --- | --- |
| [`apps/client/src/main.ts`](../apps/client/src/main.ts) | Entrada del cliente: crea UI, inicializa Rapier, carga niveles y arranca `Game`. | [`04-ExplicacionClienteGameLoop.md`](04-ExplicacionClienteGameLoop.md) |
| [`apps/client/src/core/Game.ts`](../apps/client/src/core/Game.ts) | Loop principal del juego y coordinacion general. | [`04-ExplicacionClienteGameLoop.md`](04-ExplicacionClienteGameLoop.md) |
| [`apps/client/src/core/GameRulesController.ts`](../apps/client/src/core/GameRulesController.ts) | Reglas generales: grounding, meta, caidas y empuje entre jugadores. | [`04-ExplicacionClienteGameLoop.md`](04-ExplicacionClienteGameLoop.md) |
| [`apps/client/src/core/AudioManager.ts`](../apps/client/src/core/AudioManager.ts) | Reproduce sonidos de salto, boton, victoria y laser. | [`02-ExplicacionTecnologias.md`](02-ExplicacionTecnologias.md) |
| [`apps/client/src/input/InputManager.ts`](../apps/client/src/input/InputManager.ts) | Teclado, mouse, pointer lock y sensibilidad. | [`04-ExplicacionClienteGameLoop.md`](04-ExplicacionClienteGameLoop.md) |
| [`apps/client/src/render/CameraController.ts`](../apps/client/src/render/CameraController.ts) | Camara normal y camara 360 del nivel 6. | [`04-ExplicacionClienteGameLoop.md`](04-ExplicacionClienteGameLoop.md), [`ExplicacionNivel6.md`](ExplicacionNivel6.md) |
| [`apps/client/src/render/MeshFactory.ts`](../apps/client/src/render/MeshFactory.ts) | Fabrica meshes y materiales compartidos. | [`02-ExplicacionTecnologias.md`](02-ExplicacionTecnologias.md) |
| [`apps/client/src/physics/PhysicsWorld.ts`](../apps/client/src/physics/PhysicsWorld.ts) | Crea el mundo Rapier. | [`02-ExplicacionTecnologias.md`](02-ExplicacionTecnologias.md) |

## Entidades del cliente

| Ruta | Que es | Explicacion |
| --- | --- | --- |
| [`apps/client/src/entities/Player.ts`](../apps/client/src/entities/Player.ts) | Jugador: cuerpo fisico, mesh, input, pose online. | [`04-ExplicacionClienteGameLoop.md`](04-ExplicacionClienteGameLoop.md), [`05-ExplicacionOnlineServidor.md`](05-ExplicacionOnlineServidor.md) |
| [`apps/client/src/entities/PushBox.ts`](../apps/client/src/entities/PushBox.ts) | Caja empujable y sincronizable. | [`06-ExplicacionSistemaNiveles.md`](06-ExplicacionSistemaNiveles.md) |
| [`apps/client/src/entities/Button.ts`](../apps/client/src/entities/Button.ts) | Boton de hold/toggle. | [`06-ExplicacionSistemaNiveles.md`](06-ExplicacionSistemaNiveles.md) |
| [`apps/client/src/entities/Door.ts`](../apps/client/src/entities/Door.ts) | Puerta visual y fisica. | [`06-ExplicacionSistemaNiveles.md`](06-ExplicacionSistemaNiveles.md) |
| [`apps/client/src/entities/GoalZone.ts`](../apps/client/src/entities/GoalZone.ts) | Zona de victoria. | [`06-ExplicacionSistemaNiveles.md`](06-ExplicacionSistemaNiveles.md) |

## Sistema de niveles

| Ruta | Que es | Explicacion |
| --- | --- | --- |
| [`apps/client/src/levels/LevelController.ts`](../apps/client/src/levels/LevelController.ts) | Carga JSON y elige runtime segun `level.id`. | [`06-ExplicacionSistemaNiveles.md`](06-ExplicacionSistemaNiveles.md) |
| [`apps/client/src/levels/LevelRuntime.ts`](../apps/client/src/levels/LevelRuntime.ts) | Runtime base: plataformas, cajas, botones, puertas y metas. | [`06-ExplicacionSistemaNiveles.md`](06-ExplicacionSistemaNiveles.md) |
| [`apps/client/src/levels/Level03Runtime.ts`](../apps/client/src/levels/Level03Runtime.ts) | Reglas especiales del nivel 3. | [`ExplicacionNivel3.md`](ExplicacionNivel3.md) |
| [`apps/client/src/levels/Level04Runtime.ts`](../apps/client/src/levels/Level04Runtime.ts) | Llave y cuerda estable del nivel 4. | [`ExplicacionNivel4.md`](ExplicacionNivel4.md) |
| [`apps/client/src/levels/Level05Runtime.ts`](../apps/client/src/levels/Level05Runtime.ts) | Batalla espacial, lasers, escudos y torretas. | [`ExplicacionNivel5.md`](ExplicacionNivel5.md) |
| [`apps/client/src/levels/Level06Runtime.ts`](../apps/client/src/levels/Level06Runtime.ts) | Telarana libre, puntero y camara 360. | [`ExplicacionNivel6.md`](ExplicacionNivel6.md) |

## JSON de niveles

| Ruta | Que es | Explicacion |
| --- | --- | --- |
| [`apps/client/public/levels/levels.json`](../apps/client/public/levels/levels.json) | Lista de niveles disponibles y orden de carga. | [`06-ExplicacionSistemaNiveles.md`](06-ExplicacionSistemaNiveles.md) |
| [`apps/client/public/levels/level-01.json`](../apps/client/public/levels/level-01.json) | Nivel 1: caja, boton y puerta. | [`ExplicacionNivel1.md`](ExplicacionNivel1.md) |
| [`apps/client/public/levels/level-02.json`](../apps/client/public/levels/level-02.json) | Nivel 2: parkour y caja alta. | [`ExplicacionNivel2.md`](ExplicacionNivel2.md) |
| [`apps/client/public/levels/level-03.json`](../apps/client/public/levels/level-03.json) | Nivel 3: rutas laterales y botones. | [`ExplicacionNivel3.md`](ExplicacionNivel3.md) |
| [`apps/client/public/levels/level-04.json`](../apps/client/public/levels/level-04.json) | Nivel 4: llave y tira y afloja. | [`ExplicacionNivel4.md`](ExplicacionNivel4.md) |
| [`apps/client/public/levels/level-05.json`](../apps/client/public/levels/level-05.json) | Nivel 5: batalla espacial. | [`ExplicacionNivel5.md`](ExplicacionNivel5.md) |
| [`apps/client/public/levels/level-06.json`](../apps/client/public/levels/level-06.json) | Nivel 6: telaranas en altura. | [`ExplicacionNivel6.md`](ExplicacionNivel6.md) |

## Online del cliente

| Ruta | Que es | Explicacion |
| --- | --- | --- |
| [`apps/client/src/network/ClientSocket.ts`](../apps/client/src/network/ClientSocket.ts) | Wrapper de Socket.IO del lado cliente. | [`05-ExplicacionOnlineServidor.md`](05-ExplicacionOnlineServidor.md) |
| [`apps/client/src/network/OnlineSessionController.ts`](../apps/client/src/network/OnlineSessionController.ts) | Une el juego con el estado online. | [`05-ExplicacionOnlineServidor.md`](05-ExplicacionOnlineServidor.md) |
| [`apps/client/src/network/RemotePlayerInterpolator.ts`](../apps/client/src/network/RemotePlayerInterpolator.ts) | Aplica poses remotas a otros jugadores. | [`05-ExplicacionOnlineServidor.md`](05-ExplicacionOnlineServidor.md) |
| [`apps/client/src/network/RemotePoseBuffer.ts`](../apps/client/src/network/RemotePoseBuffer.ts) | Buffer de interpolacion de poses remotas. | [`05-ExplicacionOnlineServidor.md`](05-ExplicacionOnlineServidor.md) |

## Servidor

| Ruta | Que es | Explicacion |
| --- | --- | --- |
| [`apps/server/src/index.ts`](../apps/server/src/index.ts) | Servidor Socket.IO y validacion de eventos. | [`05-ExplicacionOnlineServidor.md`](05-ExplicacionOnlineServidor.md) |
| [`apps/server/src/rooms/GameRoom.ts`](../apps/server/src/rooms/GameRoom.ts) | Estado de una sala: jugadores, host, nivel, resets. | [`05-ExplicacionOnlineServidor.md`](05-ExplicacionOnlineServidor.md) |
| [`apps/server/src/rooms/RoomManager.ts`](../apps/server/src/rooms/RoomManager.ts) | Crea, busca y limpia salas. | [`05-ExplicacionOnlineServidor.md`](05-ExplicacionOnlineServidor.md) |
| [`apps/server/src/rooms/RoomCodeGenerator.ts`](../apps/server/src/rooms/RoomCodeGenerator.ts) | Genera codigos de sala. | [`05-ExplicacionOnlineServidor.md`](05-ExplicacionOnlineServidor.md) |
| [`apps/server/src/core/ServerGameLoop.ts`](../apps/server/src/core/ServerGameLoop.ts) | Loop fijo del servidor. | [`05-ExplicacionOnlineServidor.md`](05-ExplicacionOnlineServidor.md) |
| [`apps/server/src/core/TimeAccumulator.ts`](../apps/server/src/core/TimeAccumulator.ts) | Acumulador de tiempo para ticks fijos. | [`05-ExplicacionOnlineServidor.md`](05-ExplicacionOnlineServidor.md) |

## Shared

| Ruta | Que es | Explicacion |
| --- | --- | --- |
| [`packages/shared/src/types/level.ts`](../packages/shared/src/types/level.ts) | Tipos de JSON de nivel. | [`06-ExplicacionSistemaNiveles.md`](06-ExplicacionSistemaNiveles.md) |
| [`packages/shared/src/types/network.ts`](../packages/shared/src/types/network.ts) | Payloads y contratos online. | [`05-ExplicacionOnlineServidor.md`](05-ExplicacionOnlineServidor.md) |
| [`packages/shared/src/types/entities.ts`](../packages/shared/src/types/entities.ts) | Tipos de jugador, input y snapshots. | [`04-ExplicacionClienteGameLoop.md`](04-ExplicacionClienteGameLoop.md) |
| [`packages/shared/src/constants/player.ts`](../packages/shared/src/constants/player.ts) | Velocidad, salto y medidas del jugador. | [`04-ExplicacionClienteGameLoop.md`](04-ExplicacionClienteGameLoop.md) |
| [`packages/shared/src/constants/physics.ts`](../packages/shared/src/constants/physics.ts) | Gravedad. | [`02-ExplicacionTecnologias.md`](02-ExplicacionTecnologias.md) |
| [`packages/shared/src/constants/game.ts`](../packages/shared/src/constants/game.ts) | Constantes generales de juego. | [`04-ExplicacionClienteGameLoop.md`](04-ExplicacionClienteGameLoop.md) |

## Continuacion

Seguir con `04-ExplicacionClienteGameLoop.md` si queres entender el flujo del cliente, o con `ExplicacionNivel1.md` si queres ir directo nivel por nivel.
