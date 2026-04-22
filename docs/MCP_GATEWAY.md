# MCP Gateway (converter API HTTP → MCP tools)

Objetivo: permitir que um usuário cadastre “skills” (tools) apontando para rotas HTTP (com tokens/headers), e o bot passe a usar isso como um **servidor MCP**.

Esta API expõe um endpoint MCP:

- `POST /mcp/:integrationId` (JSON-RPC 2.0)
  - `tools/list`
  - `tools/call`

---

## 1) Criar uma Integration (catálogo + auth)

`POST /integrations`

Exemplo:

```json
{
  "name": "crm-demo",
  "baseUrl": "http://localhost:7100",
  "auth": { "type": "bearer", "token": "SEU_TOKEN" },
  "headers": { "x-app": "bot" },
  "tools": [
    {
      "name": "get_customer",
      "description": "Busca cliente por CPF",
      "method": "GET",
      "path": "/customers/{{cpf}}",
      "inputSchema": {
        "type": "object",
        "properties": { "cpf": { "type": "string" } },
        "required": ["cpf"]
      }
    },
    {
      "name": "create_ticket",
      "description": "Cria ticket",
      "method": "POST",
      "path": "/tickets",
      "body": { "subject": "{{subject}}", "description": "{{description}}" },
      "inputSchema": {
        "type": "object",
        "properties": {
          "subject": { "type": "string" },
          "description": { "type": "string" }
        },
        "required": ["subject"]
      }
    }
  ]
}
```

Notas:

- O token não é retornado nas respostas (`auth.token` é write-only).
- `path`, `query`, `body` e `headers` do tool suportam templates `{{...}}` resolvidos a partir de `arguments` do `tools/call`.

---

## 2) Usar como MCP server

Depois de criar, use o `integrationId` retornado para chamar MCP:

### tools/list

```json
{ "jsonrpc": "2.0", "id": "1", "method": "tools/list", "params": {} }
```

### tools/call

```json
{
  "jsonrpc": "2.0",
  "id": "2",
  "method": "tools/call",
  "params": { "name": "get_customer", "arguments": { "cpf": "52998224725" } }
}
```

---

## 3) Fazer o bot usar isso

No `assistant.mcpServers[]`, aponte o `url` para o gateway:

```json
{
  "type": "mcp",
  "server_label": "crm-demo",
  "server_url": "http://localhost:3000/mcp/<integrationId>",
  "require_approval": "never"
}
```

Assim, o Flow Engine pode chamar `call_tool` com `toolName` igual ao `tool.name` cadastrado.
