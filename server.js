import express from "express";
import { addSubscriber, addSpeaker, addSponsor } from "./index.js";

const app = express();
app.use(express.json());

app.post("/subscribe", (req, res) => {
  try {
    const newSubscriber = req.body;
    addSubscriber(newSubscriber);
    res.status(200).send("Subscriber added!");
  } catch(err) {
    res.status(500).send("Error adding subscriber!")
  }
});

app.post("/speaker", (req, res) => {
  try {
    const newSpeaker = req.body;
    addSpeaker(newSpeaker);
    res.status(200).send("Speaker added!");
  } catch(err) {
    res.status(500).send("Error adding speaker!")
  }
});

app.post("/sponsor", (req, res) => {
  try {
    const newSponsor = req.body;
    addSponsor(newSponsor);
    res.status(200).send("Sponsor added!");
  } catch(err) {
    res.status(500).send("Error adding sponsor!")
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running");
});