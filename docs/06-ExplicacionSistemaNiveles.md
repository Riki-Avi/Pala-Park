# Explicacion del sistema de niveles

Los niveles combinan datos JSON con codigo TypeScript.

## JSON de nivel

Cada nivel JSON tiene esta forma general:

```json
{
  "id": "level-01",
  "name": "Nombre",
  "objective": "Texto objetivo",
  "rules": {},
  "spawnPoints": [],
  "platforms": [],
  "boxes": [],
  "buttons": [],
  "doors": [],
  "goalZones": []
}
```

El tipo exacto esta en:

```txt
packages/shared/src/types/level.ts
```

## LevelController

`LevelController` carga un JSON y decide que runtime usar.

Ejemplo:

- `level-01` usa `LevelRuntime`
- `level-03` usa `Level03Runtime`
- `level-04` usa `Level04Runtime`
- `level-05` usa `Level05Runtime`
- `level-06` usa `Level06Runtime`

## LevelRuntime base

`LevelRuntime` crea:

- plataformas
- cajas
- botones
- puertas
- metas

Tambien sabe:

- actualizar botones
- abrir puertas normales
- sincronizar cajas
- resetear objetos dinamicos
- generar `LevelStatePayload`
- aplicar `LevelStatePayload`

## Runtimes especiales

Cuando un nivel necesita mecanica propia, se crea una clase nueva.

Ejemplos:

- Nivel 4: llave y cuerda visual estable.
- Nivel 5: naves, lasers, torretas, escudos.
- Nivel 6: telarana libre con puntero y camara 360.

Esto es importante porque evita ensuciar el runtime base o afectar niveles anteriores.

## Reglas de nivel

Cada nivel tiene:

- `resetOnAnyPlayerFall`: si un jugador cae, se reinicia.
- `respawnBoxesFromSky`: si una caja cae, reaparece desde arriba.
- `autoAdvanceOnComplete`: al completar meta, avanza al siguiente nivel.

## Meta

La meta se define con `goalZones`.

`requiredPlayers` puede ser:

- un numero
- `"all"`

Actualmente algunos niveles piden 2 jugadores para facilitar testeo, y otros piden 4.

## Continuacion

Seguir con `ExplicacionNivel1.md`.
