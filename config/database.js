const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/chaat-support';

    // High-performance MongoDB connection settings
    const options = {
      maxPoolSize: 50,
      minPoolSize: 10,
      maxIdleTimeMS: 45000,
      waitQueueTimeoutMS: 10000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      w: 'majority'
    };

    await mongoose.connect(mongoURI, options);

    // Monitor connection pool
    mongoose.connection.on('open', () => {
      console.log('✓ Database connected with connection pooling enabled');
    });

    mongoose.connection.on('error', (err) => {
      console.error('Database connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('Database disconnected');
    });

    return mongoose.connection;
  } catch (error) {
    console.error('Error connecting to database:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
