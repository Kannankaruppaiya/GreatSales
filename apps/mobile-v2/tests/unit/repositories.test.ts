import { describe, it, expect } from 'vitest';
import * as registry from '../../src/repositories';

/**
 * This file used to be "Synthetic Repositories Reactivity" — it exercised the
 * in-memory fixtures in src/repositories/synthetic by creating a customer and
 * reading it back. Those fixtures are gone, and with them the reason anyone
 * believed the app had a working data layer: thirty-seven screens rendered
 * against them without one API call, and these tests passed the whole time.
 *
 * So the subject under test is now the replacement contract. Until a real
 * ./api implementation is wired in, every repository must fail loudly on its
 * first call. A screen that has not been wired should crash on render, not
 * quietly show fake numbers, and that is what these tests pin down.
 */
const REPOSITORIES = [
  'authRepo',
  'dashboardRepo',
  'customerRepo',
  'leadRepo',
  'projectionRepo',
  'orderRepo',
  'paymentRepo',
  'followUpRepo',
  'mappingRepo',
  'notificationRepo',
  'activityRepo',
  'productRepo',
] as const;

describe('Repository registry', () => {
  it('exports every repository the app depends on', () => {
    for (const name of REPOSITORIES) {
      expect(registry, `${name} is missing from the registry`).toHaveProperty(name);
    }
  });

  // The guard throws synchronously rather than returning a rejected promise,
  // even though the interfaces declare Promise returns. That is deliberate: it
  // is the louder failure, and react-query catches a synchronous throw from a
  // queryFn just as it catches a rejection. Assertions here are synchronous to
  // match - `.rejects` would never see a promise.
  it.each(REPOSITORIES)('%s throws until a real implementation is wired', (name) => {
    const repo = (registry as unknown as Record<string, Record<string, () => Promise<unknown>>>)[name];

    // The Proxy answers any property with a throwing function, so the method
    // name here only has to be plausible - it stands in for every call a screen
    // could make.
    expect(() => repo.list()).toThrow(/has no implementation/);
  });

  it('names the repository and the fix in the error it throws', () => {
    expect(() => registry.customerRepo.list()).toThrow(
      'CustomerRepository has no implementation. Add src/repositories/api/ and wire it in src/repositories/index.ts.',
    );
  });
});
