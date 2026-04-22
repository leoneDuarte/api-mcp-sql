# Prompt DSL (Flow) — v1

Este documento descreve um formato de prompt (DSL JSON v1) que você pode usar dentro de `assistant.prompt` para escrever fluxos de forma estruturada.

Obs.: a execução de tools MCP segue o padrão da OpenAI (Responses API com `tools: [{type:\"mcp\", ...}]`). O seu backend não lista/chama tools diretamente.

---

## Estrutura do fluxo

O prompt deve ser um JSON com este formato:

```json
{
  "version": 1,
  "initialStep": "start",
  "globalRules": [],
  "steps": {
    "start": { "rules": [] }
  }
}
```

- `version`: sempre `1`
- `initialStep`: step inicial (string) ou `null`
- `globalRules`: regras avaliadas **antes** do step atual (útil para “cancelar”, “ajuda”, etc.)
- `steps`: mapa `{ [stepName]: { rules: Rule[] } }`

---

## Como o motor executa

Em cada `POST /message`, o motor:

1) Carrega `conversation.currentStep` e `conversation.variables`
2) Avalia as regras do step atual (e `globalRules`)
3) Executa as `actions` retornadas
4) Pode iterar até **3 vezes** no mesmo turno quando houver mudanças de estado (ex.: `set_step`, `set_variable`, `extract_variable`) ou `call_tool`, para permitir “coletar → chamar tool → responder” no mesmo request
5) Persiste:
   - `conversation.currentStep`
   - `conversation.variables`
   - `conversation.history`
   - `logs` (auditoria)

Importante: `variables` **persistem**. Se você criar uma condicional “quando cpf/nome/endereco existirem”, ela ficará verdadeira para sempre. Para não executar toda hora, use **travas** (ver “Guards”).

---

## Guards (para não executar sempre)

Padrões recomendados:

- **Por step**: só execute uma regra em um step específico, depois mude o step.
- **Por flag**: defina uma variável `*_done=true` após executar a ação, e condicione com `not hasVar`.

Exemplo (flag):

```json
{
  "when": {
    "all": [
      { "hasVar": "cpf" },
      { "hasVar": "nome" },
      { "hasVar": "endereco" },
      { "not": { "hasVar": "dados_buscados" } }
    ]
  },
  "actions": [
    {
      "type": "call_tool",
      "toolName": "buscar_dados",
      "arguments": { "cpf": "{{cpf}}", "nome": "{{nome}}", "endereco": "{{endereco}}" },
      "saveResultAs": "dados"
    },
    { "type": "set_variable", "name": "dados_buscados", "value": true }
  ]
}
```

---

## Rules

Cada `Rule` tem:

```json
{
  "when": { /* condition */ },
  "actions": [ /* actions */ ]
}
```

- `when` é opcional (se não existir, a regra pode bater)
- A primeira regra cujo `when` bater é aplicada (ordem importa)

---

## Conditions (when)

Você pode compor condições com:

### 1) Combinadores

- `{ "all": [Condition, ...] }` (AND)
- `{ "any": [Condition, ...] }` (OR)
- `{ "not": Condition }` (NOT)

### 2) Estado da conversa

- `{ "stepIs": "nome_do_step" }` ou `{ "stepIs": null }`
- `{ "firstMessage": true }` (primeira mensagem do usuário na conversa)

### 3) Variáveis

- `{ "hasVar": "cpf" }` (existe e não é vazio)
- `{ "varEquals": { "name": "plano", "value": "premium" } }`
- `{ "varPathEquals": { "path": "ticket.content.created", "value": true } }`

### 4) Comparações (numéricas ou lexicográficas)

Formato:

```json
{
  "compare": {
    "left": { "var": "age" },
    "op": "gte",
    "right": { "value": 18 }
  }
}
```

Operadores:

- `eq`, `neq`, `gt`, `gte`, `lt`, `lte`

Operandos (`left/right`) podem ser:

- `{ "var": "income" }` (variável no topo de `variables`)
- `{ "path": "calc_result.content.value" }` (path aninhado)
- `{ "value": 5000 }` (literal)

O motor tenta comparar como **número** quando ambos viram número; caso contrário compara como **string**.

### 5) Texto da mensagem

- `{ "messageMatches": "regex" }` (regex em string; é avaliado como case-insensitive)

---

## Actions

`actions` é um array. Tipos disponíveis:

### `respond`

