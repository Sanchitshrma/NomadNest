const Listing = require("../models/listing.js");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

module.exports.index = async (req, res) => {
  let allListing = await Listing.find({});
  res.render("listings/index.ejs", { allListing });
};

module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs");
};

module.exports.showListing = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id)
    .populate({ path: "reviews", populate: { path: "author" } })
    .populate("owner");
  if (!listing) {
    req.flash("error", " Listing you requested does not exist");
    res.redirect("/listings");
  }
  let response = await geocodingClient
    .forwardGeocode({
      query: listing.location,
      limit: 1,
    })
    .send();
  listing.geometry = response.body.features[0].geometry;
  res.render("listings/show.ejs", { listing });
};

module.exports.createListing = async (req, res) => {
  let response = await geocodingClient
    .forwardGeocode({
      query: req.body.listing.location,
      limit: 1,
    })
    .send();

  let url = req.file.path;
  let filename = req.file.filename;
  const newListing = new Listing(req.body.listing);
  newListing.owner = req.user._id;
  newListing.image = { url, filename };

  newListing.geometry = response.body.features[0].geometry;

  let savedListing = await newListing.save();
  console.log(savedListing);
  req.flash("success", " New listing is created !");
  res.redirect("/listings");
};

module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing you requested for does not exist");
    res.redirect("/listings");
  }

  let originalImageUrl = listing.image.url;
  originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250");
  res.render("listings/edit.ejs", { listing, originalImageUrl });
};

module.exports.updateListing = async (req, res) => {
  let { id } = req.params;
  let listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });
  if (typeof req.file !== "undefined") {
    let url = req.file.path;
    let filename = req.file.filename;
    listing.image = { url, filename };
    await listing.save();
  }
  req.flash("success", " Listing is updated !");
  res.redirect(`/listings/${id}`);
};

module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;
  await Listing.findByIdAndDelete(id);
  req.flash("success", " Listing is deleted !");
  res.redirect("/listings");
};

module.exports.renderItineraryForm = (req, res) => {
  res.render("listings/itinerary", { itinerary: null });
};

module.exports.generateItinerary = async (req, res) => {
  const { place, days } = req.body;

  try {
    const { GoogleGenAI } = await import("@google/genai");
    const { marked } = await import("marked");
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const prompt = `Create a detailed ${days}-day travel itinerary for ${place}, including sightseeing, food recommendations, local tips, and cultural experiences.`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const markdownText = response.text;
    const htmlContent = marked.parse(markdownText);

    res.render("listings/itinerary", { itinerary: htmlContent });
  } catch (err) {
    console.error("Error while generating itinerary:", err);
    res.render("listings/itinerary", {
      itinerary: "❌ Failed to generate itinerary. Please try again later.",
    });
  }
};
