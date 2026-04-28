/////////////////////////////////////
// ACCOUNT REGISTRY
/////////////////////////////////////
class AccountRegistry {
  constructor() {
    this.accounts = []; // Array of Accounts
  }

  addAccount(id, ownerId, status) {
    this.accounts.push({ id, ownerId, status });
  }

  getAccount(id) {
    return this.accounts.find((acc) => acc.id === id);
  }

  validateActiveAccount(account) {
    if (!account) {
      throw new Error("Account not found");
    }

    if (account.status !== "active") {
      throw new Error("Account not active");
    }
    return account;
  }
}
module.exports = AccountRegistry;
