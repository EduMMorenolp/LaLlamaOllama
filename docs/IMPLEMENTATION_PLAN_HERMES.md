# Plan de implementación: `agent-engine` como asistente 24/7

Fecha: 2026-06-02

Objetivo
--------
Construir un asistente 24/7 sobre `agent-engine` con estas piezas:
- Orchestrator para coordinar ejecuciones.
- Cola de trabajos para ejecución asíncrona.
- Memoria local como caché de contexto.
- `mcp-brain` como memoria permanente y búsqueda semántica.
- Sandbox con Docker para tools peligrosas.
- API + WebSocket para control y streaming.
- Telegram como canal principal de operación.
- Cron para automatización y disparo de jobs.
- Logs estructurados y recuperación de fallos.

Qué conserva este plan
----------------------
- Redis + BullMQ para cola funcional.
- Docker executor para sandbox real.
- Cron para automatizaciones.
- SQLite para logs y contexto temporal.
- Brain MCP para memoria persistente.
- Memoria local como caché de contexto, no como memoria permanente.

Qué no se incluye por ahora
---------------------------
- Vector DB externa adicional, salvo que después sea necesaria.
- Panel visual nuevo dentro de `agent-engine`.
- Reglas complejas de aprobación humana, salvo para actions muy riesgosas.

Cómo encajan tus cambios
------------------------
- Sí, la cola es necesaria si quieres ejecución asíncrona real y no bloquear el loop principal.
- Sí, el sandbox es necesario si el sistema va a ejecutar commands/tools con riesgo.
- Sí, el cron es necesario si quieres automatizaciones 24/7 sin depender de un usuario conectado.
- Sí, la memoria local como caché es útil para no llamar siempre a brain MCP y para sostener contexto corto de sesión.
- Sí, brain MCP debe seguir siendo la memoria permanente; `agent-engine` no debe duplicarla.

Arquitectura objetivo
---------------------
Flujo general:
1. Telegram o API recibe una instrucción.
2. El orchestrator crea un run.
3. Se guarda contexto temporal en SQLite.
4. Se consulta brain MCP para recuperar memoria relevante.
5. Se decide el siguiente paso.
6. Si hace falta, la tarea entra en BullMQ.
7. El worker ejecuta la tarea o la pasa al sandbox Docker.
8. Se emiten eventos por WebSocket y se registran logs.
9. Si el job fue programado, el cron lo dispara automáticamente.

Fase 1: Base + cola (Días 1-3)
-----------------------------
Objetivo:
- Tener el esqueleto operativo del sistema con cola y contexto temporal.

Tareas:
- Crear/ajustar el orchestrator para iniciar y registrar runs.
- Añadir Redis + BullMQ para encolar trabajos.
- Guardar logs y contexto temporal en SQLite.
- Dejar `runAgent.ts` como entrada coordinadora, no como lógica monolítica.
- Preparar un flujo donde la cola exista aunque al principio ejecute inline o con jobs simples.

Resultado esperado:
- El sistema ya puede recibir una solicitud, crear un run y encolarlo.
- SQLite guarda el contexto corto y el estado operativo.
- La estructura ya soporta async desde el principio.

Fase 2: Memoria dual (Días 4-5)
------------------------------
Objetivo:
- Separar memoria de sesión y memoria permanente.

Tareas:
- SQLite almacena contexto de sesión y últimos N mensajes o eventos.
- Brain MCP se usa para memoria permanente, embeddings y búsqueda semántica.
- El orchestrator combina ambas fuentes al construir contexto.
- La memoria local funciona como caché de contexto, no como fuente final.

Resultado esperado:
- El asistente recuerda la sesión actual rápido.
- La memoria importante vive en brain MCP.
- No se duplica lógica de memoria en varios sitios.

Fase 3: Sandbox + seguridad (Días 6-8)
--------------------------------------
Objetivo:
- Ejecutar tools de riesgo con aislamiento real.

Tareas:
- Implementar Docker executor para acciones peligrosas.
- Definir allowlist de tools y políticas básicas.
- Separar tools seguras de tools que exigen sandbox.
- Registrar cada acción sensible en logs estructurados.

Resultado esperado:
- El sistema puede ejecutar acciones peligrosas sin exponer todo el host.
- Hay una capa clara de seguridad entre la intención y la ejecución.

Fase 4: API + WebSocket (Días 9-10)
-----------------------------------
Objetivo:
- Exponer control remoto y streaming de estado.

Tareas:
- Extender `src/server/api.ts` con endpoints de inicio, estado y cancelación.
- Extender `src/server/ws.ts` para emitir progreso, logs y resultado final.
- Mantener contrato simple para frontend, Telegram y herramientas externas.

Resultado esperado:
- La UI y otros clientes pueden seguir lo que está pasando en tiempo real.

Fase 5: Telegram + Cron (Días 11-13)
-----------------------------------
Objetivo:
- Operar el asistente 24/7 desde Telegram y automatizar jobs.

Tareas:
- Conectar Telegram como interfaz principal.
- Soportar comandos para consultar estado, iniciar runs y revisar errores.
- Hacer que cron dispare jobs que entren a la cola.
- Si el job necesita ejecución, pasa por el mismo orchestrator y la misma cola.

Resultado esperado:
- Telegram es el canal operativo.
- Cron activa automatizaciones reales y repetibles.

Fase 6: Hardening (Días 14-15)
-----------------------------
Objetivo:
- Cerrar puntos débiles y preparar uso continuo.

Tareas:
- Mejorar logs estructurados.
- Agregar recuperación de fallos.
- Revisar timeouts, reintentos y fallos de workers.
- Revisar seguridad de tools y mensajes entrantes.

Resultado esperado:
- El sistema queda más estable para operar de forma continua.

Dependencias mínimas
--------------------
- `better-sqlite3` para logs y contexto temporal.
- `bullmq` + `ioredis` para cola de trabajos.
- `dockerode` para sandbox.
- `ajv` para validación de inputs.
- `pino` para logging estructurado.
- `node-cron` para automatizaciones.

Archivos clave a tocar
----------------------
- [agent-engine/src/services/agent/runAgent.ts](agent-engine/src/services/agent/runAgent.ts)
- [agent-engine/src/server/api.ts](agent-engine/src/server/api.ts)
- [agent-engine/src/server/ws.ts](agent-engine/src/server/ws.ts)
- `agent-engine/src/services/brain/*`
- `agent-engine/src/services/db/*`
- `agent-engine/src/services/tools/*`
- `agent-engine/src/server/cron.ts`

Decisión técnica final
----------------------
Este plan sí conserva todo lo importante que planteaste:
- cola para async,
- sandbox para seguridad,
- cron para automatización,
- memoria local como caché,
- brain MCP como memoria permanente.

La única simplificación real es que cada pieza se implementa con un alcance claro y ordenado, sin mezclar responsabilidades.

Siguiente paso recomendado
--------------------------
Si quieres, ahora puedo hacer una segunda pasada y dejar este documento todavía más accionable, con subtareas por fase y criterios de “listo” para cada una.
