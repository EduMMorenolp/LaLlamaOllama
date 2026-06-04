FROM node:22-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ARG VITE_ENGINE_URL
ENV VITE_ENGINE_URL=$VITE_ENGINE_URL

RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
