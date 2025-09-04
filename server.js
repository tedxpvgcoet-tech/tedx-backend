import express from "express";
import cors from "cors";
import { addSubscriber, addSpeaker, addSponsor } from "./index.js";

const app = express();
app.use(cors());
app.use(express.json());

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
