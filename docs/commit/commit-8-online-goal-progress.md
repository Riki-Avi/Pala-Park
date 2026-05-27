# Commit 8: online goal progress

Este commit sincroniza el progreso de la meta online.

## Objetivo

La sala sigue siendo de 4 jugadores, pero la meta de los niveles actuales se completa con 2 jugadores.

El objetivo de este commit es que todos los clientes vean el mismo progreso:

- cuantos jugadores llegaron a la meta,
- cuantos faltan,
- si el nivel esta completado.

## Modelo actual

Seguimos con el modelo intermedio:

- `p1` actua como host temporal de reglas de nivel.
- `p1` calcula el progreso de meta.
- `p1` envia `goalProgress` al servidor.
- El servidor guarda el ultimo progreso.
- El servidor reenvia el progreso a los demas clientes.
- Si un jugador entra tarde, recibe el ultimo `goalProgress`.

Todavia no es servidor autoritativo completo, pero evita que cada cliente decida la victoria por su cuenta.

## Contratos nuevos

En `packages/shared/src/types/network.ts` se agrego:

- `GoalProgressPayload`
- evento cliente -> servidor `goalProgress`
- evento servidor -> cliente `goalProgress`
- `goalProgress` opcional en `RoomJoinedPayload`

## Comportamiento en cliente

El host envia:

- `requiredPlayers`
- `playersInGoal`
- `completed`
- `levelId`
- `serverTick`

Los clientes que no son host usan ese estado para mostrar objetivo y completar nivel.

Cuando la puerta esta abierta, el HUD puede mostrar progreso tipo:

```text
Meta 1/2 - faltan 1
```

## Verificacion

Se verifico:

- `npm run typecheck`
- `npm run build`
- test con dos clientes Socket.IO:
  - `p1` envia `goalProgress`,
  - `p2` lo recibe.
- test con jugador tardio:
  - `p3` entra despues,
  - recibe el ultimo `goalProgress`.

## Siguiente paso recomendado

El siguiente avance grande deberia ser empezar a mover autoridad real al servidor:

- validar resets,
- validar completion,
- enviar snapshots oficiales,
- reducir confianza en el host.
