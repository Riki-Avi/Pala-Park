# Commit: online basico para probar con dos computadoras

Este commit agrega la primera capa online funcional de Pala Park. La meta no fue construir todavia el multiplayer autoritativo completo con fisica oficial en servidor, sino lograr una version practica para probar en dos computadoras reales:

- crear sala,
- unirse con codigo,
- asignar jugador,
- ver al otro jugador moverse,
- reiniciar el nivel para todos con `R` o si alguien cae.

## Objetivo de esta tanda

El objetivo fue convertir el prototipo local en una prueba online minima sin romper la base actual del juego.

La decision principal fue hacer una etapa intermedia:

- El cliente sigue simulando su jugador local.
- El servidor coordina salas, jugadores y resets globales.
- Las posiciones de jugadores se reenvian por Socket.IO.
- Al entrar online, se fuerza el nivel 1 para probar rapido con dos computadoras.

Esto permite testear ya el flujo real entre maquinas distintas antes de meternos en la parte mas compleja: fisica autoritativa de caja, boton y puerta en servidor.

## Cambios principales

### 1. Dependencia de cliente Socket.IO

Se agrego `socket.io-client` al cliente.

Archivo:

```text
apps/client/package.json
```

Esto permite que el navegador se conecte al servidor Socket.IO que corre en `localhost:3001` o en la IP de la maquina host.

## 2. Nuevos contratos compartidos de red

Se extendio:

```text
packages/shared/src/types/network.ts
```

Nuevos conceptos:

- `RoomPlayer`: jugador dentro de una sala.
- `RoomJoinedPayload`: respuesta al crear/unirse a sala.
- `PlayerPose`: posicion, velocidad y yaw de un jugador.
- `LevelResetPayload`: evento de reset global del nivel.

Nuevos eventos cliente -> servidor:

- `playerPose`
- `resetLevel`

Nuevos eventos servidor -> cliente:

- `playerJoined`
- `playerLeft`
- `playerPose`
- `levelReset`

## 3. Servidor con salas mas completas

Se tocaron:

```text
apps/server/src/index.ts
apps/server/src/rooms/GameRoom.ts
apps/server/src/rooms/RoomManager.ts
```

Ahora el servidor puede:

- Crear una sala.
- Asignar jugadores como `p1`, `p2`, `p3`, `p4`.
- Permitir que otro cliente se una con codigo.
- Avisar a todos cuando entra o sale un jugador.
- Reenviar poses de jugadores a los demas clientes.
- Emitir reset global cuando alguien presiona `R` o cae.

El servidor mantiene un `resetId` por sala para identificar resets sucesivos.

## 4. Cliente de red

Se agrego:

```text
apps/client/src/network/ClientSocket.ts
```

Esta clase envuelve `socket.io-client` y expone metodos simples:

- `createRoom()`
- `joinRoom(roomCode)`
- `sendPlayerPose(pose)`
- `requestReset(reason)`

Tambien permite registrar listeners para:

- sesion online,
- lista de jugadores,
- poses remotas,
- reset global,
- estado de conexion.

## 5. UI minima para online

Se actualizo:

```text
apps/client/src/main.ts
apps/client/src/styles.css
```

Se agrego un panel simple con:

- boton `Crear sala`,
- input de codigo,
- boton `Unirse`,
- texto de estado.

Cuando se crea una sala, el codigo queda en el input para copiarlo o verlo rapido.

## 6. Game adaptado a modo online

Se modifico:

```text
apps/client/src/core/Game.ts
```

Cambios importantes:

- `attachNetwork(network)` conecta el juego con `ClientSocket`.
- Al entrar en sala, el juego carga el nivel 1.
- El jugador activo se define por el `playerId` asignado por servidor.
- En online, `Tab` deja de cambiar jugador.
- Cada cliente controla solo su jugador asignado.
- Se envia la pose del jugador local cada pocos ticks.
- Se reciben poses de jugadores remotos y se aplican a sus cuerpos.
- Si se presiona `R`, se pide reset al servidor.
- Si el jugador local cae, se pide reset al servidor.
- Cuando llega `levelReset`, todos reinician el nivel.

## 7. Player con pose de red

Se modifico:

```text
apps/client/src/entities/Player.ts
```

Se agregaron metodos:

```ts
getNetworkPose(playerId, yaw)
applyNetworkPose(pose)
```

Esto permite serializar el estado visible del jugador y aplicarlo en otros clientes.

## 8. Scripts de desarrollo

Se actualizo:

```text
package.json
README.md
```

Nuevos scripts:

```bash
npm run dev:server
npm run dev:client
```

Para probar online local:

```bash
npm run dev:server
npm run dev
```

El cliente local queda en:

```text
http://localhost:5173
```

Desde otra computadora en la misma red, abrir la URL de red que muestra Vite, por ejemplo:

```text
http://192.168.x.x:5173
```

## Como probar con dos computadoras

En la computadora host:

```bash
npm run dev:server
npm run dev
```

En el navegador del host:

1. Abrir `http://localhost:5173`.
2. Click en `Crear sala`.
3. Copiar/ver el codigo generado.

En la segunda computadora:

1. Abrir la URL de red de Vite, por ejemplo `http://192.168.x.x:5173`.
2. Escribir el codigo de sala.
3. Click en `Unirse`.

Resultado esperado:

- Host queda como `p1`.
- Segunda computadora queda como `p2`.
- Ambos entran al nivel 1.
- Cada computadora controla su propio jugador.
- Si uno presiona `R`, se reinicia para todos.
- Si uno cae, se reinicia para todos.

## Limitaciones conocidas

Esta etapa no es todavia multiplayer autoritativo completo.

Limitaciones actuales:

- La fisica de caja, boton y puerta no es oficial en servidor.
- La sincronizacion es simple, basada en poses.
- No hay prediccion/reconciliacion avanzada.
- No hay snapshots completos de entidades.
- El objetivo es validar conexion real y coordinacion basica entre computadoras.

La siguiente etapa robusta seria mover la simulacion oficial al servidor o compartir una simulacion determinista cliente/servidor para:

- caja,
- boton,
- puerta,
- meta,
- resets,
- snapshots.

## Verificacion realizada

Antes de cerrar esta tanda se ejecuto:

```bash
npm run typecheck
npm run build
```

Ambos pasaron correctamente.

Tambien se probo el servidor con dos clientes Socket.IO desde Node:

- cliente 1 creo sala como `p1`,
- cliente 2 entro a la misma sala como `p2`.

El usuario confirmo que la prueba online funciono.
