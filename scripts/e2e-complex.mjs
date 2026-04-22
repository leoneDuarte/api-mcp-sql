import 'dotenv/config';

const BASE_URL = (process.env.E2E_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

async function http(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
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
  console.log(`[e2e-complex] base=${BASE_URL}`);

  const suffix = nowSuffix();
  const integration = await http('POST', '/integrations', {
    name: `httpbin-demo-${suffix}`,
    baseUrl: 'https://httpbin.org',
    auth: { type: 'none' },
    tools: [
      {
        name: 'httpbin_get',
        description: 'GET /get with query params',
        method: 'GET',
        path: '/get',
        query: { cpf: '{{cpf}}', nome: '{{nome}}', endereco: '{{endereco}}' },
        inputSchema: {
          type: 'object',
          properties: {
            cpf: { type: 'string' },
            nome: { type: 'string' },
            endereco: { type: 'string' }
          },
          required: ['cpf', 'nome', 'endereco']
        }
      }
    ]
  });

  const integrationId = integration._id;
  console.log(`[e2e-complex] integrationId=${integrationId}`);

  const prompt = [
    'Você é um motor de automação.',
    'Colete variáveis, avalie condicionais e chame ferramentas MCP quando necessário.',
    '',
    'Variáveis: cpf (string), nome (string), endereco (string), idade (number), renda (number).',
    'Flags: saudacao_enviada (bool), dados_buscados (bool), aprovado (bool).',
    '',
    'Regras obrigatórias:',
    '1) Se variables.saudacao_enviada != true: responda uma saudação e setVariables.saudacao_enviada=true.',
    '2) Sempre tente extrair as variáveis da última mensagem (cpf, nome, endereco, idade, renda) e preencher setVariables.',
    '3) Coleta:',
    '   - Se cpf não existir: peça CPF e currentStep="coleta".',
    '   - Se nome não existir: peça nome e currentStep="coleta".',
    '   - Se endereco não existir: peça endereco e currentStep="coleta".',
    '   - Se idade não existir: peça idade e currentStep="coleta".',
    '   - Se renda não existir: peça renda e currentStep="coleta".',
    '4) Condicional com múltiplas variáveis + gate (para não repetir):',
    '   - Se cpf, nome e endereco preenchidos E variables.dados_buscados != true: chame MCP httpbin_get com arguments { cpf: {{cpf}}, nome: {{nome}}, endereco: {{endereco}} }.',
    '     Depois setVariables.dados_buscados=true e currentStep="busca".',
    '5) Condicionais numéricas:',
    '   - Se idade >= 18 E renda > 5000 E variables.aprovado != true: setVariables.aprovado=true; responda "Pré-aprovado"; currentStep="final".',
    '   - Se idade < 18: setVariables.aprovado=false; responda "Menor de idade"; currentStep="final".',
    '6) Nunca repita ações: use flags (dados_buscados, aprovado, saudacao_enviada).',
    '7) No fim, responda SOMENTE em JSON no formato exigido pelo motor.',
    ''
  ].join('\n');

  const assistant = await http('POST', '/assistants', {
    name: `Assistente E2E Complexo ${suffix}`,
    prompt,
    mcpServers: [
      {
        type: 'mcp',
        server_label: 'httpbin',
        server_description: 'Gateway MCP (integrações HTTP)',
        server_url: `${BASE_URL}/mcp/${integrationId}`,
        require_approval: 'never',
        allowed_tools: ['httpbin_get']
      }
    ]
  });

  const assistantId = assistant._id;
  console.log(`[e2e-complex] assistantId=${assistantId}`);

  const clientId = `client-test-${suffix}`;

  const turns = [];
  turns.push(await http('POST', '/message', { clientId, assistantId, message: 'Oi', metadata: {} }));
  turns.push(
    await http('POST', '/message', {
      clientId,
      assistantId,
      message: 'Meu CPF é 123, meu nome é Leone',
      metadata: {}
    })
  );
  turns.push(
    await http('POST', '/message', {
      clientId,
      assistantId,
      message: 'Meu endereço é Rua A, 123',
      metadata: {}
    })
  );
  turns.push(
    await http('POST', '/message', {
      clientId,
      assistantId,
      message: 'Tenho 25 anos e minha renda é 6000',
      metadata: {}
    })
  );

  const last = turns[turns.length - 1];
  console.log(
    JSON.stringify(
      {
        conversationId: last.conversationId,
        currentStep: last.currentStep,
        variables: last.variables,
        responses: last.responses
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

