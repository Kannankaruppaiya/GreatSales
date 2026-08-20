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
  // Demo/seed login prefill (dev only; never real secrets). Used to prefill the
  // login form so the seeded tenant is one click away.
  DEMO_TENANT_ID: import.meta.env.VITE_DEMO_TENANT_ID || "tenant_acme",
  DEMO_EMAIL: import.meta.env.VITE_DEMO_EMAIL || "admin@acme.test",
  DEMO_PASSWORD: import.meta.env.VITE_DEMO_PASSWORD || "Passw0rd!",
} as const;
