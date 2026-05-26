# Memoria tecnica para futuras sesiones de IA

Este documento resume el estado actual de Pala Park para que otra sesion de IA pueda retomar el proyecto sin reconstruir todo desde cero.

## Contexto general

Pala Park es un juego cooperativo 3D web inspirado en Pico Park. El objetivo tecnico es construir una base con:

- Three.js para render 3D.
- Rapier para fisica.
- TypeScript.
- Vite para cliente.
- Node.js + Socket.IO como base futura de multiplayer.
- Monorepo con cliente, servidor y paquete compartido.

El juego esta pensado para 4 jugadores fijos.

## Estructura actual

```text
apps/client
apps/server
packages/shared
docs/ayuda/ia
docs/ayuda/humano
```

Archivos importantes:

- `apps/client/src/core/Game.ts`: orquesta loop principal, input, fisica, render y delega reglas/online/niveles.
- `apps/client/src/core/GameRulesController.ts`: reglas reutilizables de grounded, empuje suave, caidas y meta.
- `apps/client/src/entities/Player.ts`: jugador fisico, input, salto, coyote time y jump buffer.
- `apps/client/src/entities/PushBox.ts`: caja empujable fisica.
- `apps/client/src/entities/Button.ts`: boton que detecta jugadores/cajas.
- `apps/client/src/entities/Door.ts`: puerta con collider removible al abrirse.
- `apps/client/src/entities/GoalZone.ts`: zona de meta que requiere jugadores.
- `apps/client/src/levels/LevelRuntime.ts`: carga/descarga plataformas, cajas, botones, puertas y metas.
- `apps/client/src/levels/LevelController.ts`: administra nivel actual, cambio de nivel y runtime activo.
- `apps/client/src/levels/level-01.ts`: nivel tutorial de escalera humana.
- `apps/client/src/levels/level-02.ts`: nivel actual de parkour + escalera humana.
- `apps/client/src/input/InputManager.ts`: teclado, mouse look, sensibilidad, reset y cambio de jugador.
- `apps/client/src/network/OnlineSessionController.ts`: sesion online, poses, interpolacion remota y reset online.
- `packages/shared/src/types/level.ts`: contrato declarativo de niveles.

## Estado actual del juego

El juego arranca directamente en el nivel 2 para testear rapido:

```ts
private currentLevelIndex = 1;
```

Esto ahora se define al crear `LevelController` en `apps/client/src/core/Game.ts`.

Para volver a empezar en el nivel 1, cambiarlo a:

```ts
private currentLevelIndex = 0;
```

## Controles actuales

- Click en el canvas: captura mouse.
- Mouse: controla camara.
- WASD: mueve el jugador activo.
- Espacio: salto.
- Tab: cambia entre los 4 jugadores.
- R: reinicia nivel.
- Slider `Mouse`: sensibilidad.

En modo local solo se controla un jugador a la vez. Esto es una herramienta de prueba. En multiplayer real, cada jugador tendra su propia camara y controlara solo su personaje.

## Jugadores

Hay 4 jugadores fijos:

- Azul.
- Amarillo.
- Verde.
- Violeta.

Se crean en `Game.createPlayers()` con colores:

```ts
["#62a8ff", "#ffcf5c", "#69d38f", "#d96cff"]
```

## Movimiento y fisica del jugador

El jugador usa cuerpo dinamico de Rapier con rotaciones bloqueadas.

Detalles actuales:

- Movimiento relativo a camara para el jugador activo.
- Coyote time.
- Jump buffer.
- Control aereo suavizado.
- Friccion del jugador en 0 para evitar quedarse pegado a paredes.
- Se agrego amortiguacion entre jugadores en `Game.dampenPlayerPush()` para que puedan empujarse un poco, pero no salgan disparados.

Importante: no volver a anclar jugadores inactivos ni hacerlos artificialmente pesados. El usuario pidio que los jugadores se puedan empujar, pero poquito, de forma general.

