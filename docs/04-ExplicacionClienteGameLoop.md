# Explicacion del cliente y game loop

El cliente es la parte mas grande del proyecto. Corre en el navegador y se encarga de dibujar, mover, simular localmente y mostrar feedback.

## Donde empieza

El punto de entrada es:

```txt
apps/client/src/main.ts
```

Ese archivo:

1. Crea el HTML de la UI.
2. Crea `ClientSocket`.
3. Inicializa Rapier.
4. Carga `levels.json`.
5. Crea `Game`.
6. Conecta la red al juego.
7. Arranca el juego.

## Game.ts

`Game.ts` coordina casi todo.

Responsabilidades principales:

- crear renderer, escena y camara
- crear jugadores
- cargar nivel inicial
- ejecutar fixed update
- procesar input
- avanzar fisica
- llamar al runtime del nivel
- revisar meta y reinicios
- enviar pose online
- renderizar

## Fixed timestep

La fisica se actualiza con paso fijo:

```ts
FIXED_DELTA
```

Esto evita que la simulacion dependa directamente de los FPS. Si una PC renderiza a 144 FPS y otra a 60 FPS, la fisica intenta seguir pasos consistentes.

## Orden simplificado de fixedUpdate

1. Si online todavia no esta jugando, espera.
2. Si se apreta `R`, reinicia.
3. Si local y se apreta `Tab`, cambia jugador.
4. Aplica input al jugador activo.
5. Avanza Rapier.
6. Actualiza grounding.
7. Actualiza el nivel.
8. Actualiza objetivo/meta.
9. Revisa caidas.
10. Envia pose online.

## Movimiento del jugador

`Player.applyInput()` no mueve el mesh visual directamente. Cambia la velocidad del rigid body de Rapier.

Luego `Player.syncMesh()` copia la posicion del cuerpo fisico al mesh de Three.js.

## Camara

`CameraController` recibe jugador, yaw, pitch y delta. En niveles normales usa limites verticales. En nivel 6 se activo un modo especial de orbita completa para mirar 360 grados.

## Input

`InputManager` escucha:

- WASD
- espacio
- E
- click izquierdo
- mouse move
- R
- Tab

El input no decide el nivel. Solo produce intenciones.

## Continuacion

Seguir con `05-ExplicacionOnlineServidor.md`.
