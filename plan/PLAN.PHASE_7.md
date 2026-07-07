# Phase 7 — Dark Mode

The strategy is CSS-variable-first: all color decisions are expressed as custom properties. Dark mode simply overrides those properties under a `.dark` class on `<html>`. No Tailwind `dark:` prefixes are needed in template markup — the CSS variables change, and every consumer updates automatically. Class-based toggling is used (rather than media-query-only) so the user's explicit choice persists across sessions, while still falling back to `prefers-color-scheme` when no preference has been saved.

## 7a — Extend `src/styles/global.css` ✅

Add the missing semantic tokens that are currently hardcoded as raw hex values in templates, and define dark-mode overrides for all tokens.

**New tokens to add to `@theme` (light values):**

| Token | Value | Usage |
|---|---|---|
| `--color-label` | `#525252` | Form field labels, table header text |
| `--color-subtle` | `#a3a3a3` | Secondary metadata labels (smaller than muted) |
| `--color-faint` | `#fafafa` | Table row hover on white background |
| `--color-badge-completed-bg` | `#d4f0e8` | "Completed" status badge surface |
| `--color-badge-completed-text` | `#0a6047` | "Completed" status badge text |
| `--color-badge-pending-bg` | `#faf7f0` | "Pending" status badge surface |
| `--color-badge-pending-text` | `#7c5e0a` | "Pending" status badge text |
| `--color-badge-positive-bg` | `#e4f5d4` | Positive balance / success badge surface |
| `--color-badge-positive-text` | `#1a5c00` | Positive balance / success badge text |
| `--color-badge-negative-bg` | `#ffe4d8` | Negative balance / error badge surface |
| `--color-badge-negative-text` | `#8b2500` | Negative balance / error badge text |
| `--color-error-bg` | `#fff0f0` | Parse/validation error panel surface |
| `--color-error-border` | `#fecaca` | Parse/validation error panel border |
| `--color-error-text` | `#b91c1c` | Parse/validation error panel text |
| `--color-modal-scrim` | `rgba(0,0,0,0.4)` | Modal backdrop overlay |
| `--color-modal-bg` | `#ffffff` | Modal dialog surface |
| `--color-input-bg` | `#ffffff` | Form input background |
| `--color-file-btn-bg` | `#0a0a0a` | File input button background |
| `--color-file-btn-text` | `#ffffff` | File input button text |

**Dark mode overrides** — added via `@layer base` using both selectors so that either approach works:

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { … }
}
:root[data-theme="dark"] { … }
```

Dark values:

| Token | Dark Value | Rationale |
|---|---|---|
| `--color-ink` | `#f0f0f0` | Near-white body text |
| `--color-canvas` | `#0d0d0d` | Deep near-black page background |
| `--color-surface` | `#1c1c1c` | Slightly elevated surface (table headers, code chips) |
| `--color-hairline` | `#2a2a2a` | Subtle border on dark canvas |
| `--color-muted` | `#a3a3a3` | Kept the same — readable on both |
| `--color-label` | `#a3a3a3` | Lighter label text for dark surfaces |
| `--color-subtle` | `#6b6b6b` | Dimmer secondary metadata |
| `--color-faint` | `#141414` | Row hover on dark background |
| `--color-block-lime` | `#1a2e14` | Muted dark lime |
| `--color-block-coral` | `#2e1710` | Muted dark coral |
| `--color-block-cream` | `#1e1c18` | Muted dark cream |
| `--color-block-mint` | `#102a22` | Muted dark mint |
| `--color-badge-completed-bg` | `#102a22` | Dark mint surface |
| `--color-badge-completed-text` | `#6ee7b7` | Readable mint-300 on dark |
| `--color-badge-pending-bg` | `#2a2318` | Dark amber surface |
| `--color-badge-pending-text` | `#fcd34d` | Readable amber-300 on dark |
| `--color-badge-positive-bg` | `#1a2e14` | Dark lime surface |
| `--color-badge-positive-text` | `#86efac` | Readable green-300 on dark |
| `--color-badge-negative-bg` | `#2e1710` | Dark coral surface |
| `--color-badge-negative-text` | `#fb923c` | Readable orange-300 on dark |
| `--color-error-bg` | `#2e1212` | Dark error surface |
| `--color-error-border` | `#7f1d1d` | Dark error border |
| `--color-error-text` | `#fca5a5` | Readable red-300 on dark |
| `--color-modal-scrim` | `rgba(0,0,0,0.6)` | Deeper scrim on dark |
| `--color-modal-bg` | `#1c1c1c` | Modal surface matches elevated |
| `--color-input-bg` | `#141414` | Dark input background |
| `--color-file-btn-bg` | `#f0f0f0` | Inverted: light button on dark |
| `--color-file-btn-text` | `#0d0d0d` | Dark text on light button |

