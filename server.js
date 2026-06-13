const path = require("path");
const express = require("express");
const session = require("express-session");
const RedisStore = require("connect-redis").default;
const { createClient } = require("redis");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const config = require("./config");
const userService = require("./services/user");
const authMiddleware = require("./middleware/auth");
const { dashboardHtml } = require("./templates/dashboard");

// Route imports
const authRoutes = require("./routes/auth");
const apiRoutes = require("./routes/api");
const pageRoutes = require("./routes/pages");
const settingsRoutes = require("./routes/settings");
const assistantRoutes = require("./routes/assistant");
const changelogRoutes = require("./routes/changelog");

/**
 * ──────────────────────────────────────────────────────────────────────────
 * SHIPFAST - REFACTORED ENTRY POINT
 * ──────────────────────────────────────────────────────────────────────────
 *
 * This is the main entry point after refactoring. The monolithic server.js
 * has been broken into modular, testable components:
 *
 * - config.js: Configuration management
 * - services/: Business logic (S3, user, page, content management)
 * - middleware/: Express middleware (auth, etc.)
 * - routes/: API and page routes
 * - templates/: HTML template generation
 *
 * This follows SOLID principles and improves maintainability significantly.
 */

// ── Initialize Express ────────────────────────────────────────────────────

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Initialize Redis & Session ───────────────────────────────────────────

const redisClient = createClient({ url: config.REDIS_URL });
redisClient.on("error", (err) => console.error("Redis Client Error", err));
redisClient.connect().catch((err) => console.error("Redis connection failed:", err));

app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.IS_PRODUCTION,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// ── Setup Passport Authentication ────────────────────────────────────────

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Configure Google OAuth if enabled
if (config.GOOGLE_AUTH_ENABLED) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.GOOGLE_CLIENT_ID,
        clientSecret: config.GOOGLE_CLIENT_SECRET,
        callbackURL: "/auth/google/callback",
      },
      async (_accessToken, _refreshToken, profile, done) => {
        const user = {
          id: "google-" + profile.id,
          displayName: profile.displayName,
          email: (profile.emails && profile.emails[0] && profile.emails[0].value) || "",
          avatar: (profile.photos && profile.photos[0] && profile.photos[0].value) || "",
          role: "publisher",
        };
        await userService.upsertUser(user);
        done(null, user);
      }
    )
  );
} else {
  console.log(
    "Google OAuth disabled — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable"
  );
}

// ── Mount Routes ──────────────────────────────────────────────────────────

// Inject the shared Redis client into each router via app.locals
app.locals.redisClient = redisClient;

// Authentication routes
app.use("/", authRoutes);

// API routes (all under /api/pages)
app.use("/api", apiRoutes);

// Settings page
app.use("/", settingsRoutes);

// Changelog page
app.use("/", changelogRoutes);

// AI assistant (widget delivery + chat persistence API)
app.use("/", assistantRoutes);

// Page serving routes
app.use("/", pageRoutes);

// ── Dashboard Route (root) ────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(dashboardHtml(authMiddleware.getCurrentUser(req)));
});

// ── Start Server ──────────────────────────────────────────────────────────

const PORT = config.PORT;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Shipfast running on :${PORT}`);
  console.log(`Environment: ${config.NODE_ENV}`);
  console.log(`Google OAuth: ${config.GOOGLE_AUTH_ENABLED ? "enabled" : "disabled"}`);
});

module.exports = app;
