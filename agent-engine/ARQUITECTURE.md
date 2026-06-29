# Arquitectura — Agent Engine

```
                    ┌─────────────────────────────────────────────┐
                    │           index.ts (entry)                  │
                    │  validateEnv → loadConfig → Brain           │
                    │  → registerAllTools → start                 │
                    └─────────────────────┬───────────────────────┘
                                          │
              ┌───────────────────────────┼───────────────────────────┐
              │                           │                           │
       ┌──────┴──────┐            ┌───────┴────────┐          ┌──────┴──────┐
       │  server/    │            │  services/     │          │  gateway/   │
       │  api.ts     │            │  agent/        │          │ protocol.ts │
       │  ws.ts      │            │   runAgentCore │          │ (types)     │
       │  handlers.ts│            │   createClient │          └─────────────┘
       │  cron.ts    │            │   buildPrompt  │
       └─────────────┘            │   sessionSumm. │
                                  │  tools/        │
                                  │   registry     │
                                  │   bash         │
                                  │   read/write   │
                                  │   glob/grep    │
                                  │   read-url     │
                                  │   skills-tools │
                                  │   task-tools   │
                                  │   (37+ total)  │
                                  │  skills/       │
                                  │   skillsService│
                                  │   CRUD         │
                                  │  brain/        │
                                  │   client       │
                                  │  db/           │
                                  │   connection   │
                                  │   users        │
                                  │   experts      │
                                  │   messages     │
                                  │   chats        │
                                  │   models       │
                                  │   runs         │
                                  │  telegram/     │
                                  │   bot          │
                                  │   commands     │
                                  │   callbacks    │
                                  │  knowledge/    │
                                  │   index        │
                                  │  session/      │
                                  │  config/       │
                                  └────────────────┘
```

## Flujo de mensaje

```
1. WebSocket recibe "user_message"
2. handlers.ts → handleUserMessage(chatId, text, clientId)
3. runAgent.ts → runAgentCore() (core loop)
4. buildPrompt.ts → system prompt con skills + user_profile + workspace
5. Ollama nativo /api/chat (callOllamaChat / callOllamaChatSimple)
6. Tool calls → registradas en toolRegistry (37+ tools)
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
- `agent/`: core loop, client creation, prompt building, session summaries
- `tools/`: ToolRegistry singleton, 37+ herramientas (incluye skills-tools, task-tools)
- `skills/`: SkillsService con CRUD, progressive disclosure, propuestas automáticas
- `brain/`: BrainClient para comunicación con MCP Brain
- `db/`: SQLite con 15+ tablas operacionales
- `telegram/`: Bot de Telegram (start/stop, comandos, callbacks, transcriber)
- `knowledge/`: chunking e indexación de documentos
- `sessions/`: gestión de sesiones en memoria
- `config/`: carga de variables de entorno

### `gateway/` — Protocolo
- `protocol.ts`: tipos de mensaje WS (28 tipos)

## Base de datos

SQLite local (`agent-engine.db`) con tablas:
- `users` — perfiles de usuario
- `sub_agents` — agentes expertos configurables
- `agent_modes` — modos de operación del agente
- `custom_tools` — herramientas personalizadas
- `chats` — conversaciones persistidas
- `messages` — historial de mensajes
- `runs` — ejecuciones del agente
- `run_events` — eventos de ejecución
- `models` — proveedores de modelos guardados
- `settings` — configuración key-value persistente
- `scheduled_tasks` — tareas programadas
- `workspace_context` — contexto de workspace por usuario
- `message_feedback` — ratings de mensajes
- `saved_messages` — mensajes favoritos
- `skills` — memoria procedural de habilidades
