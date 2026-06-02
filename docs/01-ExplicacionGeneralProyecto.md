# Explicacion general del proyecto

Pala Park es un juego cooperativo 3D inspirado en puzzles de plataformas. La experiencia principal es que varios jugadores tienen que colaborar para superar obstaculos: empujar cajas, pisar botones, abrir puertas, llegar a metas, usar mecanicas especiales y coordinar movimientos.

## Que tipo de aplicacion es

Es una aplicacion web con dos partes:

- Un cliente que corre en el navegador.
- Un servidor que corre en Node.js.

El cliente muestra el juego con Three.js, calcula fisica con Rapier y escucha teclado/mouse. El servidor maneja salas online, jugadores conectados, cambios de nivel, reinicios y eventos sincronizados.

## Regla principal

El proyecto intenta separar responsabilidades:

- `Game.ts` coordina el loop principal.
- `Player.ts` representa al jugador fisico y visual.
- `LevelRuntime.ts` representa el comportamiento base de un nivel.
- `Level03Runtime.ts`, `Level04Runtime.ts`, `Level05Runtime.ts` y `Level06Runtime.ts` agregan mecanicas especiales solo para esos niveles.
- `OnlineSessionController.ts` maneja el estado online en el cliente.
- `apps/server/src/index.ts` recibe y emite eventos Socket.IO.

La regla importante es que un cambio en un nivel no deberia romper los demas. Por eso las mecanicas especificas se ponen en un runtime separado por nivel.

## Flujo general cuando se abre el juego

1. `main.ts` crea la interfaz HTML basica.
2. Se inicializa Rapier.
3. Se leen los archivos de niveles desde `public/levels/levels.json`.
4. Se crea una instancia de `Game`.
5. `Game.start()` carga el nivel inicial.
6. Empieza el loop de juego.

## Flujo general en cada frame

1. Se acumula tiempo real.
2. Se ejecutan pasos fisicos fijos.
3. Se procesa input del jugador activo.
4. Rapier avanza la fisica.
5. El nivel actual actualiza reglas propias.
6. Se revisan metas, caidas y reinicios.
7. Se sincronizan meshes de Three.js con cuerpos fisicos.
8. La camara se actualiza.
9. Three.js renderiza la escena.

## Por que hay niveles JSON y runtimes

El JSON describe cosas estaticas o configurables:

- plataformas
- cajas
- botones
- puertas
- metas
- posiciones iniciales
- reglas basicas

El runtime describe comportamiento:

- llave del nivel 4
- batalla espacial del nivel 5
- telaranas del nivel 6

Asi se evita meter toda la logica en `Game.ts`.

## Continuacion

Seguir con `02-ExplicacionTecnologias.md`.
