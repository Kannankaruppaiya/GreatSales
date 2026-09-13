import { describe, it, expect } from 'vitest';
import {
  calculateDashboardMetrics,
  calculateOrderTotals,
  calculateAgingDays,
  getFollowUpCategory,
  calculatePriorityItems,
  getTodayIso,
} from '../../src/domain/calculations';
import type { ProjectionLine, Lead, FollowUp, Payment } from '../../src/domain/types';

describe('Domain Calculations', () => {
  it('calculates order totals correctly with 18% GST', () => {
    const items = [
      { quantity: 2, rate: 1000 },
      { quantity: 1, rate: 3000 },
    ];
    const { subtotal, tax, total } = calculateOrderTotals(items);
    expect(subtotal).toBe(5000);
    expect(tax).toBe(900);
    expect(total).toBe(5900);
  });

  it('calculates aging days correctly', () => {
    const today = getTodayIso();
    expect(calculateAgingDays(today)).toBe(0);

    const pastDate = '2026-01-01';
    expect(calculateAgingDays(pastDate)).toBeGreaterThan(0);
  });

  it('calculates dashboard metrics across recurring and new sales', () => {
    const mockProjections: ProjectionLine[] = [
      {
        id: 'p1',
        month: '2026-06',
        customerId: 'c1',
        customerName: 'Customer A',
        productId: 'prod1',
        productName: 'Oil A',
        principalId: 'pr1',
        principalName: 'Castrol',
        sku: '1L',
        projectedQuantity: 100,
        achievedQuantity: 80,
        salespersonId: 'usr1',
        salespersonName: 'Rep 1',
        rate: 500,
        achievementPercentage: 80,
        status: 'InProgress',
      },
    ];

    const mockLeads: Lead[] = [
      {
        id: 'l1',
        title: 'Deal 1',
        customerId: 'c1',
        customerName: 'Customer A',
        salespersonId: 'usr1',
        salespersonName: 'Rep 1',
        value: 200000,
        probability: 90,
        stage: 'OrderClosedWon',
        expectedClose: '2026-06-30',
        stageUpdatedAt: '2026-06-15',
        createdAt: '2026-06-01',
        updatedAt: '2026-06-15',
      },
    ];

    const mockFollowUps: FollowUp[] = [];
    const mockPayments: Payment[] = [];

    const metrics = calculateDashboardMetrics(
      mockProjections,
      mockLeads,
      mockFollowUps,
      mockPayments
    );

    expect(metrics.recurringCommitted).toBe(50000);
    expect(metrics.recurringAchieved).toBe(40000);
    expect(metrics.newSalesCommitted).toBe(200000);
    expect(metrics.newSalesAchieved).toBe(200000);
    expect(metrics.totalCommitted).toBe(250000);
    expect(metrics.totalAchieved).toBe(240000);
    expect(metrics.achievementPercentage).toBe(96);
  });

  it('ranks priority items with red zone payments first, followed by overdue follow-ups', () => {
    const mockPayments: Payment[] = [
      {
        id: 'pay_red',
        customerId: 'cust_05',
        customerName: 'Southern Auto Works & Castings',
        salespersonId: 'usr_megala',
        salespersonName: 'Megala',
        invoiceCode: 'INV-2026-0501',
        amount: 1120000,
        pending: 1120000,
        dueDate: '2026-07-12',
        agingDays: 63,
        paymentZone: 'Red',
        status: 'Overdue',
        mail1: true,
        mail2: true,
        mail3: true,
        mail4: false,
        createdAt: '2026-07-12',
        updatedAt: '2026-09-10',
      },
      {
        id: 'pay_paid',
        customerId: 'cust_01',
        customerName: 'ABC Industrial',
        salespersonId: 'usr_megala',
        salespersonName: 'Megala',
        amount: 500000,
        pending: 0,
        dueDate: '2026-08-01',
        agingDays: 40,
        status: 'Paid',
        mail1: false,
        mail2: false,
        mail3: false,
        mail4: false,
        createdAt: '2026-08-01',
        updatedAt: '2026-09-01',
      },
    ];

    const mockFollowUps: FollowUp[] = [
      {
        id: 'fu_urgent',
        entityType: 'Lead',
        entityId: 'lead_01',
        customerId: 'cust_01',
        customerName: 'ABC Industrial Components',
        salespersonId: 'usr_megala',
        title: 'Oral Confirmation PO Close',
        dueDate: '2026-09-10', // overdue relative to now
        done: false,
        priority: 'High',
        createdAt: '2026-09-01',
        updatedAt: '2026-09-05',
      },
      {
        id: 'fu_done',
        entityType: 'Order',
        entityId: 'so_02',
        customerId: 'cust_03',
        salespersonId: 'usr_megala',
        title: 'Completed Delivery',
        dueDate: '2026-09-01',
        done: true,
        priority: 'Low',
        createdAt: '2026-09-01',
        updatedAt: '2026-09-02',
      },
    ];

    const ranked = calculatePriorityItems(mockPayments, mockFollowUps);

    // Done and Paid items should be excluded
    expect(ranked.some((r) => r.id === 'pay_paid')).toBe(false);
    expect(ranked.some((r) => r.id === 'fu_done')).toBe(false);

    // Active items should be present
    expect(ranked.length).toBe(2);

    // Red zone payment must rank #1
    expect(ranked[0].id).toBe('pay_red');
    expect(ranked[0].type).toBe('payment');
    if (ranked[0].type === 'payment') {
      expect(ranked[0].isRedZone).toBe(true);
    }

    // Overdue high-priority follow-up must rank #2
    expect(ranked[1].id).toBe('fu_urgent');
    expect(ranked[1].type).toBe('followup');
  });
});
