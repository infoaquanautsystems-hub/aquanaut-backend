const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect("mongodb://okeziedavid02_db_user:toGTkRWFMstJWmfN@ac-ngrm9os-shard-00-00.irwlliy.mongodb.net:27017,ac-ngrm9os-shard-00-01.irwlliy.mongodb.net:27017,ac-ngrm9os-shard-00-02.irwlliy.mongodb.net:27017/?ssl=true&replicaSet=atlas-kb7s28-shard-0&authSource=admin&appName=Cluster0")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log("DB Error:", err));

const User = mongoose.model("User", {
  email: String,
  password: String
});

const Bot = mongoose.model("Bot", {
  botId: String,
  botName: String,
  location: { lat: Number, lng: Number },
  totalWaste: Number,
  status: String
});

const WasteLog = mongoose.model("WasteLog", {
  botId: String,
  wasteCollected: Number,
  timestamp: { type: Date, default: Date.now }
});
// ===== EMAIL SETUP =====
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "info.aquanautsystems@gmail.com",
    pass: "YOUR_APP_PASSWORD_HERE"
  }
});
function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.sendStatus(401);
  try {
    const decoded = jwt.verify(token, "secret");
    req.user = decoded;
    next();
  } catch {
    res.sendStatus(403);
  }
}

app.post("/register", async (req, res) => {
  const hashed = await bcrypt.hash(req.body.password, 10);
  await User.create({ email: req.body.email, password: hashed });
  res.send("User created");
});

app.post("/login", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return res.json({ success: false });
  const valid = await bcrypt.compare(req.body.password, user.password);
  if (!valid) return res.json({ success: false });
  const token = jwt.sign({ id: user._id }, "secret");
  res.json({ success: true, token });
});

app.post("/bot-data", async (req, res) => {
  const { botId, waste, lat, lng } = req.body;
  let bot = await Bot.findOne({ botId: botId });
  if (!bot) {
    bot = await Bot.create({
      botId: botId,
      botName: "Bot " + botId,
      location: { lat, lng },
      totalWaste: waste,
      status: "active"
    });
  } else {
    bot.location = { lat, lng };
    bot.totalWaste += waste;
    await bot.save();
  }
  await WasteLog.create({ botId, wasteCollected: waste });
  res.send("Bot data stored");
});

app.get("/data", auth, async (req, res) => {
  const bots = await Bot.find();
  const totalWaste = bots.reduce((sum, b) => sum + b.totalWaste, 0);
  const logs = await WasteLog.find().sort({ timestamp: 1 });
  res.json({
    totalWaste,
    activeBots: bots.length,
    pollutionLevel: totalWaste > 100 ? "High" : "Moderate",
    bots,
    trend: logs.map(l => ({
      time: l.timestamp,
      waste: l.wasteCollected
    }))
  });
});

app.listen(5000, () => console.log("Server running on port 5000"));