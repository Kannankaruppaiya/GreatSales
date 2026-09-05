import { normalizeRefNo, planPaymentImport } from './payment-import';

/**
 * Pure import de-dup planner — no DB. Decides, per source row, insert vs.
 * skip-as-duplicate under the FLAGGED-SKIP policy, catching both refs already
 * live in the ledger and refs repeated within the same sheet.
 */
describe('payment-import', () => {
  describe('normalizeRefNo', () => {
    it('trims surrounding whitespace', () => {
      expect(normalizeRefNo('  PAY-1 ')).toBe('PAY-1');
    });
    it('maps blank / whitespace / null / undefined to null (no reference)', () => {
      expect(normalizeRefNo('   ')).toBeNull();
      expect(normalizeRefNo('')).toBeNull();
      expect(normalizeRefNo(null)).toBeNull();
      expect(normalizeRefNo(undefined)).toBeNull();
    });
    it('preserves case (references are case-significant)', () => {
      expect(normalizeRefNo('Pay-1')).toBe('Pay-1');
    });
  });

  describe('planPaymentImport', () => {
    it('inserts references not present anywhere', () => {
      const plan = planPaymentImport([{ refNo: 'A' }, { refNo: 'B' }], []);
      expect(plan.map((d) => d.action)).toEqual(['insert', 'insert']);
    });

    it('skips a reference already live in the ledger', () => {
      const plan = planPaymentImport([{ refNo: 'A' }, { refNo: 'B' }], ['A']);
      expect(plan[0]).toEqual({
        action: 'skip',
        refNo: 'A',
        reason: 'duplicate_existing',
      });
      expect(plan[1]).toEqual({ action: 'insert', refNo: 'B' });
    });

    it('keeps the first occurrence and skips later in-sheet repeats', () => {
      const plan = planPaymentImport(
        [{ refNo: 'A' }, { refNo: 'A' }, { refNo: 'A' }],
        [],
      );
      expect(plan[0]).toEqual({ action: 'insert', refNo: 'A' });
      expect(plan[1]).toEqual({
        action: 'skip',
        refNo: 'A',
        reason: 'duplicate_in_batch',
      });
      expect(plan[2]).toEqual({
        action: 'skip',
        refNo: 'A',
        reason: 'duplicate_in_batch',
      });
    });

    it('dedupes on the trimmed reference, so " A " collides with "A"', () => {
      const plan = planPaymentImport([{ refNo: 'A' }, { refNo: ' A ' }], []);
      expect(plan[1]).toMatchObject({
        action: 'skip',
        reason: 'duplicate_in_batch',
      });
    });

    it('treats an existing reference as normalised on both sides', () => {
      const plan = planPaymentImport([{ refNo: ' A ' }], ['A']);
      expect(plan[0]).toMatchObject({
        action: 'skip',
        reason: 'duplicate_existing',
      });
    });

    it('never treats reference-less rows as duplicates of one another', () => {
      const plan = planPaymentImport(
        [{ refNo: null }, { refNo: '' }, { refNo: '   ' }, {}],
        [],
      );
      expect(plan.every((d) => d.action === 'insert')).toBe(true);
    });

    it('is index-aligned to the input rows', () => {
      const rows = [{ refNo: 'X' }, { refNo: 'A' }, { refNo: 'X' }];
      const plan = planPaymentImport(rows, ['A']);
      expect(plan).toHaveLength(3);
      expect(plan.map((d) => d.action)).toEqual(['insert', 'skip', 'skip']);
    });
  });
});
