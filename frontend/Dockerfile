# Etapa 1: Construcción (Build)
FROM node:20-alpine AS build-step

WORKDIR /app

# Instalar dependencias
COPY package.json package-lock.json ./
RUN npm install

# Copiar código fuente y construir
COPY . .
RUN npm run build -- --configuration production

# Etapa 2: Servidor de Producción (Nginx)
FROM nginx:stable-alpine

# Copiar los archivos construidos desde la etapa anterior
# Nota: Ajusta 'frontend/browser' si el path de salida de Angular es diferente
COPY --from=build-step /app/dist/frontend/browser /usr/share/nginx/html

# Copiar configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer puerto 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
