# Explicacion Nivel 5 - Batalla Espacial en Equipo

Archivo:

```txt
apps/client/public/levels/level-05.json
```

Runtime:

```txt
apps/client/src/levels/Level05Runtime.ts
```

Este nivel cambia mucho la jugabilidad. Los jugadores dejan de comportarse como personajes normales y pasan a moverse como naves.

## Objetivo jugable

El grupo debe avanzar por un tunel con obstaculos, lasers y torretas.

Roles:

- jugadores 1 y 2: atacantes
- jugadores 3 y 4: defensores

Los atacantes disparan. Los defensores usan escudo.

## Que hace el runtime

`Level05Runtime`:

- desactiva gravedad de jugadores
- oculta partes del personaje normal
- agrega una nave visual a cada jugador
- crea bloques destructibles
- crea barreras laser
- crea torretas enemigas
- crea proyectiles de jugadores
- crea proyectiles enemigos
- maneja escudos
- pide reset si alguien toca un peligro

## Por que no esta en LevelRuntime

Porque es una mecanica completamente distinta:

- movimiento flotante
- disparos
- escudos
- proyectiles
- enemigos
- estado custom online

Meter eso en `Game.ts` o `LevelRuntime.ts` ensuciaria todos los niveles.

## Estado online

El nivel 5 envia estado custom:

- bloques
- torretas
- barreras
- lasers de jugador
- proyectiles enemigos

Los clientes no-host aplican ese estado para ver la misma batalla.

## Detalle importante de red

`PlayerPose` incluye:

- `isActionActive`
- `yaw`
- `pitch`

`isActionActive` permite saber si alguien esta disparando o usando escudo. Se agrego cuidado especial para que esa accion no se pierda en interpolacion.

## Continuacion

Seguir con `ExplicacionNivel6.md`.
