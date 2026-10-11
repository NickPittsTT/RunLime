# 05 — Running Cost Estimate (per month) — rev 2

> Rev 2: phone/SMS sign-in dropped (owner decision 6a), so the SMS rows no longer apply. Use the "no phone OTP" subtotal.

USD, with TTD at ≈ 6.78. Prices come from vendor pages and 2026 third-party summaries, so **verify before budgeting**. "Users" = registered accounts; assumes ~35% monthly active, 4 runs per active user per month, and ~3 push notifications per active user per week.

## Fixed / one-off
| Item | Cost |
|---|---|
| Apple Developer Program | US$99/yr (≈ $8.25/mo) |
| Google Play developer registration | US$25 one-time |
| Domain | ~US$15–40/yr (`.tt` costs more) |
| D-U-N-S (if organisation account) | free |
| Trademark filing (TT IPO) | not estimated: get a quote |
| Attorney review of legal docs | not estimated: one-off |

## Monthly at scale

| Service | 1,000 users | 10,000 users | 50,000 users | Notes |
|---|---|---|---|---|
| Supabase prod (Pro) | $25 | $25 + ~$50 (Medium compute) = **$75** | $25 + ~$100–200 (Large/XL compute) + optional PITR $100 = **$150–325** | Pro includes 100k MAU, 8 GB DB, 250 GB egress, daily backups |
| Supabase staging | $0 (free org) | $0–10 | $10 | Free projects pause when idle, which is fine for staging |
| Vercel Pro | $20 | $20 | $20–50 | bandwidth overage at 50k depends on public page traffic |
| Expo EAS | $0–19 | $19 | $199 | Starter $19 covers 3k update-MAU; Production $199 covers 50k. Push is free |
| RevenueCat | $0 | $0 | $0–1% of revenue | free under $2.5k monthly tracked revenue |
| Sentry | $0 | $26 | $26–80 | |
| PostHog | $0 | $0 | $0–50 | 1M events/mo free |
| Resend (email) | $0 | $20 | $20–35 | |
| Maps (native SDKs + Embed) | $0 | $0 | $0–20 | only the organiser route-drawer uses a metered API |
| Cloudflare Turnstile | $0 | $0 | $0 | |
| Apple dev (amortised) | $8 | $8 | $8 | |
| **Subtotal (no phone OTP)** | **≈ $55–75** | **≈ $170–180** | **≈ $430–800** | |
| SMS phone OTP (if kept) | ~$30 | ~$250 | ~$600–900 | ~$0.30/SMS to TT (Twilio list price); assumes 30% of users choose phone |
| **Total with phone OTP** | **≈ $85–105** | **≈ $420–430** | **≈ $1,030–1,700** | |

In TTD, without phone OTP: about **TT$370–510**, **TT$1,150–1,220** and **TT$2,900–5,400** per month.

## Not costs, but affect revenue
- Apple/Google commission on Premium: 15% under the Small Business / reduced-fee programs (first $1M/yr), otherwise 30%.
- RevenueCat measures revenue gross (before store commission).

## Biggest levers
1. **Phone/SMS sign-in** is the largest variable cost. Recommendation: drop it at launch (Question 6).
2. Supabase compute size is driven by push fan-out and dashboard aggregation. Pre-aggregated `event_stats_daily` and counters keep it on small instances longer.
3. EAS Update MAU pricing: we can skip over-the-air updates entirely (store builds only) and stay on Starter at 50k users. That saves ~$180/mo but means slower hotfixes.

Confidence in these figures: **0.65**. Vendor prices move, and the usage assumptions (actives, push volume) are guesses until we have real data.
