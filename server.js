console.log("SERVER FILE LOADED");

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
const AccountRegister = require("./accountRegister");
const FeePolicy = require("./feePolicy");
const Ledger = require("./ledger");
const TransactionBuilder = require("./transactionBuilder");

// BY CONVENTION WE USE USER(VARIABLE NAME) FOR USERMODEL MODULES AND WE USE TRANSACTION(VARIABLE NAME) FOR TRANSACTION MODEL
const Transaction = require("./transactionModel");
const User = require("./userModel");

// BASE CONFIGURATION (GLOBAL MIDDLEWARE)
app.use(express.json());
app.use(cors());

const SECRET = process.env.SECRET;
if (!SECRET) {
  throw new Error("SECRET is not defined");
}

// INSTANCES OBJECT CREATED BY CLASS
const accountRegister = new AccountRegister();
const feePolicy = new FeePolicy(0.02, 1, 10);
const ledger = new Ledger();
const transactionBuilder = new TransactionBuilder(
  ledger,
  accountRegister,
  "BANK",
  feePolicy
);

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

    // SAVE ACCOUNT AFTER REGISTER IT;
    accountRegister.addAccount(accountId, username, "active");

    // GENERATE A TOKEN
    const token = jwt.sign({ userId: user.username }, SECRET, {
      expiresIn: "1h"
    });

    //RESPONSE
    res.json({
      message: "User created",
      token
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
      token
    });
  } catch (err) {
    res.status(500).send("Server Error");
  }
});

// DEPOSIT ROUTE
app.post("/deposit", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // const user = await User.findById(userId);
    const user = await User.findOne({ username: userId });
    if (!user) {
      res.status(404).send("user not found");
      return;
    }

    const accountId = user.accountId;

    const account = accountRegister.getAccount(accountId);
    if (!account) {
      res.status(404).send("Invalid account");
      return;
    }

    if (!accountRegister.isActive(account)) {
      throw new Error("Account not active");
    }

    const amount = Number(req.body.amount);
    if (isNaN(amount) || !isFinite(amount)) {
      res.status(400).send("Invalid amount");
      return;
    }

    if (amount <= 0) {
      res.status(400).send("Amount must be greater than 0");
      return;
    }

    const result = await transactionBuilder.deposit(userId, accountId, amount);

    res.json({
      message: "deposit successfully",
      result
    });
  } catch (error) {
    console.log("DEPOSIT ERROR:", error.message);
    console.log("DEPOSIT STACK:", error.stack);

    res.status(500).send("Server Error");
  }
});

// WITHDRAW ROUTE;
app.post("/withdraw", verifyToken, async (req, res) => {
  try {
    // AUTHENTICATION
    const userId = req.user.userId;

    // GET USER
    // const user = await User.findById(userId);
    const user = await User.findOne({ username: userId });
    if (!user) {
      return res.status(404).send("User not found");
    }

    // GET ACCOUNT ID
    const accountId = user.accountId;

    // GET ACCOUNT
    const account = accountRegister.getAccount(accountId);
    if (!account) {
      return res.status(404).send("Invalid account");
    }

    // VALIDATE ACCOUNT STATUS
    accountRegister.isActive(account);

    // VALIDATION AMOUNT RAW INPUT FIRST
    const rawAmount = req.body.amount;

    if (rawAmount === undefined || rawAmount === null || rawAmount === "") {
      res.status(400).send("Invalid amount");
      return;
    }

    const amount = Number(rawAmount);

    if (isNaN(amount) || !isFinite(amount)) {
      res.status(400).send("Invalid amount");
      return;
    }

    if (amount <= 0) {
      res.status(400).send("Amount must be greater than 0");
      return;
    }

    // GET BALANCE
    const balance = ledger.getBalance(accountId);

    if (balance < amount) {
      res.status(400).send("Insufficient funds");
      return;
    }

    // WITHDRAW
    const result = await transactionBuilder.withdraw(userId, accountId, amount);

    res.json({
      message: "Withdraw successful",
      result
    });
  } catch (err) {
    console.log("DEPOSIT ERROR:", err.message);
    res.status(500).send("Server Error");
  }
});

