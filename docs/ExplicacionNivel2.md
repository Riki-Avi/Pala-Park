# Explicacion Nivel 2 - Parkour a la caja

Archivo:

```txt
apps/client/public/levels/level-02.json
```

Runtime:

```txt
LevelRuntime
```

Este nivel tambien usa el comportamiento base. La dificultad esta en el layout del JSON.

## Objetivo jugable

La idea es parecida al nivel 1, pero mas vertical.

Flujo esperado:

1. Los jugadores aparecen en la zona inicial.
2. Deben cruzar un parkour.
3. Hay una caja muy alta.
4. Deben hacer escalera humana para que alguien llegue.
5. La caja baja.
6. La caja presiona el boton.
7. La puerta se abre.
8. Al menos 2 jugadores llegan a la meta.

## Elementos importantes

Plataformas:

- `start`
- `parkour-01`
- `parkour-02`
- `parkour-03`
- `box-shelf`
- `main-floor`
- `button-pad`
- `goal-pad`

Caja:

- `box-02`

Boton:

- `button-02`

Puerta:

- `door-02`

Meta:

- `goal`

## Diferencia con nivel 1

El nivel 1 ensena caja + boton + puerta.

El nivel 2 agrega:

- recorrido de parkour
- caja mas alta
- necesidad mas fuerte de escalera humana

No tiene codigo propio porque todas las reglas salen de los elementos base.

## Riesgos al modificarlo

Si se cambia la altura de `box-shelf`, hay que probar que:

- un jugador solo no pueda llegar demasiado facil
- con cooperacion si sea posible
- la caja pueda caer hacia una zona util
- la caja no quede atrapada

## Continuacion

Seguir con `ExplicacionNivel3.md`.
