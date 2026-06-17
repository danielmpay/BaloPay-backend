const TRANSACTION_TYPES = require("./constants/transactionsTypes");
const crypto = require("crypto");
const User = require("./userModel");

class TransactionBuilder {
  constructor(ledger, bankAccountId, feePolicy) {
    if (!ledger) throw new Error("Invalid Ledger");
    if (!bankAccountId) throw new Error("bankAccountId");
    if (!feePolicy) throw new Error("Invalid feePolicy");

    this.ledger = ledger;
    this.bankAccountId = bankAccountId;
    this.feePolicy = feePolicy;
  }

  async deposit(userId, accountId, amount) {
    // - VALIDATION
    if (!userId || typeof userId !== "string") throw new Error("Invalid user");

    if (!accountId || typeof accountId !== "string")
      throw new Error("Invalid user");

    if (typeof amount !== "number" || isNaN(amount) || !isFinite(amount))
      throw new Error("Invalid amount");

    if (amount < 0) throw new Error("Deposit amount must be greater than zero");

    // A.  CHECH IF ACCOUNT EXIT
    const user = await User.findOne({ accountId });
    if (!user) throw new Error("Invalid account");

    // B. CHECK IF ACCOUNT IS ACTIVE
    if (user.status !== "active") throw new Error("Account not active");

    // C. CHECK ACCOUNT OWNERSHIP
    if (user.username !== userId) {
      throw new Error("Not Owner");
    }

    const depositTrxId = crypto.randomUUID();

    const depositEntries = [
      { accountId: accountId, amount: amount },
      { accountId: this.bankAccountId, amount: -amount }
    ];

    return this.ledger.recordTransaction(
      depositTrxId,
      TRANSACTION_TYPES.DEPOSIT,
      depositEntries
    );
  }

  async withdraw(userId, accountId, amount) {
    // - VALIDATION
    if (!userId || typeof userId !== "string") throw new Error("Invalid user");

    if (!accountId || typeof accountId !== "string")
      throw new Error("Invalid user");

    if (typeof amount !== "number" || isNaN(amount) || !isFinite(amount))
      throw new Error("Invalid amount");

    if (amount < 0)
      throw new Error("Withdraw amount must be greater than zero");

    // A. CHECK IF WITHDRAWAL ACCOUNT EXIT
    let user = await User.findOne({ accountId });
    if (!user) throw new Error("Invalid account");

    // B. CHECK IF IS ACTIVE
    if (user.status !== "active") throw new Error("Accout not active");

    // C. CHECK ACCOUNT OWNERSHIP
    if (user.username !== userId) {
      throw new Error("Not  Owner");
    }

    // D. CHECK IF ENOUGH AMOUNT
    let currentAmount = this.ledger.getBalance(accountId);
    if (currentAmount < amount) throw new Error("Insufficient funds");

    const withdrawalId = crypto.randomUUID();
    const withdrawEntries = [
      { accountId: accountId, amount: -amount },
      { accountId: this.bankAccountId, amount: amount }
    ];

    return this.ledger.recordTransaction(
      withdrawalId,
      TRANSACTION_TYPES.WITHDRAW,
      withdrawEntries
    );
  }

  async transfer(userId, fromAccountId, toAccountId, amount) {
    if (!userId || typeof userId !== "string") {
      throw new Error("Invalid userId");
    }
    if (!fromAccountId || typeof fromAccountId !== "string") {
      throw new Error("Invalid sender");
    }
    if (!toAccountId || typeof toAccountId !== "string") {
      throw new Error("Invalid receiver");
    }
    if (typeof amount !== "number" || isNaN(amount) || !isFinite(amount)) {
      throw new Error("Invalid number");
    }
    if (amount <= 0) {
      throw new Error("Transfer should be greater than zero");
    }

    // AGAIN SELF TRANSFER
    if (fromAccountId === toAccountId)
      throw new Error("You cannot send to yourself");

    // VALIDATE SENDER
    const sender = await User.findOne({ accountId: fromAccountId });
    if (!sender) {
      throw new Error("Invalid sender");
    }

    if (sender.username !== userId) throw new Error("Not owner");

    // VALIDATE RECEIVER
    const receiver = await User.findOne({ accountId: toAccountId });
    if (!receiver) {
      throw new Error("Invalid receiver");
    }

    if (receiver.status !== "active") {
      throw new Error("Receiver Account not active");
    }

    // GET BALANCE
    const currentAmount = this.ledger.getBalance(fromAccountId);

    // CALCULATE FEE
    const totalFee = this.feePolicy.calculate(amount);

    // CHECK FUNDS
    if (currentAmount < amount + totalFee) {
      throw new Error("Insufficient funds");
    }

    const transferId = crypto.randomUUID();
    const transferEntries = [
      { accountId: fromAccountId, amount: -(amount + totalFee) },
      { accountId: toAccountId, amount: amount },
      { accountId: this.bankAccountId, amount: totalFee }
    ];

    return this.ledger.recordTransaction(
      transferId,
      TRANSACTION_TYPES.TRANSFER,
      transferEntries
    );
  }
}

module.exports = TransactionBuilder;