// TRANSFER ROUTE
app.post("/transfer", verifyToken, async (req, res) => {
  try {
    // AUTHENTICATION
    const userId = req.user.userId;

    // GET SENDER ACCOUNT
    // const user = await User.findById(userId);
    const user = await User.findOne({ username: userId });
    if (!user) {
      return res.status(404).send("Invalid User");
    }

    // GET SENDER ACCOUNTID
    const senderAccountId = user.accountId;
    if (!senderAccountId) {
      return res.status(404).send("Account not found");
    }

    // GET SENDER ACCOUNT
    const senderAccount = accountRegister.getAccount(senderAccountId);

    if (!accountRegister.isActive(senderAccount)) {
      return res.status(404).send("Account not active");
    }

    // GET RECEIVER ACCOUNTID
    const receiverAccountId = req.body.accountId;

    // GET RECEIVER ACCOUNT
    const receivedAccount = accountRegister.getAccount(receiverAccountId);

    if (!receivedAccount) {
      return res.status(404).send("Account not found");
    }

    if (!accountRegister.isActive(receivedAccount)) {
      return res.status(404).send("Account not active");
    }

    // VALIDATE AMOUNT
    const rawAmount = req.body.amount;
    if (rawAmount === null || rawAmount === undefined || rawAmount === "") {
      return res.status(400).send("Invalid Amount");
    }

    const amount = Number(rawAmount);
    if (isNaN(amount) || !isFinite(amount)) {
      return res.status(404).send("Invalid Amount");
    }

    if (amount <= 0) {
      return res.status(404).send("Transfer must be greater than 0");
    }

    if (senderAccountId === receiverAccountId) {
      return res.status(400).send("You cannot send to own account");
    }

    // CHECK BALANCE
    const balance = ledger.getBalance(senderAccountId);
    if (balance < amount) {
      return res.status(400).send("Insufficient fund");
    }

    const transfer = await transactionBuilder.transfer(
      userId,
      senderAccountId,
      receiverAccountId,
      amount
    );

    res.json({
      message: "Transfer successfull",
      transfer
    });
  } catch (err) {
    console.log("TRANSFER ERROR:", err.message);
    res.status(500).send("Server error");
  }
});

// GET BALANCE ROUTE;
app.get("/balance/:id", verifyToken, async (req, res) => {
  try {
    //1. VERIFY TOKEN === THIS IS ALREADY USERId
    const userId = req.user.userId;

    //2. GET USER
    // const user = await User.findById(userId);
    const user = await User.findOne({ username: userId });
    if (!user) {
      return res.status(400).send("Invalid user");
    }

    // GET ACCOUNT FROM THE URL AND CHECK ACCOUNT BELONG TO USER
    const accountId = req.params.id;

    if (accountId !== user.accountId) {
      return res.status(403).send("Forbidden");
    }

    const account = accountRegister.getAccount(accountId);

    if (!account) {
      return res.status(400).send("Invalid account");
    }

    // CHECK ACCOUNT ACTIVE
    const activeAccount = accountRegister.isActive(account);
    if (!activeAccount) {
      res.status(400).send("Account not active");
    }

    // GET BALANCE
    const balance = ledger.getBalance(accountId);

    res.json({
      message: "You balance is " + balance,
      balance
    });
  } catch (error) {
    res.status(500).send("Server error");
  }
});

// TRANSACTION ROUTE
app.get("/transaction/:id", verifyToken, async (req, res) => {
  try {
    // GET USER ID;
    const userId = req.user.userId;

    // GET ACCOUNT;
    // const user = await User.findById(userId);
    const user = await User.findOne({ username: userId });

    // CHECK ACCOUNT BELONG TO USER;
    const accountId = req.params.id;

    if (accountId !== user.accountId) {
      return res.status(403).send("Forbidden");
    }

    // GET TRANSACTIONS FROM LEDGER
    const allTransactions = ledger.getTransactions();

    // FILTER ONLY THOSE WHO BELONG TO THAT ACCOUNT;
    const history = allTransactions.filter((trx) =>
      trx.entries.some((entry) => entry.accountId === accountId)
    );

    // RESPONSE WITH LIST
    res.json({ transactions: history });
  } catch (error) {
    res.status(500).send("Server error");
  }
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("Mongo Connected");
    await ledger.loadFromDB();

    // CHARGER LES COMPTES DEPUIS MONGODB
    const users = await User.find();
    users.forEach((user) => {
      accountRegister.addAccount(user.accountId, user.username, "active");
    });

    console.log(`Loaded ${users.length} accounts`);

    app.listen(process.env.PORT || 8080, () => {
      console.log(`server running on port  ${process.env.PORT || 8080}`);
    });
  })
  .catch((err) => console.log("Erreur MongoDB", err.message));

// process.on("uncaughtException", (err) => {
//   console.log("ERREUR:", err.message);
// });
