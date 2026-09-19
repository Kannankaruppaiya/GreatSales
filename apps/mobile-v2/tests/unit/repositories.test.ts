import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * What each repository asks the API for.
 *
 * This file used to be "Synthetic Repositories Reactivity": it created a
 * customer through the registry and read it back out of an in-memory fixture,
 * and it passed for the entire life of the thirty-seven screens it covered
 * while not one of them had ever reached the API.
 *
 * The subject now is the wire contract - path, method and body - because that
 * is the part that breaks silently. A wrong path is a 404 at runtime that no
 * typecheck catches, and `GET /followups/:id` existing at all is three days
 * old (it was added for the design's detail screens).
 *
 * src/lib/api is mocked rather than imported: it pulls in react-native and
 * expo-secure-store, which vite cannot parse, and the fetch wrapper's own
 * behaviour - single-flight refresh, keychain storage - is not what is under
 * test here.
 */
const apiFetch = vi.fn();

vi.mock('../../src/lib/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
  setAccessToken: vi.fn(),
  persistRefreshToken: vi.fn(),
  loadRefreshToken: vi.fn(async () => 'refresh_token_abc'),
  clearTokens: vi.fn(),
  // The real one, so query-string assertions below mean something.
  buildQuery: (params: Record<string, unknown>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v != null && v !== '') q.set(k, String(v));
    }
    const s = q.toString();
    return s ? `?${s}` : '';
  },
}));

const repos = await import('../../src/repositories');

/** The path and the parsed body of the single call the subject made. */
function lastCall() {
  const [path, init] = apiFetch.mock.calls.at(-1) as [
    string,
    RequestInit | undefined,
  ];
  return {
    path,
    method: init?.method ?? 'GET',
    body: init?.body ? JSON.parse(init.body as string) : undefined,
  };
}

beforeEach(() => {
  apiFetch.mockReset();
  apiFetch.mockResolvedValue({ items: [], nextCursor: null, total: 0 });
});

describe('registry', () => {
  it('exposes every repository the app depends on', () => {
    for (const name of [
      'authRepo', 'dashboardRepo', 'customerRepo', 'leadRepo',
      'projectionRepo', 'orderRepo', 'paymentRepo', 'followUpRepo',
      'mappingRepo', 'notificationRepo', 'activityRepo', 'productRepo',
    ]) {
      expect(repos, `${name} is missing`).toHaveProperty(name);
    }
  });
});

describe('auth', () => {
  it('declares itself as the mobile client and takes the refresh token in the body', async () => {
    apiFetch.mockResolvedValue({
      accessToken: 'at', refreshToken: 'rt', user: { id: 'u1' },
    });
    await repos.authRepo.login('tenant_promech', 'meg@x.com', 'pw');

    const { path, method, body } = lastCall();
    expect([path, method]).toEqual(['/auth/login', 'POST']);
    // The server admits only `sales` from mobile and decides on the role
    // behind the credential; sending this honestly is what makes the refusal
    // land on the right accounts. 'body' because a native app holds no cookie.
    expect(body).toMatchObject({
      tenantId: 'tenant_promech',
      client: 'mobile',
      tokenDelivery: 'body',
    });
  });

  it('sends the refresh token on logout, which is what actually revokes it', async () => {
    apiFetch.mockResolvedValue(undefined);
    await repos.authRepo.logout();

    const { path, body } = lastCall();
    expect(path).toBe('/auth/logout');
    // Without it the server reaches `if (!token) return { revoked: 0 }`: the
    // phone clears, and the refresh token stays valid for its seven days.
    expect(body.refreshToken).toBe('refresh_token_abc');
  });
});

