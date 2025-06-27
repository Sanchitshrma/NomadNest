// controllers/search.js
const Listing = require("../models/listing.js");

module.exports.searchListings = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === "") {
      return res.render("listings/search.ejs", {
        allListing: [],
        searchTerm: "",
        resultCount: 0,
        errorMessage: "Please enter a search term",
      });
    }

    const searchTerm = q.trim();

    // Create search query with multiple fields
    const searchQuery = {
      $or: [
        { title: { $regex: searchTerm, $options: "i" } },
        { description: { $regex: searchTerm, $options: "i" } },
        { location: { $regex: searchTerm, $options: "i" } },
        { country: { $regex: searchTerm, $options: "i" } },
      ],
    };

    const searchResults = await Listing.find(searchQuery);

    // If no results found, try a more flexible search
    if (searchResults.length === 0) {
      const flexibleQuery = {
        $or: [
          { title: { $regex: searchTerm.split(" ").join("|"), $options: "i" } },
          {
            description: {
              $regex: searchTerm.split(" ").join("|"),
              $options: "i",
            },
          },
          {
            location: {
              $regex: searchTerm.split(" ").join("|"),
              $options: "i",
            },
          },
          {
            country: { $regex: searchTerm.split(" ").join("|"), $options: "i" },
          },
        ],
      };

      const flexibleResults = await Listing.find(flexibleQuery);

      if (flexibleResults.length === 0) {
        return res.render("listings/search.ejs", {
          allListing: [],
          searchTerm,
          resultCount: 0,
          errorMessage: `No listings found for "${searchTerm}"`,
        });
      }

      return res.render("listings/search.ejs", {
        allListing: flexibleResults,
        searchTerm,
        resultCount: flexibleResults.length,
      });
    }

    res.render("listings/search.ejs", {
      allListing: searchResults,
      searchTerm,
      resultCount: searchResults.length,
      errorMessage: null,
    });
  } catch (error) {
    console.error("Search error:", error);
    req.flash("error", "Something went wrong during search");
    res.redirect("/listings");
  }
};

module.exports.searchSuggestions = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === "") {
      return res.json([]);
    }

    const searchTerm = q.trim();

    // Get unique locations and countries for suggestions
    const suggestions = await Listing.aggregate([
      {
        $match: {
          $or: [
            { location: { $regex: searchTerm, $options: "i" } },
            { country: { $regex: searchTerm, $options: "i" } },
            { title: { $regex: searchTerm, $options: "i" } },
          ],
        },
      },
      {
        $group: {
          _id: null,
          locations: { $addToSet: "$location" },
          countries: { $addToSet: "$country" },
          titles: { $addToSet: "$title" },
        },
      },
    ]);

    if (suggestions.length === 0) {
      return res.json([]);
    }

    const { locations, countries, titles } = suggestions[0];

    // Filter and combine suggestions
    const allSuggestions = [
      ...locations.filter((loc) =>
        loc.toLowerCase().includes(searchTerm.toLowerCase())
      ),
      ...countries.filter((country) =>
        country.toLowerCase().includes(searchTerm.toLowerCase())
      ),
      ...titles.filter((title) =>
        title.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    ];

    // Remove duplicates and limit to 8 suggestions
    const uniqueSuggestions = [...new Set(allSuggestions)].slice(0, 8);

    res.json(uniqueSuggestions);
  } catch (error) {
    console.error("Suggestions error:", error);
    res.json([]);
  }
};
