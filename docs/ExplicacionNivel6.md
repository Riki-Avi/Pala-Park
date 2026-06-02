# Explicacion Nivel 6 - Telaranas en Altura

Archivo:

```txt
apps/client/public/levels/level-06.json
```

Runtime:

```txt
apps/client/src/levels/Level06Runtime.ts
```

Este nivel agrega una mecanica de telarana o gancho.

## Objetivo jugable

El grupo debe subir a zonas altas usando la telarana, empujar cajas de arriba, presionar un boton y cruzar una puerta.

Flujo esperado:

1. Los jugadores empiezan abajo.
2. Apuntan con la mira.
3. Mantienen `E` o click para tirar telarana.
4. La telarana se pega a una superficie visible.
5. El jugador es atraido hacia ese punto.
6. Arriba hay cajas.
7. Una caja debe presionar el boton.
8. El boton abre la puerta.
9. La meta pide 2 jugadores.

## Camara especial

Solo en este nivel, la camara permite mirar en 360 grados.

Esto esta activado desde `Game.ts`:

```ts
const isSpiderWebLevel = this.level.definition.id === "level-06";
```

Si el nivel actual es `level-06`, `InputManager` deja de limitar el pitch y `CameraController` usa modo `fullOrbit`.

Los demas niveles mantienen el comportamiento de camara normal.

## Como funciona la telarana

La telarana no usa cuerda fisica real. Eso es intencional.

El runtime:

1. Calcula un origen cerca del cuerpo del jugador.
2. Calcula la direccion de la mira usando yaw y pitch.
3. Usa un raycast de Three.js contra objetos visibles del nivel.
4. Si encuentra una superficie dentro del rango, guarda ese punto.
5. Aplica una velocidad suave hacia el punto.
6. Dibuja una linea desde el cuerpo hasta el punto pegado.

La telarana sale del cuerpo del jugador, pero apunta a donde mira el puntero.

## Por que no hay puntos fijos

La primera version tenia anclajes fijos. Despues se cambio para que el jugador pueda engancharse a cualquier superficie visible dentro del rango.

Esto permite un gameplay mas libre.

## Online

Para que otras pantallas entiendan hacia donde apunta un jugador, `PlayerPose` manda:

- yaw
- pitch
- accion activa

Con eso los clientes pueden dibujar la telarana de otros jugadores sin inventar un punto vertical arriba.

## Riesgos al modificar

Si la telarana queda muy fuerte, el jugador puede salir disparado. Si queda muy debil, no llega a las plataformas.

Valores importantes:

- `WEB_RANGE`
- `WEB_RELEASE_DISTANCE`
- `WEB_MAX_SPEED`
- `POINTER_DISTANCE`

Todos viven en `Level06Runtime.ts`.

## Continuacion

Volver a `00-IndiceDocumentacion.md` para elegir otro tema.
