# Explicacion Nivel 3 - La Union de los Cuatro

Archivo:

```txt
apps/client/public/levels/level-03.json
```

Runtime:

```txt
apps/client/src/levels/Level03Runtime.ts
```

Este nivel tiene runtime propio.

## Objetivo jugable

El nivel divide a los jugadores en rutas laterales. Deben resolver botones y luego reunirse para avanzar.

Flujo esperado:

1. Los jugadores salen desde una plataforma pequena.
2. Hay parkour por izquierda y derecha.
3. Cada lado tiene un boton.
4. Luego hay una plataforma central con un boton elevado.
5. Se necesita cooperacion para activar el boton elevado.
6. Se abre la puerta de victoria.
7. Llegan a la meta.

## Elementos importantes del JSON

Botones:

- `button-start-1`
- `button-start-2`
- `button-unlock`

Puertas:

- `door-big`
- `door-victory`

Meta:

- requiere 4 jugadores.

## Por que tiene runtime propio

El nivel 3 necesita reglas mas avanzadas que el runtime base.

El runtime base abre una puerta si cualquier boton que la apunta esta presionado. En este nivel conviene una logica mas especifica: botones de hold, boton toggle y desbloqueo central.

Por eso existe `Level03Runtime`.

## Idea tecnica

El runtime especial puede sobreescribir metodos del base:

- `update`
- `updateStandardDoors`
- otros metodos de estado si hiciera falta

Asi el nivel 3 puede tener reglas propias sin cambiar niveles 1 y 2.

## Continuacion

Seguir con `ExplicacionNivel4.md`.
