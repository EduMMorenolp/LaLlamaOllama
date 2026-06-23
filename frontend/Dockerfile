# Use Node.js as the base image
FROM node:22-slim AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code and build
COPY . .

# Inyectar variables de entorno para Vite durante el Build
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ARG VITE_BRAIN_API_URL
ARG VITE_ENGINE_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_BRAIN_API_URL=$VITE_BRAIN_API_URL
ENV VITE_ENGINE_URL=$VITE_ENGINE_URL

RUN npm run build

# Use Nginx to serve the build
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Default Vite port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
