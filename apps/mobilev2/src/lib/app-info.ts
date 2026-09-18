/**
 * What the About screen states about the app.
 *
 * The version is read from `app.json` through Expo's constants rather than
 * typed here, so it cannot drift from what was actually built.
 */
import Constants from "expo-constants";

export const APP_VERSION: string = Constants.expoConfig?.version ?? "0.1.0";

export const APP_NAME = "GreatSales";

export const APP_TAGLINE = "Field sales, in hand.";
