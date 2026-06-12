# Frontend — Changelog

## [Unreleased]

### 🧹 Consolidación UI: Eliminados AI Engine Tuner y Agent Engine

#### Eliminado
- **🗑️ `AiEngineTuner.tsx`** — Componente completo eliminado (GPU gauges, token counter, cloud savings, thermal stress, pricing config)
- **🗑️ `AgentChat.tsx`** — Componente completo eliminado (chat, settings, sub-agents). El Agent Engine corre como servicio aparte (`agent-frontend/`)

#### Cambiado
- **🔧 `HardwareSentinel.tsx` → `GpuSentinel`** — Componente renombrado; integrado el card "GPU en Tiempo Real" con 5 gauges SVG circulares (Consumo W, Temperatura °C, Fan Speed %, GPU Util %, VRAM Uso MB), alerta térmica y warning nvidia-smi. Los datos vienen del `status` del padre
- **🔧 `App.tsx`** — Removidas importaciones de `AgentChat` y `AiEngineTuner`; importado `GpuSentinel`; eliminados los casos `"agent"` y `"engine"` en `getSectionInfo()` y `renderContent()`; sidebar: quitados botones "Agent Engine" y "Engine Tuner"; renombrado "HW Sentinel" → "GPU Sentinel"

### 🐛 Corrección de bugs

#### Corregido
- **🐛 Fix: Chat keys duplicadas** — Reemplazado `key={i}` por clave única basada en timestamp en `AgentChat.tsx` para evitar duplicados de renderizado

## [1.0.0] — 2026-06-07

### 🚀 Versión estable 1.0.0

Alineación de versión con el proyecto raíz LaLlamaOllama.

### Cambiado
- Refactor a componentes reutilizables: MetricCard, StatusBadge, LoadingOverlay, etc.

## [0.3.0] — 2026-05-10

### Añadido
- Dashboard con monitoreo de CPU, VRAM, disco en tiempo real
- Gráficos de tráfico con Recharts
- Playground con streaming de tokens
- Agentes: CRUD con Socket.IO en tiempo real
- Telegram: configurar token, modelo, prompt, admins
- Tools: templates de herramientas (python, bash, prompt, docker)
- Seguridad: tabla de intentos, auto-ban stats
- Historial: filtros por modelo, fecha, agente
- Sidebar responsiva con 7 secciones

## [0.2.0] — 2026-04-01

### Añadido
- Primeros componentes glassmorphism
- Conexión Socket.IO con el backend
- Listado básico de modelos

## [0.1.0] — 2026-03-01

### Añadido
- Proyecto Vite + React + TypeScript base
- Tema oscuro con CSS modules
