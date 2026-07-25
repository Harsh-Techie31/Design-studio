# Flora.ai — Design System Reference
*Extracted directly from the live flora.ai landing page (computed styles, not guesswork). Use this as the source-of-truth spec for building a visually similar dark/black + green interface.*

---

## 1. Design Philosophy (observed)

Flora's landing page reads as a **cinematic, black-canvas creative tool** — not a typical SaaS marketing site. The core visual moves are:

- **Near-total black** as the dominant surface — not charcoal, actual `#000000`.
- **Content (video/image previews) does the coloring**, not chrome. UI elements stay monochrome; color shows up only in small, deliberate accents (green CTA, green link-hover) and inside generated media itself.
- **Soft black scrims** are laid over every image/video so white text stays legible without adding a visible "card."
- **Large radii** (mostly 24px) make panels feel soft/organic against the otherwise sharp typography.
- **Grain/noise texture** subtly breaks up the flat black so it doesn't look like a plain `#000` div — gives it a filmic, premium feel rather than "flat dark mode."
- **Micro-interactions over motion-heavy design** — small blurs (2–10px) and shadow glows on hover, not big sweeping animations.

---

## 2. Color Palette

### Core surfaces
| Token | Hex | Usage |
|---|---|---|
| `--bg-base` | `#000000` | Page/body background — true black, used ~1800+ times, by far the dominant color |
| `--surface-1` | `#191919` | Slightly-raised panel/card background |
| `--surface-2` | `#202020` | Secondary raised surface (inputs, hover panels) |
| `--surface-3` | `#131416` | Deepest elevated surface (rare, tooltips/menus) |

### Text
| Token | Hex | Usage |
|---|---|---|
| `--text-primary` | `#eeeeee` | Default body/heading text (not pure white — slightly softened) |
| `--text-secondary` | `#b4b4b4` | Secondary/muted text (nav labels, captions) |
| `--text-tertiary` | `#7b7b7b` | Disabled/faint text |
| `--text-on-accent` | `#000000` | Text sitting on top of the green accent button |

### Accent — the "Flora green"
| Token | Hex | Usage |
|---|---|---|
| `--accent-mint` | `#71d083` | Primary filled CTA buttons ("Go to app", "Try Omni") — bg fill, black text on top |
| `--accent-green` | `#49c470` | Secondary accent — used as **text/link color** on black (e.g. "Explore more →"), and for hover states |

Notice Flora uses **two greens**, not one: a lighter mint for solid button fills (needs black text on it for contrast), and a deeper green reserved for text/icon accents directly on black. This is a good pattern to copy — don't use one green for everything.

### Borders / hairlines
| Token | Hex | Usage |
|---|---|---|
| `--border-subtle` | `#292f35` | Card/panel hairline borders — a cool dark blue-gray, *not* pure gray. This is what gives panels a "techy" edge instead of a flat one. |
| `--border-hairline-light` | `rgba(255,255,255,0.08–0.12)` | Occasional light hairline on top of images/scrims |

**Key insight:** Flora's border color is not neutral gray — it has a slight cool/blue tint (`#292f35`). Copy this exact value rather than using `gray-800` from a default Tailwind palette; it's part of what makes the UI feel intentional rather than templated.

---

## 3. Typography

