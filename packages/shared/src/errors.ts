/**
 * Machine-readable error codes.
 *
 * The web layer branches on these, never on the human message, so wording can
 * change without breaking a client. One code per distinct business rule — not
 * one per HTTP status, because "409" alone tells a user nothing about what to
 * do next, while LAST_ADMIN_PROTECTED does.
 */
export const ERROR_CODES = [
  // --- Users --------------------------------------------------------------
  /** You cannot deactivate, delete, or demote your own account. */
  "SELF_MUTATION_FORBIDDEN",
  /** The write would leave the tenant with nobody able to manage users. */
  "LAST_ADMIN_PROTECTED",
  /** Manager is missing, inactive, cross-tenant, self, or would close a cycle. */
  "INVALID_MANAGER",
  /** The password failed the shared policy. */
  "WEAK_PASSWORD",
  /** A referenced role, manager, or team does not exist in this workspace. */
  "INVALID_REFERENCE",
  /** Email or username is already taken by a live user. */
  "DUPLICATE_IDENTITY",
  "USER_NOT_FOUND",
  /** The deleted user's email or username has since been re-taken. */
  "RESTORE_CONFLICT",

  // --- Roles --------------------------------------------------------------
  /** A built-in role may not be renamed or deleted. */
  "SYSTEM_ROLE_PROTECTED",
  /** The role still has users assigned. */
  "ROLE_IN_USE",
  /** Removing this permission would leave no role able to administer the tenant. */
  "LAST_ADMIN_ROLE_PROTECTED",
  "ROLE_NOT_FOUND",

  // --- Teams --------------------------------------------------------------
  "TEAM_NOT_FOUND",

  // --- Mappings (customer x product) --------------------------------------
  /** The (customer, product) pair is already mapped. Soft-deleted rows still
   *  occupy the pair, so the duplicate may not be visible to the caller. */
  "MAPPING_EXISTS",
  "MAPPING_NOT_FOUND",
  /** Projection lines still resolve their customer/product/price through this
   *  mapping, so removing it would leave rows that cannot render. */
  "MAPPING_IN_USE",
  /** A sales user may not hand a mapping to, or take one from, another owner. */
  "REASSIGN_FORBIDDEN",
  "CUSTOMER_NOT_FOUND",
  "PRODUCT_NOT_FOUND",

  // --- Auth ---------------------------------------------------------------
  /** The supplied current password did not verify. */
  "WRONG_CURRENT_PASSWORD",
  /** An admin set this password; the user must replace it before continuing. */
  "PASSWORD_CHANGE_REQUIRED",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
