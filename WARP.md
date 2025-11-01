# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Project overview
- Node.js + Express.js server with EJS views and static assets in `public/`
- MongoDB via Mongoose; sessions stored in MongoDB (`connect-mongo`)
- Authentication with Passport (local strategy)
- File uploads to Cloudinary (via `multer` + `multer-storage-cloudinary`)
- Geocoding with Mapbox; optional AI-powered itinerary generation with Google GenAI

Environment
- Node engine: 20.12.2 (see `package.json`)
- Required environment variables (create a `.env` in project root):
  - ATLASDB_URL: Mongo connection string
  - SECRET: session secret
  - CLOUD_NAME, CLOUD_API_KEY, CLOUD_API_SECRET: Cloudinary credentials
  - MAP_TOKEN: Mapbox access token (used by `@mapbox/mapbox-sdk`)
  - GEMINI_API_KEY: Google GenAI API key (only needed for itinerary feature)

Common commands
- Install dependencies: `npm install`
- Run the server locally (port 8080): `node app.js`
- Seed local Mongo with sample listings (uses `mongodb://127.0.0.1:27017/wanderlust`): `node init/index.js`
- Tests: not configured (the default `npm test` script only prints a placeholder)
- Lint/format: not configured
- Build: not applicable (server-side JS + EJS)

Notes
- README mentions `npm start` and port 3000, but there is no `start` script; the app listens on port 8080 in `app.js`.
- The Mapbox token env name in code is `MAP_TOKEN` (not `MAPBOX_TOKEN`).
- Cloudinary env names in code are `CLOUD_NAME`, `CLOUD_API_KEY`, `CLOUD_API_SECRET` (ensure they match your `.env`).

High-level architecture
- Entry point: `app.js`
  - Loads env, connects to Mongo (`ATLASDB_URL`), configures sessions (`SECRET`) with `connect-mongo`
  - Sets up Passport local auth with `User` model
  - Registers routers: `/` (home + listings + users), `/listings/:id/reviews`, `/search` (and `/search/suggestions`)
  - Serves static assets from `public/` and EJS views from `views/`
  - Central error handling using custom `ExpressError`
- Routes/controllers
  - `routes/home.js` → `controllers/listings.landingPage`
  - `routes/listing.js` → `controllers/listings` (CRUD for listings, image upload via Cloudinary, Mapbox geocoding, itinerary endpoints)
  - `routes/reviews.js` → `controllers/reviews` (create/delete reviews under `/listings/:id/reviews`)
  - `routes/user.js` → `controllers/users` (signup/login/logout with Passport)
  - `routes/search.js` → `controllers/search` (server-side search + suggestions)
- Models (`models/`)
  - `Listing`: title, description, image, price, location, country, owner, reviews, and GeoJSON `geometry` used for maps; cascades review deletion on listing delete
  - `Review`: comment, rating, timestamps, author
  - `User`: email + `passport-local-mongoose` for username/password
- Middleware (`middleware.js`)
  - Auth guards (`isLoggedIn`, `isOwner`, `isReviewAuthor`) and Joi validation (`validateListing`, `validateReview`) using schemas in `schema.js`
- Views (`views/`)
  - EJS templates structured with `layouts/boilerplate.ejs`, shared `includes/`, and feature pages under `listings/` and `users/`
- Utilities
  - `Cloudconfig.js`: Cloudinary configuration and storage adapter export
  - `utils/ExpressError.js`, `utils/wrapAsync.js`: error utilities
  - `init/`: seeding script and sample data for local development
