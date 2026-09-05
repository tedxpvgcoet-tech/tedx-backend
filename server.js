import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { addSubscriber, addSpeaker, addSponsor } from "./index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Load active members dataset ────────────────────────────────────────────
const activeMembers = JSON.parse(
  readFileSync(join(__dirname, "data", "activeMembers.json"), "utf-8")
);

// Build a lookup map: email (lowercase) -> member object
const membersByEmail = new Map();
for (const member of activeMembers) {
  membersByEmail.set(member.email.toLowerCase().trim(), member);
}

// ─── In-memory OTP store ────────────────────────────────────────────────────
// Map<email, { otp: string, expiresAt: number, attempts: number }>
const otpStore = new Map();
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_OTP_ATTEMPTS = 5;

// ─── In-memory auth token store ─────────────────────────────────────────────
// Map<token, { email, name, displayName, team, expiresAt }>
const authTokenStore = new Map();
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Nodemailer transporter ─────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Cleanup expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of otpStore) {
    if (now > val.expiresAt) otpStore.delete(key);
  }
  for (const [key, val] of authTokenStore) {
    if (now > val.expiresAt) authTokenStore.delete(key);
  }
}, 10 * 60 * 1000);

// ─── Rate limiters ──────────────────────────────────────────────────────────
const otpRequestLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: { error: "Too many OTP requests. Please wait a few minutes." },
  validate: { xForwardedForHeader: false },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: { error: "Too many verification attempts. Please wait a few minutes." },
  validate: { xForwardedForHeader: false },
});

const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: { error: "Too many requests to this endpoint, please try again." },
  validate: { xForwardedForHeader: false },
});

