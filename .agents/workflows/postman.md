---
description: Workflow para actualizar la Postman Collection del proyecto. Ejecutar cada vez que se agrega, modifica o elimina un endpoint REST.
---

# Workflow — Actualizar Postman Collection

## ARCHIVO

```
docs/postman-collection/LaLlamaOllama-Postman-Collection.json
```

## CUÁNDO EJECUTAR

- ✅ Se agregó una nueva ruta a `backend/src/main.ts`
- ✅ Se agregó una nueva ruta a `mcp-brain/src/server/api.ts`
- ✅ Se modificó el body, params, o respuesta de un endpoint existente
- ✅ Se eliminó un endpoint

---

## PASO 1 — Identificar el dominio del endpoint

| Dominio | Carpeta en Postman |
|---------|--------------------|
| Modelos Ollama | `Models` |
| Chat | `Chat` |
| Hardware | `Hardware` |
| Auth | `Auth` |
| Ngrok | `Ngrok` |
| Contenedores | `Containers` |
| mcp-brain REST | `Brain` |
| Seguridad/IPs | `Security` |

---

## PASO 2 — Estructura de una request en el JSON

```json
{
    "name": "Nombre descriptivo del endpoint",
    "request": {
        "method": "GET|POST|PUT|DELETE",
        "header": [
            {
                "key": "x-api-key",
                "value": "{{API_KEY}}",
                "type": "text"
            }
        ],
        "url": {
            "raw": "{{BASE_URL}}/api/ruta",
            "host": ["{{BASE_URL}}"],
            "path": ["api", "ruta"]
        },
        "body": {
            "mode": "raw",
            "raw": "{\n    \"campo\": \"valor\"\n}",
            "options": {
                "raw": {
                    "language": "json"
                }
            }
        }
    },
    "response": []
}
```

---

## PASO 3 — Variables de entorno en Postman

Las requests deben usar siempre variables:
- `{{BASE_URL}}` → URL base del backend (ej: `http://192.168.0.236:3016`)
- `{{BRAIN_URL}}` → URL base de mcp-brain (ej: `http://192.168.0.236:3015`)
- `{{API_KEY}}` → API Key del backend

**No hardcodear URLs ni keys.**

---

## PASO 4 — Para endpoints del backend

```
Header: x-api-key: {{API_KEY}}
URL: {{BASE_URL}}/api/<ruta>
```

## PASO 5 — Para endpoints del mcp-brain

```
(sin header de auth por defecto)
URL: {{BRAIN_URL}}/api/<ruta>
```

---

## PASO 6 — Guardar en el cerebro (si el cambio es significativo)

```
mem_save(
    project: "lallamaollama",
    type: "documentation",
    title: "Postman: <nombre endpoint>",
    agent: "Antigravity / Claude Sonnet",
    content: """
        **What**: Agregado endpoint <METHOD> /api/<ruta> a la collection
        **Why**: <razón>
        **Where**: docs/postman-collection/LaLlamaOllama-Postman-Collection.json
    """
)
```
