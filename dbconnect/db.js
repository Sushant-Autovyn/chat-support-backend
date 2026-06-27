const mongoose = require('mongoose');
const logger = require('../utils/logger');
const { config } = require('../config/env');

function maskMongoUri(uri) {
  try {
    return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:\/]+:)([^@]+)(@)/i, (m, p1, p2, p3) => `${p1}*****${p3}`);
  } catch (e) {
    return uri;
  }
}

const connectDB = async () => {
  const mongoUri = config.mongoUri;
  logger.info('Connecting to MongoDB', { uri: maskMongoUri(mongoUri) });

  // Connection-level resilience + pool sizing for high concurrency.
  // maxPoolSize 50 lets a single instance serve many simultaneous queries;
  // tune up if the host has more RAM/CPU headroom.
  mongoose.set('strictQuery', true);

  // Surface connection lifecycle for production debugging.
  const conn = mongoose.connection;
  conn.on('disconnected', () => logger.warn('MongoDB disconnected'));
  conn.on('reconnected', () => logger.info('MongoDB reconnected'));
  conn.on('error', (err) => logger.error('MongoDB connection error', { err: err.message }));

  try {
    await mongoose.connect(mongoUri, {
      maxPoolSize: parseInt(process.env.MONGO_MAX_POOL, 10) || 50,
      minPoolSize: parseInt(process.env.MONGO_MIN_POOL, 10) || 5,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4,
    });
    logger.info('MongoDB connected', { host: conn.host });
  } catch (error) {
    logger.error('Failed to connect to MongoDB', { err: error?.message || String(error) });
    logger.error('Hints: verify MONGO_URI, URL-encode special chars in the password, and whitelist host IPs in Atlas Network Access.');
    // Re-throw so the caller (app.js) decides how to exit — keeps shutdown logic centralised.
    throw error;
  }
};

module.exports = connectDB;
