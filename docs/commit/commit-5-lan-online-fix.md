# Commit 5: LAN online fix

Este commit arregla el online cuando el juego se abre desde otra computadora de la red local.

## Problema

En `localhost` el juego conectaba bien al servidor, pero al abrirlo desde otra computadora con:

```text
http://192.168.1.50:5173/
```

la pantalla quedaba en:

```text
Modo local
Servidor: detectando...
0 FPS
```

Eso hacia parecer que el servidor online estaba roto, pero el problema ocurria antes de crear la conexion Socket.IO.

## Causa real

El cliente generaba un `clientId` con:

```ts
crypto.randomUUID()
```

Eso funciona bien en `localhost`, porque el navegador lo considera un contexto seguro.

Pero `http://192.168.1.50:5173` no es un contexto seguro si se usa HTTP sin HTTPS. En ese caso algunos navegadores no exponen `crypto.randomUUID()`.

Entonces el cliente fallaba durante el arranque, antes de:

- crear el `ClientSocket`,
- mostrar el servidor detectado,
- iniciar Rapier,
- crear el juego,
- empezar el loop.

## Solucion

`ClientSocket` ahora genera el `clientId` asi:

1. Si existe `globalThis.crypto.randomUUID()`, lo usa.
2. Si no existe, usa un fallback compatible con LAN:

```ts
client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}
```

Esto permite que el juego funcione en red local usando HTTP.

## Diagnostico visible

Tambien se agrego un texto visible en el panel online:

```text
Servidor: http://192.168.1.50:3000
```

Y los mensajes de conexion ahora muestran el destino real:

```text
Servidor conectado: http://192.168.1.50:3000
No se pudo conectar a http://192.168.1.50:3000
```

Esto ayuda a distinguir rapidamente entre:

- cliente apuntando a `localhost`,
- cliente apuntando a la IP correcta,
- servidor caido,
- firewall bloqueando,
- problema del navegador.

## Bootstrap mas claro

El arranque del cliente ahora crea la red antes de inicializar la fisica.

Tambien se agrego un timeout visible para Rapier. Si Rapier tarda demasiado o falla, el HUD muestra un mensaje claro en vez de quedarse mudo.

## Suavizado de jugadores remotos

Este commit tambien incluye el primer pulido de movimiento remoto:

- las poses online se mandan a 30 Hz en vez de 20 Hz,
- el buffer remoto guarda mas poses,
- el delay de interpolacion baja un poco,
- los jugadores remotos absorben la pose con suavizado en vez de teletransportarse seco,
- si la diferencia es grande, se corrige de golpe para no dejar jugadores atrasados.

Esto apunta a que en otra computadora el movimiento se vea menos aspero.

## Archivos principales

- `apps/client/src/network/ClientSocket.ts`
- `apps/client/src/main.ts`
- `apps/client/src/styles.css`
- `apps/client/src/network/OnlineSessionController.ts`
- `apps/client/src/network/RemotePoseBuffer.ts`
- `apps/client/src/network/RemotePlayerInterpolator.ts`
- `apps/client/src/entities/Player.ts`

## Verificacion

Se verifico:

- crear sala local,
- crear y unir dos clientes Socket.IO simulados,
- abrir el cliente desde `http://192.168.1.50:5173/`,
- ver `60 FPS`,
- ver `Servidor conectado: http://192.168.1.50:3000`,
- `npm run typecheck`,
- `npm run build`.

## Siguiente paso recomendado

El siguiente avance grande deberia ser sincronizar estado del nivel online:

- caja,
- boton,
- puerta,
- meta,
- reset por caida.

Ahora los jugadores ya conectan por LAN, pero la logica del nivel todavia vive demasiado en cada cliente.
