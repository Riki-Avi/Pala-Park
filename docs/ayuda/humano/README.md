# Pala Park

Pala Park es un juego cooperativo 3D para navegador, inspirado en juegos tipo Pico Park. La idea es que 4 jugadores resuelvan niveles juntos usando movimiento, saltos, cajas, botones, puertas y cooperacion.

## Estado actual

El proyecto ya tiene un prototipo jugable local.

Incluye:

- Mundo 3D con Three.js.
- Fisica con Rapier.
- 4 jugadores.
- Camara en tercera persona.
- Movimiento con mouse y teclado.
- Cambio de jugador con Tab para probar localmente.
- Cajas empujables.
- Botones que abren puertas.
- Puertas con colision.
- Zonas de meta que requieren a los 4 jugadores.
- Dos niveles iniciales.

## Como jugar ahora

Abrir:

```text
http://localhost:5173
```

Controles:

- Click en el juego: activa el control de mouse.
- Mouse: mirar alrededor.
- WASD: mover jugador activo.
- Espacio: saltar.
- Tab: cambiar entre los 4 jugadores.
- R: reiniciar nivel.
- Slider `Mouse`: ajustar sensibilidad.

## Modo local

Por ahora el juego se prueba en una sola computadora. Como solo hay un teclado y un mouse, se usa `Tab` para cambiar que jugador estas controlando.

Esto es solo para testear. La idea final es que cada persona juegue desde su propio navegador y controle su personaje.

## Jugadores

El juego esta pensado para 4 jugadores fijos:

- Azul.
- Amarillo.
- Verde.
- Violeta.

La meta de los niveles normalmente pide que lleguen los 4.

## Nivel 1: Escalera humana

Objetivo:

```text
Hagan una escalera de 3, bajen la caja y llevenla al boton
```

Idea del nivel:

1. Hay una caja arriba de una plataforma.
2. Tres jugadores tienen que formar una escalera humana.
3. El cuarto jugador sube, llega a la caja y la baja.
4. La caja se empuja hasta el boton.
5. El boton abre la puerta.
6. Los 4 cruzan y llegan a la meta.

## Nivel 2: Parkour a la caja

Este es el nivel en el que el juego arranca actualmente para probar mas rapido.

Objetivo:

```text
Suban por el parkour, hagan escalera, bajen la caja y abran la puerta
```

Idea del nivel:

1. Primero hay que pasar un parkour.
2. Despues se llega a una zona con una plataforma alta.
3. La caja esta arriba.
4. Hay que apilar jugadores para que uno llegue.
5. Se baja la caja.
6. Se lleva al boton.
7. Se abre la puerta.
8. Pasan los 4.

## Detalles importantes

La caja:

- Se puede empujar.
- No es tan resbaladiza.
- Si cae del mapa, reaparece desde el cielo.

Los jugadores:

- Pueden empujarse, pero solo un poco.
- Pueden subirse unos encima de otros.
- Sirven para formar escaleras humanas.

## Tecnologia usada

- TypeScript.
- Three.js.
- Rapier.
- Vite.
- Node.js.
- Socket.IO.

El multiplayer online todavia no esta terminado. Hay una base de servidor, pero el gameplay actual es local.

## Objetivo del proyecto

Construir un juego cooperativo online donde 4 personas tengan que comunicarse y coordinarse para completar puzzles cortos.

El foco no es el realismo grafico, sino que las mecanicas sean claras, divertidas y cooperativas.
