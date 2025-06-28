const express = require("express");
const router = express.Router();
const listingController = require("../controllers/listings");

router.get("/", listingController.landingPage);

module.exports = router;
