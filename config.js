const path = require("path");

// Load .env.local first (local dev overrides), then fall back to .env
require("dotenv").config({ path: path.resolve(__dirname, ".env.local"), override: true });
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

/**
 * Application Configuration
 * Centralizes all environment-based config following the Single Responsibility Principle
 */

const config = {
  // App settings
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: process.env.PORT || 3000,

  // Auth settings
  PUBLISHER_PASSWORD: process.env.PUBLISHER_PASSWORD || "shipfast",
  SESSION_SECRET: process.env.SESSION_SECRET,

  // Redis configuration
  REDIS_URL: process.env.REDIS_URL,

  // S3 configuration
  S3_BUCKET: process.env.S3_BUCKET,
  S3_REGION: process.env.S3_REGION || process.env.AWS_REGION,

  // Google OAuth configuration
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,

  // Computed flags
  IS_PRODUCTION: process.env.NODE_ENV === "production",
};

// Google Auth enabled flag
config.GOOGLE_AUTH_ENABLED = !!(
  config.GOOGLE_CLIENT_ID &&
  config.GOOGLE_CLIENT_SECRET &&
  config.GOOGLE_CLIENT_ID !== "your-google-client-id" &&
  config.GOOGLE_CLIENT_SECRET !== "your-google-client-secret"
);

/**
 * Validate required configuration
 * Fail fast on startup if critical config is missing
 */
function validateConfig() {
  if (!config.SESSION_SECRET) {
    throw new Error(
      "SESSION_SECRET is required. Set it in .env or environment variables."
    );
  }
  if (!config.REDIS_URL) {
    throw new Error(
      "REDIS_URL is required. Set it in .env or environment variables."
    );
  }
  if (!config.S3_BUCKET) {
    throw new Error(
      "S3_BUCKET is required. Set it in .env or environment variables."
    );
  }
}

validateConfig();

module.exports = config;
