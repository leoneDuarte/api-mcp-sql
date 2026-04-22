import 'dotenv/config';
import mongoose from 'mongoose';

const APPLY = process.argv.includes('--apply');

function mustUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  return uri;
}

function asRegexList() {
  // Only patterns we used during automated tests in this repo.
  return [
    /^httpbin-demo-/i,
    /^trace-demo-/i,
    /^Assistente E2E /i,
    /^Assistente Trace /i,
    /^Assistente Fluxo Complexo$/i,
    /^Fluxo CPF \(teste\)$/i
  ];
}

function clientIdRegex() {
  return /^(client-(e2e|trace|test)-|trace-smoke)/i;
}

async function main() {
  const uri = mustUri();
  await mongoose.connect(uri);

  const Assistants = mongoose.connection.collection('assistants');
  const Integrations = mongoose.connection.collection('integrations');
  const Conversations = mongoose.connection.collection('conversations');
  const Logs = mongoose.connection.collection('logs');

  const nameOr = asRegexList().map((re) => ({ name: { $regex: re } }));

  const assistants = await Assistants.find({ $or: nameOr }).project({ _id: 1, name: 1 }).toArray();
  const integrations = await Integrations.find({ $or: nameOr }).project({ _id: 1, name: 1 }).toArray();

  const assistantIds = assistants.map((a) => a._id);
  const integrationIds = integrations.map((i) => i._id);

  const conversations = await Conversations.find({
    $or: [
      assistantIds.length ? { assistantId: { $in: assistantIds } } : null,
      { clientId: { $regex: clientIdRegex() } }
    ].filter(Boolean)
  })
    .project({ _id: 1, clientId: 1, assistantId: 1 })
    .toArray();

  const conversationIds = conversations.map((c) => c._id);

  const counts = {
    assistants: assistants.length,
    integrations: integrations.length,
    conversations: conversations.length,
    logs: conversationIds.length
      ? await Logs.countDocuments({ conversationId: { $in: conversationIds } })
      : 0
  };

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? 'apply' : 'dry-run',
        match: {
          assistantNamePatterns: asRegexList().map((r) => String(r)),
          integrationNamePatterns: asRegexList().map((r) => String(r)),
          conversationClientIdPattern: String(clientIdRegex())
        },
        counts,
        sample: {
          assistants: assistants.slice(0, 5),
          integrations: integrations.slice(0, 5),
          conversations: conversations.slice(0, 5)
        }
      },
      null,
      2
    )
  );

  if (!APPLY) {
    console.log('\nNo changes made. Re-run with --apply to delete matched test data.');
    await mongoose.disconnect();
    return;
  }

  if (conversationIds.length) {
    await Logs.deleteMany({ conversationId: { $in: conversationIds } });
    await Conversations.deleteMany({ _id: { $in: conversationIds } });
  }

  if (assistantIds.length) {
    await Assistants.deleteMany({ _id: { $in: assistantIds } });
  }

  if (integrationIds.length) {
    await Integrations.deleteMany({ _id: { $in: integrationIds } });
  }

  console.log('\nDeleted test data.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

