/**
 * Entity remarks — the free-text activity notes that hang off a record.
 *
 * Web has embedded a remarks timeline in five detail surfaces since the
 * endpoints shipped. Mobile called neither `GET /remarks` nor `POST /remarks`,
 * so a rep in the field could read a customer's history on a laptop and not on
 * the phone they actually carry, and could not add to it at all.
 *
 * Keyed by (entityType, entityId) so two records never share a cache entry and
 * a post invalidates only the timeline it belongs to.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  EntityTypeValue,
  RemarkCreate,
  RemarkRow,
  CursorPage,
} from '@greatsales/shared';
import { apiFetch, buildQuery } from '../api';

export type { RemarkRow, EntityTypeValue };

export type RemarkTarget = {
  entityType: EntityTypeValue;
  entityId: string;
};

const remarkKey = (t: RemarkTarget) => ['remarks', t.entityType, t.entityId] as const;

/**
 * One record's notes, newest first.
 *
 * `enabled` is the caller's to set, because every consumer is a bottom sheet:
 * fetching a timeline for a record nobody has opened would be one request per
 * row of the list behind it.
 */
export function useRemarks(target: RemarkTarget | null, opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: target ? remarkKey(target) : (['remarks', 'none'] as const),
    enabled: (opts.enabled ?? true) && target != null,
    queryFn: () =>
      apiFetch<CursorPage<RemarkRow>>(
        `/remarks${buildQuery({
          entityType: target!.entityType,
          entityId: target!.entityId,
          limit: 50,
        })}`,
      ),
  });
}

export function useCreateRemark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RemarkCreate) =>
      apiFetch<RemarkRow>('/remarks', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (_row, body) => {
      void qc.invalidateQueries({
        queryKey: remarkKey({ entityType: body.entityType, entityId: body.entityId }),
      });
    },
  });
}
