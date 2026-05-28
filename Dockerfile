FROM node:20-alpine

WORKDIR /app

# Copiar archivos de dependencias del monorepo
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/
COPY packages/shared/package*.json ./packages/shared/

# Instalar todas las dependencias usando npm ci
RUN npm ci

# Copiar el código fuente completo
COPY . .

# Exponer el puerto de conexión
EXPOSE 3001

# Variables de entorno por defecto
ENV PORT=3001
ENV NODE_ENV=production

# Arrancar el servidor
CMD ["npm", "run", "dev:server"]
