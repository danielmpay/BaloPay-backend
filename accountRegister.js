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

  // THIS RETURN A SINGLE OBJECT
  getAccount(id) {
    return this.accounts.find((acc) => acc.id === id);
  }

  // THIS RETURN ONLY TRUE OR FALSE
  isActive(account) {
    return account && account.status === "active";
  }
}
module.exports = AccountRegistry;
