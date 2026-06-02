# Explicacion online y servidor

El online usa Socket.IO. El servidor no renderiza y no tiene Three.js. Su trabajo principal es coordinar salas y reenviar informacion entre clientes.

## Puerto

El servidor corre por defecto en:

```txt
localhost:3001
```

El cliente se conecta a ese servidor usando `ClientSocket`.

## Eventos principales

Cliente a servidor:

- `createRoom`
- `joinRoom`
- `playerPose`
- `levelState`
- `goalProgress`
- `resetLevel`
- `requestLevelChange`
- `requestStartGame`

Servidor a cliente:

- `roomCreated`
- `roomJoined`
- `playerJoined`
- `playerLeft`
- `roomState`
- `gameStarted`
- `playerPose`
- `levelState`
- `goalProgress`
- `levelReset`
- `levelChanged`
- `errorMessage`

## GameRoom

`GameRoom` representa una sala online.

Guarda:

- codigo de sala
- jugadores
- client ids
- host
- estado de sala
- nivel actual
- ultimo estado de nivel
- ultimo progreso de meta

El host inicial es `p1`. Si se desconecta, el server puede elegir otro host conectado.

## Jugadores y clientId

El cliente crea un `clientId` en localStorage. Eso sirve para evitar que la misma pestaña o navegador se una varias veces como jugadores distintos en la misma sala.

En modo privado, el localStorage es diferente. Por eso una ventana normal y una privada pueden representar dos jugadores distintos.

## playerPose

`playerPose` es la pose del jugador local:

- id
- posicion
- velocidad
- yaw
- pitch
- accion activa

El pitch se agrego para que mecanicas como la telarana del nivel 6 puedan verse bien en otras pantallas.

## Estado de nivel

El host envia `levelState`. Contiene:

- cajas
- botones
- puertas
- estado custom de nivel si existe

Los clientes no-host aplican ese estado para ver el mundo sincronizado.

## Cambio de nivel

El host puede pedir `requestLevelChange`. El servidor valida que sea el host y emite `levelChanged` a todos.

En el cliente, la carga de nivel tiene protecciones para evitar que una carga vieja pise una nueva.

## Continuacion

Seguir con `06-ExplicacionSistemaNiveles.md`.
