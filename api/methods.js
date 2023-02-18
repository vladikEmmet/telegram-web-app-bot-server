const Password = require("../models/Password");

const getPasswords = async (id) => {
  const data = await Password.find({ userTgId: id });
  return data;
};

module.exports = {
  getPasswords,
};
