/**
 * GreatSales Feature Flag System.
 *
 * Provides a lightweight, typed boundary for enabling or disabling features
 * across development, staging, and production environments.
 */

export type FeatureFlagKey =
  | 'enable_skia_visualizations'
  | 'enable_biometric_login'
  | 'enable_whatsapp_direct'
  | 'enable_offline_persistence'
  | 'enable_order_split_shipment'
  | 'enable_quick_action_fab';

const DEFAULT_FLAGS: Record<FeatureFlagKey, boolean> = {
  enable_skia_visualizations: false,
  enable_biometric_login: true,
  enable_whatsapp_direct: true,
  enable_offline_persistence: true,
  enable_order_split_shipment: false,
  enable_quick_action_fab: true,
};

let customOverrides: Partial<Record<FeatureFlagKey, boolean>> = {};

export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  if (key in customOverrides) {
    return Boolean(customOverrides[key]);
  }
  return DEFAULT_FLAGS[key] ?? false;
}

export function setFeatureFlagOverride(key: FeatureFlagKey, value: boolean) {
  customOverrides[key] = value;
}

export function resetFeatureFlagOverrides() {
  customOverrides = {};
}
