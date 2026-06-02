# Indice de documentacion de Pala Park

Esta carpeta explica el proyecto para una persona que sabe programar, pero no necesariamente conoce TypeScript, Three.js, Rapier, Vite, Node.js o Socket.IO.

La idea es leer los archivos en orden. Cada archivo explica una parte concreta y termina con una continuacion.

## Orden recomendado

1. `01-ExplicacionGeneralProyecto.md`
2. `02-ExplicacionTecnologias.md`
3. `03-ExplicacionEstructuraCarpetas.md`
4. `04-ExplicacionClienteGameLoop.md`
5. `05-ExplicacionOnlineServidor.md`
6. `06-ExplicacionSistemaNiveles.md`
7. `07-EstructuraProyectoConLinks.md`
8. `ExplicacionNivel1.md`
9. `ExplicacionNivel2.md`
10. `ExplicacionNivel3.md`
11. `ExplicacionNivel4.md`
12. `ExplicacionNivel5.md`
13. `ExplicacionNivel6.md`

## Idea central del proyecto

Pala Park es un juego cooperativo 3D para navegador. El cliente dibuja el mundo, captura input y simula al jugador local. El servidor coordina salas online y reenvia estado entre clientes. Los niveles se definen con JSON y algunos tienen codigo propio cuando necesitan mecanicas especiales.

El proyecto esta armado como monorepo:

- `apps/client`: juego en navegador.
- `apps/server`: servidor Node.js con Socket.IO.
- `packages/shared`: tipos y contratos compartidos entre cliente y servidor.

## Convencion mental para entenderlo

Pensalo asi:

- Three.js muestra cosas.
- Rapier calcula cuerpos fisicos.
- TypeScript da tipos y estructura.
- Socket.IO manda eventos online.
- El JSON de niveles describe el mapa.
- Los `LevelRuntime` agregan comportamiento especial por nivel.

## Continuacion

Seguir con `01-ExplicacionGeneralProyecto.md`.
