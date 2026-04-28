class TransactionBuilder {
  constructor(ledger, accountRegister, bankAccountId, feePolicy) {
    if (!ledger) throw new Error("Invalid ledger");
    if (!accountRegister) throw new Error("Invalid Account");
    if (!bankAccountId) throw new Error("Invalid bankAccountId");
    if (!feePolicy) throw new Error("Invalid fee");

    this.ledger = ledger;
    this.accountRegister = accountRegister;
    this.bankAccountId = bankAccountId;
    this.feePolicy = feePolicy;
  }

  // Method
  // DEPOSIT
  async deposit(userId, accountId, amount) {
    if (!accountId || typeof accountId !== "string") {
      throw new Error("invalid Id");
    }

    if (!userId || typeof userId !== "string") {
      throw new Error("Invalid User");
    }

    if (typeof amount !== "number" || isNaN(amount) || !isFinite(amount)) {
      throw new Error("invalid amount");
    }

    if (amount <= 0) {
      throw new Error("Amount must be greater than zero");
    }

    // CHECKING IF ACCOUNT EXIST / OWNERSHIP AND ACTIVE
    let currentAccount = this.accountRegister.getAccount(accountId);

    if (!currentAccount) throw new Error("Invalid account");
    if (currentAccount.ownerId !== userId) throw new Error("Invalid owner");
    if (currentAccount.status !== "active") throw new Error("Invalid Status");

    const transactionID = crypto.randomUUID();

    const entries = [
      { accountId: accountId, amount: amount },
      { accountId: this.bankAccountId, amount: -amount }
    ];

    return await this.ledger.recordTransaction(transactionID, entries);
  }

  // WITHDRAW
  async withdraw(userId, accountId, amount) {
    if (!userId || typeof userId !== "string") {
      throw new Error("Invalid user");
    }

    if (!accountId || typeof accountId !== "string") {
      throw new Error("Invalid accounnt Id");
    }

    if (typeof amount !== "number" || isNaN(amount) || !isFinite(amount)) {
      throw new Error("Invalid amount");
    }

    if (amount <= 0) {
      throw new Error("Amount should be greater than 0");
    }

    let currentAccount = this.accountRegister.getAccount(accountId);

    if (!currentAccount) {
      throw new Error("Invalid account");
    }

    if (currentAccount.ownerId !== userId) {
      throw new Error("Invalid user");
    }

    if (currentAccount.status !== "active") {
      throw new Error("Account not active");
    }

    let currentAmount = this.ledger.getBalance(accountId);

    if (amount > currentAmount) throw new Error("Insufficient Funds");

    const transactionId = crypto.randomUUID();

    const entries = [
      { accountId: accountId, amount: -amount },
      { accountId: this.bankAccountId, amount: amount }
    ];

    return await this.ledger.recordTransaction(transactionId, entries);
  }

  // TRANSFER
  async transfer(userId, fromAccountId, toAccountId, amount) {
    // VALIDATE INPUTS
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
      throw new Error("Amount should be greater than zero");
    }

    //AGAIN SELF TRANSFERT
    if (fromAccountId === toAccountId) {
      throw new Error("You cannot send to same account");
    }

    //GET AND VALIDATE SENDER
    const sender = this.accountRegister.validateActiveAccount(
      this.accountRegister.getAccount(fromAccountId)
    );

    //GET SENDER OWNERSHIP
    if (sender.ownerId !== userId) {
      throw new Error("Not owner of account");
    }

    //GET AND VALIDATE RECEIVER
    const receiver = this.accountRegister.validateActiveAccount(
      this.accountRegister.getAccount(toAccountId)
    );

    //GET BALANCE
    const currentAmount = this.ledger.getBalance(fromAccountId);

    // CALCULATE FEE
    const totalFee = this.feePolicy.calculate(amount);

    //CHECK FUNDS
    if (amount + totalFee > currentAmount) {
      throw new Error("Insufficient Funds");
    }

    const transferId = crypto.randomUUID();

    const transferEntries = [
      { accountId: fromAccountId, amount: -(amount + totalFee) },
      { accountId: toAccountId, amount: amount },
      { accountId: this.bankAccountId, amount: totalFee }
    ];

    return await this.ledger.recordTransaction(transferId, transferEntries);
  }
}

module.exports = TransactionBuilder;
