require("dotenv").config(".env");
const crypto = require("crypto");

if (!process.env.PASSWORD_SALT) {
  console.log(
    "Shutting down, in production and missing env. variable PASSWORD_SALT"
  );
  process.exit();
} else if (process.env.PASSWORD_SALT.length < 32) {
  console.log("Shutting down, env. variable PASSWORD_SALT too short.");
  process.exit();
}

module.exports = function (password) {
  if (typeof password !== "string") {
    return null;
  }
  return crypto
    .createHmac("sha256", process.env.PASSWORD_SALT)
    .update(password);
};
