import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { app } from "../dist/app.js";
import { closeDb, collections, connectDb, ensureIndexes } from "../dist/db.js";

const hasMongo = Boolean(process.env.MONGODB_URL);
const RUN_ID = Date.now();
const EMAIL = `test+${RUN_ID}@example.com`;
const EMAIL2 = `test+${RUN_ID}+other@example.com`;
const PASSWORD = "test-password-123";

describe("API integration (MongoDB)", { skip: !hasMongo && "MONGODB_URL not set — skipping integration tests" }, () => {
  let token;
  let userId;
  let audit;

  before(async () => {
    await connectDb();
    await ensureIndexes();
  });

  after(async () => {
    try {
      const db = collections();
      const users = await db.users.find({ email: { $in: [EMAIL, EMAIL2] } }).toArray();
      const ids = users.map((u) => u._id);
      if (ids.length) {
        await db.audits.deleteMany({ userId: { $in: ids } });
        await db.users.deleteMany({ _id: { $in: ids } });
      }
      if (audit?.public_id) {
        await db.audits.deleteMany({ publicId: audit.public_id });
      }
    } finally {
      await closeDb();
    }
  });

  it("GET /api/health returns ok", async () => {
    const res = await request(app).get("/api/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
  });

  it("registers a user and returns a Bearer token", async () => {
    const res = await request(app).post("/api/auth/register").send({ email: EMAIL, password: PASSWORD });
    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.ok(res.body.user.id);
    assert.equal(res.body.user.email, EMAIL);
    assert.equal(res.body.user.credits, 2);
    token = res.body.token;
    userId = res.body.user.id;
  });

  it("GET /api/auth/me works with the token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.email, EMAIL);
  });

  it("rejects duplicate email registration", async () => {
    const res = await request(app).post("/api/auth/register").send({ email: EMAIL, password: PASSWORD });
    assert.equal(res.status, 409);
  });

  it("logs in and returns a fresh token", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: EMAIL, password: PASSWORD });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
  });

  it("requires auth for audit history", async () => {
    const res = await request(app).get("/api/audits");
    assert.equal(res.status, 401);
  });

  it("requires auth to create an audit", async () => {
    const res = await request(app).post("/api/audits").send({ url: "https://example.com", language: "en" });
    assert.equal(res.status, 401);
  });

  it("rejects blocked URLs (SSRF/localhost)", async () => {
    const res = await request(app)
      .post("/api/audits")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "http://localhost:8000", language: "en" });
    assert.equal(res.status, 422);
  });

  it("creates an audit and completes it", { timeout: 90_000 }, async () => {
    const created = await request(app)
      .post("/api/audits")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "https://example.com", language: "en" });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, "queued");
    audit = created.body;
    assert.ok(audit.share_id);

    // Poll until the audit finishes or fails.
    let current = audit;
    for (let i = 0; i < 60; i++) {
      if (current.status === "completed" || current.status === "failed") break;
      await new Promise((r) => setTimeout(r, 1000));
      const res = await request(app)
        .get(`/api/audits/${audit.public_id}`)
        .set("Authorization", `Bearer ${token}`);
      assert.equal(res.status, 200);
      current = res.body;
    }
    assert.ok(["completed", "failed"].includes(current.status));
    if (current.status === "completed") {
      assert.ok(current.overall_score !== null);
      assert.ok(Array.isArray(current.results.checks));
      assert.ok(current.results.checks.length > 0);
    }
  });

  it("public share link is viewable without login", async () => {
    const res = await request(app).get(`/api/audits/shared/${audit.share_id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.public_id, audit.public_id);
  });

  it("lists audits and stats for the authenticated user", async () => {
    const list = await request(app).get("/api/audits").set("Authorization", `Bearer ${token}`);
    assert.equal(list.status, 200);
    assert.ok(Array.isArray(list.body));
    assert.ok(list.body.some((a) => a.public_id === audit.public_id));

    const stats = await request(app).get("/api/audits/stats").set("Authorization", `Bearer ${token}`);
    assert.equal(stats.status, 200);
    assert.ok(stats.body.total_audits >= 1);
  });

  it("blocks another user from viewing a private audit", async () => {
    const other = await request(app).post("/api/auth/register").send({ email: EMAIL2, password: PASSWORD });
    assert.equal(other.status, 201);
    const otherToken = other.body.token;

    const res = await request(app)
      .get(`/api/audits/${audit.public_id}`)
      .set("Authorization", `Bearer ${otherToken}`);
    assert.equal(res.status, 403);
  });

  it("consumes credits and blocks audits when credits run out", { timeout: 90_000 }, async () => {
    const second = await request(app)
      .post("/api/audits")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "https://example.com", language: "en" });
    assert.equal(second.status, 201);

    // Wait for the second audit to finish so no background work is left running.
    let current = second.body;
    for (let i = 0; i < 60; i++) {
      if (current.status === "completed" || current.status === "failed") break;
      await new Promise((r) => setTimeout(r, 1000));
      const res = await request(app)
        .get(`/api/audits/${current.public_id}`)
        .set("Authorization", `Bearer ${token}`);
      assert.equal(res.status, 200);
      current = res.body;
    }
    assert.ok(["completed", "failed"].includes(current.status));

    const blocked = await request(app)
      .post("/api/audits")
      .set("Authorization", `Bearer ${token}`)
      .send({ url: "https://example.com", language: "en" });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.detail.code, "credits_exhausted");
  });

  it("allows the owner to delete their audit", async () => {
    const res = await request(app)
      .delete(`/api/audits/${audit.public_id}`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  it("logout returns ok", async () => {
    const res = await request(app).post("/api/auth/logout");
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });
});
