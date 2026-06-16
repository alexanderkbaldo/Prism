# Prism — Design System

A fintech alternative-data platform. This system pairs the **Data-Dense Dashboard**
pattern (KPI cards, scannable tables, space-efficient grids, hover affordances)
with an **editorial** voice (serif display, generous whitespace, restraint). It
was derived with the UI/UX Pro Max design intelligence and adapted to Prism's
existing warm palette.

## Principles

1. **Quiet, professional whisper.** One accent (sage), hairline dividers, lots of
   air. Nothing ornate.
2. **Surface elevation by gentle warm shifts**, not heavy shadows: canvas → paper
   card → raised panel.
3. **Data is the hero.** KPI cards and the AI brief lead; chrome recedes.
4. **Accessible by default.** Visible focus, 4.5:1 contrast, keyboard reachable,
   reduced-motion honored.

## Color

Existing palette, kept exactly. Sage is the single accent; clay signals urgency.

| Token | Hex | Role |
|---|---|---|
| `--bg` | `#E7DCCB` | Canvas (level 0) |
| `--paper` | `#F1E8D8` | Card surface (level 1) |
| `--paper-raised` | `#F7F1E6` | Elevated panel |
| `--surface` | `#DFD3C0` | Inset bands |
| `--hairline` | `#CBBDA8` | 0.5px borders/dividers |
| `--ink` | `#1A2018` | Primary text + dark sections |
| `--muted` / `--faint` | `#6E6253` / `#8A7D6B` | Secondary / tertiary text |
| `--sage` / `--sage-soft` | `#6B8F71` / `#C4D4C6` | Accent / soft accent |
| `--up` / `--down` / `--clay` | `#4A8A5A` / `#B5503F` / `#B86B4A` | Positive / negative / urgency |

Contrast: ink-on-sand and muted-on-sand both clear 4.5:1; sage is used for
accents and large text, not small body copy.

## Typography

- **Display** — Newsreader (serif): hero, section headlines, the AI brief voice,
  KPI numbers. Tight tracking (−0.02em).
- **UI / body** — Inter (sans): labels, captions, controls, descriptions.
- **Eyebrow** — 10px, 0.16em tracking, uppercase, sage or faint. The only
  uppercase in the system.

Scale (CSS tokens): `--text-eyebrow` 10 · `--text-caption` 12 · `--text-body` 16
· `--text-body-lg` 18 · `--text-h3` 24 · `--text-h2` 44 · `--text-display` 64.
Body line-height 1.5–1.7; line length capped ~65ch for reading columns.

## Spacing

4px base, exposed as `--space-1…10` (4, 8, 12, 16, 24, 32, 48, 64, 96, 120).
Cards pad 28–40px; element gaps 20px; section rhythm 48–120px.

## Components

- **KPI card** — paper surface, 10px radius, soft shadow, eyebrow label + large
  serif value + caption. Display-only (no clickable hover).
- **Elevated panel** (the brief / "the read") — raised paper, 12px radius,
  36–40px padding; the page's focal point.
- **Tabs** (company switcher) — text tabs; active filled `--ink`; non-active wash
  to `--surface` on hover (150ms).
- **Buttons / CTA** — sage fill, 10px radius; hover scale 1.03 + shadow (200ms).
- **Cards on canvas** (home "what we track", companies) — `--surface` tint, lift
  −2px + sage border on hover.

## Interaction & motion

- Transitions 150–300ms, ease-out; transform/opacity only.
- Hover feedback on every interactive element; **not** on display-only cards.
- Scroll reveals: fade + 30–40px rise, `whileInView` once, 0.12s stagger.
- All motion gated on `prefers-reduced-motion`.

## Accessibility checklist (enforced)

- [x] Visible `:focus-visible` ring (sage) on all interactive elements
- [x] Skip-to-content link before the nav
- [x] `<main id="main">` landmark
- [x] Icon-only buttons carry `aria-label`; tooltips use `role="tooltip"`
- [x] Color never the sole signal (arrows + words accompany up/down)
- [x] `prefers-reduced-motion` respected (JS + CSS)
- [x] Responsive at 375 / 768 / 1024 / 1440

## Anti-patterns (avoid)

Ornate decoration · emoji as icons · removing focus outlines · multiple accent
colors · hover states that imply interactivity on static data · heavy drop
shadows.
