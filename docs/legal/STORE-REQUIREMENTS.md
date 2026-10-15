# Store requirements checklist — RunLime (18+, social, fitness, location)

Checked on 2026-10-11 against public sources (Apple App Store Connect help/guidelines coverage, Google Play Console help). **Re-verify every item in Phase 8 before submission.** "Owner" = an action only you can take.

## A. How to answer the age-rating questionnaires for an 18+ app

### Apple (App Store Connect → Age Rating)
Apple's tiers are 4+ / 9+ / 13+ / 16+ / 18+.
1. **Answer every content question truthfully** for what's actually in the app:
   - violence, sexual content, profanity, gambling, alcohol, medical: **None**
   - **User-generated content: Yes.** That covers nicknames, community times and follows.
   - **Messaging/chat: No.** There's no direct messaging in v1.
   - **Unrestricted web access: No.** Only links to organisers' registration pages open in the system browser.
   - **Social media capability** (UGC surfaced through a feed or discovery mechanism, mandatory since Sept 2026): **Yes**. Community boards, discoverable public profiles and followers count as discovery. This sets a 13+ floor.
2. Then **override the rating to 18+**. Apple's guidance says that if your terms set a minimum age above the calculated rating, you must override to a rating that matches. Our Terms say 18+, so choose **18+**.
3. **Age assurance:** we use our own date-of-birth gate plus server enforcement. Apple's Declared Age Range API is not used in v1, which is fine with TT-only distribution (re-check if we expand; see BACKLOG).

### Google Play (Policy → App content)
1. **Target audience and content:** select **18 and over only**. Don't select any under-18 group. That keeps us out of the Families programme and its policies.
2. **IARC content rating questionnaire:**
   - category: Social / Lifestyle
   - violence, sexuality, language, drugs, gambling: none
   - **users can interact or exchange content: Yes** (follows, community times)
   - **shares user location with other users: No** (we never share precise location; check-ins are not shown with coordinates)
   - **digital purchases: Yes** (Premium subscription)
   - unrestricted internet: No
   The IARC rating will probably come out low (e.g. Everyone/Teen with "Users Interact"). That's fine, because the target audience setting (18+) plus our in-app gate is what enforces adults-only.
3. **Store listing:** state "For adults 18+" in the description.

## B. Apple App Store requirements

