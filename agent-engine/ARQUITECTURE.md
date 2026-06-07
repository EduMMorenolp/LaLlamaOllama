# Arquitectura — Agent Engine

```
                    ┌─────────────────────────────────────┐
                    │           index.ts (entry)           │
                    │  validateEnv → loadConfig → Brain    │
                    │  → registerAllTools → start          │
                    └──────────┬──────────────────────────┘
                               │
              ┌────────────────┼────────────────────┐
              │                │                    │
       ┌──────▼──────┐  ┌─────▼──────┐  ┌─────────▼──────────┐
       │  server/    │  │ services/  │  │     gateway/       │
       │  api.ts     │  │ agent/     │  │     protocol.ts    │
       │  ws.ts      │  │   runAgent │  │     (types)        │
       │  handlers.ts│  │   createCli│  └────────────────────┘
       │  cron.ts    │  │   buildProm│
       └─────────────┘  │ tools/     │
                        │   registry │
                        │   bash     │
                        │   read/writ│
                        │   glob/grep│
                        │   read-url │
                        │   delegate │
                        │   memory-to│
                        │ brain/     │
                        │   client   │
                        │ db/        │
                        │   connectio│
                        │   users   │
                        │   experts │
                        │   messages│
                        │   chats   │
                        │   models  │
                        │   runs    │
                        │ telegram/ │
                        │   bot     │
                        │   commands│
                        │   callback│
                        │ knowledge/│
                        │   index   │
                        │ session/  │
                        │ config/   │
                        └───────────┘
```

## Flujo de mensaje

```
1. WebSocket recibe "user_message"
2. handlers.ts → handleUserMessage(chatId, text, clientId)
3. runAgent.ts → runAgentCore() (core loop)
4. buildPrompt.ts → system prompt mínimo
5. OpenAI SDK → modelo configurado
6. Tool calls → registradas en toolRegistry
7. Sesión guardada en Map<chatId, SessionState>
8. Mensajes persistidos en SQLite
9. Respuesta streaming via WebSocket
```

## Capas

### `server/` — Transporte
- `ws.ts`: servidor WebSocket con gestión de clientes
- `handlers.ts`: 20+ tipos de mensaje WS
- `api.ts`: REST endpoints de health, tools, runs, knowledge
- `cron.ts`: cleanup periódico de sesiones viejas

### `services/` — Lógica de negocio
- `agent/`: core loop, client creation, prompt building
- `tools/`: ToolRegistry singleton, 8 herramientas
- `brain/`: BrainClient para comunicación con MCP Brain
- `db/`: SQLite con 7 tablas operacionales
- `telegram/`: Bot de Telegram (start/stop, comandos, callbacks)
- `knowledge/`: chunking e indexación de documentos
- `sessions/`: gestión de sesiones en memoria
- `config/`: carga de variables de entorno

### `gateway/` — Protocolo
- `protocol.ts`: tipos de mensaje WS (28 tipos)

## Base de datos

SQLite local (`agent-engine.db`) con tablas:
- `users` — perfiles de usuario
- `sub_agents` — agentes expertos configurables
- `chats` — conversaciones persistidas
- `messages` — historial de mensajes
- `runs` — ejecuciones del agente
- `run_events` — eventos de ejecución
- `models` — proveedores de modelos guardados
