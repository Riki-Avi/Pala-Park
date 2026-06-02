# Explicacion de tecnologias

Este proyecto usa varias tecnologias juntas. No hace falta conocerlas a fondo para leer el codigo, pero si conviene entender que responsabilidad tiene cada una.

## TypeScript

TypeScript es JavaScript con tipos. El codigo termina corriendo como JavaScript, pero durante desarrollo TypeScript ayuda a detectar errores.

Ejemplo conceptual:

```ts
interface Vec3 {
  x: number;
  y: number;
  z: number;
}
```

Eso significa que un objeto `Vec3` debe tener numeros `x`, `y` y `z`.

En este proyecto los tipos compartidos viven en `packages/shared/src/types`.

## Three.js

Three.js dibuja el mundo 3D.

Ejemplos de cosas que maneja:

- camara
- luces
- mallas visuales
- colores
- lineas de telarana
- naves del nivel 5
- puertas, cajas, plataformas y metas visibles

Three.js no deberia decidir la realidad del juego. Solo muestra lo que dice la simulacion.

## Rapier

Rapier es el motor de fisica.

Ejemplos de cosas que maneja:

- gravedad
- cuerpos rigidos
- colisiones
- cajas empujables
- plataformas fisicas
- velocidad de jugadores

En el codigo, el cuerpo fisico suele ser mas importante que el mesh visual. El mesh copia la posicion del cuerpo fisico.

## Vite

Vite levanta el cliente en desarrollo.

Comando:

```bash
npm run dev:client
```

Normalmente expone:

- `http://localhost:5173`
- una URL LAN para otra computadora de la red

## Node.js

Node.js corre el servidor.

Comando:

```bash
npm run dev:server
```

Por defecto usa el puerto `3001`.

## Socket.IO

Socket.IO permite comunicacion en tiempo real entre navegadores y servidor.

En este proyecto se usa para:

- crear sala
- unirse a sala
- enviar pose del jugador
- reenviar estado de nivel
- reiniciar nivel
- cambiar nivel
- avisar progreso de meta

## Workspaces

El proyecto usa workspaces de npm. Eso permite tener varios paquetes en el mismo repo:

- cliente
- servidor
- shared

El cliente y el servidor importan tipos desde `@game/shared`.

## Continuacion

Seguir con `03-ExplicacionEstructuraCarpetas.md`.
