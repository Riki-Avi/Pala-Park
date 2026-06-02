# Explicacion Nivel 4 - Tira y Afloja Cooperativo

Archivo:

```txt
apps/client/public/levels/level-04.json
```

Runtime:

```txt
apps/client/src/levels/Level04Runtime.ts
```

Este nivel tiene runtime propio.

## Objetivo jugable

La idea original es que los jugadores cooperen cerca de un precipicio para agarrar una llave y abrir una puerta.

Flujo esperado:

1. Los jugadores empiezan en una plataforma.
2. Hay una llave abajo.
3. Algunos jugadores deben acercarse o colgarse para agarrarla.
4. Cuando se recoge la llave, se abre `door-gate`.
5. El grupo cruza hacia la meta.

## Mecanica de llave

La llave no existe en el JSON. La crea `Level04Runtime` con Three.js.

El runtime:

- crea el mesh de la llave
- la anima
- detecta si un jugador esta cerca
- marca `keyCollected`
- abre la puerta
- sincroniza ese estado online usando `Level04StatePayload`

## Cuerda estable

El nivel tuvo una version con cuerda fisica real usando muchos joints y cuerpos pequenos. Eso hacia que Rapier pudiera explotar la simulacion y mandar jugadores volando.

La version actual usa una cuerda visual estable:

- se dibuja una linea entre jugadores
- no hay cadena fisica real
- se aplica un limite suave de distancia
- la velocidad se limita para evitar explosiones

Esto mantiene la idea jugable sin romper la fisica.

## Estado online

El estado custom del nivel es:

```ts
{
  type: "level-04",
  keyCollected: boolean
}
```

Eso permite que si el host recoge la llave, los demas clientes vean la puerta abierta.

## Continuacion

Seguir con `ExplicacionNivel5.md`.
