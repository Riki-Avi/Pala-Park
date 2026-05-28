# Commit 9 - Server hardening

Este commit cierra los puntos flojos del servidor online para que las salas sean mas confiables antes de seguir agregando mecanicas.

## Objetivo

El servidor ya no debe depender de condiciones sueltas para decidir quien puede entrar, quien puede reconectar, cuando empieza la partida o quien puede mandar estado sincronizado.

La regla general queda asi:

- La sala tiene 4 slots fijos: `p1`, `p2`, `p3`, `p4`.
- Un jugador nuevo solo puede entrar mientras la sala esta en `WAITING`.
- Cuando se ocupan los 4 slots, la sala pasa a `PLAYING`.
- Si un jugador se desconecta, su slot queda reservado durante un tiempo para reconectar.
- Un quinto jugador no puede entrar si la sala ya empezo o esta llena.
- Un mismo socket no puede crear o unirse a otra sala mientras ya esta dentro de una.
- El cliente manda estado visual/simulacion, pero el servidor filtra quien tiene permiso.

## Cambios principales

### GameRoom

`apps/server/src/rooms/GameRoom.ts` ahora concentra mas reglas de sala:

- `addPlayer()` devuelve si la sala acaba de empezar.
- `canAcceptNewPlayer()` decide si un jugador nuevo puede ocupar un slot.
- `canReconnect()` permite volver al mismo slot si el cliente ya pertenecia a la sala.
- `nextAvailablePlayerId()` asigna slots usando `clientIds`, no solo sockets conectados.
- `canReceiveHostState()` permite aceptar estado de nivel/meta solo desde `p1` y solo en `PLAYING`.
- `canReset()` aplica anti-spam y evita resets fuera de partida.
- `clearSyncedState()` limpia estado sincronizado al reiniciar nivel.

Esto evita que `index.ts` tenga que conocer detalles internos de la sala.

### RoomManager

`apps/server/src/rooms/RoomManager.ts` ahora separa buscar sala de validar entrada:

- `getRoom()` solo busca una sala por codigo.
- `joinRoom()` conserva compatibilidad, pero ya no decide reglas de entrada.
- `nextPlayerId()` delega en `GameRoom.nextAvailablePlayerId()`.

La validacion real queda donde corresponde: entre `GameRoom` y el handler del servidor.

### Servidor Socket.IO

`apps/server/src/index.ts` ahora:

- Bloquea `createRoom` y `joinRoom` si el socket ya esta en una sala.
- Valida `clientId`, `roomCode`, `playerPose` y `resetLevel` antes de procesarlos.
- Rechaza con mensaje claro si la sala no existe.
- Rechaza con mensaje claro si la sala ya empezo o esta llena.
- Permite reconectar con el mismo `clientId` a una sala ya empezada.
- Manda `gameStarted` a todos cuando entra el cuarto jugador.
- Manda `gameStarted` solo al jugador que reconecta si la partida ya estaba iniciada.
- Ignora `playerPose` si no coincide con el jugador real del socket.
- Ignora `levelState` y `goalProgress` si no los manda `p1`.
- Limpia `levelState` y `goalProgress` cuando alguien reinicia el nivel.

## Casos probados

Se levanto servidor temporal en `PORT=3002` y se probaron sockets reales:

- Crear sala.
- Bloquear que el mismo socket cree otra sala.
- Entrar con 4 clientes.
- Confirmar que los 4 reciben `gameStarted`.
- Bloquear un quinto cliente.
- Desconectar `p2` y reconectar con el mismo `clientId`.
- Confirmar que reconecta como `p2`.
- Confirmar que el reconectado recibe `gameStarted`.
- Confirmar que `levelState` de un no-host no se rebroadcast.
- Confirmar que `levelState` de `p1` si se rebroadcast.
- Confirmar que `goalProgress` de un no-host no se rebroadcast.
- Confirmar que `goalProgress` de `p1` si se rebroadcast.
- Confirmar que `resetLevel` llega con `byPlayerId` correcto.

Resultado del test:

```json
{
  "ok": true,
  "started": 4,
  "duplicateError": "Ya estas en una sala.",
  "rejoinedAs": "p2",
  "fifthError": "La sala ya empezo o esta llena.",
  "resetId": 1
}
```

## Verificacion

- `npm run typecheck`
- `npm run build`

El build paso correctamente. Vite mantiene una advertencia normal de chunk grande por Three/Rapier, no es un error.

## Nota importante

El servidor todavia no simula fisica autoritativa completa. Lo que queda terminado aca es el flujo de sala online, autoridad basica del host, reconexion, reset y validaciones defensivas. El siguiente salto grande seria mover mas simulacion real al servidor o mejorar la suavidad visual de jugadores remotos.
