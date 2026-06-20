---
{
  "id": "file_l0fvjkb2",
  "filetype": "document",
  "filename": "frontend-redesign",
  "created_at": "2026-06-19T22:39:09.844Z",
  "updated_at": "2026-06-19T22:39:09.844Z",
  "meta": {
    "location": "/",
    "tags": [],
    "categories": [],
    "description": "",
    "source": "markdown"
  }
}
---
# RoundTable 4.1 — Frontend Redesign Design Document

**Version**: 1.0  
**Date**: 2026-06-19  
**Status**: Approved for Phase 1

---

## 1. Design Brief

**Target user**: Solo player — one human controlling one character, with the AI running the Dungeon Master and all other party members.

**Dominant emotional state during a session**: Immersed. The player has forgotten the UI exists; they are inside the fiction.

**Design mandate**: The interface must *belong* to the fantasy world — not disappear, but exist as a native artifact of that world. The UI is something the player finds inside the game, not a shell wrapped around it.

---

## 2. Aesthetic Direction

### Name: *The Living Record*

**DFII Score: 12 / 15**

| Dimension | Score | Rationale |
|---|---|---|
| Aesthetic Impact | 5 | Dual-register system is rare; the transition moment is a genuine hero |
| Context Fit | 5 | Medieval manuscript + armorer's iron maps directly to TTRPG world-building |
| Implementation Feasibility | 4 | CSS-driven, no external assets required |
| Performance Safety | 4 | Texture via SVG/CSS; animations sparse and purposeful |
| Consistency Risk | −6 | Two visual registers require discipline to keep from diverging |

### Differentiation Anchor

> "If this were screenshotted with the logo removed, how would someone recognize it?"

A warm vellum panel where the DM's words are visibly being *written* — and when combat begins, that page drains of warmth and hardens into cold stamped iron. No other app in the TTRPG space has a UI that is literally two different materials.

### Anti-Patterns Explicitly Rejected

- ❌ Parchment texture images (overdone — every fantasy app reaches for these)
- ❌ Gold serif fonts on dark backgrounds (D&D Beyond aesthetic — not ours)
- ❌ Glowing rune borders (decorative without narrative function)
- ❌ Default Tailwind dark chrome (neutral-900 cards, border-neutral-800)
- ❌ Purple-on-dark "AI app" gradient aesthetic

---

## 3. Dual Aesthetic System

The entire UI operates in one of two modes, driven by `gameState.phase === 'combat'`, applied as a `data-mode` attribute on the game root element.

### Mode A — Manuscript (Exploration)

**Metaphor**: A medieval manuscript being written in real-time as the session unfolds. The DM is the scribe. The player's actions become entries. The world is a document still being created.

| Token | Value | Intent |
|---|---|---|
| `--color-bg` | `#F2E8D5` | Aged vellum — warm, never white |
| `--color-surface` | `#EAD9BC` | Inset parchment — slightly darker than bg |
| `--color-ink` | `#1C1814` | Warm black, never pure #000 |
| `--color-accent` | `#8B3A2A` | Rubrication — chapter marks, danger, player name |
| `--color-secondary` | `#6B4C2A` | Sepia — marginalia, annotations |
| `--color-border` | `#C4A882` | Vellum fold lines |

**Texture**: Fine grain noise applied via SVG data URI `background-image` — no external asset required.

**Typography feel**: Organic, slightly irregular. Letters have weight variation. Spacing is generous — a scribe leaves room to breathe.

---

### Mode B — Iron & Rivets (Combat)

**Metaphor**: An armorer's notation board. Not a scribe's page — a chisel on metal. Every number is stamped, not written. Every border is bolted, not ruled.

| Token | Value | Intent |
|---|---|---|
| `--color-bg` | `#0F0F0D` | Forge black — charcoal with warmth stripped |
| `--color-surface` | `#2A2A2F` | Cold steel plate |
| `--color-ink` | `#C8C8D0` | Stamped silver — engraved into metal |
| `--color-accent` | `#C0392B` | Ember red — low HP, critical hits |
| `--color-secondary` | `#4A9B8E` | Iron cyan — active turn, current actor |
| `--color-border` | `#3D3D45` | Plate seams |

**Texture**: Fine crosshatch noise, cooler tone than manuscript grain.

**Typography feel**: Tight tracking, consistent weight. No variation — stamped numerals, not calligraphy.

---

## 4. Typography

| Font | Role | Use |
|---|---|---|
| **IM Fell English** | Display | DM narration headings, location names (manuscript mode) |
| **Crimson Pro** | Body | DM narration body text (manuscript mode) |
| **JetBrains Mono** | Technical | All text in iron/combat mode — HP, initiative, stamped labels |

```css
@import url('https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;600;700&display=swap');
```

**Font loading strategy**: Google Fonts CDN for development; self-host before production.

---

## 5. Spacing Rhythm

Base unit: **8px**

| Token | Value | Use |
|---|---|---|
| `--space-1` | 4px | Tight internal padding |
| `--space-2` | 8px | Standard gap |
| `--space-3` | 12px | Comfortable separation |
| `--space-4` | 16px | Section padding |
| `--space-6` | 24px | Panel internal breathing room |
| `--space-8` | 32px | Between major sections |

