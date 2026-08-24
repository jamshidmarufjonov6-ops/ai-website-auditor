import { Db, MongoClient, ObjectId } from "mongodb";
import { config } from "./config.js";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDb(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(config.mongoUrl, {
    serverSelectionTimeoutMS: 10_000,
  });
  await client.connect();
  db = client.db();
  return db;
}

export async function closeDb(): Promise<void> {
  await client?.close();
  client = null;
  db = null;
}

export function getDb(): Db {
  if (!db) throw new Error("Database not connected. Call connectDb() first.");
  return db;
}

export function collections() {
  const database = getDb();
  return {
    users: database.collection<UserDoc>("users"),
    audits: database.collection<AuditDoc>("audits"),
    websites: database.collection<WebsiteDoc>("websites"),
    webhookEvents: database.collection<WebhookEventDoc>("webhook_events"),
  };
}

export function toId(value: string | ObjectId): ObjectId {
  return typeof value === "string" ? new ObjectId(value) : value;
}

export interface UserDoc {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  createdAt: Date;
  credits?: number;
  stripeCustomerId?: string | null;
}

export interface WebsiteDoc {
  _id: ObjectId;
  domain: string;
  firstSeenAt: Date;
  lastAuditedAt?: Date;
}

export interface WebhookEventDoc {
  _id: ObjectId;
  eventId: string;
  eventType: string;
  processedAt: Date;
}

export interface AuditDoc {
  _id: ObjectId;
  publicId: string;
  shareId: string;
  userId: ObjectId | null;
  websiteId: ObjectId | null;
  url: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  stage: string;
  maxPages: number;
  language: string;
  overallScore?: number | null;
  categoryScores?: unknown | null;
  summary?: unknown | null;
  results?: unknown | null;
  aiRecommendations?: unknown | null;
  errorMessage?: string | null;
  errorCode?: string | null;
  startedAt: Date;
  completedAt?: Date | null;
}

export async function ensureIndexes(): Promise<void> {
  const c = collections();
  await c.users.createIndex({ email: 1 }, { unique: true });
  await c.audits.createIndex({ publicId: 1 }, { unique: true });
  // Replace any old non-sparse shareId index with a sparse unique index so
  // audits created before share links still coexist.
  try {
    await c.audits.dropIndex("shareId_1");
  } catch {
    // index does not exist yet
  }
  await c.audits.createIndex({ shareId: 1 }, { unique: true, sparse: true });
  await c.audits.createIndex({ userId: 1, startedAt: -1 });
  await c.audits.createIndex({ websiteId: 1, completedAt: -1 });
  await c.websites.createIndex({ domain: 1 }, { unique: true });
  await c.webhookEvents.createIndex({ eventId: 1 }, { unique: true });
}
