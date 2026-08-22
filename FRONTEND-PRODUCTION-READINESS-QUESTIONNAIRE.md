# The Master Frontend Production Readiness Questionnaire
## Universal · End-to-End · Unconstrained · Reusable for Any Project

> **Version:** 3.0 — Generated from Impeccable + UI-UX Pro Max skill audits + real GreatSales codebase analysis
> **Scope:** React / Next.js / Vite / Expo / React Native (universally applicable to any modern frontend)
> **Philosophy:** Ship nothing you would not bet your job on. Question every assumption. Cover every edge.

---

## Table of Contents

| # | Domain | Items |
|---|--------|-------|
| 1 | [Security and Token Management](#1-security-and-token-management) | 42 |
| 2 | [Performance and Core Web Vitals](#2-performance-and-core-web-vitals) | 38 |
| 3 | [Resilience, Error Handling and Fault Tolerance](#3-resilience-error-handling-and-fault-tolerance) | 31 |
| 4 | [UI/UX, Design System and Craft Floor](#4-uiux-design-system-and-craft-floor) | 47 |
| 5 | [Accessibility (a11y) WCAG 2.2 AA](#5-accessibility-a11y-wcag-22-aa) | 40 |
| 6 | [Forms, Validation and Data Entry](#6-forms-validation-and-data-entry) | 29 |
| 7 | [Navigation, Routing and State](#7-navigation-routing-and-state) | 24 |
| 8 | [Mobile and Cross-Platform Specifics](#8-mobile-and-cross-platform-specifics) | 30 |
| 9 | [Internationalisation, Localisation and Timezones](#9-internationalisation-localisation-and-timezones) | 22 |
| 10 | [Architecture and Code Quality](#10-architecture-and-code-quality) | 28 |
| 11 | [Testing Strategy and Coverage](#11-testing-strategy-and-coverage) | 25 |
| 12 | [Build, Bundle and Deployment Pipeline](#12-build-bundle-and-deployment-pipeline) | 26 |
| 13 | [Charts, Data Visualisation and Tables](#13-charts-data-visualisation-and-tables) | 24 |
| 14 | [SEO, Meta and Discoverability](#14-seo-meta-and-discoverability) | 18 |
| 15 | [Telemetry, Monitoring and Observability](#15-telemetry-monitoring-and-observability) | 22 |
| 16 | [Print, Export and Offline](#16-print-export-and-offline) | 16 |
| 17 | [Real-Time, WebSocket and Push](#17-real-time-websocket-and-push) | 17 |
| 18 | [Third-Party Integrations and SDK Hygiene](#18-third-party-integrations-and-sdk-hygiene) | 16 |
| 19 | [Environment Parity and Feature Flags](#19-environment-parity-and-feature-flags) | 15 |
| 20 | [Privacy, Compliance and Data Governance](#20-privacy-compliance-and-data-governance) | 18 |
| 21 | [Multi-Tenancy, Role-Based UI and Permission Gates](#21-multi-tenancy-role-based-ui-and-permission-gates) | 20 |
| 22 | [DevX, Tooling and Developer Safety](#22-devx-tooling-and-developer-safety) | 16 |
| -- | [Final Go-Live Gate Tests](#-final-go-live-gate-tests) | 20 |

---

## 1. Security and Token Management

### 1.1 Token Storage and Lifecycle
- [ ] **Secure Mobile Storage:** Access Token and Refresh Token stored exclusively in expo-secure-store (iOS Keychain / Android Keystore), never in AsyncStorage or plain files.
- [ ] **Web Token Storage Decision:** Documented rationale for httpOnly cookie vs memory+refresh-cookie vs localStorage. If localStorage is used, justify with CSP and DOMPurify coverage.
- [ ] **Silent Refresh (401 Interceptor):** When an API returns 401, the client transparently refreshes the token pair via refresh token before surfacing the error to the user.
- [ ] **Refresh Loop Guard:** If the refresh token itself returns 401/403, the client breaks the loop immediately — clears all auth state and redirects to /login. No infinite retry.
- [ ] **Token Expiry on Logout:** Logout clears in-memory state, Zustand/Redux store, localStorage, sessionStorage, HTTP-only cookies (via server-side /logout endpoint), and any service worker caches.
- [ ] **Token Rotation Verified:** Each token refresh issues a new refresh token; old refresh tokens are invalidated server-side (prevent token replay attacks).
- [ ] **Concurrent Refresh Deduplication:** Multiple simultaneous 401s trigger exactly ONE refresh call; all other inflight requests queue and reuse the single new token.
- [ ] **Access Token Never Logged:** console.log, Sentry breadcrumbs, and analytics events never contain raw access/refresh token strings.

### 1.2 Secrets, Config and Env Protection
- [ ] **No Hardcoded Credentials in Bundle:** No demo passwords, API keys, or secrets are inlined in source. Verified via grep search across src/.
- [ ] **DEV-only Credentials Gated:** Demo/prefill credentials in login forms are wrapped in import.meta.env.DEV or __DEV__ and tree-shaken out of production builds.
- [ ] **.env Prefix Discipline:** Web: only VITE_* / NEXT_PUBLIC_* variables are exposed to the browser bundle. Private DB URLs, JWT secrets, and service account keys use unprefixed names.
- [ ] **.env.production vs .env.local Separation:** .env.local overrides never accidentally get committed; .gitignore lists all local env files.
- [ ] **Source Map Leakage Blocked:** vite.config.ts / next.config.js sets build.sourcemap: false (or hidden for Sentry-only). Raw TypeScript source is unreachable to browser DevTools in production.
- [ ] **Dependency Secret Scan:** CI runs truffleHog or gitleaks on every PR to detect accidentally committed secrets.

### 1.3 Injection, XSS and CSP
- [ ] **Zero dangerouslySetInnerHTML:** Codebase audit shows 0 occurrences, or every occurrence is sanitized with DOMPurify.sanitize() before rendering.
- [ ] **No eval() or new Function():** Neither direct calls nor dynamic import(variable) are present.
- [ ] **External Links Hardened:** All anchor elements with target="_blank" carry rel="noopener noreferrer".
- [ ] **Content Security Policy (CSP) Header:** Server sends a CSP header that disallows inline scripts (script-src self), limits connect-src to known APIs, and blocks object-src none.
- [ ] **Clickjacking Protection:** X-Frame-Options: DENY or CSP frame-ancestors none prevents the app from being embedded in an attacker iframe.
- [ ] **Subresource Integrity (SRI):** CDN-loaded scripts (Google Fonts, Intercom, etc.) use integrity and crossorigin attributes.
- [ ] **CSRF Protection:** Mutation endpoints are protected via SameSite=Strict cookies or CSRF tokens; the frontend sends the correct token header.
- [ ] **URL Parameter Sanitisation:** Route parameters from deep links, push notifications, and query strings are validated/parsed through a Zod schema before use.

### 1.4 Client-Side Data Exposure
- [ ] **Redux/Zustand DevTools Disabled in Prod:** State management DevTools extensions are disabled/excluded in production builds (they expose full app state to browser extensions).
- [ ] **No PII in URL Query Strings:** Sensitive fields (phone, email, GSTIN) are not embedded in URL params that appear in browser history or server logs.
- [ ] **Clipboard Security:** Copy-to-clipboard of sensitive fields (tokens, keys) clears the clipboard after a configurable timeout (e.g., 60 seconds).
- [ ] **Session Timeout Enforced:** Idle sessions are detected client-side (mouse/keyboard inactivity) and logged out after a defined idle timeout with a 1-minute warning.
- [ ] **Referrer Policy:** Referrer-Policy: no-referrer-when-downgrade or stricter prevents leaking app URLs to third-party analytics on external link click.

### 1.5 Dependency and Supply Chain Security
- [ ] **npm audit / pnpm audit Clean:** No high/critical CVEs in the dependency tree. CI fails builds with unresolved critical vulnerabilities.
- [ ] **Lockfile Committed:** pnpm-lock.yaml / package-lock.json / yarn.lock is committed and CI uses --frozen-lockfile to prevent resolution drift.
- [ ] **No Abandoned Packages:** Key libraries have had a commit within the last 12 months and have more than 1 maintainer.
- [ ] **Dependency Count Audited:** Total JS dependencies reviewed; unused packages removed (depcheck or knip).

---

## 2. Performance and Core Web Vitals

### 2.1 Core Web Vitals Targets
- [ ] **LCP < 2.5 s:** Largest Contentful Paint measured in the real production environment via Lighthouse or CrUX data.
- [ ] **INP < 200 ms:** Interaction to Next Paint (replaced FID) measured under CPU throttle (4x slowdown).
- [ ] **CLS < 0.1:** Cumulative Layout Shift — no elements jump on load or during dynamic data injection.
- [ ] **TTFB < 800 ms:** Time to First Byte from the API/CDN to the browser.
- [ ] **FCP < 1.8 s:** First Contentful Paint — first meaningful pixel visible within 1.8 seconds.
- [ ] **TBT < 200 ms:** Total Blocking Time on mobile networks measured in CI with Lighthouse budget.

### 2.2 Code Splitting and Bundle Size
- [ ] **Route-Level Lazy Loading:** Every page component is wrapped in React.lazy() + Suspense. Verified via bundle analysis showing per-route chunks.
- [ ] **Feature-Level Dynamic Imports:** Heavy features (PDF viewer, rich text editor, Excel export) are dynamically imported only on demand.
- [ ] **Vendor Chunking Strategy:** Large third-party libraries (React, TanStack Query, date-fns, xlsx) are in separate long-cached vendor chunks via manualChunks.
- [ ] **Initial Bundle Budget Enforced:** First-load JS < 150 KB gzipped. CI uses bundlesize or Lighthouse budget to fail builds that exceed it.
- [ ] **Tree-Shaking Verified:** import * as Icons is replaced with named imports. Bundle analysis shows no unused exports from icon/utility libraries.
- [ ] **Barrel File Audit:** index.ts barrel files do not inadvertently import heavy modules that block tree-shaking.

### 2.3 Asset and Font Optimisation
- [ ] **Image Format:** All images use WebP/AVIF with picture fallback. PNG/JPEG only used where absolutely required.
- [ ] **Responsive Images:** srcset + sizes attributes serve appropriately sized images per device pixel ratio.
- [ ] **Image Dimensions Declared:** All img elements have width + height attributes or aspect-ratio CSS to prevent CLS.
- [ ] **Lazy Loading Below Fold:** All below-the-fold images use loading="lazy". Hero/above-fold images use fetchpriority="high".
- [ ] **Font Strategy — No FOIT:** Google Fonts or self-hosted fonts use font-display: swap (or optional for non-critical fonts).
- [ ] **Critical Fonts Preloaded:** link rel="preload" as="font" for the first 1-2 font weights used above the fold.
- [ ] **Self-Hosted vs CDN Fonts Decision:** Documented rationale. Self-hosted: faster, no third-party DNS. CDN: cache hit benefit.
- [ ] **SVG Icons Not Raster:** Icon library uses SVG/vector icons. No PNG icon sprites that pixelate on HiDPI screens.

### 2.4 Rendering Performance
- [ ] **List Virtualisation:** Tables and lists with more than 100 rows use @tanstack/react-virtual, react-window, or react-virtualized. DOM node count verified < 1000.
- [ ] **useMemo / useCallback Selective:** Expensive computations (sort/filter on large arrays) are memoized. Over-memoization is also avoided (lint rule).
- [ ] **React.memo on List Items:** List item components that receive stable props are wrapped in React.memo to prevent unnecessary re-renders.
- [ ] **Debounce on Search:** Search inputs have 300-500 ms debounce before triggering API calls or heavy client-side filters.
- [ ] **Throttle on Scroll/Resize Events:** Scroll handlers and ResizeObserver callbacks are throttled/debounced to fewer than 1 call per 16 ms.
- [ ] **No N+1 Client Queries:** Dashboard and aggregation pages do NOT call individual item APIs in a loop. Backend provides aggregated endpoints.
- [ ] **Avoid Layout Thrashing:** No code reads element.offsetHeight inside a forEach loop followed by DOM writes in the same tick.
- [ ] **Web Workers for Heavy Computation:** CSV/Excel parsing, encryption, and large JSON transforms run in a Web Worker to avoid main-thread blocking.
- [ ] **React 18 Concurrent Features:** useTransition / useDeferredValue used for non-urgent state updates (search filtering, tab switching).

### 2.5 Network and Caching
- [ ] **HTTP/2 or HTTP/3 Enabled:** Server supports multiplexed requests. Verified via curl -I --http2 or Lighthouse report.
- [ ] **API Response Caching (TanStack Query):** staleTime and gcTime are configured intentionally per query — not left at defaults. Short for real-time data, longer for reference data.
- [ ] **Optimistic Cache Updates:** Mutation hooks update the React Query cache immediately and roll back on error (no full refetch for simple updates).
- [ ] **Prefetching on Hover:** Navigation links prefetch the target page data/chunk on hover or link.onmouseenter.
- [ ] **Cache-Control Headers Correct:** Static assets (/assets/*) served with max-age=31536000 immutable. HTML served with no-cache to ensure fresh entry point.
- [ ] **Service Worker Caching Strategy:** If PWA, caching strategy documented (Network-first for API, Cache-first for static). Stale SW does not silently serve outdated assets.

---

## 3. Resilience, Error Handling and Fault Tolerance

### 3.1 Error Boundaries
- [ ] **Global Error Boundary at App Root:** The entire app tree is wrapped in an ErrorBoundary that renders a friendly fallback UI with a Reload button instead of a white screen.
- [ ] **Route-Level Error Boundaries:** Each route/page has its own error boundary so a dashboard widget crash does not crash the entire layout.
- [ ] **Widget-Level Isolation:** Individual cards, charts, and sidebar widgets have granular error boundaries to isolate failures.
- [ ] **Error Boundary Reporting:** componentDidCatch (or onError in React Router errorElement) sends errors to Sentry with component stack and user context.
- [ ] **Reset Mechanism:** Error boundary provides a Try Again button that resets the error state.
- [ ] **Async Error Handling:** Unhandled promise rejections are caught globally via window.addEventListener unhandledrejection and reported.

### 3.2 API and Network Resilience
- [ ] **Request Timeout Configured:** Every API call has a max timeout (10-30 seconds). After timeout, a clear "Server is slow. Retry?" message appears — not a hanging spinner.
- [ ] **Retry with Backoff:** Failed GET requests are retried up to 3x with exponential backoff (500 ms, 1 s, 2 s). Mutations do NOT auto-retry.
- [ ] **Offline Detection and Messaging:** navigator.onLine plus online/offline events display a toast when connectivity is lost. React Query refetchOnReconnect is enabled.
- [ ] **Race Condition Prevention:** Stale API responses from superseded queries are ignored. If multiple sequential fetches are triggered (e.g., tab switching), only the last response is applied.
- [ ] **Abort Controller on Unmount:** useEffect cleanup calls controller.abort() for in-flight fetch or axios requests to prevent state updates on unmounted components.
- [ ] **Server Error Classification:** HTTP 4xx errors surface user-friendly action messages ("Record not found — go back"). HTTP 5xx shows "Something went wrong on our end — try again." Never raw stack traces.
- [ ] **Empty vs. Error State Differentiation:** A 200 OK with data: [] renders an empty state illustration. A network/5xx error renders a retry card. These are two different UI states.
- [ ] **Partial Data Handling:** If a paginated list partially loads (e.g., page 2 fails), the user is informed and can retry that page — the app does not show corrupted partial data.

### 3.3 Optimistic UI and Conflict Resolution
- [ ] **Optimistic UI Rollback:** Optimistic mutations revert to the previous state on API error with a toast message (not a silent failure).
- [ ] **Conflict Detection:** If two users edit the same record simultaneously, the last-write-wins or conflict UI is surfaced (version/etag check).
- [ ] **Idempotency Keys:** Critical mutation endpoints (order creation, payment submission) send Idempotency-Key headers to prevent duplicates on retry.
- [ ] **Double-Submit Prevention:** Submit buttons disable immediately on first click and re-enable only after API response (success or error). Prevents accidental duplicate orders/payments.

### 3.4 Graceful Degradation
- [ ] **Feature Unavailability Messaging:** When an optional feature (analytics chart, map widget) fails to load, a non-blocking "Feature unavailable" message replaces it — not a broken UI.
- [ ] **Degraded Mode for Slow Networks:** On 2G/3G, heavy assets (charts, video previews) are skipped or shown as placeholders. Network Information API can signal this.
- [ ] **JavaScript Disabled Fallback:** Critical pages (landing, auth) render useful content with noscript message or server-rendered HTML. Not a blank screen.

---

## 4. UI/UX, Design System and Craft Floor

### 4.1 Design Tokens and Consistency
- [ ] **Semantic Colour Tokens:** All colours are referenced via design tokens (--color-primary, --surface-card, --text-muted) — never raw hex values in components.
- [ ] **No Ad-Hoc Per-Screen Styling:** No style={{ color: "#f00" }} or one-off Tailwind arbitrary values scattered across components.
- [ ] **8 dp / 4 pt Spacing System:** All padding, margins, and gaps use multiples of 4 px. No arbitrary spacing values.
- [ ] **Elevation / Shadow Scale:** Cards, modals, dropdowns, and toasts use a consistent shadow scale. No random box-shadow values.
- [ ] **Border Radius Consistency:** All corner radii come from a token scale. No mixing different radius values for similar components.
- [ ] **Icon Family Discipline:** One icon library (e.g., Lucide) used throughout. No mixing Heroicons, FontAwesome, and emojis for structural icons.
- [ ] **Typography Scale:** A defined type scale (display, headline, body, label, caption) applied consistently. Body text >= 16px on mobile.

### 4.2 Visual States — Every Component Has All Four
- [ ] **Default State:** Rendered correctly with typical data.
- [ ] **Loading/Skeleton State:** Shimmer skeleton that matches the shape of the loaded content. No spinners for operations longer than 1 second.
- [ ] **Empty State:** Meaningful illustration + headline + primary CTA (e.g., "No customers yet — Add your first customer").
- [ ] **Error State:** Clear error message + retry action. Never a blank container or broken layout.
- [ ] **Disabled State:** Reduced opacity (0.38-0.5) + cursor-not-allowed + disabled attribute. Visually distinct from enabled state.

### 4.3 Interactive and Hover States
- [ ] **Every Clickable Element has cursor-pointer:** All button, anchor, card clicks, row clicks, and div onClick elements show pointer cursor.
- [ ] **Hover State Defined:** All interactive elements have a visible hover state (background, border, or colour change) — not just pointer change.
- [ ] **Pressed/Active Feedback:** Cards and buttons provide a subtle scale or background feedback on mousedown/active state (not just hover).
- [ ] **Focus-Visible Ring:** :focus-visible rings appear on keyboard navigation but not on mouse clicks. Ring is 2-4 px and uses brand colour.
- [ ] **Transition on State Change:** State transitions (hover to default, loading to loaded) use CSS transitions (200-300 ms ease-out). No jarring instant state snaps.
- [ ] **No Layout Shift on Hover:** Hover effects (border, shadow, scale) do not move adjacent elements. Use outline instead of border if border would shift layout.

### 4.4 Typography and Readability
- [ ] **Line Height 1.5-1.75 on Body Text:** Long paragraphs, descriptions, and form helper text have adequate line height.
- [ ] **Line Length <= 75 Characters:** Content columns are max-w-prose or similar to prevent overly wide reading lines.
- [ ] **Tabular Numbers on Data:** Financial amounts, quantities, percentages, and timestamps in tables use font-variant-numeric: tabular-nums to prevent column jitter.
- [ ] **Correct Currency Formatting:** Amounts formatted using Intl.NumberFormat with correct locale (en-IN for Indian Rupee, not Western 1,000,000 format).
- [ ] **Truncation Strategy:** Long text in cells uses ellipsis with a tooltip on hover showing the full value. Not silently cut off with no affordance.
- [ ] **URL/ID Overflow:** Long tokens, URLs, and UUIDs in UI use overflow-wrap: anywhere to prevent horizontal overflow.

### 4.5 Animation and Motion
- [ ] **No animate-bounce or animate-ping for UI indicators:** These are attention-grabbing patterns inappropriate for professional dashboards. Use subtle pulse or fade.
- [ ] **prefers-reduced-motion Respected:** All animations and transitions are disabled/minimised for users with @media (prefers-reduced-motion: reduce).
- [ ] **Easing Follows Direction:** Entering elements decelerate (ease-out); leaving elements accelerate (ease-in). Linear only for progress bars.
- [ ] **Duration by Complexity:** Simple state changes: 150-200 ms. Page transitions: 200-350 ms. Full-screen overlays: 300-400 ms. No single global duration for everything.
- [ ] **Only transform + opacity Animated:** No animating width, height, top, left, or padding (causes layout reflow and jank).
- [ ] **Animations Non-Blocking:** User can interact with the page while entry animations play. No pointer-events: none applied during animation.
- [ ] **Staggered List Entrance:** List/grid items stagger at 30-50 ms offset, not all-at-once, for a polished entrance feel.
- [ ] **Interruptible Animations:** Rapid tab switches or state changes cancel in-progress animations cleanly without flickering.

### 4.6 Dark Mode
- [ ] **Both Themes Designed Together:** Dark mode is not an afterthought inversion. All surfaces, text, borders, and shadows are independently verified in dark theme.
- [ ] **No Hardcoded Light-only Colours:** No text-gray-900 or bg-white without a dark: equivalent.
- [ ] **Contrast in Dark Mode >= 4.5:1:** Every text + background pair meets WCAG AA in dark theme (light-mode passing does not imply dark-mode passing).
- [ ] **System Theme Sync:** App responds to prefers-color-scheme changes without requiring a page reload.
- [ ] **Scrim/Modal Contrast in Dark Mode:** Overlay scrims are opaque enough that modal content remains readable on any background.

### 4.7 Micro-interactions and Delight
- [ ] **Toast Notifications:** Auto-dismiss in 3-5 seconds. Includes type icon (success, error, warning). Can be manually dismissed. Uses aria-live region.
- [ ] **Confirmation Dialogs for Destructive Actions:** Delete, archive, bulk-remove require an explicit confirmation dialog — not immediate execution.
- [ ] **Undo for Reversible Destructive Actions:** Where possible, a Delete is followed by a 5-second Undo toast before committing.
- [ ] **Primary CTA Discipline:** Each screen has exactly ONE primary (filled) button. All other actions are secondary (outline) or tertiary (ghost/text).

---

## 5. Accessibility (a11y) — WCAG 2.2 AA

### 5.1 Colour and Contrast
- [ ] **Normal Text >= 4.5:1:** All body text, labels, and placeholder text pass WCAG AA contrast ratio.
- [ ] **Large Text >= 3:1:** Headings >= 18 px bold (or 24 px normal) pass the large-text threshold.
- [ ] **Non-Text UI Elements >= 3:1:** Icon controls, input borders, chart data marks, and button outlines meet 3:1 against adjacent colours.
- [ ] **Colour Not the Sole Indicator:** Status badges (Success/Warning/Error) combine colour with icon AND text label. Charts use patterns/shapes in addition to colour.
- [ ] **Both Themes Pass:** Contrast is verified independently in light AND dark mode — not assumed from one theme.

### 5.2 Keyboard Navigation
- [ ] **Full Keyboard Operability:** Every interactive element (button, link, input, custom dropdown, date picker, modal) is reachable and operable with Tab, Shift+Tab, Enter, Space, and arrow keys.
- [ ] **Tab Order Matches Visual Order:** DOM order matches the visual reading order. No tabindex > 0 that creates confusing jump sequences.
- [ ] **Skip-to-Main Link:** A "Skip to main content" link is the first focusable element on every page, visible on focus.
- [ ] **Focus Not Obscured:** Focused elements are never hidden behind sticky headers, banners, floating bars, or overlapping tooltips (WCAG 2.2 AA).
- [ ] **Focus Indicator Visible (WCAG 2.2):** Focus ring covers >= the component perimeter, has 2+ px thickness, and maintains 3:1 contrast against adjacent colour.
- [ ] **Modal Focus Trap:** When a modal/dialog opens, focus moves inside it and is trapped (Tab cycles within the modal). Escape closes the modal and returns focus to the trigger element.
- [ ] **No Keyboard Traps:** Focus can always escape any widget via Tab or Escape without requiring a mouse.

### 5.3 Screen Reader and Semantic HTML
- [ ] **Landmark Roles:** Pages use header, nav, main, aside, footer (or role equivalents) for landmark navigation.
- [ ] **Heading Hierarchy:** H1 to H2 to H3 hierarchy has no skipped levels. One h1 per page.
- [ ] **Icon-Only Buttons Labelled:** All buttons without visible text carry aria-label or aria-labelledby. Screen reader hears a meaningful action name.
- [ ] **Decorative Icons Hidden:** Icons beside visible button text use aria-hidden="true" to prevent redundant announcements.
- [ ] **Image Alt Text:** Meaningful images have descriptive alt text. Purely decorative images use alt="".
- [ ] **Form Labels:** Every input, select, textarea has an associated label (via for/htmlFor or aria-labelledby) — not just a placeholder.
- [ ] **Live Regions for Dynamic Content:** Toasts, status changes, and form validation errors use aria-live="polite" or role="alert" to announce changes without moving focus.
- [ ] **Table Accessibility:** Data tables use th with scope="col/row", caption, and aria-sort on sortable columns.
- [ ] **Dialog ARIA:** Modals include role="dialog", aria-modal="true", aria-labelledby (pointing to modal title), and aria-describedby (pointing to modal body).

### 5.4 Motion and Sensory
- [ ] **Reduced Motion Respected:** All animations and auto-playing content reduce/stop when prefers-reduced-motion: reduce is active.
- [ ] **No Auto-Playing Content:** Videos, carousels, and animated charts do not auto-play with sound. Pause/stop controls are available.
- [ ] **No Flashing Content:** No element flashes more than 3 times per second (seizure risk, WCAG 2.3.1).
- [ ] **Dynamic Text Size:** UI remains readable and non-overlapping when system font size is set to Largest (iOS) or 200% browser zoom.

### 5.5 Forms and Interaction Accessibility
- [ ] **Error Announcement on Submit:** After a failed form submission, errors are announced via role="alert" or aria-live. Focus moves to the error summary or first invalid field.
- [ ] **Inline Error Linked with aria-describedby:** Each field error message element ID is referenced in the input aria-describedby attribute.
- [ ] **Drag Actions Have Keyboard Alternative:** All drag-and-drop interactions (file upload, kanban cards, reordering) have a keyboard-operable alternative (e.g., buttons to move up/down).
- [ ] **Redundant Entry Prevention:** Multi-step forms do not re-ask for information already entered in a previous step without a clear reason (WCAG 2.2 AA).
- [ ] **Accessible Authentication:** Login does not block paste in password fields. Password managers work. A non-cognitive auth path exists if CAPTCHA is used (WCAG 2.2 AA).
- [ ] **Timeout Warning:** If sessions expire, users are warned with at least 20 seconds to extend — not abruptly logged out (WCAG 2.2).

---

## 6. Forms, Validation and Data Entry

### 6.1 Schema and Validation
- [ ] **Type-Safe Schema Validation:** All forms use Zod, Yup, or Valibot resolver with React Hook Form / Formik. Field types, max lengths, regex patterns, and required fields are schema-defined.
- [ ] **Server-Side Validation Mirrored:** Client-side schema validation rules match backend validation. Mismatches are documented as known deviations.
- [ ] **Inline Field-Level Errors:** Errors appear immediately below the relevant field (not in a top-level alert banner). Error text in small red text.
- [ ] **Error on Blur, Not on Keystroke:** Validation triggers on field blur (not every character), except for real-time format feedback (e.g., phone number masking).
- [ ] **Error Recovery Path:** Error messages state the cause AND how to fix it ("Phone must be 10 digits" not "Invalid phone"). Recovery is actionable.
- [ ] **Cross-Field Validation:** Fields that depend on each other (password + confirm password, start date + end date) are validated together using .refine() or equivalent.

### 6.2 Form UX and Safety
- [ ] **Double-Submit Prevention:** Submit button is disabled immediately on first click and shows a loading spinner. Re-enabled only after API response.
- [ ] **Idempotent Submission:** Form submits carry a client-generated nonce or idempotency key to prevent duplicate server-side records on network retries.
- [ ] **Unsaved Changes Guard:** Navigating away from a partially filled long form triggers a confirmation dialog ("You have unsaved changes"). Browser beforeunload event is also handled.
- [ ] **Auto-Save for Long Forms:** Multi-page forms or complex modal forms auto-save drafts to localStorage or the server at regular intervals to prevent data loss on crash.
- [ ] **Required Field Marking:** All required fields are marked with an asterisk (*) and a legend "* Required" is present.
- [ ] **Password Show/Hide Toggle:** Password inputs have a visible show/hide toggle. Paste is not blocked in password fields.
- [ ] **Autocomplete Hints:** autocomplete attributes are set correctly (email, given-name, new-password, tel) for browser and password manager autofill.
- [ ] **Mobile Keyboard Types:** inputMode="numeric" for quantities/amounts, inputMode="decimal" for prices, type="email" for email, type="tel" for phone numbers.
- [ ] **Number Inputs Guard Against Negative/Zero:** Business fields (price, quantity, discount) validate min > 0 on both client and server.
- [ ] **Date Format Consistency:** All date pickers emit YYYY-MM-DD strings (not Date objects) to prevent timezone offset corruption during serialization.

### 6.3 File Uploads
- [ ] **File Type Validation:** Accepted file types validated on the client (MIME type + extension) AND server. Uploading .exe or script files is rejected.
- [ ] **File Size Limit:** Maximum file size enforced on the client before upload begins with a friendly error ("Max 5 MB allowed").
- [ ] **Upload Progress Feedback:** Large file uploads show a progress bar. User can cancel the upload.
- [ ] **Upload Error Recovery:** Failed uploads show a retry button. The form is not reset on upload failure.
- [ ] **Virus Scan Awareness:** If the uploaded file is user-facing, the backend scans it (ClamAV, cloud antivirus) before making it accessible.

---

## 7. Navigation, Routing and State

### 7.1 Routing Architecture
- [ ] **All Key Screens Bookmarkable:** Every important screen has a unique URL. Refreshing the page or sharing the URL loads the same content (no ephemeral modal-only states).
- [ ] **Deep Link Support:** Push notifications, emails, and external links navigate directly to the relevant resource (e.g., /orders/ORD-1234).
- [ ] **404 / Not Found Page:** Invalid URLs render a styled 404 page with a "Back to Dashboard" link — not a white screen or broken layout.
- [ ] **Protected Route Guards:** Routes that require authentication redirect unauthenticated users to /login with the original URL preserved as ?redirect= for post-login resumption.
- [ ] **Role-Based Route Guards:** Admin-only routes redirect non-admin users to a "403 Forbidden" page — not silently showing an empty page or partial UI.
- [ ] **Lazy Route Suspension Handling:** Suspense boundaries have skeleton fallbacks that match the page layout. Not a global spinner that blocks the entire app.

### 7.2 Navigation UX
- [ ] **Back Button Behaviour:** Browser Back/Forward works correctly. Navigating back restores scroll position, active tab, and applied filters.
- [ ] **Active Nav Item Highlighted:** The current route nav item is visually differentiated (background, weight, or indicator) at all nesting levels.
- [ ] **Breadcrumbs for Deep Hierarchies:** Pages 3+ levels deep have breadcrumbs to orient users and allow quick upward navigation.
- [ ] **Predictable Navigation:** Clicking the same link always produces the same result. No navigation side effects (unexpected modal opens, page scrolls).
- [ ] **Persisted Sidebar State:** Sidebar open/collapsed state is persisted across page navigations (not reset on every route change).
- [ ] **Search Bar Accessible:** Global search is reachable via keyboard shortcut (Cmd+K / Ctrl+K) and has aria-label="Global search".
- [ ] **Tab Bar <= 5 Items (Mobile):** Bottom navigation tabs do not exceed 5 items. Overflow goes into a More menu.

### 7.3 Client-Side State Management
- [ ] **No Mock/Seed Data in Production Store:** In-memory state stores (Zustand, Redux) are initialized empty — not with hardcoded PoC/seed data that leaks into production.
- [ ] **State Persistence Strategy Documented:** Which state is persisted to localStorage (user prefs), which to sessionStorage (ephemeral session), and which is always fetched from the server.
- [ ] **Zustand/Redux DevTools Disabled in Prod:** devtools() middleware is excluded from production builds.
- [ ] **Stale Closure Prevention:** useEffect, useCallback, and useMemo dependency arrays are complete and lint-enforced by eslint-plugin-react-hooks.
- [ ] **No Context Re-render Storms:** React Context providers split by update frequency. High-frequency state (notifications, presence) does not live in a monolithic context.

---

## 8. Mobile and Cross-Platform Specifics

### 8.1 Safe Areas and Device Insets
- [ ] **Safe Area Insets Applied:** All fixed headers, bottom tab bars, FABs, and CTA bars respect SafeAreaView / safe-area-inset-* CSS env variables. Content does not sit under Dynamic Island, notch, or gesture bar.
- [ ] **Status Bar Colour Adapts:** Status bar foreground (light/dark) adapts to the current screen background in both light and dark themes.
- [ ] **Home Indicator Clearance (iOS):** Scrollable content pads the bottom to avoid the iPhone home indicator covering the last list item.

### 8.2 Keyboard Handling
- [ ] **Keyboard Does Not Obscure Inputs:** KeyboardAvoidingView (React Native) or CSS env(keyboard-inset-height) (Web) ensures active input fields remain visible when the software keyboard opens.
- [ ] **Keyboard Dismissal Patterns:** Tapping outside the input or pressing "Done" dismisses the keyboard on mobile. List scrolling also dismisses keyboard.
- [ ] **Return/Next Key Behaviour:** Multi-field forms use returnKeyType="next" to move focus to the next input, and returnKeyType="done" on the final field.

### 8.3 Touch and Gestures
- [ ] **Touch Targets >= 44x44 pt (iOS) / 48x48 dp (Android):** Every tappable element meets platform minimum size. Hit area extended via padding if visual icon is smaller.
- [ ] **Minimum 8 px Gap Between Touch Targets:** Adjacent interactive elements have sufficient spacing to prevent mis-taps.
- [ ] **No Hover-Only Interactions:** All interactive states are accessible via tap/touch — no functionality hidden behind hover-only affordances.
- [ ] **Swipe Actions with Affordances:** Swipeable list items show a visual hint (arrow, label) on first appearance or after tutorial.
- [ ] **No System Gesture Conflicts:** App gestures do not intercept iOS swipe-back (UIScreenEdgePanGestureRecognizer) or Android Predictive Back.
- [ ] **Haptic Feedback on Key Actions:** Confirmations, errors, and important CTA taps trigger haptic feedback (iOS UIImpactFeedbackGenerator, Android Vibrator).
- [ ] **Drag Threshold Before Drag Starts:** Drag actions require a movement threshold (>= 5 px) to avoid accidental drags on tap.

### 8.4 Orientation and Screen Sizes
- [ ] **Landscape Mode Supported:** Key flows (login, order entry) remain usable in landscape orientation without layout breaking.
- [ ] **Tablet/iPad Layout:** On screens >= 768 dp, the app uses a split-pane or sidebar layout rather than bottom navigation.
- [ ] **Small Screen (375 px / SE) Verified:** UI tested on iPhone SE (375x667 pt) and small Android (360x640 dp). No horizontal overflow, truncation, or overlapping elements.

### 8.5 App Versioning and Updates
- [ ] **Minimum Version Check:** On app startup, a version check API call determines if the installed version is below the minimum supported. If so, a blocking "Update Required" screen appears.
- [ ] **OTA Update Channel Segregation:** Expo / CodePush channels (dev / staging / production) are separate. Production OTA cannot accidentally receive dev updates.
- [ ] **App Store Guidelines Compliance:** No API-accessed functionality that bypasses in-app purchase, no hidden functionality in the review build, correct permission usage strings.

### 8.6 Offline and Sync
- [ ] **Offline State Detected and Communicated:** A persistent banner or toast appears when the device has no connectivity. Reads from cache where possible.
- [ ] **Background Sync Queue:** Critical mutations (order updates, payment records) are queued locally and synced when connectivity resumes.
- [ ] **Conflict Resolution on Sync:** If offline changes conflict with server state on reconnect, the conflict is surfaced to the user — not silently overwritten.

### 8.7 Permissions
- [ ] **Permission Requests Contextualised:** Camera, location, and notification permissions are requested at the moment of need, not on app launch, with a rationale UI.
- [ ] **Permission Denial Handled:** If the user denies a permission, the feature gracefully degrades and shows a guide to re-enable it in Settings.
- [ ] **Unused Permissions Removed:** Info.plist / AndroidManifest.xml only declares permissions actively used by the app. Unused permissions are removed to avoid app store rejection.

---

## 9. Internationalisation, Localisation and Timezones

### 9.1 Timezone Safety
- [ ] **No Client Clock Dependency for Business Logic:** Invoice aging, due date calculations, and SLA timers use UTC timestamps from the server — not new Date() from the browser/device.
- [ ] **Date Serialisation Format:** All dates transmitted as ISO 8601 strings (YYYY-MM-DDTHH:mm:ssZ) — never JavaScript Date objects or Unix timestamps without documented timezone.
- [ ] **Date Picker Timezone Guard:** The value selected in a date picker is serialised as YYYY-MM-DD string without timezone conversion to prevent a +/-1-day off-by-one error.
- [ ] **Displayed Dates in User Timezone:** Timestamps are displayed in the user configured timezone (from user profile/device), not server timezone.
- [ ] **Relative Dates Handled Correctly:** "3 days ago" and "Due in 2 days" are calculated from the current UTC time, formatted per locale.

### 9.2 Number and Currency Formatting
- [ ] **Intl.NumberFormat Used:** All currencies, percentages, and large numbers use Intl.NumberFormat with the correct locale (en-IN for Indian Rupee).
- [ ] **Indian Number System Supported:** If targeting Indian users, amounts format as 1,50,000 (lakh) not 150,000 (Western thousand). Crore system supported.
- [ ] **Locale-Aware Sorting:** Lists sorted by text use Intl.Collator for locale-correct alphabetical order (handles accented characters, regional scripts).

### 9.3 i18n Architecture (if multi-language)
- [ ] **No Hardcoded Strings in Source:** All user-visible text extracted to a translation namespace (en.json, ta.json). No inline English strings in JSX.
- [ ] **RTL Layout Support:** If an RTL language (Arabic, Hebrew) is planned, CSS uses logical properties (margin-inline-start, padding-inline-end) not directional (margin-left).
- [ ] **Dynamic String Length Accommodation:** UI tested with German/Tamil/Japanese strings that are 50-200% longer than English equivalents. Buttons do not overflow.
- [ ] **Pluralisation Rules:** String interpolation uses i18n plural rules ("one: 1 item" vs "other: {{count}} items") — not manual JS conditionals.
- [ ] **Missing Translation Fallback:** If a translation key is missing, it falls back to the default language string — not an empty string or raw key.
- [ ] **Number/Date Formatting per Locale:** Locale-specific format for dates (DD/MM/YYYY in India vs MM/DD/YYYY in US) is driven by user locale, not hardcoded.

### 9.4 Character Encoding and Unicode
- [ ] **UTF-8 Everywhere:** All API responses, database columns, HTML documents, and CSV exports use UTF-8 encoding.
- [ ] **Special Character Handling:** User-entered names with special characters (Tamil, Hindi, Arabic script, accented letters) display correctly everywhere.
- [ ] **Emoji in User Content:** User-submitted emoji in names/notes do not break string length calculations, database storage, or search indexing.

---

## 10. Architecture and Code Quality

### 10.1 Component Architecture
- [ ] **Feature-Based Folder Structure:** Components organised by feature (features/orders/) not type (components/modals/). Shared cross-feature components in components/shared/.
- [ ] **No Circular Dependencies:** No moduleA.ts imports moduleB.ts which imports moduleA.ts. Verified via madge --circular src/.
- [ ] **Separation of Concerns:** UI components contain no business logic (API calls, data transforms). Logic lives in custom hooks or service files.
- [ ] **Custom Hook Extraction:** Repeated state + effect patterns are extracted into custom hooks (useDebounce, usePaginatedQuery, usePermission).
- [ ] **Co-Location:** Component, its styles, its test, and its type file live in the same folder.

### 10.2 TypeScript Discipline
- [ ] **strict: true Enabled:** tsconfig.json enables strictNullChecks, noImplicitAny, and strictFunctionTypes. No blanket any types.
- [ ] **No @ts-ignore or @ts-nocheck:** All TypeScript suppressions are replaced with proper types or @ts-expect-error with an explanatory comment.
- [ ] **API Response Types Auto-Generated:** Backend API types are generated from OpenAPI/GraphQL schema — not manually maintained. openapi-typescript or graphql-codegen runs in CI.
- [ ] **No as any Casting:** Type assertions use specific types (as UserResponse) not as any.
- [ ] **Enum vs Union Type Decision:** Documented why enum or as const union is chosen for status/role constants. No magic string literals scattered in logic.

### 10.3 Code Hygiene
- [ ] **Dead Code Eliminated:** No unreachable routes, unused exports, commented-out blocks, or orphaned component files. ts-prune or knip runs in CI.
- [ ] **Mock/PoC Seed Data Removed:** In-memory stores are NOT initialised with PoC fixture data (POC_SEED_*) in production builds. Verified with a grep scan.
- [ ] **No Console Logs in Production:** console.log, console.debug, console.table are stripped by the bundler (drop_console: true in Vite / esbuild config) in production builds.
- [ ] **No Hardcoded Feature Strings:** Business-rule values (product codes, status strings, role names) are defined as constants — not scattered literal strings.
- [ ] **Zero FIXME / TODO / HACK Comments in Production Paths:** Technical debt comments are tracked in issues, not left in shipping code.
- [ ] **Import Ordering Enforced:** ESLint import order plugin ensures node_modules then @/ aliases then relative paths. Consistent across all files.

### 10.4 API Contract
- [ ] **OpenAPI / GraphQL Schema in Version Control:** The API schema file is committed. Frontend type generation is automated on schema change.
- [ ] **Breaking Change Detection:** Schema changes go through a breaking-change review (e.g., removing a required field, changing a response type) before merging.
- [ ] **API Versioning Strategy:** Major API breaking changes use URL versioning (/v2/) or header-based versioning. The frontend and backend do not update simultaneously without a deprecation window.

---

## 11. Testing Strategy and Coverage

### 11.1 Unit Tests
- [ ] **Custom Hook Tests:** Every custom hook is unit tested with renderHook from @testing-library/react. Edge cases covered (empty data, error state, loading state).
- [ ] **Utility Function Tests:** Pure functions (formatCurrency, calculateAging, parseDateString) have 100% branch coverage.
- [ ] **Store/Reducer Tests:** Zustand slices and Redux reducers are unit tested for every action type including failure paths.
- [ ] **Zod Schema Tests:** Validation schemas are tested with valid inputs, invalid inputs, boundary values, and empty/null values.

### 11.2 Component Tests
- [ ] **Render Tests for Key Components:** All form components, modal dialogs, and data tables have rendering tests.
- [ ] **User Interaction Tests:** Critical user flows (submit a form, click delete, open modal) are tested with userEvent from Testing Library.
- [ ] **Accessibility Tests in CI:** jest-axe or vitest-axe runs on all rendered components to catch ARIA violations automatically.
- [ ] **Visual Regression Tests:** Key screens have Playwright/Storybook visual snapshots that fail on unexpected UI changes.

### 11.3 Integration and E2E Tests
- [ ] **Critical User Journeys Covered:** Login -> Navigate -> Create Record -> Edit -> Delete is automated with Playwright or Cypress.
- [ ] **Happy Path AND Error Path:** E2E tests cover both successful flows and error scenarios (API failure, validation error, permission denied).
- [ ] **Auth Flow Tested:** Login, logout, token expiry + silent refresh, and role-based redirect are E2E tested.
- [ ] **Cross-Browser Testing:** E2E runs on Chrome, Firefox, and Safari (Playwright multi-browser) in CI.
- [ ] **Mobile Viewport E2E:** Playwright runs with iPhone 14 and Pixel 5 viewport configs to catch mobile-only layout breaks.

### 11.4 Test Infrastructure
- [ ] **Tests Run in Pre-Commit Hook:** lint-staged runs affected tests before each commit (not full suite — too slow).
- [ ] **Coverage Thresholds Enforced:** CI fails if branch coverage drops below configured thresholds (e.g., 80% statements, 70% branches).
- [ ] **No Test-Only Code in Production:** data-testid attributes are acceptable in production; __mocks__, fixture files, and test helpers are not bundled.
- [ ] **Flaky Test Policy:** Flaky tests are tracked, quarantined, and fixed within 2 sprints. Not silently skipped.

---

## 12. Build, Bundle and Deployment Pipeline

### 12.1 Build Configuration
- [ ] **Environment-Specific Configs:** vite.config.ts / next.config.js uses separate configs for development, staging, and production. No manual env-variable overriding in CI.
- [ ] **Source Maps in hidden Mode for Sentry:** sourcemap: hidden generates maps uploaded to Sentry only — not served publicly.
- [ ] **Tree-Shaking Verified:** Bundle analyser (rollup-plugin-visualizer, @next/bundle-analyzer) run monthly. Unexpected large chunks are investigated.
- [ ] **TypeScript Compilation Errors Block Build:** CI fails on any TypeScript error. No noEmitOnError: false workaround.
- [ ] **Asset Fingerprinting:** All static assets (JS, CSS, images) have content-hash suffixes for cache busting. main.[hash].js not main.js.

### 12.2 CI/CD Pipeline
- [ ] **Lint Fails the Build:** ESLint and Prettier violations cause the CI pipeline to fail. No --max-warnings 9999 escape hatches.
- [ ] **All Tests Must Pass:** Unit + Integration tests are required to pass before merge. Test failures block deployment.
- [ ] **Dependency Install is Reproducible:** CI uses pnpm install --frozen-lockfile or npm ci — never npm install (which can silently update dependencies).
- [ ] **Build Artefact Signed/Verified:** Docker image or build artefact is tagged with the Git SHA. Deployment uses the exact same artefact that passed CI.
- [ ] **Staged Deployment:** Changes are deployed to staging and verified before being promoted to production. No direct-to-production pushes.
- [ ] **Rollback Plan Documented:** One-command rollback to the previous production build is documented and tested annually.

### 12.3 Release Management
- [ ] **Semantic Versioning:** Releases follow MAJOR.MINOR.PATCH. CHANGELOG.md is updated. Users are informed of breaking changes.
- [ ] **Feature Flags for Risky Features:** New features behind a feature flag to allow phased rollout and kill-switch without a deployment.
- [ ] **Database Migration Sync:** Frontend changes that depend on new API fields are only deployed after the backend migration is complete.
- [ ] **CDN Cache Invalidation:** After deployment, CDN cache for HTML entry point is purged. Old assets remain cached for users on the previous version.

---

## 13. Charts, Data Visualisation and Tables

### 13.1 Chart Correctness
- [ ] **Chart Type Matches Data:** Line charts for trends over time; bar charts for comparison; donut charts for proportions (<= 5 categories).
- [ ] **No Pie Overuse:** Pie/donut charts have <= 5 slices. More segments use a bar chart.
- [ ] **Axis Labels with Units:** Y-axis shows units (INR, %, units). X-axis shows time granularity (Day/Week/Month) with readable tick spacing.
- [ ] **Gridlines Subtle:** Chart gridlines use low-contrast colour (gray-100/200) so they do not compete with data marks.
- [ ] **Direct Labeling for Small Datasets:** Values labelled directly on bars/points when < 10 data points, to reduce eye travel to the legend.
- [ ] **Legend Visible and Clickable:** Legend is always visible near the chart. Clicking a legend item toggles that series visibility.
- [ ] **Tooltip on Hover/Tap:** Exact values are shown in a tooltip on hover (web) or tap (mobile). Tooltip does not clip at chart boundaries.

### 13.2 Chart Accessibility
- [ ] **Accessible Colour Palette:** Chart colours pass the 3:1 non-text contrast. Colour-blind-safe palette used (avoid red/green only pairs).
- [ ] **Pattern/Shape Supplement:** Chart series differentiated by pattern or shape in addition to colour for colourblind users.
- [ ] **Screen Reader Summary:** Each chart has an aria-label or adjacent text describing the key insight ("Revenue up 23% this quarter").
- [ ] **Data Table Alternative:** Every chart has a screen-reader-accessible data table toggle for users who cannot perceive the visual chart.
- [ ] **Reduced Motion on Chart Animations:** Chart entry animations respect prefers-reduced-motion. Data is readable immediately, not after animation completes.
- [ ] **Touch Target on Chart Elements:** Interactive chart points/bars/slices have minimum 44pt tap area on mobile. On web, hover area is expanded beyond the visual mark.

### 13.3 Data Tables
- [ ] **Sticky Column for Wide Tables:** Tables with horizontal scroll pin the identifier column (Customer Name, Order #) to the left with position: sticky and a z-index background.
- [ ] **Sortable Columns with aria-sort:** Sortable columns show a sort icon and set aria-sort="ascending" or "descending" on the th element.
- [ ] **Pagination or Virtualisation:** Tables never load all records at once. Server-side pagination or client-side virtualisation (>50 rows).
- [ ] **Bulk Action Pattern:** Checkboxes + floating action bar for bulk operations. "Select all on this page" vs "Select all records" is clearly differentiated.
- [ ] **Column Resize/Reorder:** If columns are resizable, the new widths persist via localStorage.
- [ ] **Export to CSV/Excel:** Table data can be exported. CSV values are sanitized (no formula injection: =, +, -, @).

---

## 14. SEO, Meta and Discoverability

### 14.1 Meta Tags
- [ ] **Unique title per Page:** Each page has a descriptive, unique title tag. Not just the app name everywhere.
- [ ] **Meta Description per Page:** Unique meta name="description" under 160 characters for each key page.
- [ ] **OpenGraph Tags:** og:title, og:description, og:image, og:url present for pages shared on social media.
- [ ] **Twitter Card Tags:** twitter:card, twitter:title, twitter:description, twitter:image present.
- [ ] **Canonical URL:** link rel="canonical" prevents duplicate content penalties from query parameter variations.

### 14.2 Technical SEO (for public pages)
- [ ] **Single h1 per Page:** One H1 per page, containing the primary page keyword.
- [ ] **Semantic HTML5 Elements:** article, section, nav, header, footer used instead of div soup.
- [ ] **Structured Data (JSON-LD):** Key pages include @type: Product, Organization, or BreadcrumbList schema for rich search results.
- [ ] **robots.txt Configured:** robots.txt exists. Private/admin routes are disallowed. Sitemap URL referenced.
- [ ] **Sitemap Generated:** sitemap.xml lists all public routes with lastmod dates. Auto-generated on build.
- [ ] **No Index on Internal/Auth Pages:** /dashboard, /admin, and /settings carry meta name="robots" content="noindex, nofollow".
- [ ] **404 Returns HTTP 404 Status:** The Not Found page returns a real 404 HTTP status code — not a 200 OK with "Page not found" text.
- [ ] **Core Web Vitals for Public Pages:** Public-facing marketing pages pass Google PageSpeed Insights (LCP < 2.5s, INP < 200ms, CLS < 0.1).

---

## 15. Telemetry, Monitoring and Observability

### 15.1 Error Tracking
- [ ] **Sentry (or equivalent) Integrated:** Frontend Sentry SDK captures all unhandled JS exceptions, unhandled promise rejections, and console.error calls.
- [ ] **Source Maps Uploaded to Sentry:** Production source maps uploaded during CI. Sentry shows original file:line numbers, not minified code.
- [ ] **User Context in Error Reports:** Errors include user ID, role, workspace, and app version — not just anonymous exceptions.
- [ ] **Error Grouping Tuned:** Sentry fingerprinting rules group related errors into single issues. Noisy/irrelevant browser extension errors are filtered.
- [ ] **Alert Thresholds Set:** PagerDuty/Slack alerts trigger when error rate exceeds baseline + 2 sigma within 5 minutes.

### 15.2 Performance Monitoring
- [ ] **Real User Monitoring (RUM):** Web Vitals (LCP, INP, CLS) are measured from real user sessions — not just Lighthouse CI. Data segmented by route and device.
- [ ] **API Latency Tracking:** Frontend records API response times and reports p50/p95/p99 to a monitoring dashboard.
- [ ] **Long Tasks Tracked:** PerformanceObserver reports tasks > 50 ms on the main thread to identify jank sources.

### 15.3 Analytics and Privacy
- [ ] **Analytics SDK Installed:** Product analytics (PostHog, Amplitude, Mixpanel) tracks key user events (feature used, funnel completed, error encountered).
- [ ] **PII Never in Event Names or Properties:** Analytics events do not contain names, emails, phone numbers, or GSTIN in property values.
- [ ] **Session Replay PII Masking:** Session replay tools mask all input fields, password fields, and content tagged data-sensitive.
- [ ] **Cookie Consent Gating:** Analytics and session replay only activate after user accepts cookie consent (GDPR / India DPDP compliance).
- [ ] **Console Log Scrubbing:** All console.log / console.debug calls are stripped by the bundler (drop_console: true) in production builds.

---

## 16. Print, Export and Offline

### 16.1 Print Stylesheets
- [ ] **@media print Stylesheet Present:** Sidebar, topbar, modals, action buttons, and toast containers are all hidden on print.
- [ ] **Print Layout is Clean A4:** Print preview renders clean, paginated A4/Letter layout with appropriate margins.
- [ ] **Page Breaks Controlled:** page-break-inside: avoid applied to table rows and invoice line items to prevent awkward mid-record breaks.
- [ ] **Print Colours Correct:** Backgrounds and dark-mode colours are overridden for print. Text prints in black on white, not light grey on grey.
- [ ] **Print Font Size Adequate:** Body text in print stylesheet is >= 10 pt for readability on paper.

### 16.2 CSV / Excel Export
- [ ] **Formula Injection Prevention:** Cell values starting with =, +, -, @, |, % are prefixed with a tab character or single quote in CSV output.
- [ ] **UTF-8 BOM for Excel Compatibility:** CSV files exported for Excel include a UTF-8 BOM so special characters (Tamil, Hindi, currency symbols) display correctly.
- [ ] **Column Headers Match Display:** Exported column names match the UI column headers — not raw database field names.
- [ ] **Filtered/Sorted Data Exported:** Export respects active filters and sort order — not always exporting all records.
- [ ] **Export Progress for Large Data:** Exports > 10,000 rows show a progress indicator or are queued as a background job with email notification.

### 16.3 Offline Capability (PWA / Mobile)
- [ ] **Service Worker Registered:** A service worker manages caching strategy for static assets and key API responses.
- [ ] **Offline Fallback Page:** A graceful offline page is served when the user has no connectivity and navigates to an uncached route.
- [ ] **Background Sync:** Critical user actions queued offline are synced via Background Sync API when connectivity returns.

---

## 17. Real-Time, WebSocket and Push

### 17.1 WebSocket / SSE
- [ ] **Connection Lifecycle Managed:** WebSocket/SSE connection is opened when the app mounts and cleaned up when it unmounts. No leaked connections on component unmount.
- [ ] **Reconnect with Exponential Backoff:** If the WebSocket drops, reconnection attempts use exponential backoff (1s -> 2s -> 4s -> max 30s) with jitter.
- [ ] **Heartbeat / Ping-Pong:** A keep-alive ping is sent regularly to detect silent connection drops (NAT/proxy timeouts).
- [ ] **Message Queue During Disconnection:** UI queues outgoing messages when disconnected and flushes them on reconnect.
- [ ] **Presence and Concurrency Indicators:** If multiple users edit the same record, online presence avatars and conflict warnings are shown.
- [ ] **Rate Limiting on Client Events:** Client-side rate limiting prevents flooding the server with events (e.g., typing indicators throttled to 1 event/2 seconds).

### 17.2 Push Notifications
- [ ] **Permission Requested in Context:** Push permission is requested at the moment of value (not on first app load).
- [ ] **Deep Link from Notification:** Tapping a push notification navigates directly to the relevant record.
- [ ] **Notification Payload Does Not Contain PII:** Push notification payloads sent via FCM/APNs do not include personal data (only IDs that the app resolves).
- [ ] **Unsubscribe / Mute Controls:** User can manage notification preferences in-app without going to device Settings.
- [ ] **Badge Count Accurate:** App icon badge count matches unread notification count and clears when notifications are read.

---

## 18. Third-Party Integrations and SDK Hygiene

### 18.1 SDK Loading
- [ ] **Third-Party Scripts Load Async/Defer:** Analytics, chat widgets, and tracking scripts use async or defer and never block the critical rendering path.
- [ ] **SDK Failure Does Not Break App:** If a third-party SDK (Intercom, Segment, Hotjar) fails to load, the app continues to function normally. Failures are caught silently.
- [ ] **SDK Version Pinned:** Third-party SDKs are pinned to a major.minor version — not loaded via unpinned CDN URLs like latest.min.js.
- [ ] **SDK Removal Is Documented:** Removing a third-party integration is a documented, one-step process (no hidden calls scattered across the codebase).

### 18.2 Payment and Financial SDKs
- [ ] **PCI-DSS Compliance:** Credit card inputs use the payment provider hosted fields (Stripe Elements, Razorpay SDK) — raw card numbers never touch the app own JavaScript.
- [ ] **Webhook Signature Verification:** Payment webhook endpoints verify the provider signature header before processing.
- [ ] **Sandbox vs Production Keys Separated:** Payment SDK uses test keys in development/staging and live keys only in production — enforced by environment variable.

### 18.3 Maps and Location
- [ ] **API Key Restricted:** Maps API keys (Google Maps, Mapbox) are HTTP-referrer restricted in the provider console. They are not usable from arbitrary domains.
- [ ] **Location Data Not Stored Without Consent:** If user location is captured, explicit consent is obtained and the retention period is defined.

---

## 19. Environment Parity and Feature Flags

### 19.1 Environment Parity
- [ ] **Dev -> Staging -> Production Parity:** All three environments use the same Docker image. Environment differences are only in environment variables — not in code paths.
- [ ] **Staging Uses Anonymised Production Data:** Staging database contains production-like data volume but with PII anonymised. No toy data that masks performance issues.
- [ ] **Staging Smoke Tests Run Before Production Deploy:** A suite of automated smoke tests runs against the staging environment before promotion to production.
- [ ] **External Service Mocks in Dev Only:** Third-party service mocks (email, SMS, payment) are used only in development and test environments. Staging calls real sandboxes.

### 19.2 Feature Flags
- [ ] **Feature Flag System in Place:** A feature flag service (LaunchDarkly, Unleash, PostHog flags, or a simple API-returned config) controls which features are visible.
- [ ] **Flags Cleaned Up After Rollout:** Feature flags have an expiry date. Shipped flags are removed from code within 2 sprints of 100% rollout.
- [ ] **Flags Are Server-Side Evaluated:** Flag values come from the server at session start — not hardcoded client-side if (env === "prod") conditions.
- [ ] **Kill Switch for Catastrophic Issues:** A flag can instantly disable a misbehaving feature without requiring a deployment.

---

## 20. Privacy, Compliance and Data Governance

### 20.1 Data Minimisation
- [ ] **Client Stores Only What It Needs:** localStorage, cookies, and in-memory state do not retain data beyond session requirements.
- [ ] **PII Not Cached in Browser Storage:** Customer names, emails, phone numbers, and financial data are not persisted to localStorage or IndexedDB without documented justification and user consent.
- [ ] **Data Retention Timers:** Session data (localStorage state, cookies) has defined TTLs that match privacy policy commitments.

### 20.2 Regulatory Compliance
- [ ] **GDPR / India DPDP Cookie Consent:** A cookie consent banner appears on first visit. Non-essential cookies (analytics, session replay) are not set before consent.
- [ ] **Right to Erasure (Delete Account):** The UI exposes a clear "Delete My Account" flow that triggers complete data removal within the regulatory window.
- [ ] **Privacy Policy Link Accessible:** A link to the privacy policy is present in the app footer and on the sign-up flow.
- [ ] **Data Processing Agreement (DPA) for Sub-processors:** All third-party SDKs that process user data are listed in the DPA / sub-processor list.

### 20.3 Audit Logging (for Admin Consoles)
- [ ] **Sensitive Actions Logged:** Bulk deletes, user role changes, data exports, and API key generation are logged to an audit trail.
- [ ] **Audit Log Is Append-Only:** The audit log cannot be modified or deleted by regular admin users.
- [ ] **Log Review UI:** Admins can search and filter the audit log by user, action type, and date range.

---

## 21. Multi-Tenancy, Role-Based UI and Permission Gates

### 21.1 Tenant Isolation
- [ ] **Tenant Context in Every API Call:** All API calls include the tenant identifier (via header or URL). Missing tenant ID never defaults to the wrong tenant data.
- [ ] **No Cross-Tenant Data Leakage:** Client-side state is fully reset on workspace/tenant switch. No data from Tenant A appears in Tenant B session.
- [ ] **Workspace Switch Flow:** If the user has access to multiple workspaces, switching workspaces triggers a full auth token exchange and state reset.

### 21.2 Role-Based UI Gates
- [ ] **UI Actions Hidden for Unauthorised Roles:** Buttons, menu items, and tabs that the user role cannot access are hidden (not just disabled). Disabled is reserved for contextual unavailability.
- [ ] **Backend Permission Check is Authoritative:** Hiding UI is a UX courtesy — backend API still rejects unauthorised requests. The frontend does not rely solely on UI gating for security.
- [ ] **Role Context Available Everywhere:** The current user permissions are available in a stable hook (usePermission("orders:write")) used consistently throughout the app.
- [ ] **No Privilege Escalation via Direct URL:** A user who navigates directly to an admin-only URL is redirected, not served a partial or broken UI.
- [ ] **Permission Changes Reflected Without Full Reload:** If a user role is changed by an admin in another session, the UI reflects the change within a defined period (next API call or websocket event).

### 21.3 Impersonation and Admin Tooling
- [ ] **Admin Impersonation Banner:** When a support admin impersonates a user, a prominent banner is always visible showing "Viewing as [User Name]".
- [ ] **Impersonation Audit Logged:** Every impersonation session is recorded in the audit log.
- [ ] **No Impersonation to Dangerous Roles:** Impersonation cannot elevate privileges beyond the impersonated user actual role.

---

## 22. DevX, Tooling and Developer Safety

### 22.1 Linting and Formatting
- [ ] **ESLint Configured with Relevant Plugins:** eslint-plugin-react-hooks, eslint-plugin-jsx-a11y, eslint-plugin-import, and @typescript-eslint are all active.
- [ ] **Prettier Enforced:** Code formatting is non-negotiable and automated. No manual formatting debates.
- [ ] **Pre-commit Hooks:** lint-staged runs ESLint + Prettier on staged files before every commit. Bypassing with --no-verify is a documented exception, not the default.
- [ ] **Editor Config Shared:** .editorconfig ensures consistent tabs/spaces/line endings across editors.

### 22.2 Developer Safety
- [ ] **Environment Variable Validation on Start:** App fails fast if required env variables are missing (validated via zod env schema on server start / vite-plugin-checker).
- [ ] **Port Conflicts Detected:** Dev server detects and reports port conflicts rather than silently failing.
- [ ] **Dependency Update Policy:** renovate.json or dependabot.yml opens automated PRs for dependency updates. Security updates are auto-merged after passing CI.
- [ ] **package.json Engines Field:** "engines": { "node": ">=18" } prevents accidental use of older Node versions.

### 22.3 Documentation
- [ ] **README Covers Local Setup in < 5 Minutes:** A new developer can clone, install, configure .env, and run the app locally by following the README alone — without tribal knowledge.
- [ ] **Architecture Decision Records (ADRs):** Key decisions (why Zustand over Redux, why Vite over CRA) are documented in docs/adr/.
- [ ] **Component Storybook or Equivalent:** Interactive component documentation exists for the design system components.
- [ ] **Runbook for Common Incidents:** Documented steps for common production issues (token revocation, cache invalidation, hotfix deployment).

---

## Final Go-Live Gate Tests

These 20 manual verification tests must be performed by a human in the staging environment before every production release:

| # | Test Name | Steps | Pass Criteria |
|---|-----------|-------|---------------|
| 1 | The Whiteout Test | Throw a runtime error in a route component | Error Boundary shows friendly fallback. No white screen. |
| 2 | The Token Theft Test | Inspect localStorage, cookies, and JS heap snapshot | No plaintext passwords. Tokens stored securely. |
| 3 | The Double-Click Test | Click a form Submit button 5x in 1 second | Exactly 1 network call. Button disabled immediately. |
| 4 | The Offline Drop Test | Submit a form, disconnect Wi-Fi mid-flight | Clear error or queue message. App does not freeze. |
| 5 | The Token Expiry Test | Manually expire access token, then perform an action | Silent refresh occurs. User is not logged out. |
| 6 | The Back Button Test | Navigate 3 levels deep, press browser Back 3x | Returns to correct previous pages with scroll/filter restored. |
| 7 | The Keyboard-Only Test | Tab through the entire app without touching the mouse | All interactive elements reachable. Focus ring always visible. |
| 8 | The Screen Reader Test | Use NVDA/VoiceOver to navigate the main flows | All labels read correctly. No "button" without a name. |
| 9 | The Print Invoice Test | Open Invoice modal, press Ctrl+P | Clean A4 layout. No nav bars, toasts, or dark backgrounds. |
| 10 | The CSV Injection Test | Export a record with =SUM(A1:B2) in the name field | Exported CSV has the formula neutralised. |
| 11 | The Broken API Test | Point API base URL to an unreachable server | Error state shown. App does not crash. Retry is offered. |
| 12 | The Empty State Test | Clear all records in a module (customers, orders) | Illustrated empty state with CTA shown. No broken tables. |
| 13 | The Large Dataset Test | Load a table with 10,000 rows | No browser hang. Virtualisation active. Scroll smooth. |
| 14 | The Permission Escalation Test | Log in as a salesperson, navigate to admin-only URL directly | Redirected to 403 page. No partial admin UI visible. |
| 15 | The Dark Mode Test | Toggle dark mode, navigate all main screens | No hardcoded backgrounds. All text readable (>= 4.5:1 contrast). |
| 16 | The 375px Test | Open Chrome DevTools with iPhone SE viewport | No horizontal scroll. No clipped text or buttons. |
| 17 | The Slow Network Test | Chrome DevTools -> Network -> Slow 3G | Skeleton screens visible. No blank containers. TTI < 10 seconds. |
| 18 | The Refresh Test | Navigate to a deep page, hit F5 | Page reloads correctly with the correct data. No 404. |
| 19 | The Logout Completeness Test | Log out, check localStorage/cookies/sessionStorage | All tokens, user data, and store state cleared. |
| 20 | The Multi-Tenant Isolation Test | Log in as Tenant A, switch to Tenant B | No Tenant A data visible. Full state reset confirmed. |

---

## Readiness Scoring

Track your checklist progress by domain and gate your deployment:

| Stage | Minimum Criteria to Deploy |
|-------|---------------------------|
| **Dev to Staging** | Sections 10, 11, 12 fully green. All TypeScript errors resolved. |
| **Staging to Production** | Sections 1-9 fully green. 20 Gate Tests passed. Zero critical CVEs. |
| **Production (Ongoing)** | Sections 13-22 addressed within first 2 sprints of production launch. |

---

*This questionnaire is a living document. Add new items as new edge cases are discovered in production. Remove items that are validated by automated tooling.*
*Last updated: from Impeccable v4.1.1 + UI-UX Pro Max guidelines + GreatSales codebase audit.*