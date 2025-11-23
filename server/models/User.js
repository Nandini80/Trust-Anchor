const mongoose = require("mongoose");
const { Schema } = mongoose;

const UserSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  kycId: {
    type: String,
    required: true,
    unique: true,
  },
  socket: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null/undefined values - only enforces uniqueness for non-null values
    default: undefined, // Don't set to null, leave undefined
  },
  // Store user data and documents locally
  name: String,
  phone: String,
  address: String,
  gender: String,
  dob: String,
  PANno: String,
  panFile: String,  // Path to PAN document
  aadharFile: String,  // Path to Aadhar document
  selfieFile: String,  // Path to Selfie document
  geo: String,
  timestamp: {
    type: Date,
    default: Date.now,
  },
});
const User = mongoose.model("user", UserSchema);
module.exports = User;
