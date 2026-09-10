import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiFetchBlob, buildQuery } from "@/lib/api";

/**
 * Wire types for the attachments API. Mirrors the `@greatsales/shared`
 * contracts; kept as a local copy so the Vite build does not need to consume
 * the CJS `shared` dist — the arrangement every feature here uses.
 */
export type AttachmentEntityType =
  | "Customer"
  | "Lead"
  | "Order"
  | "Payment"
  | "Projection";

export interface AttachmentRow {
  id: string;
  entityType: string;
  entityId: string;
  fileName: string;
  size: number;
  uploadedById: string;
  uploadedByName: string;
  createdAt: string;
}



/** Mirrors MAX_ATTACHMENT_BYTES. Enforced on the server as well. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const attachmentKeys = {
  all: ["attachments"] as const,
  list: (entityType: string, entityId: string) =>
    ["attachments", entityType, entityId] as const,
};

export function useAttachments(
  target: { entityType: AttachmentEntityType; entityId: string },
  opts: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: attachmentKeys.list(target.entityType, target.entityId),
    enabled: opts.enabled ?? true,
    queryFn: () =>
      apiFetch<AttachmentRow[]>(`/attachments${buildQuery(target)}`),
  });
}

/**
 * Upload one file.
 *
 * Through `apiFetch` like everything else, which now leaves the content-type
 * off a FormData body so the browser can write its own boundary. Rolling a
 * bare `fetch` here would have lost the bearer token and the single-flight
 * refresh, so an upload started just after a token expired would fail instead
 * of renewing.
 */
export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      entityType: AttachmentEntityType;
      entityId: string;
      file: File;
    }) => {
      const form = new FormData();
      form.append("entityType", input.entityType);
      form.append("entityId", input.entityId);
      form.append("file", input.file);
      return apiFetch<AttachmentRow>("/attachments", {
        method: "POST",
        body: form,
      });
    },
    onSuccess: (_row, input) => {
      void qc.invalidateQueries({
        queryKey: attachmentKeys.list(input.entityType, input.entityId),
      });
    },
  });
}

/**
 * Save a file to the user's machine.
 *
 * Fetched rather than linked. A plain `<a href>` sends no Authorization header,
 * so the download route — which re-checks the caller against the parent record
 * on every request — would answer 401 in a new tab with nothing to show for it.
 */
export async function downloadAttachment(row: AttachmentRow): Promise<void> {
  // The path is written out here rather than built by a helper so that
  // `pnpm wiring` — which reads the literal a request is made with — can see
  // that something calls this route. A route nothing appears to call is a
  // route somebody eventually deletes.
  const blob = await apiFetchBlob(`/attachments/${row.id}/download`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = row.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Freed on the next tick: revoking synchronously can beat the click in some
  // browsers and save a zero-byte file.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      entityType: AttachmentEntityType;
      entityId: string;
    }) => apiFetch<void>(`/attachments/${input.id}`, { method: "DELETE" }),
    onSuccess: (_v, input) => {
      void qc.invalidateQueries({
        queryKey: attachmentKeys.list(input.entityType, input.entityId),
      });
    },
  });
}
