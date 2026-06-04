# Arquitectura — Agent Frontend

```
App.tsx
├── Sidebar (6 secciones)
│   ├── Chat → AgentChat.tsx
│   │   ├── MessageList
│   │   ├── MessageBubble (token counter)
│   │   ├── ToolCallDisplay
│   │   └── ChatSidebar (right)
│   │       ├── ChatSearch
│   │       └── ChatItem (rename, pin, delete)
│   ├── Agentes → Agentes.tsx
│   │   ├── ConnectionStatus
│   │   ├── GeneralConfig (model, temp, history_limit)
│   │   ├── TelegramConfig
│   │   ├── ToolsConfig
│   │   └── SubAgentList (CRUD)
│   ├── Tareas → Tareas.tsx
│   │   ├── RunFilters
│   │   ├── RunList
│   │   └── RunDetailModal (timeline)
│   ├── Conocimiento → Knowledge.tsx
│   │   ├── FileUpload
│   │   └── SemanticSearch
│   ├── Conexión → Conexion.tsx
│   │   ├── WS Status
│   │   ├── ModelProviders (CRUD)
│   │   └── BrainInfo
│   └── Memoria → Memoria.tsx
│       ├── SearchBar (mode selector)
│       ├── ResultsList
│       ├── MemoryDetail
│       └── Stats
└── config.ts (engineUrl, brainUrl, wsUrl)
```

## Flujo de datos

### Chat
```
WebSocket connect → identify → list_chats → switch_chat
  → user_message → assistant_chunk (streaming) → assistant_done (con usage)
```

### Conocimiento
```
POST /api/knowledge → backend chunk + embed
  → MCP Brain save → response con documento indexado
```

### Memoria
```
GET /api/memory/search?q=...&mode=semantic|lexical|hybrid
  → MCP Brain → resultados + stats
```

## Comunicación

- **WebSocket** con Agent Engine (`ws://host:3021`)
- **REST HTTP** con Agent Engine (`http://host:3020/api/*`)
- **REST HTTP** con MCP Brain (`http://host:3015/api/*`)

## Configuración

`config.ts` deriva:
- `engineUrl` de `VITE_ENGINE_URL`
- `brainUrl` de `VITE_BRAIN_URL`
- `wsUrl` = engineUrl con protocolo ws:// y puerto +1
