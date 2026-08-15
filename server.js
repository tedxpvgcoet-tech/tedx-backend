import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { addSubscriber, addSpeaker, addSponsor } from "./index.js";

const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, 
  max: 20, 
  message: { error: "Too many requests to this endpoint, please try again." }
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

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

app.post("/verify-key", apiLimiter, (req, res) => {
  const { keyword } = req.body;
  if (!keyword || keyword !== process.env.BRIDGEKEEPER_KEY) {
    return res.status(401).json({ success: false, error: "Wrong! Into the Gorge of Eternal Peril with you!" });
  }
  return res.json({ success: true, message: "Right. Off you go." });
});

app.post("/bills", apiLimiter, async (req, res) => {
  try {
    const { keyword, ...billData } = req.body;
    if (!keyword || keyword !== process.env.BRIDGEKEEPER_KEY) {
      return res.status(401).json({ error: "Unauthorized: Invalid Bridgekeeper Key" });
    }
    
    if (!process.env.GOOGLE_SCRIPT_URL) {
      return res.status(500).json({ error: "Google Script URL not configured" });
    }

    const response = await fetch(process.env.GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(billData)
    });
    
    const result = await response.json();
    res.json(result);
  } catch (err) {
    console.error("Error proxying to Google Script:", err);
    res.status(500).json({ error: "Internal server error connecting to upstream." });
  }
});

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
