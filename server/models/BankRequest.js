const mongoose = require("mongoose");
const { Schema } = mongoose;

const BankRequestSchema = new Schema(
  {
    bankEmail: {
      type: String,
      required: true,
    },
    bankName: String,
    bankEthAddress: String,
    clientKycId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    remarks: String,
    history: [
      {
        action: String,
        message: String,
        at: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const BankRequest = mongoose.model("bank_request", BankRequestSchema);
module.exports = BankRequest;

