# bot-sonax-mcp

API de orquestração de fluxos via prompt + ferramentas MCP.

## Rodar local

Pré-requisitos: Node `>=18` + npm `>=9`.

1) Suba um MongoDB (ex: local ou Docker).
2) Copie `.env.example` para `.env` e ajuste `MONGODB_URI`.
3) Instale deps e rode:

```bash
npm i
npm run dev
```

### Mongo via Docker (opcional)

```bash
docker compose up -d
```

## Endpoint

`POST /message`

```json
{
  "clientId": "string",
  "assistantId": "string",
  "message": "string",
  "metadata": {}
}
```

## Assistants

Para não precisar inserir no Mongo manualmente:

- `POST /assistants`
- `GET /assistants`
- `GET /assistants/:id`

Exemplo de criação:

```bash
curl -X POST http://localhost:3000/assistants -H "content-type: application/json" -d "{\"name\":\"Fluxo CPF\",\"prompt\":\"Se for a primeira mensagem, enviar saudação. Se não tiver CPF coletado, pedir CPF. Quando receber CPF, validar usando a tool 'validate_cpf'. Se válido, seguir para próxima etapa.\",\"mcpServers\":[{\"type\":\"mcp\",\"server_label\":\"core\",\"server_url\":\"https://SEU_MCP_SERVER/mcp\",\"require_approval\":\"never\"}]}"
```

## MCP (Model Context Protocol)

Cada `assistant.mcpServers[]` define servidores MCP (sem hardcode de tools).

Formato atual suportado (OpenAI Responses API `tools: [{type:\"mcp\", ...}]`):

```json
{
  "type": "mcp",
  "server_label": "core",
  "server_url": "https://seu-servidor-mcp.exemplo/sse",
  "require_approval": "never",
  "allowed_tools": ["tool_a", "tool_b"],
  "authorization": "oauth-or-token (opcional)"
}
```

Os servidores MCP devem expor JSON-RPC 2.0 (HTTP) com métodos:

- `tools/list`
- `tools/call`

## MCP Gateway (HTTP → MCP)

Você pode cadastrar rotas HTTP como “skills/tools” e expor isso como MCP para o bot consumir:

- `docs/MCP_GATEWAY.md:1`

## Flow Engine (IA)

O motor decide a próxima ação usando:

- `assistant.prompt` (FLOW_PROMPT)
- `conversation.currentStep`, `conversation.variables`, `conversation.history`
- tools MCP configuradas em `assistant.mcpServers` (executadas pela OpenAI via Responses API)

Configuração:

- `OPENAI_API_KEY` + `OPENAI_MODEL` (motor via Responses API)

## Como escrever o prompt (DSL)

Para fluxos determinísticos (com condicionais, steps e variáveis), use o prompt em **DSL JSON v1**:

- `docs/PROMPT_DSL.md:1`

Você pode usar texto livre ou um JSON estruturado (DSL) dentro do prompt.

## Modelos (MongoDB)

- `assistants`: prompt do fluxo + configuração de `mcpServers`
- `conversations`: estado por `clientId + assistantId`
- `logs`: auditoria completa por `conversationId`

## Admin (logs via API)

- `GET /admin/logs?conversationId=<id>&limit=100&order=desc`
- Header: `x-admin-token: <ADMIN_TOKEN>`

Configure `ADMIN_TOKEN` no `.env` (local) e nas env vars da Vercel.

## E2E

Roda um fluxo completo (cria `integration`, cria `assistant`, chama `/message` e dispara MCP):

```bash
E2E_BASE_URL=http://localhost:3000 node scripts/e2e.mjs
```

## Frontend (simple)

Um front simples estÃ¡tico estÃ¡ em `public/index.html` e Ã© servido em `GET /`.
