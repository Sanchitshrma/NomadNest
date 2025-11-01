if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

const listingRouter = require("./routes/listing.js");
const reviewsRouter = require("./routes/reviews.js");
const userRouter = require("./routes/user.js");
const searchRouter = require("./routes/search.js");
const homeRouter = require("./routes/home");

// Prefer Atlas if provided, otherwise fall back to local Mongo for dev
const dbUrl = process.env.ATLASDB_URL || "mongodb://127.0.0.1:27017/wanderlust";

main()
  .then(() => {
    console.log("MongoDB connected");

    // After successful DB connection, wire up session store using the active client
    const store = MongoStore.create({
      client: mongoose.connection.getClient(),
      crypto: { secret: process.env.SECRET },
      touchAfter: 24 * 3600,
    });

    bootstrap(store);
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    console.warn("Falling back to in-memory sessions. Logins won't persist across restarts.");
    // Fallback to memory store so routes still work when DB is unreachable
    const memoryStore = new session.MemoryStore();
    bootstrap(memoryStore);
  });

async function main() {
  await mongoose.connect(dbUrl, { serverSelectionTimeoutMS: 8000 });
}

function bootstrap(store) {
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  app.use(express.urlencoded({ extended: true }));
  app.use(methodOverride("_method"));
  app.engine("ejs", ejsMate);
  app.use(express.static(path.join(__dirname, "/public")));

  const sessionOptions = {
    store,
    secret: process.env.SECRET || "devsecret",
    resave: false,
    saveUninitialized: true,
    cookie: {
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
    },
  };

  if (store && store.on) {
    store.on("error", (err) => {
      console.error("Session store error:", err);
    });
  }

  app.use(session(sessionOptions));
  app.use(flash());

  app.use(passport.initialize());
  app.use(passport.session());
  passport.use(new LocalStrategy(User.authenticate()));
  passport.serializeUser(User.serializeUser());
  passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  // Ensure optional locals are defined to avoid EJS reference errors
  if (typeof res.locals.avgRating === 'undefined') res.locals.avgRating = null;
  next();
});

  // Routers (after session/passport so auth works and failures don't kill all routes)
  app.use("/search", searchRouter);
  app.use("/", homeRouter);
  app.use("/listings", listingRouter);
  app.use("/listings/:id/reviews", reviewsRouter);
  app.use("/", userRouter);

  app.all("/*", (req, res, next) => {
    next(new ExpressError(404, "Page not found!"));
  });

  app.use((err, req, res, next) => {
    let { statusCode = 500, message = "Something went wrong !!" } = err;
    res.status(statusCode).render("./listings/error.ejs", { message });
  });

  app.listen(8080, () => {
    console.log("Server is listening to port:8080");
  });
}