## Camara

La camara es tercera persona y sigue al jugador activo.

No se quieren por ahora:

- Colision de camara contra paredes.
- Zoom con rueda.
- Primera persona.

Si hace falta tocar camara, mantenerla simple.

El usuario pidio poder mirar mas hacia arriba. El limite vertical actual esta en:

```ts
this.pitch = Math.max(-1.2, Math.min(0.85, this.pitch));
```

Archivo: `apps/client/src/input/InputManager.ts`.

## Cajas

`PushBox` representa cajas fisicas.

Valores actuales:

```ts
setDensity(0.45)
setFriction(0.6)
```

La caja es suficientemente liviana para que un solo jugador pueda empujarla en modo local. Esto fue decidido porque todavia no hay multiplayer online real.

Si la caja cae por debajo de `y < -8`, reaparece desde el cielo sobre su posicion inicial.

## Botones y puertas

Los botones se activan con:

- Jugadores.
- Cajas.

`LevelRuntime.update()` combina posiciones de jugadores y cajas:

```ts
const weightPositions = [...playerPositions, ...this.boxes.map((box) => box.getPosition())];
```

Las puertas se abren si algun boton que las referencia esta presionado.

Cuando una puerta se abre:

- Cambia material.
- Sube visualmente.
- Remueve collider.

Cuando se cierra:

- Recrea collider.

## Grounded

`Game.hasGroundBelow()` considera como superficie:

- Plataformas.
- Botones.
- Cajas.
- Otros jugadores.

Esto se agrego para permitir escalera humana. Si se cambia, cuidar que no rompa la mecanica de apilar jugadores.

## Nivel 1

Archivo: `apps/client/src/levels/level-01.ts`.

Nombre:

```text
Escalera humana
```

Objetivo:

```text
Hagan una escalera de 3, bajen la caja y llevenla al boton
```

Idea:

- Caja arriba de una repisa.
- Jugadores forman escalera humana.
- Un jugador baja la caja.
- Caja va al boton.
- Puerta se abre.
- Pasan los 4 a la meta.

## Nivel 2

Archivo: `apps/client/src/levels/level-02.ts`.

Nombre:

```text
Parkour a la caja
```

Objetivo:

```text
Suban por el parkour, hagan escalera, bajen la caja y abran la puerta
```

Estado actual:

- El juego empieza aqui.
- Hay parkour para llegar a la zona alta.
- La plataforma de la caja esta alta para requerir al menos varios jugadores apilados.
- La caja esta sobre esa plataforma.
- Luego hay que bajarla, llevarla al boton, abrir la puerta y pasar los 4.

Alturas actuales relevantes:

```ts
box-shelf y: 5.85
box-02 y: 6.75
parkour-03 y: 2.1
```

## Servidor

Incluye:

- `ServerGameLoop` con acumulador.
- `RoomManager`.
- `GameRoom`.
- Socket.IO basico para crear/unirse a sala.
- Eventos online simples para poses de jugadores y reset global.

El online actual es una primera version pragmatica:

- Crear sala.
- Unirse con codigo.
- Asignar `p1`, `p2`, `p3`, `p4`.
- Enviar/recibir poses de jugadores.
- Reset global si alguien cae o presiona `R`.

No asumir que ya existe servidor autoritativo completo. La fisica de caja/boton/puerta todavia no es oficial en servidor.

## Comandos

Instalar:

```bash
npm install
```

Desarrollo:

```bash
npm run dev:server
npm run dev
```

Cliente:

```text
http://localhost:5173
```

Verificar:

```bash
npm run typecheck
npm run build
```

Nota: en este entorno, algunos builds de Vite pueden necesitar permisos escalados por resolucion de rutas del workspace.

## Preferencias del usuario

El usuario prefiere iterar jugando y ajustando sensaciones.

Preferencias expresadas:

