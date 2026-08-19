/**
 * GreatSales Web Application Client Environment Configuration
 * Note: Only public, non-secret variables are prefixed with VITE_.
 * Never put private API keys, database credentials or service secrets here.
 */

export const env = {
  API_BASE_URL: import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1",
  APP_ENV: import.meta.env.VITE_APP_ENV || "development",
  APP_NAME: import.meta.env.VITE_APP_NAME || "GreatSales PRO",
  IS_PROD: import.meta.env.PROD,
  IS_DEV: import.meta.env.DEV,
} as const;
