# Test Plan — Skills System (feature/skills-system)

## Ambiente

- **URL API:** `http://localhost:3020`
- **API Key:** `McPOllama2026-V1-Home`
- **Header:** `X-API-Key`
- **WebSocket:** `ws://localhost:3021`
- **Servicios:** agent-engine, backend, ollama, mcp-brain, redis

---

## 1. Smoke Test — Tools registradas

```powershell
curl.exe -s -H "X-API-Key: McPOllama2026-V1-Home" http://localhost:3020/api/tools `
  | ConvertFrom-Json | Select-Object -ExpandProperty names | Select-String "skill"
```

**Esperado:** `skills_list`, `skill_view`, `skill_manage`

---

## 2. Test: Crear skill (`skill_manage` action=create)

```powershell
curl.exe -s -H "X-API-Key: McPOllama2026-V1-Home" `
  -H "Content-Type: application/json" `
  -X POST http://localhost:3021/api/chat `
  -Body '{"message":"Crea una skill llamada saludar-cli que explique c\u00f3mo hacer un script bash de saludo personalizado"}'
```

> **Alternativa vía WebSocket:** Abrir `agent-frontend` en `http://localhost:8081` y chatear:
> "Crea una skill llamada `saludar-cli` que guarde el procedimiento para crear un script bash de saludo"
> Luego "Lista las skills disponibles"

**Verificar:**
- `skills_list` devuelve la skill creada en la lista
- `skill_view` con name="saludar-cli" devuelve el contenido completo
- El archivo `SKILL.md` existe en `{workspace}/.lallama/skills/saludar-cli/SKILL.md`

---

## 3. Test: Listar skills (`skills_list`)

```powershell
curl.exe -s -H "X-API-Key: McPOllama2026-V1-Home" `
  -H "Content-Type: application/json" `
  -d '{"action":"skills_list","args":{}}' `
  http://localhost:3020/api/tools/execute
```

**Esperado:** Lista de skills con nombre, descripción, categoría y versión.

---

## 4. Test: Ver skill (`skill_view`)

```powershell
curl.exe -s -H "X-API-Key: McPOllama2026-V1-Home" `
  -H "Content-Type: application/json" `
  -d '{"action":"skill_view","args":{"name":"saludar-cli"}}' `
  http://localhost:3020/api/tools/execute
```

**Esperado:** Contenido completo de la skill en markdown.

---

## 5. Test: Actualizar skill (`skill_manage` action=patch)

```powershell
curl.exe -s -H "X-API-Key: McPOllama2026-V1-Home" `
  -H "Content-Type: application/json" `
  -d '{"action":"skill_manage","args":{"action":"patch","name":"saludar-cli","description":"Procedimiento actualizado para script bash de saludo","version":"1.1.0","content":"## Saludar CLI (v2)\n\n### Procedimiento\n1. Crear archivo\n2. Hacerlo ejecutable\n3. Ejecutar con chmod"}}' `
  http://localhost:3020/api/tools/execute
```

**Esperado:** Mensaje de confirmación. `skill_view` devuelve la versión actualizada.

---

## 6. Test: Proponer skill (`skill_manage` action=propose)

Desde el chat del frontend:
> "Usa skill_manage con action=propose para crear una propuesta de skill para documentar cómo hacer deployment con docker compose"

**Verificar:**
- Se crea archivo JSON en `{workspace}/.lallama/skills/proposals/`
- `skills_list` NO muestra la skill propuesta (solo las aprobadas)

---

## 7. Test: Auto-creación post-ejecución

Desde el chat del frontend:
> "Busca en internet las últimas 3 noticias de IA y guarda los resultados en un archivo noticias.txt"

**Verificar:**
- Si el agente usó 3+ tool calls (web_search + write_file), se genera auto-propuesta
- El archivo de propuesta aparece en `proposals/`

---

## 8. Test: Eliminar skill (`skill_manage` action=delete)

```powershell
curl.exe -s -H "X-API-Key: McPOllama2026-V1-Home" `
  -H "Content-Type: application/json" `
  -d '{"action":"skill_manage","args":{"action":"delete","name":"saludar-cli"}}' `
  http://localhost:3020/api/tools/execute
```

**Esperado:** Confirmación. `skills_list` ya no muestra la skill.

---

## 9. Test: Integración en system prompt

- Iniciar nueva sesión de chat
- Enviar cualquier mensaje
- **Verificar en logs:** `docker logs agent-engine 2>&1 | Select-String "skills"`

**Esperado:** Logs muestran `<skills_disponibles>` con las skills existentes.

---

## 10. Test: Progressive disclosure

- `skills_list` debe consumir ~3k tokens máximo (solo metadatos)
- `skill_view` carga contenido completo solo cuando se solicita
- **Verificar:** El system prompt no debe tener skills completas, solo la lista

---

## Criterios de aceptación

| # | Criterio | Estado |
|:-:|----------|:------:|
| 1 | `skills_list`, `skill_view`, `skill_manage` registradas en `/api/tools` | ✅ |
| 2 | `skills_list` devuelve metadatos sin contenido completo | ⬜ |
| 3 | `skill_view` devuelve contenido completo de una skill | ⬜ |
| 4 | `skill_manage create` persiste SKILL.md en disco | ⬜ |
| 5 | `skill_manage patch` actualiza SKILL.md existente | ⬜ |
| 6 | `skill_manage delete` elimina skill del disco | ⬜ |
| 7 | `skill_manage propose` crea propuesta JSON sin afectar skills activas | ⬜ |
| 8 | Skills se inyectan en system prompt al iniciar sesión | ⬜ |
| 9 | Auto-creación de propuesta tras 3+ tool calls | ⬜ |
| 10 | No hay errores en `docker logs agent-engine` | ⬜ |

---

## Comandos útiles

```powershell
# Logs del agent-engine
docker logs agent-engine --tail 100 -f

# Verificar skills en disco (dentro del contenedor)
docker exec agent-engine sh -c "find /workspace/.lallama/skills -type f 2>/dev/null || echo 'No skills dir yet'"

# Health check
curl.exe -s http://localhost:3020/health

# Listar tools
curl.exe -s -H "X-API-Key: McPOllama2026-V1-Home" http://localhost:3020/api/tools | ConvertFrom-Json | Select-Object -ExpandProperty names
```
