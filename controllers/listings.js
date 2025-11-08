const Listing = require("../models/listing.js");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

module.exports.index = async (req, res) => {
  const {
    minPrice,
    maxPrice,
    category,
    sort,
    page = 1,
    limit = 12,
  } = req.query;

  // Build query
  const query = {};
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  // Category mapping → regex search across title/description/location/country
  const categoryMap = {
    rooms: ["room"],
    mountains: ["mountain", "alpine"],
    pools: ["pool"],
    camping: ["camp", "glamp"],
    arctic: ["arctic", "snow", "ice"],
    skiing: ["ski"],
    campervan: ["campervan", "rv", "van"],
    hills: ["hill", "hills"],
    castles: ["castle", "historic"],
    luxe: ["luxe", "luxury", "penthouse"],
    cruise: ["cruise", "island", "beachfront"],
    trending: [],
  };

  if (category && categoryMap[category]) {
    const terms = categoryMap[category];
    if (terms.length) {
      query.$or = terms.map((t) => ({
        $or: [
          { title: { $regex: t, $options: "i" } },
          { description: { $regex: t, $options: "i" } },
          { location: { $regex: t, $options: "i" } },
          { country: { $regex: t, $options: "i" } },
        ],
      }));
    }
  }

  // Sorting
  let sortSpec = {};
  switch (sort) {
    case "price-asc":
      sortSpec = { price: 1 };
      break;
    case "price-desc":
      sortSpec = { price: -1 };
      break;
    case "newest":
      sortSpec = { _id: -1 }; // approximate newest
      break;
    default:
      sortSpec = {};
  }

  const pageNum = Math.max(parseInt(page) || 1, 1);
  const perPage = Math.min(Math.max(parseInt(limit) || 12, 1), 48);
  const skip = (pageNum - 1) * perPage;

  const total = await Listing.countDocuments(query);
  const allListing = await Listing.find(query)
    .sort(sortSpec)
    .skip(skip)
    .limit(perPage);

  res.render("listings/index.ejs", {
    allListing,
    filters: {
      minPrice: minPrice || "",
      maxPrice: maxPrice || "",
      category: category || "",
      sort: sort || "",
    },
    pagination: {
      page: pageNum,
      limit: perPage,
      total,
      totalPages: Math.max(Math.ceil(total / perPage), 1),
    },
  });
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
    return res.redirect("/listings");
  }

  // Derive category heuristically from title/description/location
  const text = `${listing.title} ${listing.description || ""} ${listing.location || ""} ${listing.country || ""}`;
  const categoryMap = [
    { key: "rooms", label: "Rooms", terms: ["room"] },
    { key: "mountains", label: "Mountains", terms: ["mountain", "alpine"] },
    { key: "pools", label: "Pools", terms: ["pool"] },
    { key: "camping", label: "Camping", terms: ["camp", "glamp"] },
    { key: "arctic", label: "Arctic", terms: ["arctic", "snow", "ice"] },
    { key: "skiing", label: "Skiing", terms: ["ski"] },
    { key: "campervan", label: "Campervan", terms: ["campervan", "rv", "van"] },
    { key: "hills", label: "Hills", terms: ["hill", "hills"] },
    { key: "castles", label: "Castles", terms: ["castle", "historic"] },
    { key: "luxe", label: "Luxe", terms: ["luxe", "luxury", "penthouse"] },
    { key: "cruise", label: "Cruise", terms: ["cruise", "island", "beachfront"] },
  ];
  let category = { key: "trending", label: "Trending", terms: [] };
  for (const c of categoryMap) {
    if (c.terms.some((t) => new RegExp(t, "i").test(text))) {
      category = c;
      break;
    }
  }

  // Fetch similar listings by category (best-effort)
  let similarListings = [];
  if (category.terms.length) {
    const or = category.terms.map((t) => ({
      $or: [
        { title: { $regex: t, $options: "i" } },
        { description: { $regex: t, $options: "i" } },
        { location: { $regex: t, $options: "i" } },
        { country: { $regex: t, $options: "i" } },
      ],
    }));
    similarListings = await Listing.find({ _id: { $ne: id }, $or: or })
      .limit(6)
      .sort({ _id: -1 });
  } else {
    similarListings = await Listing.find({ _id: { $ne: id } })
      .limit(6)
      .sort({ _id: -1 });
  }

  // Geocode (best-effort)
  try {
    let response = await geocodingClient
      .forwardGeocode({ query: listing.location, limit: 1 })
      .send();
    if (response.body.features?.[0]?.geometry) {
      listing.geometry = response.body.features[0].geometry;
    }
  } catch (e) {
    // ignore geocode errors for view rendering
  }

  // Basic amenities (until dedicated schema exists)
  const amenities = [
    { icon: "fa-wifi", label: "Free WiFi" },
    { icon: "fa-square-parking", label: "Parking" },
    { icon: "fa-snowflake", label: "Air Conditioning" },
    { icon: "fa-mug-saucer", label: "Breakfast Included" },
    { icon: "fa-kitchen-set", label: "Kitchen" },
    { icon: "fa-soap", label: "Washer" },
    { icon: "fa-tv", label: "TV" },
    { icon: "fa-dumbbell", label: "Gym" },
    { icon: "fa-mountain", label: "Mountain View" },
    { icon: "fa-leaf", label: "Nature View" },
  ];

  res.render("listings/show.ejs", { listing, category, amenities, similarListings });
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

module.exports.landingPage = (req, res) => {
  const landingImages = [
    {
      url: "/images/beach.jpg",
      caption: "Let the waves take you where the Wi-Fi can't.",
    },
    {
      url: "/images/mountains.jpg",
      caption: "Climb mountains, not corporate ladders.",
    },
    {
      url: "/images/forest.jpg",
      caption: "Where trees speak and cities stay silent.",
    },
    { url: "/images/lake.jpg", caption: "Still waters. Stirred souls." },
    {
      url: "/images/desert.jpg",
      caption: "Whispers of the dunes and wanderers' tales.",
    },
    { url: "/images/snow.jpg", caption: "Chill in the air. Fire in the soul." },
    {
      url: "/images/bridge.jpg",
      caption: "Cross bridges to find yourself.",
    },
    {
      url: "/images/city.jpg",
      caption: "The city lights hide a thousand untold journeys.",
    },
    {
      url: "/images/jungle.jpg",
      caption: "In the heart of the jungle, silence speaks loudest.",
    },
    {
      url: "/images/cabin.jpg",
      caption: "Cabins in the wild know secrets the world forgot.",
    },
    {
      url: "/images/roadtrip.jpg",
      caption: "Every road trip writes its own poetry.",
    },
  ];
  // Remove the last image from the landing set
  landingImages.pop();
  res.render("home", { landingImages });
};
