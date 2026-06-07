# Stage 1: Build (with full toolchain for native modules like better-sqlite3)
FROM node:20-bookworm AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build

# Stage 2: Runtime (slim, only compiled artifacts)
FROM node:20-slim

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./

EXPOSE 3020

CMD ["npm", "start"]
