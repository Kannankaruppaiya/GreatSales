import { describe, it, expect } from 'vitest';
import {
  customerRepo,
  leadRepo,
  orderRepo,
  paymentRepo,
  followUpRepo,
} from '../../src/repositories';

describe('Synthetic Repositories Reactivity', () => {
  it('creates and lists customers', async () => {
    const created = await customerRepo.create({
      name: 'Test Motors Pvt Ltd',
      city: 'Coimbatore',
      address: '123 Industrial Estate, Coimbatore',
      industry: 'Auto',
      tier: 'Tier-1',
      paymentTermsDays: 30,
      creditLimit: 500000,
      outstanding: 0,
      paymentZone: 'Green',
      salespersonId: 'usr-1',
      salespersonName: 'Megala',
      contacts: [{ id: 'con-test', name: 'Rajan', phone: '+91 9988776655', isPrimary: true }],
    });

    expect(created.id).toBeDefined();
    expect(created.name).toBe('Test Motors Pvt Ltd');

    const found = await customerRepo.getById(created.id);
    expect(found?.name).toBe('Test Motors Pvt Ltd');
  });

  it('updates lead stage and reflects in list', async () => {
    const leads = await leadRepo.list();
    const target = leads[0];
    expect(target).toBeDefined();

    const updated = await leadRepo.changeStage(target.id, 'NegotiationOralConfirmation', 'Oral deal agreed');
    expect(updated.stage).toBe('NegotiationOralConfirmation');

    const fresh = await leadRepo.getById(target.id);
    expect(fresh?.stage).toBe('NegotiationOralConfirmation');
  });

  it('records payment and decrements customer outstanding balance', async () => {
    const payments = await paymentRepo.list();
    const openPayment = payments.find((p) => p.amount > 1000);
    expect(openPayment).toBeDefined();

    if (openPayment) {
      const customerBefore = await customerRepo.getById(openPayment.customerId);
      const outBefore = customerBefore?.outstanding || 0;

      await paymentRepo.recordPayment(openPayment.id, 1000);

      const customerAfter = await customerRepo.getById(openPayment.customerId);
      expect(customerAfter?.outstanding).toBe(outBefore - 1000);
    }
  });

  it('completes follow-up and updates status', async () => {
    const list = await followUpRepo.list();
    const openFollowUp = list.find((f) => f.status !== 'Completed');
    expect(openFollowUp).toBeDefined();

    if (openFollowUp) {
      const done = await followUpRepo.complete(openFollowUp.id, 'Completed site meeting');
      expect(done.status).toBe('Completed');
    }
  });

  it('guarantees relational integrity across synthetic entities and customers', async () => {
    const customers = await customerRepo.list();
    const customerIds = new Set(customers.map((c) => c.id));

    // Verify all leads reference existing customers
    const leads = await leadRepo.list();
    expect(leads.length).toBeGreaterThan(0);
    for (const lead of leads) {
      if (lead.customerId) {
        expect(customerIds.has(lead.customerId)).toBe(true);
      }
    }

    // Verify all orders reference existing customers
    const orders = await orderRepo.list();
    expect(orders.length).toBeGreaterThan(0);
    for (const order of orders) {
      expect(customerIds.has(order.customerId)).toBe(true);
    }

    // Verify all payments reference existing customers
    const payments = await paymentRepo.list();
    expect(payments.length).toBeGreaterThan(0);
    for (const payment of payments) {
      expect(customerIds.has(payment.customerId)).toBe(true);
    }

    // Verify all follow-ups with customerId reference existing customers
    const followUps = await followUpRepo.list();
    expect(followUps.length).toBeGreaterThan(0);
    for (const fu of followUps) {
      if (fu.customerId) {
        expect(customerIds.has(fu.customerId)).toBe(true);
      }
    }
  });
});
