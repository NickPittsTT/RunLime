# BACKLOG — ideas outside the current scope

Not to be built without explicit owner approval.

- Phone sign-in (SMS ~US$0.30/msg to TT, or WhatsApp OTP). Owner decision 6a: not at launch.
- QR code check-in (scanner, organiser poster, QR landing page). Removed from v1 (S2).
- Race photo sharing (S3).
- Apple HealthKit / Android Health Connect sync.
- Offline map tiles (MapLibre + region packs).
- Apple Declared Age Range / Google Play Age Signals integration. Not needed while distribution is TT-only and accounts are 18+; revisit on expansion.
- Card payment gateway for organisers (payment layer designed for it). Owner: not in v1 — manual bank transfer only.
- **Caribbean expansion** (planned). Schema already stores country, currency and timezone per event and organiser, plus regions per country. Each new country needs:
  1. **Store availability:** add the country in App Store Connect (Pricing & Availability) and Play Console (Countries/regions). Check local pricing tiers for Premium.
  2. **Legal review:** a local attorney reviews the Privacy Policy, Terms and Child Safety Policy against that country's data-protection, consumer and child-protection laws. Note cross-border transfer rules, since data is stored in the United States. Add country-specific emergency and child-protection contacts.
  3. **Age rules:** confirm 18+ still meets local law (age of majority / digital consent). Check whether local app-store age-verification laws apply, which would mean Apple Declared Age Range / Google Play Age Signals. The 18+ minimum never goes down.
  4. **Currency:** add a `countries` row (currency, timezone), organiser listing prices in that currency (settings), invoice numbering and tax/VAT rules, and the bank-transfer details for that country.
  5. **Data:** regions/areas for that country, a timezone per event, translations if needed.
  6. **Operations:** local support hours, moderation coverage, organiser verification process.
- Wear OS / Apple Watch companion.
- Audio cues during runs.
- Self-hosted PostHog for full data residency.
