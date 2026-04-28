const Transaction = require("./transactionModel");
class Ledger {
  #transactions = [];

  async recordTransaction(id, entries) {
    // ID AND ENTRIES VALIDATION
    if (!id || typeof id !== "string") {
      throw new Error("invalid Id");
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      throw new Error("Invalid entries");
    }

    // LEDGER MUST BE BALANCE TO ZER0
    let sum = 0;
    for (const entry of entries) {
      if (!entry.accountId || typeof entry.accountId !== "string") {
        throw new Error("Invalid AccountId");
      }

      if (
        typeof entry.amount !== "number" ||
        isNaN(entry.amount) ||
        !isFinite(entry.amount)
      ) {
        throw new Error("Invalid Amount");
      }

      sum += entry.amount;
    }

    // ANTI CORRUPTION WALL , we enforce rules here
    if (sum !== 0) {
      throw new Error("Sum must be balance to Zero");
    }

    // PREVENTING DUPLICATE TRANSACTION
    const existingTransaction = this.#transactions.some((trx) => trx.id === id);
    if (existingTransaction) throw new Error("Transaction already exist");

    const freezeEntries = entries.map((entry) => Object.freeze({ ...entry }));
    Object.freeze(freezeEntries);

    // STORE TRANSACTION;
    const transaction = Object.freeze({
      id,
      entries: freezeEntries,
      timestamp: Date.now()
    });

    this.#transactions.push(transaction);

    // CECI EST POUR TESTER
    console.log("Saving to MongoDB:", transaction.id);
    await Transaction.create({
      id: transaction.id,
      entries: transaction.entries,
      timestamp: transaction.timestamp
    });
    console.log("Saved ✅");

    return { ...transaction };
  }

  // GET BALANCE
  getBalance(id) {
    // VALIDATION
    if (!id || typeof id !== "string") {
      throw new Error("Invalid ID");
    }

    let balance = 0;

    for (let i = 0; i < this.#transactions.length; i++) {
      const entries = this.#transactions[i].entries;

      for (let j = 0; j < entries.length; j++) {
        if (entries[j].accountId === id) {
          balance += entries[j].amount;
        }
      }
    }
    return balance;
  }

  // GET TRANSACTIONS
  getTransactions() {
    return this.#transactions;
  }

  async loadFromDB() {
    const data = await Transaction.find();
    this.#transactions = data.map((trx) => ({
      id: trx.id,
      entries: trx.entries,
      timestamp: trx.timestamp
    }));
    console.log(`Loaded ${this.#transactions.length} transactions from DB`);
  }
}

module.exports = Ledger;
