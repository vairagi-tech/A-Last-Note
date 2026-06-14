import { MongoClient } from "mongodb";

// Lazily create ONE client connection — NEVER at module load. Creating it at the
// top level would run during `next build` (page-data collection), forcing the
// build to have a valid MONGODB_URI just to compile. Instead we connect on the
// first getDb() call (request time), cache it for the life of the serverless
// instance, and in dev cache on `global` so HMR doesn't open new pools.
let clientPromise;

function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) global._mongoClientPromise = new MongoClient(uri).connect();
    return global._mongoClientPromise;
  }
  return new MongoClient(uri).connect();
}

export async function getDb() {
  if (!clientPromise) clientPromise = connect();
  const client = await clientPromise;
  return client.db("letter-platform");
}

export async function getLetters() {
  return (await getDb()).collection("letters");
}

export async function getSessions() {
  return (await getDb()).collection("sessions");
}

export async function getReaders() {
  return (await getDb()).collection("readers");
}

export async function getUserSettings() {
  return (await getDb()).collection("userSettings");
}
