import type { DashboardResponse } from '@greatsales/shared';
import { apiFetch, buildQuery } from '../../lib/api';
import type { DashboardRepository } from '../interfaces';

/** One aggregate request; see the note on DashboardRepository. */
export const apiDashboardRepository: DashboardRepository = {
  overview({ from, to, ownerId }) {
    return apiFetch<DashboardResponse>(
      `/dashboard${buildQuery({ from, to, ownerId })}`,
    );
  },
};
