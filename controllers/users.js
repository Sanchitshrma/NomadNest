const User = require("../models/user");
const crypto = require("crypto");
const { sendMail } = require("../utils/mailer");

module.exports.renderSignupForm = (req, res) => {
  res.render("users/signup.ejs");
};

module.exports.signup = async (req, res) => {
  try {
    let { username, email, password } = req.body;
    const newUser = new User({ email, username });
    const registeredUser = await User.register(newUser, password);
    req.login(registeredUser, (err) => {
      if (err) {
        return next(err);
      }
      req.flash("success", "Welcome to NomadNest!");
      res.redirect("/listings");
    });
  } catch (e) {
    req.flash("error", e.message);
    res.render("/signup");
  }
};

module.exports.renderLoginForm = (req, res) => {
  res.render("users/login.ejs");
};

module.exports.login = async (req, res) => {
  req.flash("success", "Welcome back to NomadNest!");
  let redirectUrl = res.locals.redirectUrl || "/listings";
  res.redirect(redirectUrl);
};

module.exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.flash("success", "You are logged out!");
    res.redirect("/listings");
  });
};

// ===== Password reset via OTP =====
module.exports.renderForgotForm = (req, res) => {
  res.render("users/forgot.ejs");
};

module.exports.sendResetOtp = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  // Do not reveal whether user exists to avoid enumeration
  if (!user) {
    req.flash("success", "If the email exists, an OTP has been sent.");
    return res.redirect("/reset");
  }

  // Generate 6-digit OTP and store hash + expiry (10 min)
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hash = crypto.createHash("sha256").update(otp).digest("hex");
  user.resetOtpHash = hash;
  user.resetOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
  user.resetOtpTries = 0;
  await user.save();

  const subject = "NomadNest password reset OTP";
  const html = `
    <p>Use the following One-Time Password (OTP) to reset your password:</p>
    <h2 style="letter-spacing:3px;">${otp}</h2>
    <p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
  `;
  await sendMail(email, subject, html);

  req.flash("success", "If the email exists, an OTP has been sent.");
  res.redirect("/reset");
};

module.exports.renderResetForm = (req, res) => {
  res.render("users/reset.ejs");
};

module.exports.resetWithOtp = async (req, res) => {
  const { email, otp, password, confirm } = req.body;
  if (!email || !otp || !password || !confirm) {
    req.flash("error", "All fields are required");
    return res.redirect("/reset");
  }
  if (password !== confirm) {
    req.flash("error", "Passwords do not match");
    return res.redirect("/reset");
  }

  const user = await User.findOne({ email });
  if (!user || !user.resetOtpHash || !user.resetOtpExpires) {
    req.flash("error", "Invalid or expired OTP");
    return res.redirect("/reset");
  }
  if (user.resetOtpTries >= 5) {
    req.flash("error", "Too many attempts. Request a new OTP.");
    return res.redirect("/forgot");
  }
  if (user.resetOtpExpires.getTime() < Date.now()) {
    req.flash("error", "OTP expired. Request a new one.");
    return res.redirect("/forgot");
  }
  const hash = crypto.createHash("sha256").update(otp).digest("hex");
  if (hash !== user.resetOtpHash) {
    user.resetOtpTries += 1;
    await user.save();
    req.flash("error", "Incorrect OTP");
    return res.redirect("/reset");
  }

  await user.setPassword(password);
  user.resetOtpHash = undefined;
  user.resetOtpExpires = undefined;
  user.resetOtpTries = 0;
  await user.save();

  req.flash("success", "Password updated. Please log in.");
  res.redirect("/login");
};
