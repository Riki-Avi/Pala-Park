# Commit 4-2: limpieza de arquitectura

Este commit ordena el codigo del cliente para que el proyecto pueda seguir creciendo sin convertir `Game.ts` en un archivo gigante.

La idea principal fue separar responsabilidades:

- `Game.ts` queda como orquestador del juego.
- `LevelController` administra la carga, reinicio y avance de niveles.
- `GameRulesController` concentra reglas de gameplay compartidas.
- `OnlineSessionController` concentra la sesion online del cliente.
- Cada nivel declara sus propias reglas en su `LevelDefinition`.

## Por que se hizo

El usuario marco dos preocupaciones importantes:

1. `Game.ts` estaba creciendo demasiado.
2. Cada nivel debe poder quedar cerrado, para que un cambio futuro en el nivel 10 no rompa el nivel 2.

Antes, `Game.ts` tenia demasiadas responsabilidades juntas:

- loop principal,
- input,
- fisica,
- camara,
- reglas de caida,
- meta,
- avance de nivel,
- online,
- interpolacion remota,
- reset,
- carga de niveles.

Eso funcionaba para prototipo, pero era peligroso para seguir agregando mecanicas.

## Cambios principales

### Game.ts mas chico

`apps/client/src/core/Game.ts` bajo a 269 lineas.

Ahora se encarga principalmente de:

- crear renderer, escena, camara, input y fisica,
- ejecutar el fixed update,
- pasar datos a los controllers,
- sincronizar meshes con cuerpos fisicos,
- actualizar HUD basico,
- coordinar el flujo general.

Ya no contiene directamente toda la logica de reglas, online y carga de niveles.

### LevelController

Archivo nuevo:

`apps/client/src/levels/LevelController.ts`

Responsabilidades:

- mantener el `LevelRuntime` actual,
- cargar un nivel por indice,
- cargar el siguiente nivel,
- reiniciar objetos dinamicos,
- destruir correctamente el runtime anterior.

Esto prepara el proyecto para que los niveles sean mas independientes.

### GameRulesController

Archivo nuevo:

`apps/client/src/core/GameRulesController.ts`

Responsabilidades:

- detectar si los jugadores estan grounded,
- reducir empujes excesivos entre jugadores,
- recuperar o reiniciar si alguien cae,
- evaluar la meta,
- decidir si debe avanzar el nivel,
- calcular posiciones de jugadores para reglas.

Esto saca reglas de gameplay de `Game.ts` y las deja en un modulo mas facil de testear y cambiar.

### OnlineSessionController

Archivo nuevo:

`apps/client/src/network/OnlineSessionController.ts`

Responsabilidades:

- manejar la sesion online del cliente,
- guardar `playerId` y lista de jugadores,
- procesar eventos de reset online,
- enviar poses cada 3 ticks,
- aplicar interpolacion a jugadores remotos,
- evitar resets duplicados mientras ya hay uno pendiente.

Esto separa el online del loop principal y deja preparado el camino para mejorar multiplayer sin ensuciar el juego local.

### Reglas por nivel

`packages/shared/src/types/level.ts` ahora incluye reglas declarativas por nivel:

```ts
rules: {
  resetOnAnyPlayerFall: boolean;
  respawnBoxesFromSky: boolean;
  autoAdvanceOnComplete: boolean;
}
```

Los niveles actualizados:

- `apps/client/src/levels/level-01.ts`
- `apps/client/src/levels/level-02.ts`

Cada nivel ahora define como se comporta ante caidas, cajas y avance de nivel.

Esto es importante porque evita que una regla global escondida en `Game.ts` afecte accidentalmente a todos los niveles futuros.

## Estado del gameplay despues del commit

Se conserva lo que ya funcionaba:

- 4 jugadores.
- Control con mouse y WASD.
- Seleccion de jugador local con Tab.
- Online basico con salas.
- Interpolacion de jugadores remotos.
- Reset global con R en online.
- Reset si un jugador cae.
- Caja que puede reaparecer desde arriba.
- Nivel 1 online.
- Nivel 2 local de prueba para parkour y escalera humana.

## Verificacion

Antes de commitear se verifico:

- `npm run typecheck`
- `npm run build`
- carga del juego en navegador local con Vite

El juego cargo correctamente y no aparecieron errores visibles en consola durante la prueba.

## Siguiente paso recomendado

Despues de este commit conviene avanzar con uno de estos caminos:

1. Mejorar la suavidad online para jugadores remotos.
2. Empezar a convertir el servidor en mas autoritativo.
3. Crear un sistema formal de objetivos/progreso por nivel.
4. Seguir separando `Game.ts` si vuelve a crecer.

La prioridad tecnica recomendada es mejorar la suavidad online, porque el jugador local ya se siente bien pero los jugadores vistos desde otra computadora todavia pueden sentirse asperos.