// ─── Express setup ──────────────────────────────────────────────────────────
const app = express();
app.set("trust proxy", 1); // Trust Render's proxy to get real client IPs
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// ─── Existing routes (subscriber, speaker, sponsor) ─────────────────────────
app.post("/subscriber", async (req, res) => {
  try {
    const newSubscriber = req.body;
    if (!newSubscriber?.email) {
      return res.status(400).json({ error: "Missing required field: email" });
    }
    await addSubscriber(newSubscriber);
    res.status(201).json({ message: "Subscriber added!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/speaker", async (req, res) => {
  try {
    const newSpeaker = req.body;
    if (!newSpeaker?.email) {
      return res.status(400).json({ error: "Missing required field: email" });
    }
    await addSpeaker(newSpeaker);
    res.status(201).json({ message: "Speaker added!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/sponsor", async (req, res) => {
  try {
    const newSponsor = req.body;
    if (!newSponsor?.email) {
      return res.status(400).json({ error: "Missing required field: email" });
    }
    await addSponsor(newSponsor);
    res.status(201).json({ message: "Sponsor added!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── OLD verify-key route (preserved for backward compat, can be removed) ───
app.post("/verify-key", apiLimiter, (req, res) => {
  const { keyword } = req.body;
  if (!keyword || keyword !== process.env.BRIDGEKEEPER_KEY) {
    return res.status(401).json({ success: false, error: "Wrong! Into the Gorge of Eternal Peril with you!" });
  }
  return res.json({ success: true, message: "Right. Off you go." });
});

// ─── NEW: Request OTP ───────────────────────────────────────────────────────
app.post("/request-otp", otpRequestLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: "Email address is required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const member = membersByEmail.get(normalizedEmail);

    if (!member) {
      return res.status(404).json({
        success: false,
        error: "This email is not associated with any active TEDx committee member.",
      });
    }

    const otp = generateOTP();
    otpStore.set(normalizedEmail, {
      otp,
      expiresAt: Date.now() + OTP_EXPIRY_MS,
      attempts: 0,
    });

    // Send the OTP email
    await transporter.sendMail({
      from: `"TEDxPVGCOETM" <${process.env.GMAIL_USER}>`,
      to: normalizedEmail,
      subject: "Your TEDx Portal Login Code",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0a0a0c; color: #fff; border-radius: 12px;">
          <h2 style="color: #e81b2a; margin: 0 0 8px 0; font-size: 1.4rem;">TEDxPVGCOETM</h2>
          <p style="color: #aaa; margin: 0 0 24px 0; font-size: 0.9rem;">Internal Portal Login Code</p>
          <p style="margin: 0 0 16px 0; color: #ddd;">Hello <strong>${member.displayName}</strong>,</p>
          <p style="margin: 0 0 24px 0; color: #ccc;">Your one-time login code is:</p>
          <div style="background: rgba(232, 27, 42, 0.1); border: 1px solid rgba(232, 27, 42, 0.3); border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 2.2rem; font-weight: 800; letter-spacing: 8px; color: #e81b2a;">${otp}</span>
          </div>
          <p style="color: #888; font-size: 0.85rem; margin: 0;">This code expires in 5 minutes. Do not share it with anyone.</p>
        </div>
      `,
    });

    console.log(`✅ OTP sent to ${normalizedEmail} for ${member.displayName}`);
    return res.json({ success: true, message: "OTP sent to your email." });
  } catch (err) {
    console.error("❌ Error sending OTP:", err);
    return res.status(500).json({ success: false, error: "Failed to send OTP. Please try again." });
  }
});

// ─── NEW: Verify OTP ────────────────────────────────────────────────────────
app.post("/verify-otp", otpVerifyLimiter, (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, error: "Email and OTP are required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const stored = otpStore.get(normalizedEmail);

    if (!stored) {
      return res.status(400).json({
        success: false,
        error: "No OTP found for this email. Please request a new one.",
      });
    }

    if (Date.now() > stored.expiresAt) {
      otpStore.delete(normalizedEmail);
      return res.status(400).json({
        success: false,
        error: "OTP has expired. Please request a new one.",
      });
    }

    stored.attempts += 1;
    if (stored.attempts > MAX_OTP_ATTEMPTS) {
      otpStore.delete(normalizedEmail);
      return res.status(429).json({
        success: false,
        error: "Too many wrong attempts. Please request a new OTP.",
      });
    }

    if (stored.otp !== otp.trim()) {
      return res.status(401).json({
        success: false,
        error: `Incorrect OTP. ${MAX_OTP_ATTEMPTS - stored.attempts} attempt(s) remaining.`,
      });
    }

    // OTP is correct – clean up and issue an auth token
    otpStore.delete(normalizedEmail);

    const member = membersByEmail.get(normalizedEmail);
    const token = generateToken();

    authTokenStore.set(token, {
      email: normalizedEmail,
      name: member.name,
      displayName: member.displayName,
      team: member.team,
      expiresAt: Date.now() + TOKEN_EXPIRY_MS,
    });

    console.log(`✅ OTP verified for ${member.displayName} (${normalizedEmail})`);

    return res.json({
      success: true,
      message: "Right. Off you go.",
      token,
      name: member.displayName,
      team: member.team,
    });
  } catch (err) {
    console.error("❌ Error verifying OTP:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
});

// ─── NEW: Validate auth token middleware ─────────────────────────────────────
function validateAuthToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing or invalid auth token." });
  }

  const token = authHeader.split("Bearer ")[1];
  const session = authTokenStore.get(token);

  if (!session) {
    return res.status(401).json({ error: "Unauthorized: Invalid or expired session." });
  }

  if (Date.now() > session.expiresAt) {
    authTokenStore.delete(token);
    return res.status(401).json({ error: "Unauthorized: Session has expired. Please log in again." });
  }

  // Attach the session to the request for downstream use
  req.authSession = session;
  next();
}

// ─── UPDATED: Bills endpoint ────────────────────────────────────────────────
app.post("/bills", apiLimiter, validateAuthToken, async (req, res) => {
  try {
    // Strip auth fields before forwarding to Google Script
    const { keyword, authToken, ...billData } = req.body;

    if (!process.env.GOOGLE_SCRIPT_URL) {
      return res.status(500).json({ error: "Google Script URL not configured" });
    }

    // Add backend secret so Apps Script can verify the request is from our server
    const payload = {
      ...billData,
      backendSecret: process.env.BACKEND_SECRET || "",
    };

    const response = await fetch(process.env.GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    res.json(result);
  } catch (err) {
    console.error("Error proxying to Google Script:", err);
    res.status(500).json({ error: "Internal server error connecting to upstream." });
  }
});

// ─── Fun & health ───────────────────────────────────────────────────────────
app.get("/fun", (req, res) => {
  res.redirect("https://www.youtube.com/shorts/41iWg91yFv0");
});

app.get("/", (req, res) => {
  res.json({ status: "API is running ✅" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
