import { describe, it, expect } from 'vitest';
import {
  formatCurrencyINR,
  formatLakhs,
  formatNumber,
  formatPercentage,
  formatInitials,
} from '../../src/domain/formatters';

describe('Domain Formatters', () => {
  it('formats INR currency correctly', () => {
    expect(formatCurrencyINR(1500)).toBe('₹1,500');
    expect(formatCurrencyINR(150000)).toBe('₹1,50,000');
  });

  it('formats Lakhs and Crores correctly', () => {
    expect(formatLakhs(482000)).toBe('₹4.82L');
    expect(formatLakhs(1840000)).toBe('₹18.40L');
    expect(formatLakhs(25000000)).toBe('₹2.50Cr');
  });

  it('formats percentages correctly', () => {
    expect(formatPercentage(74)).toBe('74%');
    expect(formatPercentage(99.4)).toBe('99%');
  });

  it('formats initials correctly', () => {
    expect(formatInitials('Megala')).toBe('ME');
    expect(formatInitials('Surendiran K')).toBe('SK');
    expect(formatInitials('')).toBe('GS');
  });
});
