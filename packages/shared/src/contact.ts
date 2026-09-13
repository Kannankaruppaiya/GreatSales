import { z } from "zod";

/**
 * A named human at an account, shared by every record that has one.
 *
 * An account is worked through more than one person — the purchase manager
 * signs the order, the plant head decides the trial — and the product could
 * only ever name one of them: a lead flattened a single contact into five of
 * its own columns, and `CustomerContact` held many rows behind a service that
 * read `where isPrimary take 1`. One shape now, on one table, keyed the way
 * `Remark` and `Attachment` already attach to any record.
 */

/** Which record a contact belongs to. Mirrors the DB's EntityType. */
export const ContactEntitySchema = z.enum(["Lead", "Customer"]);
export type ContactEntity = z.infer<typeof ContactEntitySchema>;

export const ContactInputSchema = z.object({
  name: z.string().min(1).max(160),
  /** "Purchase Manager", "Plant Head" — what this person is to the deal. */
  designation: z.string().max(120).nullable().optional(),
  /** The mobile number. The only one either surface ever asked for. */
  phone: z.string().max(40).nullable().optional(),
  whatsapp: z.string().max(40).nullable().optional(),
  /** Mirror `phone` into `whatsapp`, as the lead form has always offered. */
  sameAsMobile: z.boolean().optional(),
  email: z.string().max(200).nullable().optional(),
  /** Exactly one contact on a record carries this — see ContactsSchema. */
  isPrimary: z.boolean().optional(),
});
export type ContactInput = z.infer<typeof ContactInputSchema>;

/**
 * A record's contacts, in the order they are shown.
 *
 * Exactly one primary, validated here rather than left to the caller: the
 * primary is the one a list row, the dashboard and the printed paperwork name,
 * so "none" and "two" are both a question nothing downstream can answer. The
 * cap is a guard against a runaway client, not a product rule — three is what a
 * plant usually has.
 */
export const ContactsSchema = z
  .array(ContactInputSchema)
  .min(1)
  .max(10)
  .superRefine((rows, ctx) => {
    const primaries = rows.filter((r) => r.isPrimary).length;
    if (primaries !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exactly one contact must be marked primary",
      });
    }
  });

export interface ContactRow {
  id: string;
  name: string;
  designation: string | null;
  phone: string | null;
  whatsapp: string | null;
  sameAsMobile: boolean;
  email: string | null;
  isPrimary: boolean;
}
