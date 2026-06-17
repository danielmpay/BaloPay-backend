class AccountRegistry {
  constructor() {
    this.accounts = [];
  }

  // 1. ADD ACCOUNT
  addAccount(id, ownerId, status, type) {
    if (!id) throw new Error("Invalid id");
    if (!ownerId) throw new Error("Invalid owner");
    if (!status) throw new Error("Invalid status");
    if (!type) throw new Error("Invalid type");

    return this.accounts.push({ id, ownerId, status, type });
  }

  // 2. RETURN AN OBJECT
  getAccount(id) {
    return this.accounts.find((account) => account.id === id);
  }

  // 3. RETURN TRUE OR FALSE
  isActive(account) {
    return account && account.status === "active";
  }
}

module.exports = AccountRegistry;
