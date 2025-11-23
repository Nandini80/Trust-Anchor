/**
 * Script to fix the socket index issue in MongoDB
 * Run this once: node server/scripts/fixSocketIndex.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

async function fixSocketIndex() {
  try {
    // Connect to MongoDB
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/test';
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('users');

    // Try to drop the existing index
    try {
      await collection.dropIndex('socket_1');
      console.log('✅ Dropped existing socket_1 index');
    } catch (err) {
      if (err.code === 27 || err.codeName === 'IndexNotFound') {
        console.log('ℹ️  Index does not exist, will create new one');
      } else {
        console.log('⚠️  Error dropping index:', err.message);
      }
    }

    // Create new sparse index
    await collection.createIndex({ socket: 1 }, { unique: true, sparse: true });
    console.log('✅ Created new sparse unique index on socket field');

    console.log('\n✅ Index fix completed! You can now register users without socket values.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixSocketIndex();

