const mongoose = require('mongoose');

let activeMongoUri = '';

const getMongoUri = () => activeMongoUri;

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/grocery_expense_db';
    
    // Set connection timeout to 4000ms so fallback activates quickly if local Mongo is not running
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 4000,
    });
    
    activeMongoUri = mongoUri;
    console.log(`[MongoDB] Connected to database: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    console.warn(`[MongoDB] Standard connection failed (${err.message}). Starting In-Memory MongoDB Server for instant local development...`);
    
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongod = await MongoMemoryServer.create();
      const inMemoryUri = mongod.getUri();
      activeMongoUri = inMemoryUri;
      
      const conn = await mongoose.connect(inMemoryUri);
      console.log(`[MongoDB] Successfully connected to In-Memory MongoDB at ${inMemoryUri}`);
      console.log(`[MongoDB Compass Connection String] 👉 ${inMemoryUri}`);
      return conn;
    } catch (memErr) {
      console.error(`[MongoDB] Fatal: Failed to initialize MongoDB:`, memErr);
      process.exit(1);
    }
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
    console.log('[MongoDB] Disconnected successfully');
  } catch (err) {
    console.error('[MongoDB] Error disconnecting:', err);
  }
};

module.exports = { connectDB, disconnectDB, getMongoUri };

