import { useRef, useState } from "react";
import { Download, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { ApiError } from "@/lib/api";
import {
  downloadAttachment,
  useAttachments,
  useDeleteAttachment,
  useUploadAttachment,
  MAX_ATTACHMENT_BYTES,
  type AttachmentEntityType,
  type AttachmentRow,
} from "@/features/attachments/queries";

/** 1.4 MB, 812 KB — never "1468006 bytes". */
function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * One record's files, as a block a detail view can embed.
 *
 * A panel rather than a modal, for the same reason the remarks timeline is one:
 * the paperwork is looked at WHILE looking at the record, and a dialog opened
 * from a dialog is a thing nobody opens twice.
 *
 * `enabled` exists so a modal can hold this in its tree without fetching until
 * it is actually open.
 */
export function AttachmentsPanel({
  entityType,
  entityId,
  enabled = true,
  canWrite = true,
}: {
  entityType: AttachmentEntityType;
  entityId: string;
  enabled?: boolean;
  canWrite?: boolean;
}) {
  const target = { entityType, entityId };
  const q = useAttachments(target, { enabled });
  const upload = useUploadAttachment();
  const remove = useDeleteAttachment();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  // Defensive on shape, like RemarksPanel and for the same reason: this is
  // embedded inside a detail modal, so an unexpected row shape here throws
  // during the parent's render and blanks the whole modal.
  const rows: AttachmentRow[] = Array.isArray(q.data) ? q.data : [];

  const handleFile = async (file: File) => {
    setError("");
    if (file.size > MAX_ATTACHMENT_BYTES) {
      // Caught here as well as on the server, so a 12 MB file does not spend a
      // minute uploading before being refused.
      setError(
        `${file.name} is ${fileSize(file.size)}. The limit is ${
          MAX_ATTACHMENT_BYTES / 1024 / 1024
        } MB.`,
      );
      return;
    }
    try {
      await upload.mutateAsync({ ...target, file });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "That file could not be uploaded.",
      );
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const handleDownload = async (row: AttachmentRow) => {
    setError("");
    try {
      await downloadAttachment(row);
    } catch {
      setError(`${row.fileName} could not be downloaded.`);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold text-ink">
          <Paperclip className="h-3.5 w-3.5 text-muted" />
          Files
          {rows.length > 0 && (
            <span className="font-normal text-muted">({rows.length})</span>
          )}
        </span>
        {canWrite && (
          <>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={upload.isPending}
              onClick={() => fileInput.current?.click()}
            >
              {upload.isPending ? "Uploading…" : "Attach a file"}
            </Button>
          </>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red/30 bg-red-soft px-2.5 py-1.5 text-2xs font-semibold text-red"
        >
          {error}
        </div>
      )}

      {q.isLoading ? (
        <div className="space-y-1.5" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-9 rounded-lg bg-surface-2" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-3 text-center text-2xs text-muted">
          No files yet. Purchase orders, signed quotations, delivery photos.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-2xs font-semibold text-ink">
                  {row.fileName}
                </div>
                <div className="text-3xs text-muted">
                  {fileSize(row.size)} · {row.uploadedByName}
                </div>
              </div>
              <button
                type="button"
                title="Download"
                onClick={() => void handleDownload(row)}
                className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              {canWrite && (
                <button
                  type="button"
                  title="Remove"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate({ id: row.id, ...target })}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-red-soft hover:text-red cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