Also update `html` base styles to use the tokens and remove hardcoded color/background values.

## 7b — Replace hardcoded hex values in all Vue components and Astro pages ✅

Every hardcoded `[#hex]`, `bg-white`, `text-white` (on dark backgrounds), `bg-black/40` in class attributes must be replaced with the appropriate CSS variable reference. The mapping:

| Old class fragment | New class fragment |
|---|---|
| `[#0a0a0a]` / `bg-[#0a0a0a]` | `[--color-ink]` / `bg-(--color-ink)` |
| `[#e8e8e8]` | `[--color-hairline]` |
| `[#f5f5f5]` / `bg-[#f5f5f5]` | `[--color-surface]` / `bg-(--color-surface)` |
| `[#737373]` | `[--color-muted]` |
| `[#525252]` | `[--color-label]` |
| `[#a3a3a3]` | `[--color-subtle]` |
| `[#fafafa]` / `hover:bg-[#fafafa]` | `[--color-faint]` / `hover:bg-(--color-faint)` |
| `bg-white` (inputs, modals) | `bg-(--color-input-bg)` or `bg-(--color-modal-bg)` |
| `text-white` (on ink buttons) | stays as-is — the button bg changes, text stays white |
| `bg-black/40` (modal scrim) | `bg-(--color-modal-scrim)` |
| `bg-[#e4f5d4]` (success/lime) | `bg-(--color-badge-positive-bg)` |
| `text-[#1a5c00]` | `text-(--color-badge-positive-text)` |
| `bg-[#ffe4d8]` (coral/negative) | `bg-(--color-badge-negative-bg)` |
| `text-[#8b2500]` | `text-(--color-badge-negative-text)` |
| `bg-[#d4f0e8] text-[#0a6047]` (completed) | `bg-(--color-badge-completed-bg) text-(--color-badge-completed-text)` |
| `bg-[#faf7f0] text-[#7c5e0a]` (pending) | `bg-(--color-badge-pending-bg) text-(--color-badge-pending-text)` |
| `bg-[#fff0f0]` (error bg) | `bg-(--color-error-bg)` |
| `border-red-200` | `border-(--color-error-border)` |
| `text-red-700` | `text-(--color-error-text)` |
| Import page hardcoded `[#d4cdbf]`, `[#ece7df]` | use `[--color-hairline]` |

Files affected:
- `src/components/ApproveTransactions.vue`
- `src/components/CategoryFormModal.vue`
- `src/components/CategoryTable.vue`
- `src/components/GroupTransactionForm.vue`
- `src/components/ImportForm.vue`
- `src/components/LoginForm.vue`
- `src/components/SignOutButton.vue`
- `src/components/SingleTransactionForm.vue`
- `src/components/TransactionTable.vue`
- `src/components/UserFormModal.vue`
- `src/components/UserTable.vue`
- `src/pages/import-transactions.astro`

## 7c — Flash-prevention script in `src/layouts/Layout.astro` ✅

Add an inline `<script>` in `<head>` (before any CSS loads) that reads `localStorage.getItem('theme')` and immediately applies `data-theme="dark"` to `<html>` if needed. This prevents the white flash on page load for users who prefer dark mode.

```html
<script is:inline>
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (saved === 'dark' || (!saved && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
</script>
```

## 7d — Dark mode toggle in `src/components/AppHeader.astro` ✅

Add a sun/moon toggle button to the right side of the nav (next to the sign-out button). Uses inline SVG — no icon library needed.

- Renders a moon icon (visible in light mode) and a sun icon (visible in dark mode) using `data-theme` attribute visibility toggling
- On click: toggles `data-theme` attribute on `<html>` between `"light"` and `"dark"`, persists to `localStorage`
- Script is `is:inline` so it runs client-side without a framework

## 7e — `src/components/AppHeader.astro` nav link active state ✅

The `navClass` utility uses `bg-ink` and `text-canvas` — both are already CSS-variable-backed Tailwind theme tokens and required no changes.

## 7f — Verify `src/utils/nav.ts` ✅

Confirmed `navClass` uses `bg-ink` and `hover:bg-(--color-surface)` — no changes needed.
