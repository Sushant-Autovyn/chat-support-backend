const mongoose = require('mongoose');

function maskMongoUri(uri) {
  try {
    // mask password if present: mongodb+srv://user:pass@host/... -> mongodb+srv://user:*****@host/...
    return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:\/]+:)([^@]+)(@)/i, (m, p1, p2, p3) => `${p1}*****${p3}`);
  } catch (e) {
    return uri;
  }
}

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/supportchat';

    if (!process.env.MONGO_URI) {
      console.warn('MONGO_URI not set in environment; using local fallback. (This will fail on Render)');
    }

    console.log('Attempting MongoDB connection to:', maskMongoUri(mongoUri));

    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // Provide detailed error info for troubleshooting (do not leak the raw URI)
    console.error('Error connecting to MongoDB:', error && error.message ? error.message : error);
    if (error && error.stack) console.error(error.stack);
    // helpful hints
    console.error('Hints: verify MONGO_URI env var in Render, ensure username/password are correct, URL-encode special characters in the password, and allow Render IPs in Atlas Network Access.');
    process.exit(1);
  }
};

module.exports = connectDB;
