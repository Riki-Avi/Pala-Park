# Commit 7: four player lobby

Este commit formaliza el arranque online para salas de 4 jugadores.

## Objetivo

El juego esta pensado para 4 jugadores, asi que la sala online ahora espera 4 conexiones antes de iniciar la partida.

Importante: esto no cambia la condicion de victoria del nivel. Los niveles actuales siguen pidiendo que lleguen 2 jugadores a la meta.

## Cambios principales

- El servidor mantiene estado de sala con `RoomStatePayload`.
- Cada `RoomPlayer` ahora indica si esta conectado.
- La sala queda en `WAITING` mientras hay menos de 4 jugadores.
- Cuando entra el cuarto jugador, la sala pasa a `PLAYING`.
- El servidor emite `gameStarted`.
- El cliente online queda esperando mientras la sala no esta en `PLAYING`.
- El HUD muestra progreso de sala, por ejemplo `Sala: 3/4`.
- `level-01` y `level-02` ahora usan `requiredPlayers: 2` en la meta.

## Verificacion

Se verifico:

- `npm run typecheck`
- `npm run build`
- test de servidor con 3 clientes: no inicia partida.
- test de servidor con 4 clientes: emite `gameStarted`.

## Siguiente paso recomendado

Sincronizar progreso de meta online:

- cuantos jugadores llegaron,
- cuantos faltan,
- nivel completado,
- feedback claro en HUD.
