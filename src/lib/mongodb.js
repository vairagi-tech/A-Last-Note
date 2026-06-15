import { MongoClient } from "mongodb";

// Lazily create ONE client connection — NEVER at module load. Creating it at the
// top level would run during `next build` (page-data collection), forcing the
// build to have a valid MONGODB_URI just to compile. Instead we connect on the
// first getDb() call (request time), cache it for the life of the serverless
// instance, and in dev cache on `global` so HMR doesn't open new pools.
let clientPromise;

// Clean common paste artifacts from the env value before handing it to the driver.
// On hosts like Vercel people often paste the value WITH surrounding quotes, a
// trailing newline, or even the `MONGODB_URI=` prefix — any of which makes the
// driver throw "Invalid scheme". We strip those and validate the scheme so the
// log says exactly what's wrong instead of a cryptic parser error.
function cleanUri(raw) {
  let uri = String(raw).trim();
  // Strip an accidentally-included `KEY=` prefix (e.g. the whole .env line pasted).
  uri = uri.replace(/^MONGODB_URI\s*=\s*/i, "").trim();
  // Strip one layer of surrounding single or double quotes.
  if ((uri.startsWith('"') && uri.endsWith('"')) || (uri.startsWith("'") && uri.endsWith("'"))) {
    uri = uri.slice(1, -1).trim();
  }
  return uri;
}

function connect() {
  const raw = process.env.MONGODB_URI;
  if (!raw) throw new Error("MONGODB_URI is not set");
  const uri = cleanUri(raw);
  if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
    // Don't log the value (it has credentials) — just the diagnosis.
    throw new Error(`MONGODB_URI has an invalid scheme (must start with mongodb:// or mongodb+srv://). Check the Vercel env var for quotes/whitespace. Got prefix: "${uri.slice(0, 12)}…"`);
  }
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
