import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { ApiError } from './api';
import { C } from './theme';
import { useCreateRemark, useRemarks, type EntityTypeValue } from './queries/remarks';

/**
 * One record's activity-note timeline, as a block a detail sheet can embed.
 *
 * The mobile counterpart of web's `RemarksPanel`, and it owns its own query and
 * mutation for the same reason: the only thing a caller passes is which record
 * it is looking at. `enabled` lets a sheet hold this in its tree without
 * fetching until it is actually open.
 */
export function RemarksPanel({
  entityType,
  entityId,
  enabled = true,
}: {
  entityType: EntityTypeValue;
  entityId: string;
  enabled?: boolean;
}) {
  const target = { entityType, entityId };
  const q = useRemarks(target, { enabled });
  const create = useCreateRemark();
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  // Defensive on shape rather than paranoid: this panel is embedded INSIDE
  // detail sheets, so an unexpected row shape throws during the parent's
  // render and blanks the whole sheet — the note timeline taking out the order
  // it is attached to. A missing field costs a dash instead.
  const remarks = Array.isArray(q.data?.items) ? q.data.items : [];

  const send = async () => {
    const body = text.trim();
    if (!body || create.isPending) return;
    setError('');
    try {
      await create.mutateAsync({ ...target, text: body });
      // Cleared only once the server has accepted it, so a failed post leaves
      // the user's typing where they can retry rather than losing it.
      setText('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the note. Try again.');
    }
  };

  return (
    <View className="gap-2.5">
      <Text className="text-[11px] font-extrabold text-ink2 uppercase tracking-wide">
        Activity notes
      </Text>

      {q.isLoading ? (
        <View className="py-4 items-center">
          <ActivityIndicator size="small" color={C.brand} />
        </View>
      ) : remarks.length === 0 ? (
        <Text className="text-[11px] text-faint font-semibold">
          No notes yet. The first one goes below.
        </Text>
      ) : (
        <View className="gap-2">
          {remarks.map((r) => (
            <View key={r.id} className="bg-surface2 border border-line/70 rounded-xl px-3 py-2.5">
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-[11px] font-black text-ink" numberOfLines={1}>
                  {r.userName ?? 'Unknown'}
                </Text>
                <Text className="text-[10px] font-bold text-faint">{formatWhen(r.at)}</Text>
              </View>
              <Text className="text-[12px] text-body font-medium mt-1">{r.text}</Text>
            </View>
          ))}
        </View>
      )}

      <View className="gap-2">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Add a note..."
          placeholderTextColor={C.faint}
          multiline
          accessibilityLabel="New activity note"
          className="border border-line rounded-xl px-3.5 py-3 h-20 text-[13px] text-ink font-medium bg-surface"
          style={{ textAlignVertical: 'top' }}
        />
        {error ? <Text className="text-[11px] font-bold text-danger">{error}</Text> : null}
        <Pressable
          onPress={() => void send()}
          disabled={!text.trim() || create.isPending}
          accessibilityRole="button"
          accessibilityLabel="Add note"
          className={`self-start px-4 min-h-[44px] justify-center rounded-xl bg-brand-soft border border-brand-border/60 ${
            !text.trim() || create.isPending ? 'opacity-40' : ''
          }`}
        >
          <Text className="text-[12px] font-black text-brand-dark">
            {create.isPending ? 'Adding...' : 'Add note'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Relative for the recent past, absolute once it stops being useful.
 *
 * A field rep reads "2h ago" faster than a timestamp, but "just now" on a note
 * from March is worse than useless — so the crossover is a week, after which
 * the date is shown.
 */
function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '—';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  if (mins < 10080) return `${Math.round(mins / 1440)}d ago`;
  return new Date(then).toLocaleDateString();
}
