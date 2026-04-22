import 'dotenv/config';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

async function http(method, path, body, extraHeaders = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...extraHeaders
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status}: ${typeof json === 'string' ? json : JSON.stringify(json)}`);
  }
  return json;
}

function nowSuffix() {
  return new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
}

async function main() {
  console.log(`[e2e] base=${BASE_URL}`);

  const integrationName = `httpbin-demo-${nowSuffix()}`;
  const integration = await http('POST', '/integrations', {
    name: integrationName,
    baseUrl: 'https://httpbin.org',
    auth: { type: 'none' },
    tools: [
      {
        name: 'httpbin_get',
        description: 'GET /get with query params',
        method: 'GET',
        path: '/get',
        query: { cpf: '{{cpf}}', name: '{{name}}' },
        inputSchema: {
          type: 'object',
          properties: { cpf: { type: 'string' }, name: { type: 'string' } },
          required: ['cpf']
        }
      }
    ]
  });

  console.log(`[e2e] integrationId=${integration._id}`);

  const prompt = [
    'Você é um motor de automação.',
    'Colete variáveis e execute ferramentas MCP quando as condições baterem.',
    '',
    'Regras:',
    '1) Se variables.saudadacao_enviada != true, enviar saudação e setVariables.saudadacao_enviada=true.',
    '2) Se cpf não existir, pedir CPF. Ao receber, extrair cpf do texto (apenas números) e setVariables.cpf.',
    '3) Se nome não existir, pedir nome. Ao receber, setVariables.nome.',
    '4) Se endereco não existir, pedir endereço. Ao receber, setVariables.endereco.',
    '5) Condicional múltipla: se cpf, nome e endereco estiverem preenchidos E variables.dados_buscados != true,',
    '   chamar a tool MCP httpbin_get com arguments { cpf: {{cpf}}, name: {{nome}} }.',
    '   Depois setVariables.dados_buscados=true.',
    '6) currentStep: use coleta|busca|final.',
    '7) Nunca repita a chamada MCP: controle por dados_buscados.',
    ''
  ].join('\n');

  const assistant = await http('POST', '/assistants', {
    name: `Assistente E2E ${nowSuffix()}`,
    prompt,
    mcpServers: [
      {
        type: 'mcp',
        server_label: 'httpbin',
        server_description: 'Gateway MCP (integrações HTTP)',
        server_url: `${BASE_URL}/mcp/${integration._id}`,
        require_approval: 'never',
        allowed_tools: ['httpbin_get']
      }
    ]
  });

  console.log(`[e2e] assistantId=${assistant._id}`);

  const clientId = `client-e2e-${nowSuffix()}`;
  const assistantId = assistant._id;

  const t1 = await http('POST', '/message', { clientId, assistantId, message: 'Oi', metadata: {} });
  console.log(`[e2e] conversationId=${t1.conversationId}`);
  console.log(`[e2e] t1.responses=${JSON.stringify(t1.responses)}`);

  const t2 = await http('POST', '/message', {
    clientId,
    assistantId,
    message: 'Meu CPF é 123 e meu nome é Leone',
    metadata: {}
  });
  console.log(`[e2e] t2.variablesKeys=${Object.keys(t2.variables ?? {}).join(',')}`);
  console.log(`[e2e] t2.responses=${JSON.stringify(t2.responses)}`);

  const t3 = await http('POST', '/message', {
    clientId,
    assistantId,
    message: 'Endereço: Rua A, 123',
    metadata: {}
  });
  console.log(`[e2e] t3.currentStep=${t3.currentStep}`);
  console.log(`[e2e] t3.responses=${JSON.stringify(t3.responses)}`);

  if (ADMIN_TOKEN) {
    const logs = await http(
      'GET',
      `/admin/logs?conversationId=${t3.conversationId}&limit=50&order=desc`,
      undefined,
      { 'x-admin-token': ADMIN_TOKEN }
    );
    const mcpCalls = (logs.logs ?? []).filter((l) => l.action === 'openai_mcp_event' && l.payload?.type === 'mcp_call');
    console.log(`[e2e] logs.total=${(logs.logs ?? []).length} mcp_calls=${mcpCalls.length}`);
    if (mcpCalls[0]) {
      console.log(`[e2e] last_mcp_call.name=${mcpCalls[0].response?.name} status=${mcpCalls[0].response?.status}`);
    }
  } else {
    console.log('[e2e] ADMIN_TOKEN not set; skipping /admin/logs check');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

