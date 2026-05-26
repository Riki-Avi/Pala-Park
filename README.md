# Pala Park

Juego cooperativo 3D inspirado en Pico Park, construido con Three.js, TypeScript, Rapier, Node.js y Socket.IO.

## Scripts

```bash
npm install
npm run dev:server
npm run dev
```

Cliente local: `http://localhost:5173`

Para probar desde otra computadora en la misma red, abrir la URL de red que muestra Vite, por ejemplo `http://192.168.x.x:5173`. El cliente intenta conectarse automaticamente al servidor en el mismo host, puerto `3000`.

## Controles

Jugador 1: `WASD`, `Espacio`

Jugador 2: `Flechas`, `Shift derecho` o `Enter`

## Estructura

- `apps/client`: juego en navegador.
- `apps/server`: base del servidor online.
- `packages/shared`: tipos, constantes y contratos compartidos.
