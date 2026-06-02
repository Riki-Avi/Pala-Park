# Explicacion Nivel 1 - Escalera humana

Archivo:

```txt
apps/client/public/levels/level-01.json
```

Runtime:

```txt
LevelRuntime
```

Este nivel usa el comportamiento base. No tiene una clase TypeScript propia.

## Objetivo jugable

El nivel introduce la cooperacion con caja, boton y puerta.

La idea es:

1. Los jugadores aparecen en la zona inicial.
2. Hay una caja arriba en una plataforma.
3. Los jugadores deben colaborar para bajar o mover la caja.
4. La caja debe quedar sobre el boton.
5. El boton abre la puerta.
6. Al menos 2 jugadores deben llegar a la meta.

## Elementos importantes

Plataformas:

- `start-floor`: zona inicial.
- `door-floor`: zona despues de la puerta.
- `button-pad`: base visual para el boton.
- `box-shelf`: plataforma alta donde empieza la caja.

Caja:

- `box-01`

Boton:

- `button-01`
- modo `hold`, significa que debe mantenerse presionado.

Puerta:

- `door-01`

Meta:

- `goal`
- pide 2 jugadores.

## Como se abre la puerta

El boton tiene:

```json
"targetDoorIds": ["door-01"]
```

Eso significa que cuando `button-01` esta presionado, `door-01` se abre.

La logica vive en `LevelRuntime.updateStandardDoors()`.

## Por que la caja reaparece

El nivel tiene:

```json
"respawnBoxesFromSky": true
```

Si la caja cae fuera del mapa, reaparece desde arriba. Esto evita que el nivel quede imposible.

## Continuacion

Seguir con `ExplicacionNivel2.md`.
