import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const options = {};

let client;
let clientPromise;

if (!uri) {
  throw new Error("Please add MONGODB_URI to .env.local");
}

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;

export async function getDb() {
  const client = await clientPromise;
  return client.db("letter-platform");
}

export async function getLetters() {
  const db = await getDb();
  return db.collection("letters");
}

export async function getSessions() {
  const db = await getDb();
  return db.collection("sessions");
}

export async function getReaders() {
  const db = await getDb();
  return db.collection("readers");
}

export async function getUserSettings() {
  const db = await getDb();
  return db.collection("userSettings");
}
