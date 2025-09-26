require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('node:crypto');
const { MongoClient } = require('mongodb');

const app = express();
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const MONGODB_URI = process.env.DATABASE_URL;
const MONGODB_DB = process.env.DATABASE_NAME;

let repos;

// Connect to MongoDB
MongoClient.connect(MONGODB_URI, { useUnifiedTopology: true })
  .then(client => {
    const db = client.db(MONGODB_DB);
    repos = db.collection('repositories');
    console.log('Connected to MongoDB');
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Raw body parser for signature verification
app.use('/webhook', bodyParser.raw({ type: '*/*' }));

function verifySignature(rawBody, signature, secret) {
  if (!signature) return false;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const expected = 'sha256=' + hmac.digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

app.post('/webhook', async (req, res) => {
  if (!WEBHOOK_SECRET) {
    return res.status(500).send('Webhook secret not set');
  }
  const signature = req.header('x-hub-signature-256');
  if (!verifySignature(req.body, signature, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  let body;
  try {
    body = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).send('Malformed JSON');
  }
  if (body && body.repository) {
    const repo = body.repository;
    if (body.action === 'created') {
      const info = {
        name: repo.name,
        description: repo.description || '',
        yearCreated: new Date(repo.created_at).getFullYear(),
        imageUrl: repo.owner.avatar_url,
        htmlUrl: repo.html_url,
        topics: Array.isArray(repo.topics) ? repo.topics : [],
      };
      await repos.insertOne(info);
      return res.status(200).send('Repository info saved!');
    } else if (body.action === 'deleted') {
      await repos.deleteOne({ name: repo.name });
      return res.status(200).send('Repository deleted from DB!');
    } else if (body.action === 'edited') {
      // Update the repository info in the DB
      const update = {
        $set: {
          description: repo.description || '',
          imageUrl: repo.owner.avatar_url,
          htmlUrl: repo.html_url,
          topics: Array.isArray(repo.topics) ? repo.topics : [],
        }
      };
      await repos.updateOne({ name: repo.name }, update);
      return res.status(200).send('Repository info updated!');
    }
  }
  res.status(200).send('Ignored');
});

app.use((req, res) => {
  res.status(404).send('Not found');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
