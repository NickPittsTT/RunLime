# 04 — Brand Directions

> **Reminder before any bundle ID or store listing (Phase 1 uses bundle IDs):** confirm that "RunLime" is free on
> - the Apple App Store (search + App Store Connect name reservation)
> - Google Play
> - domains (`runlime.com`, `.app`, `.tt`)
> - social handles
> - the T&T Intellectual Property Office trademark register, plus USPTO/WIPO for Classes 9 & 41/42
>
> Proposed bundle IDs (placeholder until confirmed): `tt.runlime.app` / `com.runlime.app`.

Accessibility fact that shapes all three directions: **pure lime green fails contrast as text on white** (`#A3E635` on white = **1.51:1**; WCAG AA needs 4.5:1 for body text and 3:1 for large text/icons). So lime is used as a **fill / highlight with dark text on it**, never as text or thin icons on white. Each direction has a dark-green "action" colour that passes on white.

All ratios below were computed with the WCAG 2.x formula.

---

## Direction A — "Fresh Lime" (bright, friendly, daytime)
| Role | Colour | Check |
|---|---|---|
| Accent fill | Lime `#A3E635` | dark text on it: `#0F172A` → **11.84:1** ✅ |
| Action / links on white | Leaf `#3F7D0F` | on white **5.06:1** ✅ |
| Deep | Forest `#14532D` | lime-on-forest **6.04:1** ✅ |
| Ink | `#0F172A` | — |
| Background | White / `#F7FBEF` | — |

**Logo idea:** lowercase wordmark **runlime**. The dot of the "i" is a lime wedge, tilted forward like a runner leaning into a stride. App icon: the wedge alone on forest green.
**Feel:** Strava-meets-a-beach-lime. Clean and very legible on cheap screens.

## Direction B — "Island Lime" (warm, social, carnival energy)
| Role | Colour | Check |
|---|---|---|
| Accent fill | Lime `#84CC16` | navy text on it **7.23:1** ✅ |
| Secondary | Sunset `#C2410C` | on white **5.18:1** ✅ (the brighter `#F97316` is only 2.8:1, so use it for fills only) |
| Ink / primary dark | Navy `#1E2A44` | on white **14.29:1** ✅ |
| Background | Sand `#FFF8EE` | — |

**Logo idea:** a map pin whose head is a lime slice, with three speed lines trailing behind it. "Find the race, join the lime." App icon: the pin on navy.
**Feel:** local and social. The pin says "calendar + place". *Note:* avoid using the national flag or coat of arms (protected emblems) and avoid red/black/white stripes that look like the flag.

## Direction C — "Night Run" (dark-first, sporty, premium)
| Role | Colour | Check |
|---|---|---|
| Background | Near-black `#0B0F0C` | — |
| Accent | Electric lime `#C6F432` | on black **15.06:1** ✅ (on white only 1.28:1, so on light surfaces use `#365314`, **8.73:1** ✅) |
| Text | White / Grey `#9CA3AF` | **19.3:1** / **7.6:1** ✅ |

**Logo idea:** a single continuous line that draws a running route and closes into a lime leaf. The wordmark uses a condensed bold italic. App icon: the leaf-route in lime on black.
**Feel:** performance and night-run culture. Dark UI saves battery on OLED phones during runs. A light mode is still required.

---

## Decision: Direction A — Fresh Lime (owner, 2026-10-11)

_Original recommendation kept below for the record._

### Recommendation
**A for the app and B's warmth for marketing.** My pick is **A**: it's the most legible outdoors in bright sun, and the simplest to keep accessible. Confidence 0.65; this is taste, so it's your call.

Type (all three): **Inter** (UI; free, excellent hinting on Android) + one display face for headings: "Archivo" (A), "Poppins" (B) or "Barlow Condensed" (C). All are free and open-licensed.

Next step after you choose: I produce the icon (1024×1024 master + adaptive Android foreground/background layers), the splash, and the token file `packages/ui-tokens`. I can also publish a visual brand board (rendered swatches + logo sketches) as a shareable page if that would help you choose.
