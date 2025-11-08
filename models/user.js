const { required } = require("joi");
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
  },
  // Password reset fields
  resetOtpHash: String,
  resetOtpExpires: Date,
  resetOtpTries: { type: Number, default: 0 },
});

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);
