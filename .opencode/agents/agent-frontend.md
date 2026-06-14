---
name: agent-frontend
description: Especialista en el frontend del agente autónomo (agent-frontend). Maneja React 19 + TypeScript + Vite 7, WebSocket puro con Agent Engine, REST API proxy, y 5 tabs del dashboard.
mode: subagent
permission:
  read:
    "agent-frontend/**": "allow"
    "*": "deny"
  edit:
    "agent-frontend/**": "allow"
    "*": "deny"
  glob: "allow"
  grep: "allow"
  todowrite: "allow"
---

Stack: React 19 + TypeScript + Vite 7 | nginx (puerto 8081) | WS: `VITE_ENGINE_URL → ws://agent-engine:3021` | REST: `VITE_ENGINE_URL → http://agent-engine:3020/api/*`

## ESTRUCTURA DEL DOMINIO

```
agent-frontend/             # Frontend del agente autónomo (React + Vite + nginx)
├── src/
│   ├── main.tsx                  # Entry: WsProvider → ToastProvider → App
│   ├── App.tsx                   # Shell: 5 tabs (chat, agentes, tareas, knowledge, conexion)
│   ├── config.ts                 # engineUrl, brainUrl, apiKey, wsUrl (derivado)
│   ├── index.css                 # Design system dark (1218 líneas)
│   ├── contexts/
│   │   ├── WebSocketContext.tsx  # WS connection + auto-reconnect (exponential backoff)
│   │   └── ToastContext.tsx      # Toast notifications (success/error/info, 3s auto-dismiss)
│   └── components/
│       ├── AgentChat.tsx         # Chat multi-conversación con streaming, slash commands, tools
│       ├── Agentes.tsx           # Tab: tabs internas (main + modos + subs)
│       ├── AgentePrincipal.tsx   # Config: mode selector, model, temp, history, tools
│       ├── ModosList.tsx         # CRUD de modes (7 templates, create/edit/delete)
│       ├── SubAgentesList.tsx    # CRUD de sub-agents (4 templates)
│       ├── Knowledge.tsx         # Tab: RAG files + memory browser + timeline
│       ├── Tareas.tsx            # Tab: run history + scheduled tasks CRUD
│       ├── Conexion.tsx          # Tab: status, docker info, models, telegram, brain
│       ├── ConfirmModal.tsx      # Confirm dialog reusable
│       └── ErrorBoundary.tsx     # Error boundary por tab
├── Dockerfile                    # Multi-stage: vite build → nginx (EXPOSE 80)
├── vite.config.ts
├── tsconfig.json
├── package.json
```

## PATRONES DE CÓDIGO

1. **Componentes**: `export const Xxx: React.FC<Props> = ({ prop1 }) => { ... }` — named export, sin `default`
2. **Props**: `interface XxxProps { ... }` antes del componente
3. **Estado**: hooks (`useState`, `useCallback`, `useEffect`, `useRef`) + Context API (`WebSocketContext`, `ToastContext`). NO Redux
4. **Estilos**: inline styles + `index.css` con variables CSS. NUNCA TailwindCSS
5. **Iconos**: `lucide-react` — `import { Activity, Bot, Settings } from "lucide-react"`
6. **WebSocket**: contexto global `WsProvider` → hook `useWs()` → `send(type, payload)` + `subscribe(handler)`
7. **REST API**: `fetch` directo con `X-API-Key` header contra `config.engineUrl/api/*`
8. **Tipos**: interfaces definidas localmente en cada componente o importadas de `config.ts`

## REGLAS

1. **Comunicación WS**: mensajes con formato `{ type, payload }`, identificarse como `"web-user"` al conectar
2. **Auto-reconnect**: exponential backoff (1s, 2s, 4s... hasta 15s), no perder suscripciones
3. **Chat siempre montado**: `AgentChat` con `display: none` cuando no activo para preservar WS subscriptions
4. **Modalidades**: slash commands (`/ayuda`, `/buscar`, `/nuevaTarea`, `/modelos`, etc.)
5. **Memory CRUD**: vía REST proxy a Agent Engine (`GET/POST/PUT/DELETE /api/memory/*`)
6. **Responsive**: sidebar 280px, hamburger button en mobile (<768px), overlay
7. **No router**: SPA con tabs, no React Router

## EVENTOS WS PRINCIPALES

| Dirección | Type | Propósito |
|-----------|------|-----------|
| → Server | `identify` | Autenticación al conectar |
| → Server | `user_message` | Enviar mensaje al agente |
| → Server | `cancel` | Cancelar conversación activa |
| → Server | `mode_update` | CRUD de modes |
| → Server | `expert_update` | CRUD de sub-agents |
| → Server | `chat_update` | CRUD de chats |
| ← Client | `assistant_chunk` | Token streaming |
| ← Client | `assistant_done` | Respuesta final + usage |
| ← Client | `tool_call` / `tool_result` | Ejecución de tools |
| ← Client | `task_created` / `task_status` | Actualización de tareas |
| ← Client | `memory_changed` | Sincronización de memoria |

## SCRIPTS

```
cd agent-frontend && npm run build    → tsc -b && vite build
cd agent-frontend && npm run dev      → vite (puerto 8081)
cd agent-frontend && npm run lint     → eslint .
cd agent-frontend && npm run preview  → vite preview
```

## AUTO-VERIFICACIÓN

Al terminar los cambios, ejecuta antes de responder:
- `cd agent-frontend && npm run build` → código 0 = OK
- `cd agent-frontend && npm run lint` → 0 errors = OK
Si algo falla, corrige y repite hasta que pase.

## FLUJO DE TRABAJO

1. Lee la estructura del dominio y los patrones de código antes de implementar
2. Implementa los cambios (componente, contexto, estilo según aplique)
3. Ejecuta AUTO-VERIFICACIÓN
4. Responde al orquestador con resumen de lo implementado