**Primary typeface: Geist** (Vercel's font), with `Geist Variable` for some weights. Fallback stack: `Geist, "Geist Placeholder", sans-serif`.

Secondary/decorative typefaces spotted sparingly:
- **Times** (serif) — used for occasional editorial/quote-style headlines, a contrast move against the geometric sans everywhere else.
- **Satoshi** — used in a few isolated spots.
- **Redaction 10 / Redaction 50 Italic** — a handwritten/marker-style display font used *very* sparingly for playful annotations (sticky-note-like captions), not body copy.

### Scale (as measured)
| Element | Size | Weight | Line-height | Letter-spacing | Color |
|---|---|---|---|---|---|
| Hero/section number headline (e.g. "Ideate") | 60px | 500 | 66px | -1.5px | `#eeeeee` |
| Section subhead (e.g. "Never let a good idea go unexplored.") | 30px | 500 | 41.1px | -0.5px | `#eeeeee` |
| Nav / label text | 14px | 400 | 14px | 0.4px | `#b4b4b4` |

**Pattern to replicate:** headings use **negative letter-spacing** (tight tracking, -0.5 to -1.5px) at **medium weight (500)**, not bold. This is what gives Flora's type its confident-but-not-shouty feel — avoid `font-weight: 700` for big headlines; 500 reads more premium at large sizes.

Nav/label text goes the opposite way — small size, *positive* letter-spacing (0.4px), all giving it a slightly "spaced out" utilitarian label feel, similar to camera UI or timecodes.

---

## 4. Shape & Elevation

### Border radius
| Value | Usage |
|---|---|
| `24px` | Dominant radius — used on nearly all cards/panels/media containers (113 occurrences, by far the most common) |
| `12px` | Buttons, smaller interactive elements |
| `8px` | Small chips/inputs |
| `999px` (pill) | Tags, small rounded badges |

Flora leans heavily into **one big radius (24px)** for anything panel-sized, rather than mixing many radii. Keep this consistent — it's a big part of the "soft canvas" feel against sharp typography.

### Shadows
Dominant elevation shadow (used on ~116 elements):
```css
box-shadow: 0px 8px 24px 0px rgba(0, 0, 0, 0.28);
```
Soft, low-spread, low-opacity — barely-there depth rather than a hard drop shadow. Used to lift image/video cards subtly off the black background.

Occasional **colored glow** shadows appear contextually (e.g. an inset warm glow on a specific content card):
```css
box-shadow:
  inset 0 0 15px rgba(217, 119, 87, 0.7),
  inset 0 0 25px rgba(217, 119, 87, 0.5),
  inset 0 0 35px rgba(217, 119, 87, 0.2);
```
This tells you Flora **tints glow shadows to match the content/category color** rather than always using green — worth doing the same: default glow = green, but let content-type cards glow their own accent color if you have categories.

### Blur
Blur usage is light-touch, not full glassmorphism:
```css
backdrop-filter: blur(2px);   /* most common — barely perceptible, used on hover states */
backdrop-filter: blur(10px);  /* used a handful of times — modals/overlays */
```
**Correction to earlier assumption:** Flora's actual site is *not* heavy glassmorphism — it's mostly flat black surfaces with soft shadows. The "glass" feeling comes more from gradient scrims + soft shadows than from backdrop blur. If you want a stronger glass/translucent look than Flora's actual site has, that's a deliberate deviation — worth deciding explicitly rather than assuming Flora does it.

---

## 5. Image & Media Treatment

Every media card (video/image preview) gets a **gradient scrim** so overlaid text stays legible:
```css
/* Bottom-heavy scrim, most common */
background: linear-gradient(rgba(0,0,0,0) 0%, rgba(0,0,0,0.9) 100%);

/* Lighter version */
background: linear-gradient(rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 100%);

/* Radial vignette from a corner */
background: radial-gradient(67% 29% at 0px 0px, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 65.9%);
```

### Film grain / noise texture
A subtle radial-dot noise pattern is layered over black surfaces:
```css
background-image: radial-gradient(rgba(255,255,255,0.15) 0.6px, rgba(0,0,0,0) 1.4px);
```
This is a cheap, effective trick — it stops large black areas from looking like a flat `#000` div in dev tools and gives a subtle "cinematic film" quality. Recommend applying this as a fixed, low-opacity overlay across the whole canvas background, not per-component.

---

## 6. Components (as observed)

**Primary button ("Go to app" / "Try Omni")**
```css
background: #71d083;
color: #000000;
border: 1px solid #ffffff; /* thin light edge, adds crispness on the fill */
border-radius: 12px;
font-weight: 500;
```

**Secondary/text link with arrow ("Explore more →")**
```css
color: #49c470;
background: transparent;
/* arrow glyph inherits the same green */
```

**Nav bar**
- Sits on the same `#000000` base, no distinct translucent bar — navigation blends into the black canvas rather than floating as a glass strip.
- Labels at 14px / `#b4b4b4`, active/hover likely brightens to `#eeeeee`.

**Cards/panels**
- 24px radius, `#191919`–`#202020` fill, `#292f35` hairline border, soft `0 8px 24px rgba(0,0,0,.28)` shadow.

---

## 7. Ready-to-use CSS variables

```css
:root {
  /* Surfaces */
  --bg-base: #000000;
  --surface-1: #191919;
  --surface-2: #202020;
  --surface-3: #131416;

  /* Text */
  --text-primary: #eeeeee;
  --text-secondary: #b4b4b4;
  --text-tertiary: #7b7b7b;
  --text-on-accent: #000000;

  /* Accent greens */
  --accent-mint: #71d083;   /* solid fills */
  --accent-green: #49c470;  /* text/links/icons on black */

  /* Borders */
  --border-subtle: #292f35;

  /* Radius */
  --radius-lg: 24px;   /* cards/media panels */
  --radius-md: 12px;   /* buttons */
  --radius-sm: 8px;    /* chips/inputs */
  --radius-pill: 999px;

  /* Shadow */
  --shadow-elevate: 0px 8px 24px 0px rgba(0, 0, 0, 0.28);

  /* Typography */
  --font-primary: Geist, "Geist Placeholder", sans-serif;
  --tracking-tight: -1.5px;   /* hero headlines */
  --tracking-tight-sm: -0.5px; /* subheads */
  --tracking-wide: 0.4px;      /* nav/labels */
}

.dark body {
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-primary);
}

.btn-primary {
  background: var(--accent-mint);
  color: var(--text-on-accent);
  border: 1px solid #ffffff;
  border-radius: var(--radius-md);
  font-weight: 500;
}

.card {
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-elevate);
}

.media-scrim {
  background: linear-gradient(rgba(0,0,0,0) 0%, rgba(0,0,0,0.9) 100%);
}

.grain-overlay {
  background-image: radial-gradient(rgba(255,255,255,0.15) 0.6px, rgba(0,0,0,0) 1.4px);
  background-size: 3px 3px;
  pointer-events: none;
}
```

---

## 8. Notes for your AI coding agent

1. **Do not treat this as a heavy glassmorphism system** — flora.ai's actual landing page is flatter than that (soft shadows + scrims, light 2–10px blur only in a few spots). If you specifically want a more translucent/glass feel than Flora has, say so explicitly as a deviation, don't assume it's "the Flora look."
2. Use **two greens**, not one — mint (`#71d083`) for filled buttons, deeper green (`#49c470`) for text/links directly on black.
3. Keep **one dominant radius (24px)** for anything panel-sized; don't scatter many different radii.
4. Headline type should be **medium weight (500) with negative tracking**, not bold — that's a big part of the "premium" feel.
5. Add the **grain/noise overlay** — it's a small detail but is doing real work to keep large black areas from looking flat/cheap.
6. Border color on panels should be the cool dark blue-gray `#292f35`, not a neutral gray from a default palette.

---
*Source: computed styles pulled live from https://flora.ai/ on July 25, 2026.*
