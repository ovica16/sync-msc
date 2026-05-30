import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI as string;

if (!MONGODB_URI) {
  throw new Error("Define MONGODB_URI en .env.local");
}

let cached = (global as any).mongoose as {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  indexesFixed?: boolean;
};

if (!cached) {
  (global as any).mongoose = { conn: null, promise: null };
  cached = (global as any).mongoose;
}

export async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false });
  }

  cached.conn = await cached.promise;

  // One-time: drop the old non-partial email_1 unique index so that
  // users without email can coexist (replaced by partial index in schema)
  if (!cached.indexesFixed) {
    cached.indexesFixed = true;
    cached.conn.connection.db
      ?.collection("usuarios")
      .dropIndex("email_1")
      .catch(() => {}); // silently ignore if index doesn't exist or already dropped
  }

  return cached.conn;
}
