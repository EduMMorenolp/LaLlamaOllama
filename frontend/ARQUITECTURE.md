# Arquitectura — Frontend

```
App.tsx
├── Sidebar (7 secciones)
│   ├── Dashboard → Dashboard.tsx
│   │   └── MetricCards (CPU, VRAM, disco, tráfico)
│   ├── Playground → Playground.tsx
│   │   └── StreamingChat
│   ├── Agentes → Agentes.tsx
│   │   └── AgentCard (CRUD)
│   ├── Telegram → Telegram.tsx
│   │   └── BotConfig
│   ├── Tools → Tools.tsx
│   │   └── ToolCard (python, bash, prompt, docker)
│   ├── Seguridad → Seguridad.tsx
│   │   ├── AttemptLogs
│   │   └── Blacklist
│   └── Historial → Historial.tsx
│       └── FilterableChatHistory
└── components/shared/ (MetricCard, StatusBadge, LoadingOverlay)
```

## Comunicación

- **Socket.IO** con Backend (`socket.io-client`)
- **REST HTTP** con Backend (`VITE_API_URL`)

## Tema

Estética Glassmorphism:
- Fondos con blur + transparencia
- Bordes semitransparentes
- Sombras sutiles
- Paleta oscura con acentos vibrantes
