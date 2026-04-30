if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// console.log("MONGO_URI exists:", !process.env.MONGO_URI);
// console.log("NODE_ENV:", process.env.NODE_ENV);
const crypto = require("crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("./userModel");

const mongoose = require("mongoose");

const Ledger = require("./ledger");
const TransactionBuilder = require("./transactionBuilder");
const AccountRegister = require("./accountRegister");
const FeePolicy = require("./feePolicy");

const SECRET = process.env.SECRET;
const app = express();

const cors = require("cors");

app.use(
  cors({
    origin: ["http://127.0.0.1:5500", "http://localhost:8000"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(cors());
app.use(express.json());

//INIT
const ledger = new Ledger();
const accountRegister = new AccountRegister();
const feePolicy = new FeePolicy(0.02, 1, 10);

accountRegister.addAccount("A", "user1", "active");
accountRegister.addAccount("B", "user2", "active");

const builder = new TransactionBuilder(
  ledger,
  accountRegister,
  "BANK",
  feePolicy
);

//MIDDLEWARE
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No token" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid" });
  }
}

// ROUTES

// USER ROUTE
app.post("/register", async (req, res) => {
  try {
    const { username, password, name, mobile, country, email } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    //AccountId nes plus dans le req.body

    const accountId = crypto.randomUUID(); //genere par le serveur
    const user = await User.create({
      username,
      password: hashedPassword,
      accountId,
      name,
      mobile,
      country,
      email
    });

    // AJOUTER DANS ACCOUNTREGISTER;
    accountRegister.addAccount(accountId, username, "active");

    res.json({ message: "User created", userId: user.username });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/", (req, res) => {
  res.send("BaloPay API is running 🚀");
});

// LOGIN ROUTES
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: "Invalid Credentials" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(401).json({ error: "Invalid Credentials" });

    const token = jwt.sign(
      { userId: user.username, accountId: user.accountId },
      SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      message: "Login successfull",
      userId: user.username,
      accountId: user.accountId,
      token
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// DEPOSIT ROUTES
app.post("/deposit", verifyToken, async (req, res) => {
  console.log("req.user:", req.user);
  try {
    const userId = req.user.userId;
    const accountId = req.user.accountId;
    const { amount } = req.body;
    const result = await builder.deposit(userId, accountId, amount);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// TRANSFER ROUTES
app.post("/withdraw", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const accountId = req.user.accountId;
    const { amount } = req.body;
    const result = await builder.withdraw(userId, accountId, amount);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// TRANSFER ROUTES
app.post("/transfer", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const fromAccountId = req.user.accountId;
    const { toAccountId, amount } = req.body;
    const result = await builder.transfer(
      userId,
      fromAccountId,
      toAccountId,
      amount
    );
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// GET BALANCE ROUTES
app.get("/balance/:id", (req, res) => {
  try {
    const balance = ledger.getBalance(req.params.id);
    res.json({ balance });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get("/transactions/:accountId", async (req, res) => {
  try {
    const accountId = req.params.accountId;
    const history = ledger
      .getTransactions()
      .filter((trx) => trx.entries.some((e) => e.accountId === accountId));
    res.json(history);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("Mongo Connected");
    await ledger.loadFromDB();
    app.listen(process.env.PORT || 3000, () => {
      console.log("Server running on port 3000 ");
    });
  })
  .catch((err) => console.log("Erreur MongoDB", err.message));

process.on("uncaughtException", (err) => {
  console.log("ERREUR:", err.message);
});
