const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  accountId: { type: String, required: true },
  name: { type: String, required: true },
  mobile: { type: String, required: true, unique: true },
  country: { type: String, required: true },
  email: { type: String, required: true }
});

const User = mongoose.model("User", userSchema);

module.exports = User;
