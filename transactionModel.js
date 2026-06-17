const mongoose = require("mongoose");

const entrySchema = new mongoose.Schema({
  entryId: { type: String },
  accountId: { type: String, required: true },
  amount: { type: Number, required: true }
});

const transactionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  entries: [entrySchema],
  timestamp: { type: Number, required: true },
  idempotencyKey: { type: String, default: null },
  reversesTransactionId: { type: String, default: null }
});

const Transaction = mongoose.model("Transaction", transactionSchema);

module.exports = Transaction;
