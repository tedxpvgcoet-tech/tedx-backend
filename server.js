import express from "express";
import { addSubscriber } from "./index.js";

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running");
});