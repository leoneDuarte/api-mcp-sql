import express from 'express';

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params?: any;
};

function ok(id: string, result: unknown) {
  return { jsonrpc: '2.0', id, result };
}

function err(id: string, code: number, message: string, data?: unknown) {
  return { jsonrpc: '2.0', id, error: { code, message, data } };
}

function validateCpfDigits(digits: string) {
  // validação simples (não é o algoritmo oficial)
  if (!/^\d{11}$/.test(digits)) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  return true;
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const app = express();
app.use(express.json({ limit: '1mb' }));

app.post('/mcp', (req, res) => {
  const body = req.body as JsonRpcRequest;
  if (!body || body.jsonrpc !== '2.0' || !body.id || !body.method) {
    return res.status(400).json(err(body?.id ?? 'unknown', -32600, 'Invalid Request'));
  }

  if (body.method === 'tools/list') {
    return res.json(
      ok(body.id, {
        tools: [
          {
            name: 'validate_cpf',
            description: 'Valida CPF (mock)',
            inputSchema: {
              type: 'object',
              properties: { cpf: { type: 'string' } },
              required: ['cpf']
            }
          },
          {
            name: 'validate_email',
            description: 'Valida e-mail (mock)',
            inputSchema: {
              type: 'object',
              properties: { email: { type: 'string' } },
              required: ['email']
            }
          },
          {
            name: 'create_ticket',
            description: 'Cria ticket (mock)',
            inputSchema: {
              type: 'object',
              properties: {
                clientId: { type: 'string' },
                subject: { type: 'string' },
                description: { type: 'string' }
              },
              required: ['clientId', 'subject']
            }
          },
          {
            name: 'calc',
            description: 'Calculadora simples (mock): add/sub/mul/div',
            inputSchema: {
              type: 'object',
              properties: {
                op: { type: 'string', enum: ['add', 'sub', 'mul', 'div'] },
                a: { type: 'number' },
                b: { type: 'number' }
              },
              required: ['op', 'a', 'b']
            }
          },
          {
            name: 'send_message',
            description: 'Envia mensagem ao usuário (mock)',
            inputSchema: {
              type: 'object',
              properties: { clientId: { type: 'string' }, text: { type: 'string' } },
              required: ['clientId', 'text']
            }
          }
        ]
      })
    );
  }

  if (body.method === 'tools/call') {
    const name = body.params?.name;
    const args = body.params?.arguments ?? {};

    if (name === 'validate_cpf') {
      const cpf = String(args.cpf ?? '').replace(/\D+/g, '');
      const valid = validateCpfDigits(cpf);
      return res.json(ok(body.id, { content: { valid, cpf } }));
    }

    if (name === 'validate_email') {
      const email = String(args.email ?? '').trim();
      const valid = validateEmail(email);
      return res.json(ok(body.id, { content: { valid, email } }));
    }

    if (name === 'create_ticket') {
      const clientId = String(args.clientId ?? '');
      const subject = String(args.subject ?? '');
      const description = String(args.description ?? '');
      const ticketId = 'TCK-' + Math.floor(Math.random() * 900000 + 100000);
      return res.json(ok(body.id, { content: { created: true, ticketId, clientId, subject, description } }));
    }

    if (name === 'calc') {
      const op = String(args.op ?? '');
      const a = Number(args.a);
      const b = Number(args.b);
      if (!Number.isFinite(a) || !Number.isFinite(b)) {
        return res.json(ok(body.id, { isError: true, errorMessage: 'Invalid numbers' }));
      }
      let value: number;
      if (op === 'add') value = a + b;
      else if (op === 'sub') value = a - b;
      else if (op === 'mul') value = a * b;
      else if (op === 'div') value = b === 0 ? NaN : a / b;
      else return res.json(ok(body.id, { isError: true, errorMessage: `Unknown op: ${op}` }));

      if (!Number.isFinite(value)) {
        return res.json(ok(body.id, { isError: true, errorMessage: 'Result is not finite' }));
      }
      return res.json(ok(body.id, { content: { value } }));
    }

    if (name === 'send_message') {
      const clientId = String(args.clientId ?? '');
      const text = String(args.text ?? '');
      return res.json(ok(body.id, { content: { sent: true, clientId, text } }));
    }

    return res.json(ok(body.id, { isError: true, errorMessage: `Unknown tool: ${name}` }));
  }

  return res.json(err(body.id, -32601, `Method not found: ${body.method}`));
});

const port = Number(process.env.MOCK_MCP_PORT ?? 7000);
app.listen(port, () => {
  console.log(`[mock-mcp] listening on http://localhost:${port}/mcp`);
});
