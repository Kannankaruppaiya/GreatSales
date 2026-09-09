import { useMemo, useState } from "react";
import { periodLabel } from "@/data/months";
import { Button, Dialog, Input } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { flattenUsers, useUsers } from "@/features/users/queries";
import {
  useClearTarget,
  useSetTarget,
  useTargets,
} from "@/features/dashboard/targetQueries";

/**
 * Set each salesperson's target for one month.
 *
 * Everyone in scope is listed, whether or not they already have a target, so
 * the dialog answers "who has no target this month" — which is the question a
 * manager actually opens it with. An empty box means no target and clears any
 * existing row; `0` is a real target of nothing, for someone on leave, and the
 * dashboard shows the two differently.
 *
 * Rows are saved one at a time as they are edited rather than in one bulk
 * submit: a half-failed bulk write of fifteen targets leaves nobody able to say
 * which of them landed.
 */
export function SetTargetsModal({
  open,
  onClose,
  period,
}: {
  open: boolean;
  onClose: () => void;
  period: string;
}) {
  const targets = useTargets(period, open);
  // Only active people can carry a target; a deactivated user's month is not a
  // gap somebody needs to fill in.
  const people = useUsers({ status: "active", sort: "name" });
  const setTarget = useSetTarget();
  const clearTarget = useClearTarget();

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const rows = useMemo(() => {
    const byPerson = new Map(
      (targets.data ?? []).map((t) => [t.salespersonId, t]),
    );
    return flattenUsers(people.data).map((u) => ({
      id: u.id,
      name: u.name,
      roleName: u.roleName,
      existing: byPerson.get(u.id) ?? null,
    }));
  }, [people.data, targets.data]);

  const valueFor = (id: string, existing: number | null) =>
    drafts[id] ?? (existing == null ? "" : String(existing));

  const commit = async (
    personId: string,
    existingId: string | undefined,
    raw: string,
  ) => {
    setError("");
    const trimmed = raw.trim();
    setSavingId(personId);
    try {
      if (trimmed === "") {
        // Nothing typed and nothing stored: there is no change to make.
        if (existingId) await clearTarget.mutateAsync(existingId);
      } else {
        const value = Number(trimmed);
        if (!Number.isFinite(value) || value < 0) {
          setError(`"${trimmed}" is not an amount.`);
          return;
        }
        await setTarget.mutateAsync({
          salespersonId: personId,
          period,
          targetValue: value,
        });
      }
      setDrafts((d) => {
        const next = { ...d };
        delete next[personId];
        return next;
      });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "That target could not be saved.",
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Targets — ${periodLabel(period)}`}
      description="Each person's target for the month. Leave blank for no target; 0 is a target of nothing."
      maxWidth="max-w-lg"
      footer={
        <Button variant="outline" size="sm" onClick={onClose} type="button">
          Done
        </Button>
      }
    >
      <div className="space-y-2">
        {error && (
          <div className="rounded-lg border border-red/30 bg-red-soft px-3 py-2 text-xs font-semibold text-red">
            {error}
          </div>
        )}

        {targets.isLoading || people.isLoading ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-9 rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted">
            No active users to set a target for.
          </div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-ink">
                  {r.name}
                </div>
                <div className="text-3xs text-muted">{r.roleName}</div>
              </div>
              <Input
                type="number"
                min={0}
                step={1000}
                inputMode="numeric"
                aria-label={`Target for ${r.name}`}
                className="w-36 text-right tabular-nums"
                placeholder="No target"
                disabled={savingId === r.id}
                value={valueFor(r.id, r.existing?.targetValue ?? null)}
                onChange={(e) =>
                  setDrafts((d) => ({ ...d, [r.id]: e.target.value }))
                }
                onBlur={(e) => void commit(r.id, r.existing?.id, e.target.value)}
              />
            </div>
          ))
        )}
      </div>
    </Dialog>
  );
}
