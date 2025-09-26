require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.DATABASE_URL;
const DATABASE_NAME = process.env.DATABASE_NAME;

console.log('URI (first 30 chars):', MONGO_URI ? MONGO_URI.substring(0, 30) : '');
console.log('Database name:', DATABASE_NAME);

const client = new MongoClient(MONGO_URI, { useUnifiedTopology: true });
const db = client.db(DATABASE_NAME);
const repos = db.collection('repositories');

module.exports = { client, db, repos };