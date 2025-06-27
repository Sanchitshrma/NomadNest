// routes/search.js
const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const searchController = require("../controllers/search.js");

// Search route
router.get("/", wrapAsync(searchController.searchListings));

// Search suggestions API route
router.get("/suggestions", wrapAsync(searchController.searchSuggestions));

module.exports = router;