- Juego pensado siempre para 4 jugadores.
- Camara tercera persona simple.
- Sin zoom.
- Sin modo primera persona.
- Sin colision de camara por ahora.
- Sensibilidad configurable si.
- Caja debe respawnear si cae.
- Jugadores deben empujarse solo un poco, no demasiado.
- No usar trucos donde jugadores inactivos queden anclados.
- En local puede usarse Tab para cambiar jugador, pero la fisica debe representar lo que se quiere para el juego completo.

## Recordatorio de clean code

El usuario pregunto si el proyecto esta siguiendo clean code y buenas practicas. Respuesta honesta: si, para un prototipo que crece, pero todavia no es arquitectura final de produccion.

Recordar esto en futuras sesiones:

- Mantener `Game.ts` como orquestador, no dejar que vuelva a ser un archivo gigante.
- Cada vez que se agreguen 2 o 3 features, hacer una pasada corta de limpieza.
- Priorizar modulos chicos con responsabilidades claras.
- Evitar hacks temporales que contradigan el gameplay final.
- Si una solucion es solo para modo local/debug, nombrarla explicitamente como tal.
- Mantener contratos compartidos en `packages/shared`.
- No duplicar constantes de gameplay entre cliente y servidor.
- Correr `npm run typecheck` y `npm run build` antes de cerrar cambios importantes.

## Regla clave: independencia de niveles

El usuario pidio explicitamente que cada nivel se pueda crear y luego dejar estable: un cambio futuro en `level-10` no deberia afectar a `level-2`.

Mantener esta regla como prioridad:

- No hardcodear comportamiento por `levelId` dentro de `Game.ts`.
- Las diferencias entre niveles deben vivir en la definicion del nivel o en sistemas reutilizables.
- Si un nivel necesita una regla especial, primero intentar expresarla en `LevelDefinition.rules`.
- Si una regla es demasiado especifica, encapsularla como sistema/modulo de nivel, no mezclarla con el loop central.
- Evitar cambiar entidades compartidas de forma que rompa niveles existentes sin revisar impacto.

La estructura actual empieza a soportar esto:

- `LevelDefinition.rules` declara reglas del nivel.
- `LevelController` carga, cambia y resetea niveles desde definiciones.
- `LevelRuntime` instancia entidades reutilizables desde datos declarativos.

Estado actual del refactor:

- `Game.ts` bajo aproximadamente de 424 a 269 lineas.
- `LevelController` ya existe.
- `OnlineSessionController` ya existe.
- `GameRulesController` ya existe.
- La interpolacion remota vive fuera de `Game.ts`.

Deuda tecnica/refactors a ir atacando mientras avanza el proyecto:

1. Crear `PlayerController` para input local/remoto y control de jugadores.
2. Crear `HudController` para textos de objetivo, FPS, sala y estado.
3. Crear una capa mas clara para modo `local` vs modo `online`.
4. Convertir `GameRulesController` en sistemas mas pequenos si crece demasiado.
5. Mejorar interpolacion de jugadores remotos con timestamps del servidor.
6. Crear snapshots mas formales para jugadores/cajas/puertas/botones.
7. Preparar una simulacion autoritativa en servidor para caja, boton y puerta.
8. Agregar tests unitarios para:
   - generador de codigos de sala,
   - RoomManager,
   - reglas de reset,
   - reglas de meta.
9. Centralizar configuracion de gameplay:
   - nivel inicial,
   - cantidad de jugadores,
   - frecuencia de envio de poses,
   - limites de caida,
   - constantes de movimiento.
10. Documentar cada feature grande en `docs/commit`.

## Siguiente trabajo probable

Buenas siguientes tareas:

1. Agregar interpolacion de jugadores remotos para que el online no se vea aspero.
2. Ajustar dificultad real de la escalera humana en nivel 2 tras testear.
3. Definir mejor la separacion local/online.
4. Empezar a mover caja/boton/puerta hacia autoridad de servidor.
5. Agregar tests pequenos en servidor.
