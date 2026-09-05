import { useState } from 'react';
import { Alert } from 'react-native';
import { ModalBtn } from './modal';
import { ApiError } from './api';

/**
 * A destructive action with its confirmation, as one control.
 *
 * `useDeleteCustomer`, `useDeleteLead`, `useDeleteOrder`, `useDeletePayment`
 * and `useDeleteFollowUp` all existed in this app with no caller anywhere — the
 * endpoints were wired, the hooks were written, and no screen ever offered the
 * action. This is what the four detail sheets share so each one costs a line
 * rather than the same twenty.
 *
 * The confirmation uses the OS alert on purpose: a destructive step inside a
 * bottom sheet that is itself already a modal reads as part of the sheet, and a
 * native alert is unmistakably a stop.
 *
 * `body` must say what is lost. There is no default, so no caller can ship
 * "Are you sure?".
 */
export function DeleteButton({
  label,
  title,
  body,
  onDelete,
  onDeleted,
}: {
  label: string;
  title: string;
  body: string;
  onDelete: () => Promise<unknown>;
  onDeleted?: () => void;
}) {
  const [pending, setPending] = useState(false);

  const run = async () => {
    setPending(true);
    try {
      await onDelete();
      onDeleted?.();
    } catch (err) {
      Alert.alert(
        'Could not delete',
        err instanceof ApiError ? err.message : 'Please try again.',
      );
    } finally {
      setPending(false);
    }
  };

  const confirm = () => {
    Alert.alert(title, body, [
      { text: 'Cancel', style: 'cancel' },
      { text: label, style: 'destructive', onPress: () => void run() },
    ]);
  };

  return (
    <ModalBtn
      label={pending ? 'Deleting…' : label}
      variant="danger"
      disabled={pending}
      onPress={confirm}
    />
  );
}