```json
{ "type": "respond", "text": "Olá {{nome}}" }
```

Também grava a mensagem no `conversation.history` como `assistant`.

### `set_step`

```json
{ "type": "set_step", "step": "collect_email" }
```

Use `null` para “sem step”.

### `set_variable`

```json
{ "type": "set_variable", "name": "plano", "value": "premium" }
```

Se `value` for string, templates `{{...}}` são resolvidos. Se for objeto/array, resolve templates recursivamente.

### `extract_variable`

Extrai uma variável do texto do usuário via regex.

```json
{
  "type": "extract_variable",
  "name": "cpf",
  "pattern": "(\\d[\\d\\.\\-\\s]{9,}\\d)",
  "group": 1,
  "transform": "digits"
}
```

- `pattern`: regex em string
- `group`: grupo de captura (default `0`)
- `transform`:
  - `none`
  - `digits` (remove não-dígitos)
  - `number` (tenta converter em número; útil para renda/idade)
  - `lowercase`, `uppercase`, `trim`

### `call_tool`

Chama uma tool MCP (descoberta dinamicamente via `tools/list`).

```json
{
  "type": "call_tool",
  "toolName": "validate_cpf",
  "arguments": { "cpf": "{{cpf}}" },
  "saveResultAs": "cpf_validation"
}
```

- `arguments` aceita templates `{{...}}` em strings/objetos
- `saveResultAs` salva o retorno inteiro em `variables[saveResultAs]`

### `noop`

```json
{ "type": "noop" }
```

---

## Templates `{{variavel}}`

Você pode usar templates em `respond.text` e em `call_tool.arguments`/`set_variable.value`.

Regras:

- `{{cpf}}` lê `variables.cpf`
- Suporta path: `{{ticket.content.ticketId}}`
- Se não existir, vira string vazia

Built-ins (sempre setados no começo do turno):

- `{{incoming}}`: mensagem atual do usuário
- `{{last_message}}`: mensagem atual do usuário (alias)

---

## Logs (auditoria)

O motor grava na collection `logs` ações como:

- `message_received`
- `decision` (inclui `mode: "dsl"` quando DSL)
- `extract_variable`
- `tool_call`

Cada log tem `conversationId`, `action`, `payload`, `response`, `timestamp`.

---

## Exemplo completo (múltiplas variáveis + maior/igual)

```json
{
  "version": 1,
  "initialStep": "start",
  "steps": {
    "start": {
      "rules": [
        {
          "when": { "firstMessage": true },
          "actions": [
            { "type": "respond", "text": "Qual sua idade?" },
            { "type": "set_step", "step": "age" }
          ]
        }
      ]
    },
    "age": {
      "rules": [
        {
          "when": { "messageMatches": "\\\\d" },
          "actions": [
            { "type": "extract_variable", "name": "age", "pattern": "(\\\\d{1,3})", "group": 1, "transform": "number" },
            { "type": "respond", "text": "Qual sua renda?" },
            { "type": "set_step", "step": "income" }
          ]
        }
      ]
    },
    "income": {
      "rules": [
        {
          "when": { "messageMatches": "\\\\d" },
          "actions": [
            { "type": "extract_variable", "name": "income", "pattern": "([0-9][0-9\\\\.,\\\\s]*)", "group": 1, "transform": "number" },
            {
              "type": "respond",
              "text": "Ok. Resultado: {{age}} / {{income}}"
            },
            {
              "type": "respond",
              "text": "Aprovado se age>=18 E income>=5000"
            },
            {
              "type": "set_step",
              "step": "decision"
            }
          ]
        }
      ]
    },
    "decision": {
      "rules": [
        {
          "when": {
            "all": [
              { "compare": { "left": { "var": "age" }, "op": "gte", "right": { "value": 18 } } },
              { "compare": { "left": { "var": "income" }, "op": "gte", "right": { "value": 5000 } } }
            ]
          },
          "actions": [
            { "type": "respond", "text": "APROVADO" },
            { "type": "set_step", "step": "done" }
          ]
        },
        {
          "when": { "messageMatches": ".*" },
          "actions": [
            { "type": "respond", "text": "NEGADO" },
            { "type": "set_step", "step": "done" }
          ]
        }
      ]
    },
    "done": { "rules": [ { "when": { "messageMatches": ".*" }, "actions": [ { "type": "respond", "text": "Fim." }, { "type": "set_step", "step": null } ] } ] }
  }
}
```
