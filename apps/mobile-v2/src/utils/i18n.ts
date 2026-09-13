/**
 * GreatSales Localization (i18n) Architecture.
 *
 * Provides a structured dictionary and translation helper for sales terminology.
 * Default locale: 'en' (English). Prepared for 'ta' (Tamil).
 */

export type SupportedLocale = 'en' | 'ta';

export const STRINGS: Record<SupportedLocale, Record<string, string>> = {
  en: {
    // Navigation & General
    today: 'Today',
    pipeline: 'Pipeline',
    new_sale: 'New Sale',
    followups: 'Follow-ups',
    more: 'More',
    search: 'Search',
    notifications: 'Notifications',
    profile: 'Profile',
    settings: 'Settings',

    // Sales Metrics
    committed: 'COMMITTED',
    achieved: 'ACHIEVED',
    target: 'MONTHLY TARGET',
    achievement_rate: 'ACHIEVEMENT RATE',
    recurring_sales: 'Recurring Sales',
    new_sales: 'New Sales',
    total_pipeline: 'Total Pipeline',

    // Deal Stages
    oral_confirmation: 'Oral Confirmation',
    negotiation: 'Negotiation',
    proposal: 'Proposal',
    won: 'Won',
    lost: 'Lost',

    // Receivables
    outstanding: 'OUTSTANDING',
    aging: 'AGING',
    red_zone: 'Red Zone',
    yellow_zone: 'Yellow Zone',
    green_zone: 'Green Zone',
    record_payment: 'Record Payment',

    // Actions
    new_lead: 'New Lead',
    new_order: 'New Order',
    add_customer: 'Add Customer',
    complete_task: 'Complete Task',
    snooze: 'Snooze',
    call: 'Call',
    whatsapp: 'WhatsApp',
    retry: 'Retry',
  },
  ta: {
    today: 'இன்று',
    pipeline: 'விற்பனை வாய்ப்புகள்',
    new_sale: 'புதிய விற்பனை',
    followups: 'பின்தொடர்தல்',
    more: 'கூடுதல்',
    search: 'தேடுக',
    notifications: 'அறிவிப்புகள்',
    profile: 'சுயவிவரம்',
    settings: 'அமைப்புகள்',

    committed: 'ஒப்புக்கொள்ளப்பட்டது',
    achieved: 'அடையப்பட்டது',
    target: 'மாத இலக்கு',
    achievement_rate: 'வெற்றி சதவீதம்',
    recurring_sales: 'தொடர் விற்பனை',
    new_sales: 'புதிய விற்பனை',
    total_pipeline: 'மொத்த வாய்ப்பு மதிப்பு',

    oral_confirmation: 'வாய்மொழி உறுதி',
    negotiation: 'பேச்சுவார்த்தை',
    proposal: 'முன்மொழிவு',
    won: 'வென்றது',
    lost: 'இழந்தது',

    outstanding: 'நிலுவைத் தொகை',
    aging: 'நிலுவை நாட்கள்',
    red_zone: 'சிவப்பு மண்டலம்',
    yellow_zone: 'மஞ்சள் மண்டலம்',
    green_zone: 'பச்சை மண்டலம்',
    record_payment: 'பணம் பதிவு செய்',

    new_lead: 'புதிய வாய்ப்பு',
    new_order: 'புதிய ஆர்டர்',
    add_customer: 'வாடிக்கையாளர் சேர்',
    complete_task: 'முடித்தல்',
    snooze: 'தள்ளிவை',
    call: 'அழை',
    whatsapp: 'வாட்ஸ்அப்',
    retry: 'மீண்டும் முயற்சி',
  },
};

let currentLocale: SupportedLocale = 'en';

export function t(key: string): string {
  return STRINGS[currentLocale]?.[key] || STRINGS.en[key] || key;
}

export function setLocale(locale: SupportedLocale) {
  currentLocale = locale;
}

export function getLocale(): SupportedLocale {
  return currentLocale;
}
