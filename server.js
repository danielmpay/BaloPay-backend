if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

//this create your backend Server
const express = require("express");
const app = express();

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const cors = require("cors");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");

// LOCAL FILES
const FeePolicy = require("./feePolicy");
const Ledger = require("./ledger");
const TransactionBuilder = require("./transactionBuilder");

// BY CONVENTION WE USE USER(VARIABLE NAME) FOR USERMODEL MODULES AND WE USE TRANSACTION(VARIABLE NAME) FOR TRANSACTION MODEL
const User = require("./userModel");

// BASE CONFIGURATION (GLOBAL MIDDLEWARE)
app.use(express.json());
app.use(cors());

const SECRET = process.env.SECRET;
if (!SECRET) {
  throw new Error("SECRET is not defined");
}

// INSTANCES OBJECT CREATED BY CLASS
const feePolicy = new FeePolicy(0.02, 1, 10);
const ledger = new Ledger();
const transactionBuilder = new TransactionBuilder(ledger, "BANK", feePolicy);

// REQUEST -> VERIFYTOKEN -> ROUTE -> RESPONSE;
function verifyToken(req, res, next) {
  const authHeaders = req.headers.authorization;
  if (!authHeaders) {
    return res.status(401).send("Authorization header is missing");
  }

  if (!authHeaders.startsWith("Bearer ")) {
    return res.status(401).send("invalid authorization format");
  }

  // EXTRACT TOKEN
  const token = authHeaders.split(" ")[1];

  try {
    // VERIFY TOKEN
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;

    next();
  } catch (err) {
    return res.status(401).send("Invalid token");
  }
}

// ROUTES
// 1. REGISTER ROUTE
app.post("/register", async (req, res) => {
  console.log("Register route hit");
  try {
    const { username, name, password, mobile, email, country } = req.body;
    // Validation;
    if (!username || !name || !password || !mobile || !email || !country) {
      return res.status(400).send("Missing fields");
    }

    // SECURE PASSWORD
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // CHECK DUPLICATE USER
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).send("User already exists");
    }

    // ACCOUNT ID;
    const accountId = crypto.randomUUID();

    // CREATE USEER
    const user = await User.create({
      username,
      name,
      password: hashedPassword,
      mobile,
      email,
      country,
      accountId
    });

    // GENERATE A TOKEN
    const token = jwt.sign({ userId: user.username }, SECRET, {
      expiresIn: "1h"
    });

    //RESPONSE
    res.json({
      message: "User created",
      token,
      accountId: user.accountId,
      username: user.username
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 🔒RATE LIMITING SPECIFIED TO LOGIN
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: "Too many attempts login, please try after 1min"
});

// 1. LOGIN ROUTE
app.post("/login", loginLimiter, async (req, res) => {
  try {
    const { password, email } = req.body;
    // Validation;
    if (!password || !email) {
      return res.status(400).send("Missing fields");
    }

    if (password.length < 6) {
      return res.status(400).send("Password too short");
    }

    if (!email.includes("@")) {
      return res.status(400).send("Invalid email");
    }

    // LOOK FOR USER
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return res.status(401).send("Invalid credentials");
    }

    // COMPARE PASSWORD;
    const isMatch = await bcrypt.compare(password, existingUser.password);
    if (!isMatch) {
      return res.status(401).send("Invalid credentials");
    }

    // GENERATE TOKEN
    const token = jwt.sign({ userId: existingUser.username }, SECRET, {
      expiresIn: "1h"
    });

    //RESPONSE
    res.json({
      message: "Login Successful",
      token,
      accountId: existingUser.accountId,
      username: existingUser.username
    });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// DEPOSIT ROUTE
app.post("/deposit", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findOne({ username: userId });
    if (!user) return res.status(404).send("user not found");

    const amount = Number(req.body.amount);
    if (!amount || amount <= 0)
      return res.status(400).json({ error: "Invalid amount" });

    const result = await transactionBuilder.deposit(
      userId,
      user.accountId,
      amount
    );

    res.json({
      success: true,
      result
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// WITHDRAW ROUTE;
app.post("/withdraw", verifyToken, async (req, res) => {
  try {
    // AUTHENTICATION
    const userId = req.user.userId;
    const user = await User.findOne({ username: userId });
    if (!user) return res.status(404).send("User not found");

    // GET ACCOUNT
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0)
      return res.status(404).json({ error: "Invalid amount" });

    const result = await transactionBuilder.withdraw(
      userId,
      user.accountId,
      amount
    );

    res.json({
      success: true,
      result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TRANSFER ROUTE
app.post("/transfer", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findOne({ username: userId });
    if (!user) {
      return res.status(404).send("User not found");
    }

    const toAccountId = req.body.toAccountId;
    if (!toAccountId) {
      return res.status(404).json({ error: "Missing receiver" });
    }

    const amount = Number(req.body.amount);
    if (!amount || amount <= 0)
      return res.status(400).json({ error: "Invalid amount" });

    const transfer = await transactionBuilder.transfer(
      userId,
      user.accountId,
      toAccountId,
      amount
    );

    res.json({
      success: true,
      transfer
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET BALANCE ROUTE;
app.get("/balance/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findOne({ username: userId });
    if (!user) {
      return res.status(404).send("User not found");
    }

    if (req.params.id !== user.accountId)
      return res.status(403).json({ error: "Forbidden" });

    // GET BALANCE
    const balance = ledger.getBalance(user.accountId);

    res.json({
      success: true,
      balance
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TRANSACTION ROUTE
app.get("/transactions/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findOne({ username: userId });

    const accountId = req.params.id;

    if (accountId !== user.accountId) {
      return res.status(403).send("Forbidden");
    }

    const allTransactions = ledger.getTransactions();

    const history = allTransactions.filter((trx) =>
      trx.entries.some((entry) => entry.accountId === accountId)
    );

    res.json({ transactions: history });
  } catch (error) {
    res.status(500).send("Server error");
  }
});

const processedTransactions = new Set();

app.post("/webhooks/flutterwave", async (req, res) => {
  // 1. repondre immediatement
  res.status(200).json({ received: true });

  // 2. verifier la signature
  const signature = req.headers["verif-hash"];
  const webhookSecret = process.env.FLUTTERWAVE_WEBHOOK_SECRET;

  if (!signature || signature !== webhookSecret) {
    console.log("Invalid webhook signature");
    return;
  }

  // 3.idempotency
  const transactionId = req.body?.id;
  if (!transactionId || processedTransactions.has(String(transactionId))) {
    console.log("Already processed:", transactionId);

    return;
  }

  // 4.Traiter seuelement si paiement reussi
  if (req.body?.status !== "successful") return;

  processedTransactions.add(String(transactionId));

  try {
    // 5. Trouver l'utilisateur par email
    const txRef = req.body?.txRef;
    const username = txRef?.split("-")[1];
    const amount = req.body?.amount;

    const user = await User.findOne({ username });
    if (!user) {
      console.log("user not found for username", username);
      return;
    }

    // 6. Créditer le compte
    await transactionBuilder.deposit(user.username, user.accountId, amount);
  } catch (err) {
    console.log("Webhook error:", err.message);
  }
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("Mongo Connected");
    await ledger.loadFromDB();

    app.listen(process.env.PORT || 8080, () => {
      console.log(`server running on port  ${process.env.PORT || 8080}`);
    });
  })
  .catch((err) => console.log("Erreur MongoDB", err.message));
