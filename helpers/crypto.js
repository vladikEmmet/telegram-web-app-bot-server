const CryptoJS = require("crypto-js");

const encode = (str) =>
  CryptoJS.AES.encrypt(str, process.env.CIPHER_KEY).toString();

const decode = (str) =>
  CryptoJS.AES.decrypt(str, process.env.CIPHER_KEY).toString(CryptoJS.enc.Utf8);

module.exports = {
  encode,
  decode,
};
