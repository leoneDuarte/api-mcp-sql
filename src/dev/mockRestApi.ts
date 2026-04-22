import express from 'express';

const app = express();
app.use(express.json({ limit: '1mb' }));

app.get('/customers/:cpf', (req, res) => {
  const cpf = String(req.params.cpf ?? '').replace(/\D+/g, '');
  if (!/^\d{11}$/.test(cpf)) return res.status(400).json({ error: 'invalid_cpf' });
  return res.json({
    cpf,
    name: 'Cliente ' + cpf.slice(-4),
    address: 'Rua Exemplo, 123',
    status: cpf.endsWith('0') ? 'blocked' : 'active'
  });
});

app.post('/tickets', (req, res) => {
  const subject = String(req.body?.subject ?? '');
  const description = String(req.body?.description ?? '');
  if (!subject) return res.status(400).json({ error: 'missing_subject' });
  const ticketId = 'RST-' + Math.floor(Math.random() * 900000 + 100000);
  return res.status(201).json({ ticketId, subject, description, createdAt: new Date().toISOString() });
});

const port = Number(process.env.MOCK_REST_PORT ?? 7100);
app.listen(port, () => {
  console.log(`[mock-rest] listening on http://localhost:${port}`);
});

