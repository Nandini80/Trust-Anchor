const mongoose = require("mongoose");
const { Schema } = mongoose;

const BankSchema = new Schema({
  email:{
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  ethAddress: {
    type: String,
    required: true,
    unique: true,
  },
  // Store additional bank details
  bankName: String,
  bankAddress: String,
  contactNumber: String,
  timestamp: {
    type: Date,
    default: Date.now,
  },
});
const Bank = mongoose.model('bank',BankSchema)
module.exports = Bank;