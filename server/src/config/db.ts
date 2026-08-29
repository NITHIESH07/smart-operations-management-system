import mongoose from 'mongoose';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4']);
/**
 * Establishes connection to MongoDB using Mongoose.
 * Reads the URI strictly from process.env.MONGODB_URI.
 */
export const connectDB = async (): Promise<typeof mongoose | null> => {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌ MONGODB_URI is not defined in environment variables.');
    return null;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB Connected (Atlas): ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ MongoDB Atlas Connection Error: ${errorMessage}`);
    return null;
  }
};

export default connectDB;


