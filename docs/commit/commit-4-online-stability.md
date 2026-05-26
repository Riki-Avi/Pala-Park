# Commit 4: estabilidad online y primer alivio de Game.ts

Este commit apunta a cerrar problemas detectados en la primera prueba online:

- El jugador remoto se veia aspero.
- Un mismo cliente podia entrar varias veces a la misma sala.
- Si se recargaba o se caia la conexion, ocupaba otro slot.
- El reset podia dispararse muchas veces seguidas.
- `Game.ts` empezo a concentrar demasiadas responsabilidades.

## 1. Interpolacion de jugadores remotos

Antes, cada pose recibida por red se aplicaba directamente al cuerpo del jugador remoto. Eso producia movimiento aspero porque las poses llegan por paquetes, no frame a frame.

Se agregaron:

```text
apps/client/src/network/RemotePoseBuffer.ts
apps/client/src/network/RemotePlayerInterpolator.ts
```

Ahora el flujo es:

1. Llega una pose remota.
2. Se guarda en un buffer corto.
3. El render toma una muestra con un pequeno retraso.
4. Se interpola posicion, velocidad y yaw.
5. El jugador remoto se ve mas suave.

El delay de interpolacion actual es:

```ts
INTERPOLATION_DELAY_MS = 120
```

Esto no es prediccion ni reconciliacion; es solo suavizado visual para jugadores remotos.

## 2. Evitar duplicados por cliente

Problema detectado: el mismo navegador podia abrir otra pestaña y ocupar otro slot de la misma sala.

Se agrego un `clientId` estable en el cliente:

```text
apps/client/src/network/ClientSocket.ts
```

El `clientId` se guarda en:

```text
localStorage["pala-park-client-id"]
```

Ahora el cliente manda ese `clientId` al crear o unirse a sala.

## 3. Rejoin simple

En servidor, `GameRoom` ahora recuerda que `clientId` corresponde a que `playerId`.

Archivo:

```text
apps/server/src/rooms/GameRoom.ts
```

Si un cliente se desconecta, no se borra inmediatamente su identidad. Queda como slot recuperable por un tiempo.

Esto permite una reconexion simple:

- si el mismo `clientId` vuelve a entrar,
- recupera el mismo `p1`, `p2`, etc.,
- en vez de ocupar un nuevo jugador.

El TTL actual para desconectados es:

```ts
30_000 ms
```

Esta logica vive en:

```text
apps/server/src/rooms/RoomManager.ts
```

## 4. Bloqueo de duplicado conectado

Si el mismo `clientId` intenta unirse a una sala donde ya esta conectado, el servidor responde:

```text
Este cliente ya esta conectado a la sala.
```

Esto evita el caso:

```text
misma persona = p1 + p2 + p3 + p4
```

desde el mismo navegador/sesion.

## 5. Reset anti-spam

Se agrego proteccion simple en servidor para no emitir resets globales demasiadas veces seguidas.

Archivo:

```text
apps/server/src/index.ts
```

Regla actual:

```ts
if (now - room.lastResetAt < 800) return;
```

Esto evita que:

- mantener `R`,
- caer varias veces seguidas,
- o recibir eventos duplicados,

mande muchos resets globales en muy poco tiempo.

## 6. Contratos compartidos actualizados

Se actualizo:

```text
packages/shared/src/types/network.ts
```

Cambios:

- `createRoom` ahora recibe `{ clientId }`.
- `joinRoom` ahora recibe `{ roomCode, clientId }`.

Esto mantiene cliente y servidor hablando el mismo idioma.

## 7. Game.ts sigue grande, pero menos mezclado

Antes de este commit, `Game.ts` tenia 431 lineas.

Despues de extraer la interpolacion remota, quedo en 415 lineas.

No es una limpieza enorme, pero es un paso correcto:

- `Game.ts` sigue orquestando.
- El buffer/interpolacion remota ahora viven en clases propias.

Siguiente refactor recomendado:

- `OnlineSessionController`
- `LevelController`
- `HudController`

## Verificacion

Se corrio:

```bash
npm run typecheck
```

Pasó correctamente.

Tambien debe correrse antes de pushear:

```bash
npm run build
```

## Limitaciones que siguen

Esto todavia no resuelve:

- fisica autoritativa de caja/boton/puerta,
- snapshots oficiales del servidor,
- prediccion del jugador local,
- reconciliacion,
- estado completo de sala en UI.

Pero deja el online basico mas estable para seguir probando en dos computadoras.
