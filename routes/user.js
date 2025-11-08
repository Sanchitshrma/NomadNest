const express = require("express");
const wrapAsync = require("../utils/wrapAsync");
const router = express.Router();
const passport = require("passport");
const { saveRedirectUrl } = require("../middleware");
const userController = require("../controllers/users");

router
  .route("/signup")
  .get(userController.renderSignupForm)
  .post(wrapAsync(userController.signup));

router
  .route("/login")
  .get(userController.renderLoginForm)
  .post(
    saveRedirectUrl,
    passport.authenticate("local", {
      failureRedirect: "/login",
      failureFlash: true,
    }),
    userController.login
  );

router.get("/logout", userController.logout);

// Password reset
router
  .route("/forgot")
  .get(userController.renderForgotForm)
  .post(wrapAsync(userController.sendResetOtp));

router
  .route("/reset")
  .get(userController.renderResetForm)
  .post(wrapAsync(userController.resetWithOtp));

module.exports = router;
