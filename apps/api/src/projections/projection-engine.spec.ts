import {
  applyFilters,
  inheritedPrice,
  resolvePrice,
  sortLines,
  summarize,
  toLine,
  type EngineRow,
} from './projection-engine';

/** Minimal row builder — override only what a test cares about. */
function row(over: Partial<EngineRow> = {}): EngineRow {
  return {
    id: 'p1',
    period: '2026-08',
    projectionPrice: null,
    customPrice: null,
    basePrice: null,
    committedQty: 0,
    achievedQty: 0,
    probability: null,
    status: 'ProjectionCreated',
    nextFollowUp: null,
    targetDate: null,
    salesOrderId: null,
    salesOrderStatus: null,
    remarkCount: 0,
    followUpCount: 0,
    customerId: 'c1',
    customerName: 'Acme',
    contactName: null,
    tier: 'Gold',
    productId: 'prod1',
    productName: 'Widget',
    principalId: 'pr1',
    principalName: 'BrandCo',
    salespersonId: 'u1',
    salespersonName: 'Ravi',
    ...over,
  };
}

describe('resolvePrice', () => {
  it('prefers the projection price over custom and base', () => {
    expect(
      resolvePrice(
        row({ projectionPrice: 100, customPrice: 90, basePrice: 80 }),
      ),
    ).toBe(100);
  });

  it('falls back to the mapping custom price when no projection price', () => {
    expect(
      resolvePrice(
        row({ projectionPrice: null, customPrice: 90, basePrice: 80 }),
      ),
    ).toBe(90);
  });

  it('falls back to the product base price when no projection or custom price', () => {
    expect(
      resolvePrice(
        row({ projectionPrice: null, customPrice: null, basePrice: 80 }),
      ),
    ).toBe(80);
  });

  it('is 0 when no price is available anywhere', () => {
    expect(resolvePrice(row())).toBe(0);
  });
});

describe('inheritedPrice', () => {
  // The editable price cell's placeholder. It must IGNORE the line's own
  // price: the point is to say what the line would charge without one, so a
  // cleared field shows the figure the line is about to fall back to.
  it('is the mapping price, whatever the line itself carries', () => {
    expect(
      inheritedPrice(
        row({ projectionPrice: 100, customPrice: 90, basePrice: 80 }),
      ),
    ).toBe(90);
  });

  it('falls back to the catalog price', () => {
    expect(
      inheritedPrice(
        row({ projectionPrice: 100, customPrice: null, basePrice: 80 }),
      ),
    ).toBe(80);
  });

  it('is null when there is nothing to inherit, so the cell shows no placeholder', () => {
    expect(inheritedPrice(row({ projectionPrice: 100 }))).toBeNull();
  });
});

describe('toLine', () => {
  it('reports the own price and the inherited price separately', () => {
    // Without both, the worksheet cannot tell "priced at 100 on this line"
    // from "inheriting 100 from the mapping" — and clearing the cell would be
    // indistinguishable from retyping the same number.
    const own = toLine(
      row({ projectionPrice: 100, customPrice: 90, basePrice: 80 }),
    );
    expect(own.price).toBe(100);
    expect(own.ownPrice).toBe(100);
    expect(own.inheritedPrice).toBe(90);

    const inherited = toLine(row({ projectionPrice: null, customPrice: 90 }));
    expect(inherited.price).toBe(90);
    expect(inherited.ownPrice).toBeNull();
    expect(inherited.inheritedPrice).toBe(90);
  });

  it('computes projected value, achieved value and achievement percent', () => {
    const line = toLine(
      row({ projectionPrice: 10, committedQty: 5, achievedQty: 3 }),
    );
    expect(line.price).toBe(10);
    expect(line.projValue).toBe(50);
    expect(line.achValue).toBe(30);
    expect(line.achPct).toBe(60);
  });

  it('leaves achievement percent null when there is no projected value', () => {
    const line = toLine(
      row({ committedQty: 0, achievedQty: 4, projectionPrice: 10 }),
    );
    expect(line.projValue).toBe(0);
    expect(line.achPct).toBeNull();
  });
});

describe('applyFilters', () => {
  const today = '2026-08-19';
  const lines = [
    toLine(
      row({
        id: 'a',
        principalId: 'pr1',
        committedQty: 5,
        customerName: 'Acme',
      }),
    ),
    toLine(
      row({
        id: 'b',
        principalId: 'pr2',
        committedQty: 0,
        customerName: 'Globex',
      }),
    ),
    toLine(
      row({
        id: 'c',
        principalId: 'pr1',
        committedQty: 2,
        customerName: 'Initech',
        nextFollowUp: '2026-08-10',
      }),
    ),
  ];

  it('keeps only the requested principal', () => {
    const out = applyFilters(lines, {
      principalId: 'pr2',
      lineFilter: 'all',
      today,
    });
    expect(out.map((l) => l.id)).toEqual(['b']);
  });

  it('treats missing/ALL principal as no principal filter', () => {
    expect(applyFilters(lines, { lineFilter: 'all', today })).toHaveLength(3);
    expect(
      applyFilters(lines, { principalId: 'ALL', lineFilter: 'all', today }),
    ).toHaveLength(3);
  });

  it('matches search across customer, product and principal names, case-insensitively', () => {
    expect(
      applyFilters(lines, { search: 'glob', lineFilter: 'all', today }).map(
        (l) => l.id,
      ),
    ).toEqual(['b']);
  });

  it('projected filter keeps only lines with a committed quantity', () => {
    expect(
      applyFilters(lines, { lineFilter: 'projected', today }).map((l) => l.id),
    ).toEqual(['a', 'c']);
  });

  it('blank filter keeps only lines with no committed quantity', () => {
    expect(
      applyFilters(lines, { lineFilter: 'blank', today }).map((l) => l.id),
    ).toEqual(['b']);
  });

  it('due filter keeps only lines whose follow-up is due on or before today', () => {
    expect(
      applyFilters(lines, { lineFilter: 'due', today }).map((l) => l.id),
    ).toEqual(['c']);
  });
});

describe('sortLines', () => {
  it('orders by customer tier rank, then customer name, then product name', () => {
    const lines = [
      toLine(row({ id: 'silver', tier: 'Silver', customerName: 'Zeta' })),
      toLine(row({ id: 'plat', tier: 'Platinum', customerName: 'Yotta' })),
      toLine(
        row({
          id: 'goldB',
          tier: 'Gold',
          customerName: 'Beta',
          productName: 'B',
        }),
      ),
      toLine(
        row({
          id: 'goldA',
          tier: 'Gold',
          customerName: 'Beta',
          productName: 'A',
        }),
      ),
      toLine(row({ id: 'untiered', tier: null, customerName: 'Aardvark' })),
    ];
    expect(sortLines(lines).map((l) => l.id)).toEqual([
      'plat',
      'goldA',
      'goldB',
      'silver',
      'untiered',
    ]);
  });
});

describe('summarize', () => {
  it('totals committed and achieved value and computes achievement percent', () => {
    const lines = [
      toLine(row({ projectionPrice: 10, committedQty: 5, achievedQty: 5 })),
      toLine(row({ projectionPrice: 10, committedQty: 5, achievedQty: 0 })),
    ];
    expect(summarize(lines)).toEqual({
      totLines: 2,
      totCommitted: 100,
      totAchieved: 50,
      totPct: 50,
    });
  });

  it('reports null achievement percent when nothing is committed', () => {
    expect(summarize([])).toEqual({
      totLines: 0,
      totCommitted: 0,
      totAchieved: 0,
      totPct: null,
    });
  });
});
