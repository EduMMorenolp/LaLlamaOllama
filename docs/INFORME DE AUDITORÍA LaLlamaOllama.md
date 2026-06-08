INFORME DE AUDITORÍA: LaLlamaOllama
agent-engine + agent-frontend — Revisión Exhaustiva
1. RESUMEN EJECUTIVO
Dimensión	agent-engine	agent-frontend
Archivos fuente	57 .ts	12 .tsx/.ts
Líneas de código	~3,800	~3,700
Tests	0	0
Cobertura de tests	0%	0%
Componentes implementados	~85%	~70%
Código muerto / stubs	sessions/, execution/, onChunk	Jarvis.tsx, login CSS
Dependencias no usadas	zod	—
Estado general	Maduro, con deuda técnica menor	MVP funcional, con carencias importantes
2. AGENT-ENGINE: AUDITORÍA
2.1 ARQUITECTURA
index.ts
  ├── env.ts              → Validación de vars de entorno
  ├── services/config.ts   → Carga de configuración
  ├── services/brain/      → Cliente HTTP para MCP Brain
  ├── services/tools/      → 8 herramientas + registro
  ├── server/api.ts        → Express REST (8 rutas)
  ├── server/ws.ts         → WebSocket server
  ├── server/cron.ts       → Jobs periódicos (stub)
  ├── services/telegram/   → Bot de Telegram
  └── services/orchestrator/ → Ciclo de vida de runs
