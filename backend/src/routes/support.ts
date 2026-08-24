import { Router } from "express";
import { ObjectId } from "mongodb";
import { config } from "../config.js";
import { collections, type MessageDoc, type MessageStatus } from "../db.js";
import { clientKey, contactPerHour } from "../rateLimit.js";
import { asyncHandler, optionalAuth, requiredAdmin, type AuthRequest } from "../middleware/auth.js";
import { forwardToAdmin } from "../services/mailer.js";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function serializeMessage(msg: MessageDoc) {
  return {
    id: String(msg._id),
    user_id: msg.userId ? String(msg.userId) : null,
    name: msg.name,
    email: msg.email,
    subject: msg.subject,
    body: msg.body,
    status: msg.status,
    email_forwarded: msg.emailForwarded,
    forward_error: msg.forwardError ?? null,
    created_at: msg.createdAt,
  };
}

export const supportRouter = Router();
supportRouter.use(optionalAuth);

/**
 * Public contact endpoint. Guests can send messages; logged-in users are
 * associated with their account automatically. Every message is stored in
 * MongoDB and (when SMTP is configured) forwarded to the admin's Gmail.
 */
supportRouter.post(
  "/contact",
  asyncHandler(async (req: AuthRequest, res) => {
    if (!config.adminEmail) {
      res.status(503).json({ detail: "Contact form is not available right now." });
      return;
    }
    if (!contactPerHour.allow(clientKey(req))) {
      res.status(429).json({ detail: "Too many messages. Please try again later." });
      return;
    }

    const body = req.body || {};
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!name || name.length > 120) {
      res.status(422).json({ detail: "Please enter your name." });
      return;
    }
    if (!EMAIL_RE.test(email) || email.length > 320) {
      res.status(422).json({ detail: "Please enter a valid email address." });
      return;
    }
    if (!subject || subject.length > 200) {
      res.status(422).json({ detail: "Please enter a subject (up to 200 characters)." });
      return;
    }
    if (!message || message.length < 10 || message.length > 5000) {
      res.status(422).json({ detail: "Message must be between 10 and 5000 characters." });
      return;
    }

    // Logged-in users always use their account email for accountability,
    // but they may type a different reply-to address.
    const userId = req.user?._id ?? null;

    const doc: MessageDoc = {
      _id: new ObjectId(),
      userId,
      name,
      email,
      subject,
      body: message,
      status: "new",
      emailForwarded: false,
      forwardError: null,
      ip: clientKey(req).slice(0, 64),
      createdAt: new Date(),
    };

    const forward = await forwardToAdmin({
      name,
      email,
      subject,
      body: message,
      userId: userId ? String(userId) : null,
      createdAt: doc.createdAt,
    });
    doc.emailForwarded = forward.sent;
    doc.forwardError = forward.error ?? null;

    await collections().messages.insertOne(doc);

    res.status(201).json({
      ok: true,
      id: String(doc._id),
      delivered: forward.sent,
    });
  })
);

/** Admin inbox: list all contact messages, newest first. */
supportRouter.get(
  "/admin/messages",
  requiredAdmin,
  asyncHandler(async (_req: AuthRequest, res) => {
    const messages = await collections()
      .messages.find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();
    const unread = await collections().messages.countDocuments({ status: "new" });
    res.json({
      total: messages.length,
      unread,
      mail_configured: Boolean(config.smtpUser && config.smtpPass),
      messages: messages.map(serializeMessage),
    });
  })
);

/** Update a message status (read / replied / new). */
supportRouter.patch(
  "/admin/messages/:id",
  requiredAdmin,
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      res.status(404).json({ detail: "Message not found." });
      return;
    }
    const status = req.body?.status;
    if (status !== "new" && status !== "read" && status !== "replied") {
      res.status(422).json({ detail: "Status must be one of: new, read, replied." });
      return;
    }
    const result = await collections().messages.findOneAndUpdate(
      { _id: objectId },
      { $set: { status: status as MessageStatus } },
      { returnDocument: "after" }
    );
    if (!result) {
      res.status(404).json({ detail: "Message not found." });
      return;
    }
    res.json({ ok: true, message: serializeMessage(result) });
  })
);

/** Delete a message. */
supportRouter.delete(
  "/admin/messages/:id",
  requiredAdmin,
  asyncHandler(async (req: AuthRequest, res) => {
    const { id } = req.params;
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      res.status(404).json({ detail: "Message not found." });
      return;
    }
    const result = await collections().messages.deleteOne({ _id: objectId });
    if (!result.deletedCount) {
      res.status(404).json({ detail: "Message not found." });
      return;
    }
    res.json({ ok: true });
  })
);
