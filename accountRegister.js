class AccountRegistry {
  constructor() {
    this.accounts = [];
  }

  // 1. ADD ACCOUNT
  addAccount(id, ownerId, status) {
    return this.accounts.push({ id, ownerId, status });
  }

  // 2. RETURN AN OBJECT
  getAccount(id) {
    return this.accounts.find((acc) => acc.id === id);
  }

  // 3. RETURN TRUE OR FALSE
  isActive(account) {
    return account && account.status === "active";
  }
}

module.exports = AccountRegistry;