Manuscript mode uses larger internal padding — the scribe leaves margins. Iron mode is tighter — space is wasted metal.

---

## 6. Motion Philosophy

**Principle**: One strong entrance sequence. A few meaningful hover states. No decorative micro-motion.

| Motion | Duration | Easing | Purpose |
|---|---|---|---|
| Ink write-on (DM message) | 400ms | `ease-out` | Ink spreads — not typewriter |
| **Hero mode transition** | **600ms** | `cubic-bezier(0.4, 0, 0.2, 1)` | **Ink drains, metal hardens** |
| Entity plate slam (combat enter) | 200ms staggered 40ms | `ease-in` | Each HP plate locks into position |
| Hover on iron plate | 120ms | `ease-out` | Subtle backlit highlight |
| Reduced-motion fallback | Instant | N/A | `@media (prefers-reduced-motion)` |

### Hero Transition Spec — "Ink Bleeds Into Metal"

Triggered by `gameState.phase` changing to `'combat'`. Applied as `data-mode="iron"` on the game root.

```
0ms       — gameState.phase changes to 'combat'
0ms       — data-mode="iron" set on root element
0–200ms   — warm ochre/vellum colors drain (saturation drops, temperature cools)
200–400ms — surface darkens; grain texture crossfades warm → cool
400–600ms — typography tracking tightens; border weights sharpen
600ms     — full iron mode
```

Reversal (combat ends): same timeline, reversed direction.

---

## 7. Component Design Intent

### 7.1 ChatInterface — Manuscript Mode

**What it is**: The DM's manuscript page, being written in real-time.

- Background: vellum surface with grain texture
- DM messages: IM Fell English body, ink write-on entrance, lampblack ink
- Player messages: Crimson Pro, rubrication red, right-aligned — a marginalia response
- System messages (typing indicator, AI thinking): left margin, sepia, italic — scribe's side note
- Input area: styled as a ruled line at the bottom of the page; quill inkwell motif on send button
- **No chat bubbles. No avatars. Text is the artifact.**

### 7.2 EntityListPanel — Iron Mode

**What it is**: An armorer's notation board — stamped iron plates, one per entity.

- Each entity: rectangular iron plate, rivet dots at corners, stamped name
- HP: depleting plate fill — cold steel color drains left-to-right as HP drops; no rounded corners; no gradients
- Initiative order: entities sorted by initiative, rendered as a numbered bracket stamped into each plate header
- Active turn: plate backlit with iron cyan, subtle glow
- Conditions: small stamped symbols — not text chips or badges
- Enemy plates: slightly darker, rougher texture than ally plates
- Death/0 HP: plate crossed out with an engraved X stroke

### 7.3 BattlemapPanel — Dual

- Manuscript mode: hex grid with warm ink lines, hand-drawn feel
- Iron mode: cold technical lines, heavier stroke weight

### 7.4 GameInterface — Root

- Holds `data-mode` attribute, updated when `gameState.phase` changes
- All CSS variable transitions driven from this attribute change
- Layout structure unchanged — only visual register switches

---

## 8. CSS Architecture

All design tokens as CSS custom properties on `:root`, overridden by `[data-mode="iron"]`. All color properties transition on the root element so the hero animation is driven entirely by CSS.

```css
:root,
[data-mode="manuscript"] {
  --color-bg: #F2E8D5;
  --color-surface: #EAD9BC;
  --color-ink: #1C1814;
  --color-accent: #8B3A2A;
  --color-secondary: #6B4C2A;
  --color-border: #C4A882;

  --font-display: 'IM Fell English', serif;
  --font-body: 'Crimson Pro', serif;
  --font-mono: 'JetBrains Mono', monospace;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  --transition-mode: 600ms cubic-bezier(0.4, 0, 0.2, 1);
}

[data-mode="iron"] {
  --color-bg: #0F0F0D;
  --color-surface: #2A2A2F;
  --color-ink: #C8C8D0;
  --color-accent: #C0392B;
  --color-secondary: #4A9B8E;
  --color-border: #3D3D45;
}
```

---

## 9. Implementation Phases

| Phase | Scope | Files | Review Gate |
|---|---|---|---|
| **1** | Design tokens, fonts, textures | `index.css` | Static demo — both modes side by side |
| **2** | ChatInterface manuscript redesign | `ChatInterface.tsx` | Isolated component, mocked messages, ink entrance |
| **3** | EntityListPanel iron redesign | `EntityListPanel.tsx` | Isolated component, mocked combat state |
| **4** | Hero transition animation | `GameInterface.tsx`, `index.css` | Button-triggered mode switch demo |
| **5** | Battlemap framing + integration + a11y | `BattlemapPanel.tsx`, `GameInterface.tsx` | Live session, both modes, end-to-end |

---

## 10. Open Questions

1. **Font loading**: Google Fonts CDN (current plan) vs. self-hosted for production?
2. **Texture**: SVG data URI grain or CSS `backdrop-filter` noise?
3. **Mobile at 375px**: Does the dual register hold, or does iron mode need a simplified mobile variant?
4. **Battlemap hex rendering**: Currently SVG-based in `BattlemapPanel.tsx` — manuscript ink-line style may require a stroke-color prop; needs audit before Phase 5.