describe('reads', () => {
  it('fetches the dashboard as one windowed aggregate', async () => {
    apiFetch.mockResolvedValue({ kpis: {} });
    await repos.dashboardRepo.overview({ from: '2026-09-01', to: '2026-09-30' });

    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(lastCall().path).toBe('/dashboard?from=2026-09-01&to=2026-09-30');
  });

  it('passes the cursor through so a list can page', async () => {
    await repos.customerRepo.list({ cursor: 'cus_20', limit: 20, search: 'auto' });
    expect(lastCall().path).toBe('/customers?cursor=cus_20&limit=20&search=auto');
  });

  it('omits unset filters rather than sending them as undefined', async () => {
    await repos.leadRepo.list({ stage: undefined, search: '' });
    expect(lastCall().path).toBe('/leads');
  });

  it.each([
    ['customerRepo', '/customers/c1'],
    ['leadRepo', '/leads/c1'],
    ['orderRepo', '/orders/c1'],
    ['paymentRepo', '/payments/c1'],
    ['followUpRepo', '/followups/c1'],
    ['mappingRepo', '/mappings/c1'],
  ])('%s reads one record from %s', async (repo, path) => {
    apiFetch.mockResolvedValue({ id: 'c1' });
    await (
      repos as unknown as Record<
        string,
        { getById(id: string): Promise<unknown> }
      >
    )[repo].getById('c1');
    expect(lastCall()).toMatchObject({ path, method: 'GET' });
  });

  it('asks the server for duplicates instead of filtering a page it holds', async () => {
    await repos.customerRepo.checkDuplicates('Acme', '9876543210');
    // The phone, because it is the stronger signal; a check that only searched
    // this salesperson's first page would clear a name that already exists.
    expect(lastCall().path).toBe('/customers?search=9876543210&limit=5');
  });
});

describe('writes', () => {
  it('cancels an order with a reason rather than deleting it', async () => {
    apiFetch.mockResolvedValue({ id: 'o1' });
    await repos.orderRepo.cancelOrder('o1', 'Customer withdrew');

    expect(lastCall()).toMatchObject({
      path: '/orders/o1',
      method: 'PATCH',
      body: { status: 'Cancelled', cancelReason: 'Customer withdrew' },
    });
  });

  it('writes the cumulative received total, not the instalment', async () => {
    apiFetch.mockResolvedValue({ id: 'p1' });
    await repos.paymentRepo.recordPayment('p1', 750_000);
    // PATCH assigns `received`; there is no increment, so the caller computes
    // the total from the row it is showing and that is what lands.
    expect(lastCall().body).toEqual({ received: 750_000 });
  });

  it('marks exactly the reminder stage it was given', async () => {
    apiFetch.mockResolvedValue({ id: 'p1' });
    await repos.paymentRepo.sendReminder('p1', 'mail2');
    expect(lastCall().body).toEqual({ mail2: true });
  });

  it('snoozes forward from today, not from the date already on the row', async () => {
    apiFetch.mockResolvedValue({ id: 'f1' });
    await repos.followUpRepo.snooze('f1', 3);

    const expected = new Date();
    expected.setDate(expected.getDate() + 3);
    // Snoozing a row nine days overdue by three has to mean "ask me in three
    // days", not "make it six days overdue instead of nine".
    expect(lastCall().body).toEqual({
      dueDate: expected.toISOString().slice(0, 10),
    });
  });

  it('logs a remark as an entity remark, with the wire field name', async () => {
    apiFetch.mockResolvedValue({ id: 'r1' });
    await repos.leadRepo.addRemark('l1', 'Spoke to purchase head');
    // RemarkRow's field is `text`, and a remark hangs off (entityType, entityId).
    expect(lastCall()).toMatchObject({
      path: '/remarks',
      method: 'POST',
      body: { entityType: 'Lead', entityId: 'l1', text: 'Spoke to purchase head' },
    });
  });

  it('moves the stage before logging the note', async () => {
    apiFetch.mockResolvedValue({ id: 'l1' });
    await repos.leadRepo.changeStage('l1', 'ClosedWon', 'PO received');

    const [first, second] = apiFetch.mock.calls.map((c) => c[0]);
    // A failed remark should leave the stage moved; the reverse - a stage
    // change that silently did not happen - is the worse failure.
    expect(first).toBe('/leads/l1');
    expect(second).toBe('/remarks');
  });
});