| # | Requirement | Where it is handled | Status |
|---|---|---|---|
| 1 | Privacy Policy URL (App Store Connect + in-app) | `/legal/privacy`, linked in sign-up and settings | Draft (Phase 1) |
| 2 | Support URL | `/support` | Draft (Phase 1) |
| 3 | In-app account deletion (5.1.1(v)) | Mobile Profile → Delete account (Phase 1) | Built |
| 4 | Sign in with Apple whenever Google sign-in is offered (4.8) | Mobile sign-in screen | Built (needs owner's Apple credentials) |
| 5 | UGC safeguards (1.2): filter objectionable content, report, block, act on reports quickly, published contact | Moderation Policy; report/block in Phases 3 & 6; nickname validation | Policy drafted; features in Phases 3/6 |
| 6 | Privacy "nutrition" labels | Generated from the data model in Phase 8 | Phase 8 |
| 7 | Purpose strings: `NSLocationWhenInUseUsageDescription`, `NSMotionUsageDescription` (steps), `UIBackgroundModes: location` justification | app.config (Phase 5) | Phase 5 |
| 8 | Health & fitness accuracy (1.4.1): no medical claims, estimates labelled | Health Disclaimer; UI labels | Drafted |
| 9 | Subscriptions (3.1.2): price, period, auto-renew terms, links to Terms & Privacy on the paywall, Restore Purchases | Terms §5; paywall in Phase 7 | Terms drafted |
| 10 | No steering to outside payments (3.1.1/3.1.3); no organiser payment UI in the app | Product rule in CLAUDE.md | Enforced by design |
| 11 | Export compliance: the app uses only standard HTTPS/OS encryption → `ITSAppUsesNonExemptEncryption = false` (encryption of emergency contacts happens server-side) | app.config | Built |
| 12 | Review notes + demo account (participant, no MFA) | Phase 8 | Phase 8 |
| 13 | Age rating 18+ (section A) | App Store Connect | Owner, Phase 8 |
| 14 | Availability: **Trinidad and Tobago only** (owner decision, 2026-10-11) | App Store Connect → Pricing & Availability | Decided |

## C. Google Play requirements

| # | Requirement | Where it is handled | Status |
|---|---|---|---|
| 1 | Privacy policy URL (store listing + in-app) | `/legal/privacy` | Draft |
| 2 | **Account deletion web URL** (Data safety form) | `/delete-account` | Built (Phase 1) |
| 3 | Data safety form, from the real data model | Phase 8 (privacy policy §2 is the source) | Phase 8 |
| 4 | **Child Safety Standards (CSAE)** for social apps: (a) published standards against CSAE; (b) in-app reporting; (c) action on CSAM; (d) compliance with child-safety laws incl. reporting to NCMEC/authorities; (e) **designated CSAE point of contact named in Play Console** | `/legal/child-safety`; report reasons incl. child safety (Phases 3/6); setting `legal.child_safety_contact_email` | Policy drafted. **Owner: name the contact person** |
| 5 | Target audience 18+ (section A) | Play Console | Owner, Phase 8 |
| 6 | **Health apps declaration** (required for every app) → "Activity and fitness" | Play Console | Owner, Phase 8 |
| 7 | Location: foreground only (`ACCESS_FINE_LOCATION`), no `ACCESS_BACKGROUND_LOCATION`; **foreground service type `location` declaration** (with a short video if requested); prominent disclosure before the permission prompt | Phase 5 (D6 approved) | Phase 5 |
| 8 | Activity recognition permission for the step counter (`ACTIVITY_RECOGNITION`) with disclosure | Phase 5 | Phase 5 |
| 9 | Subscriptions via Play Billing; clear cancellation info | Phase 7 | Phase 7 |
| 10 | **Target API level:** new apps and updates must target **Android 16 (API 36)** from 31 Aug 2026 | Expo SDK 57 defaults (verify in Phase 8) | Verify |
| 11 | UGC policy: in-app reporting, blocking, moderation, published terms | Moderation Policy; Phases 3/6 | Drafted |
| 12 | Ads declaration: **No ads** | Play Console | Owner, Phase 8 |
| 13 | App access: reviewer test account (participant) | Phase 8 | Phase 8 |
| 14 | Closed testing: 12+ testers for 14 continuous days (personal accounts only) | Depends on the legal-entity answer (open item) | Owner |
| 15 | Financial features / government / news declarations: **none apply** | Play Console | Owner, Phase 8 |
| 16 | Countries: **Trinidad and Tobago only** (owner decision, 2026-10-11) | Play Console → Production → Countries | Decided |
| 17 | **Developer address may be shown publicly.** Google Play may display the developer's address on the store listing for personal developer accounts that offer in-app purchases or subscriptions. RunLime keeps the owner's residential address off its own pages (owner decision, 2026-10-15) | **Check the current Play rule before Phase 7** (Premium). Options then: (a) launch without Premium at first, so no in-app purchases; or (b) incorporate RunLime Limited with an accountant's office as the registered address and publish under an organisation account | **Owner, before Phase 7**

## D. Other things the stores (or the law) will expect for this app
1. **A real legal operator name.** It appears on store listings and in our legal pages. The operator's address is **not** shown on RunLime's pages or in the app (owner decision, 2026-10-15); it is kept in non-public settings for official records. Once the business is registered, the address is public on the Companies Registry (accepted by the owner). The stores may still require or display an address: see C17. The attorney must confirm no address is legally required on the legal pages.
2. **Supabase hosting region:** `us-east-1` (United States), as decided by the owner. The Privacy Policy states that data is stored in the United States.
3. **Attorney review** of every document here, including the Children's Authority hotline numbers in the Child Safety Policy.
4. **Support mailbox** that is actually monitored. Apple and Google both test it.
5. **Moderation staffing:** someone must review reports within the 48 hours promised in the Moderation Policy, with child-safety reports first.
6. **NCMEC reporting:** register as an electronic service provider with the NCMEC CyberTipline before launch, or document the regional reporting route the attorney recommends.
