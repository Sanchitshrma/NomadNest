const express = require("express");
const router = express.Router();
const Listing = require("../models/listing.js");
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, isOwner, validateListing } = require("../middleware.js");
const listingController = require("../controllers/listings.js");
const multer = require("multer");
const { storage } = require("../Cloudconfig.js");
const upload = multer({ storage });

//Itinerary
router.get("/itinerary", listingController.renderItineraryForm);
router.post("/itinerary", listingController.generateItinerary);

router
  .route("/listings")
  //index route
  .get(wrapAsync(listingController.index))
  // create route
  .post(
    isLoggedIn,
    upload.single("listing[image]"),
    validateListing,
    wrapAsync(listingController.createListing)
  );

// New  route
router.get("/new", isLoggedIn, listingController.renderNewForm);

router
  .route("/:id")
  //show route
  .get(wrapAsync(listingController.showListing))
  //update route
  .put(
    isLoggedIn,
    isOwner,
    upload.single("listing[image]"),
    validateListing,
    wrapAsync(listingController.updateListing)
  )
  //destroy route
  .delete(isLoggedIn, isOwner, wrapAsync(listingController.destroyListing));

//Edit route
router.get(
  "/:id/edit",
  isLoggedIn,
  isOwner,
  wrapAsync(listingController.renderEditForm)
);

// router.get("/", listingController.landingPage); // Moved to top to prevent route conflicts

module.exports = router;