2.2 LO QUE ESTÁ IMPLEMENTADO (Correcto)
- Agente autónomo multi-turno → runAgentCore.ts con max 10 iteraciones de tool calls
- 8 herramientas: bash, read-file, write-file, edit, glob, grep, read-url, delegate
- 3 herramientas de memoria: memorize, recall, get_context (vía MCP Brain)
- Base de datos SQLite con 7 tablas + sistema de migraciones
- API REST: health, tools, experts, users, models, stats, runs, knowledge
- WebSocket con 20+ handlers de mensajes
- Bot de Telegram con 10 comandos + callbacks
- Sistema de colas BullMQ con fallback inline
- Sub-agentes (experts): CRUD completo con configuración por agente
- Knowledge: Upload, chunking e indexado a Brain
- Dockerfile multi-etapa
2.3 CRÍTICO: LO QUE FALTA O ESTÁ ROTO
#	Problema	Archivo
1	onChunk nunca se invoca → assistant_chunk nunca se envía. El streaming está cableado pero no funciona.	runAgentCore.ts
2	list_tasks no tiene handler → el tipo de mensaje WS definido en protocol.ts no se maneja, siempre responde error.	gateway/protocol.ts:32 vs handlers.ts
3	No hay autenticación en REST → API_KEY se valida al iniciar pero nunca se usa para proteger endpoints.	server/api.ts
4	Sin tests → 0 archivos de test, 0 dependencias de testing.	—
2.4 MEDIO: DEUDA TÉCNICA / INCOMPLETO
#	Problema	Archivo
5	Dos sistemas de sesiones separados: runAgentCore.ts usa un Map local, services/sessions/ está sin usar.	runAgentCore.ts, services/sessions/
6	Módulos muertos: logExecution.ts, getHistory.ts, services/sessions/ — código no ejecutado.	services/execution/, services/sessions/
7	Sin manejador global de errores Express → errores no capturados en API REST.	server/api.ts
8	Sin validación de schemas → zod está en dependencias pero no se importa ni usa.	Todo el proyecto
9	CORS abierto → cors() sin configuración de orígenes permitidos.	server/api.ts
10	Sin rate limiting en REST ni WS.	—
11	cron.ts es un stub → llamado "session cleanup" pero solo hace health check a Brain.	server/cron.ts
12	Sin archivo .env.example → las variables de entorno solo están documentadas en INSTALL.md.	—
13	Type assertions peligrosas: as never en 5 lugares (handlers.ts, callbacks.ts).	handlers.ts:143,189,196,285, callbacks.ts:36
14	Mutación de process.env en runtime para TELEGRAM_BOT_TOKEN.	handlers.ts:327
15	Dynamic imports dentro del hot path del loop del agente → impacto en performance.	runAgentCore.ts:69,82,101,284
16	Sesiones en memoria sin límite → solo limpia cuando >100 entradas (TTL 30min).	runAgentCore.ts
17	Errores de Redis silenciados → ensureRunQueue() traga errores y cae a inline.	queue/runQueue.ts
2.5 SEGURIDAD
Riesgo	Detalle
Sin auth en REST API	Cualquiera con acceso a la red puede llamar a /api/*
CORS abierto	Cualquier origen puede hacer peticiones
Sin rate limiting	Posible abuso de endpoints
Sin validación de input	No hay Zod/schemas, solo checks básicos
Path traversal mitigado	Bueno: startsWith(resolve(workspaceDir))
Comandos peligrosos	Detectados en bash tool (rm -rf, sudo, etc.)
3. AGENT-FRONTEND: AUDITORÍA
3.1 ARQUITECTURA
App.tsx (tab router con useState)
  ├── AgentChat.tsx    → Chat multi-conversación (WS puerto 3021)
  ├── Jarvis.tsx       → Asistente de voz (STUB)
  ├── Agentes.tsx      → Configuración de agente (WS puerto 3021)
  ├── Tareas.tsx       → Historial de tareas (REST puerto 3020)
  ├── Knowledge.tsx    → Base de conocimiento (REST 3020 + Brain 3015)
  ├── Conexion.tsx     → Estado de conexión (WS puerto 3021)
  └── Memoria.tsx      → Búsqueda en memoria (REST Brain 3015)
3.2 LO QUE ESTÁ IMPLEMENTADO
- Chat funcional con CRUD de conversaciones, pin, búsqueda, adjuntos, token counter
- Configuración de agente con selector de modelo, temperatura, límite de historial, tools toggle
- Telegram config (token + enable/disable)
- Sub-agentes: crear y eliminar (sin editar)
- Model providers: CRUD (sin editar)
- Lista de tareas con filtros y modal de detalle con timeline
- Knowledge: listado, subida textual, búsqueda semántica
- Búsqueda en memoria con 3 modos (semántico, lexical, híbrido)
- Estadísticas de memoria con colores por tipo
- Indicador de conexión WebSocket
- Dockerfile multi-etapa con nginx
- Tema oscuro consistente con animaciones
3.3 CRÍTICO: LO QUE FALLA O NO FUNCIONA
#	Problema	Componente
1	Jarvis es un STUB completo: pide permiso del micrófono pero NO procesa audio. Sin STT, sin WS, sin interacción.	Jarvis.tsx
2	Sin tests → 0 archivos, 0 dependencias de testing.	—
3	3 conexiones WebSocket separadas al mismo servidor (Chat, Agentes, Conexion). Ineficiente y problemático.	Múltiples
4	Brain API se llama directo desde el frontend → las llamadas a memoria bypassan el Agent Engine. Riesgo CORS en producción.	Knowledge.tsx, Memoria.tsx
5	Sin autenticación: userId hardcodeado como "web-user", no hay login. Clases CSS de login existen pero no se usan.	AgentChat.tsx
3.4 ALTO: FUNCIONALIDADES FALTANTES
#	Problema	Componente
6	Sin streaming: assistant_chunk no se maneja, solo assistant_done. El usuario ve "Thinking..." y recibe el mensaje completo.	AgentChat.tsx
7	VITE_BRAIN_URL ignorado: documentado en .env.example pero config.ts hardcodea http://localhost:3015.	config.ts
8	Sin estados de carga (skeleton): solo spinners y texto.	Todos
9	Sin Error Boundaries: cualquier error no capturado tumba toda la app.	App.tsx
10	Sin manejo de errores HTTP: fetch() sin check de res.ok en Tareas y Knowledge.	Tareas.tsx, Knowledge.tsx
11	Estilos inline generalizados: ~80% de los estilos son objetos style={{}} inline → difícil de mantener.	Todos los componentes
12	Sin paginación: límites hardcodeados (50 tareas, 20 memorias), sin "cargar más".	Tareas.tsx, Memoria.tsx
3.5 MEDIO: MEJORAS NECESARIAS
#	Problema	Componente
13	Sin state management: no hay React Context, Redux, Zustand, etc. Estado local duplicado.	Todos
14	Sin router: navegación por useState<Tab> → sin deep linking, sin historial del browser.	App.tsx
15	Sin validación de input: tamaños de adjuntos, longitud de mensajes, formato de URLs.	Múltiples
16	UI bilingüe inconsistente: mezcla de español e inglés.	Todos
17	Sin sistema de notificaciones: mensajes de guardado inline, errores que desaparecen sin feedback.	Todos
18	Sin tema claro/oscuro: solo modo oscuro.	index.css
19	Sin responsive: sidebar fijo de 280px, no colapsa.	App.tsx, index.css
20	Confirm nativo: confirm() para borrar en vez de modal personalizado.	Knowledge.tsx, AgentChat.tsx
21	Sin drag-and-drop para subida de archivos.	Knowledge.tsx
22	Sin atajos de teclado (excepto Enter para enviar).	—
23	Sin renderizado de Markdown: los mensajes se muestran como texto plano.	AgentChat.tsx
24	WS errors silenciados: catch { /* ignore */ } en todos los handlers.	Todos los componentes WS
4. COMPARATIVA: PROTOCOLO WS (Backend vs Frontend)
Mensaje WS	Backend (handler)	Frontend (cliente)	Estado
user_message	✅ handleUserMessage	✅ Envía	✅
cancel	✅ handleCancel	✅ Envía	✅
assistant_chunk	⚠️ Definido pero nunca emitido	❌ No se maneja	✗
assistant_done	✅ Emitido	✅ Manejado	✅
tool_call	✅ Emitido	✅ Manajado	✅
tool_result	✅ Emitido	✅ Manajado	✅
list_tasks	❌ Sin handler	❌ No se usa	✗
list_chats	✅	✅	✅
chat_update	✅	✅	✅
switch_chat	✅	✅	✅
list_experts	✅	✅	✅
expert_update	✅	✅	✅
list_tools	✅	✅	✅
toggle_tool	✅	✅	✅
list_models	✅	✅	✅
model_update	✅	✅	✅
list_ollama_models	✅	✅	✅
telegram_update	✅	✅	✅
general_config_update	✅	✅	✅
identify	✅	✅ Envía	✅
error/status	✅ Emitido	✅ Maneja	✅
5. SEGURIDAD: HALLAZGOS
agent-engine
Hallazgo	Riesgo
API REST sin autenticación	ALTO
CORS sin restricción de orígenes	ALTO
Sin rate limiting	MEDIO
Sin validación de schemas (Zod sin usar)	MEDIO
Mutación de process.env en runtime	BAJO
as never type assertions (5 ocurrencias)	BAJO
Errores Redis silenciados	BAJO
agent-frontend
Hallazgo	Riesgo
Brain API expuesta directamente al browser	ALTO
Sin autenticación de usuario	ALTO
Sin validación de tamaño de adjuntos	MEDIO
Errores HTTP ignorados (sin check res.ok)	MEDIO
Sin Content Security Policy	MEDIO
6. TESTS: ESTADO
Dimensión	agent-engine	agent-frontend
Tests unitarios	❌ 0	❌ 0
Tests de integración	❌ 0	❌ 0
Tests E2E	❌ 0	❌ 0
Framework de testing	❌ No existe	❌ No existe
test script en package.json	❌	❌
Cobertura global: 0% — Crítico para un proyecto en producción.
7. PLAN DE ACCIÓN RECOMENDADO
Prioridad Inmediata (Semana 1)
1. Implementar streaming → Invocar onChunk en runAgentCore.ts y manejar assistant_chunk en AgentChat.tsx
2. Autenticación REST → Middleware que valide API_KEY en /api/*
3. Compartir conexión WebSocket → Crear un WebSocketContext/Provider en el frontend
4. Proxy Brain al backend → Que todas las llamadas a Brain pasen por Agent Engine, no directas desde el browser
5. Hacer funcional o eliminar Jarvis → Implementar STT o retirar el stub
Prioridad Alta (Semana 2-3)
 6. Añadir tests → Configurar Vitest + React Testing Library
 7. Resolver list_tasks → Añadir handler en handlers.ts
 8. Migrar estilos inline a CSS modules o Tailwind
 9. Añadir Error Boundaries en frontend
10. Añadir validación con Zod (backend) y validación de formularios (frontend)
11. Configurar CORS con orígenes permitidos explícitos
Prioridad Media (Sprint 2)
12. Limpiar código muerto: sessions/, execution/, login CSS
13. Añadir rate limiting (express-rate-limit)
14. Implementar paginación en listas (tareas, memorias, knowledge)
15. Añadir estado de carga skeleton
16. Unificar idioma (español o inglés, no mezcla)
17. Reemplazar confirm() nativo por modales personalizados
18. Añadir renderizado de Markdown en mensajes del chat
Prioridad Baja (Backlog)
19. Sistema de autenticación de usuarios (login con PIN)
20. Tema claro/oscuro
21. Responsive design / mobile
22. Drag-and-drop para archivos
23. Atajos de teclado
24. Sistema de notificaciones toast
25. Soporte offline / Service Worker
8. CONCLUSIÓN
agent-engine es un backend maduro y bien estructurado con ~85% de las funcionalidades implementadas. Los problemas principales son la falta de streaming funcional (onChunk no implementado), la ausencia total de tests, y la falta de autenticación en REST.
agent-frontend es un MVP visualmente pulcro pero con carencias funcionales importantes. El chat funciona, pero Jarvis es un stub, no hay streaming, no hay tests, las conexiones WS están duplicadas, y el frontend llama directamente al servicio Brain sin pasar por el engine.
Esfuerzo estimado para llevar ambos a producción estable: ~4-6 semanas con 1 desarrollador full-time.