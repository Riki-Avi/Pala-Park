# Commit 6: online level state

Este commit agrega la primera sincronizacion real del estado del nivel online y cambia el puerto default del servidor a `3001` para no chocar con proyectos Next.js que suelen usar `3000`.

## Cambio de puerto

Antes Pala Park usaba:

```text
Servidor Socket.IO: 3000
Cliente Vite: 5173
```

Ahora usa:

```text
Servidor Socket.IO: 3001
Cliente Vite: 5173
```

El cliente detecta automaticamente el host actual y se conecta al mismo host en puerto `3001`.

Ejemplo desde otra computadora:

```text
http://192.168.1.50:5173/
```

El panel online deberia mostrar:

```text
Servidor conectado: http://192.168.1.50:3001
```

## Estado online del nivel

Hasta ahora el online sincronizaba jugadores, pero la caja, el boton y la puerta seguian siendo demasiado locales.

Este commit agrega un evento `levelState` para sincronizar:

- cajas,
- botones,
- puertas.

## Modelo actual

Esta version todavia no es servidor autoritativo completo.

Para avanzar sin reescribir todo, se usa una etapa intermedia:

- `p1` actua como host del estado del nivel.
- El cliente host simula caja, boton y puerta.
- El host manda `levelState` al servidor.
- El servidor guarda el ultimo `levelState`.
- El servidor reenvia ese estado a los otros jugadores.
- Los clientes que no son host aplican el estado recibido.
- Si un jugador entra tarde, recibe el ultimo estado guardado en `roomJoined`.

Esto convierte el online en algo mas jugable sin meternos todavia en fisica oficial en servidor.

## Contratos compartidos

Se agregaron tipos en:

```text
packages/shared/src/types/network.ts
```

Nuevos contratos:

- `BoxState`
- `ButtonState`
- `DoorState`
- `LevelStatePayload`

Nuevo evento cliente -> servidor:

- `levelState`

Nuevo evento servidor -> cliente:

- `levelState`

## Cliente

Archivos principales:

- `apps/client/src/core/Game.ts`
- `apps/client/src/entities/PushBox.ts`
- `apps/client/src/entities/Button.ts`
- `apps/client/src/levels/LevelRuntime.ts`
- `apps/client/src/network/ClientSocket.ts`
- `apps/client/src/network/OnlineSessionController.ts`

Cambios importantes:

- `PushBox` puede exportar y aplicar estado.
- `Button` puede aplicar estado visual con `setPressed`.
- `LevelRuntime` puede crear y aplicar `LevelStatePayload`.
- `OnlineSessionController` sabe si el cliente es host (`p1`).
- El host manda estado de nivel cada pocos ticks.
- Los no-host aplican el ultimo estado recibido.

## Servidor

Archivos principales:

- `apps/server/src/index.ts`
- `apps/server/src/rooms/GameRoom.ts`

Cambios importantes:

- `GameRoom` guarda el ultimo `levelState`.
- Solo `p1` puede enviar `levelState`.
- El servidor reenvia `levelState` a los demas clientes de la sala.
- Al hacer reset, se limpia el `levelState` guardado.
- Al unirse a una sala, el jugador recibe el ultimo `levelState` si existe.

## Verificacion

Se verifico:

- `npm run typecheck`
- `npm run build`
- test con dos clientes Socket.IO:
  - `p1` crea sala,
  - `p2` entra,
  - `p1` envia `levelState`,
  - `p2` recibe caja, boton y puerta.
- test con jugador tardio:
  - `p3` entra despues,
  - recibe el ultimo `levelState` guardado.

## Siguiente paso recomendado

El siguiente avance deberia ser sincronizar progreso de meta y objetivo:

- jugadores en meta,
- nivel completado,
- faltan X jugadores,
- HUD simple de progreso.

Despues de eso, el paso grande sera mover mas autoridad al servidor.
