import { describe, it, expect, beforeEach } from 'vitest';
import { isFeatureEnabled, setFeatureFlagOverride, resetFeatureFlagOverrides } from '../../src/utils/featureFlags';
import { t, setLocale, getLocale } from '../../src/utils/i18n';

describe('Feature Flags', () => {
  beforeEach(() => {
    resetFeatureFlagOverrides();
  });

  it('should return default flag states correctly', () => {
    expect(isFeatureEnabled('enable_whatsapp_direct')).toBe(true);
    expect(isFeatureEnabled('enable_skia_visualizations')).toBe(false);
  });

  it('should allow overriding flags in development/testing', () => {
    setFeatureFlagOverride('enable_skia_visualizations', true);
    expect(isFeatureEnabled('enable_skia_visualizations')).toBe(true);
  });
});

describe('i18n Localization', () => {
  beforeEach(() => {
    setLocale('en');
  });

  it('should return default English translations', () => {
    expect(t('oral_confirmation')).toBe('Oral Confirmation');
    expect(t('committed')).toBe('COMMITTED');
    expect(t('achieved')).toBe('ACHIEVED');
  });

  it('should switch locale to Tamil and return localized strings', () => {
    setLocale('ta');
    expect(getLocale()).toBe('ta');
    expect(t('oral_confirmation')).toBe('வாய்மொழி உறுதி');
    expect(t('committed')).toBe('ஒப்புக்கொள்ளப்பட்டது');
    expect(t('achieved')).toBe('அடையப்பட்டது');
  });

  it('should fallback to English or key when translation is missing', () => {
    setLocale('ta');
    expect(t('unknown_sales_key')).toBe('unknown_sales_key');
  });
});
