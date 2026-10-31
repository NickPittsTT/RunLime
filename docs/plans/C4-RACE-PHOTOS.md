# C4: Race photo sharing (S3), plan only

Status: **planned, not built** (owner, 31 Oct 2026). Nothing in this document is in the app, and the published legal drafts don't describe it yet (see §8).

## 1. When: recommendation
**Right after the real-race pilot, as "Phase 6b", before Phase 7.** Not inside Phase 6.

| | After the pilot (recommended) | Inside Phase 6 |
|---|---|---|
| Depends on | GPS check-in (Phase 4); can reuse Phase 6 reporting and blocking work | The same, but adds to Phase 6, which is already the largest phase |
| Pilot | The pilot tests check-in, tracking, community times and leaderboards without a photo moderation load | The pilot also has to test photo moderation with ~10 friends: little real signal |
| Legal | Disclaimer and Terms clauses go to the attorney with the launch review (attorney review is required before public launch anyway) | Pilot runs under draft terms with a photo disclaimer no attorney has seen |
| Storage | Sized from pilot numbers (real photos per race) | Estimate only (§6) |
| Schedule effect | About +6–9 working days after the pilot | Same work, but it delays the pilot |

Confidence in the recommendation: 0.75. The main argument against it: race photos are a strong reason for runners to keep the app after the pilot, so building them first could make the pilot livelier. If that matters more to you than a simpler pilot, put it at the end of Phase 6.

## 2. Owner requirements → design
| Requirement (owner, 31 Oct) | Design |
|---|---|
| Only runners with a GPS check-in for that race can post | Upload goes through an Edge Function (`race-photo`) that checks a Phase 4 check-in row for (runner, race); the database insert policy repeats the check, so no other path exists |
| Uploader ticks "I took this photo or have permission to share it. Everyone identifiable agreed. No child is the main subject." | Required tick on every upload (not remembered); stored as `consent_at` + statement version on the photo row; the server refuses an upload without it |
| Disclaimer in the app and the Terms ("shared at the user's own risk"), attorney flag | Shown above the upload button and on every race photo gallery; Terms clause in §8; attorney question listed |
| Visibility follows the uploader's privacy (Private: followers only; Public: everyone signed in) | Same rule as profile photos (`can_view_avatar` → generalised to `can_view_user_content(uploader)`); private storage bucket `race-photos` with short-lived signed links, as for profile photos (31 Oct). Never visible signed out or on the public website |
| Reuse Report, admin removal queue, admin alerts; new priority report type "This is a photo of me / I want it removed" | New report category `photo_of_me`, treated like child-safety for alerts (bell + phone at once, email at once) and listed first. **Decision needed (§9.2):** hide the photo as soon as such a report arrives, until an admin reviews it |
| GPS/EXIF stripped (reuse the profile photo pipeline); location never shown | Same pipeline: re-encoded on the phone (drops metadata), stripped again on the server, JPEG only; no location field anywhere; no map of photos |
| Per-runner per-race limit (setting, default 5); compression | Setting `photos.per_runner_per_race` = 5; phone resizes to 1600 px on the long edge, JPEG quality 0.8 (about 250–450 KB), plus a 400 px thumbnail (about 30–50 KB) for galleries |
| Storage estimate against the Supabase free tier | §6 |
| Recheck Google Play and Apple UGC rules; say what else they require | §5 |

Also, following existing rules:
- the uploader can delete their own photo at any time;
- deleting the account deletes the files;
- photos are included in the data export (filenames and dates);
- blocking hides each other's photos;
- no likes, comments or prizes in v1 (BACKLOG for later).

## 3. Data model (sketch)
- `race_photos`: `id`, `event_id`, `uploader_id`, `path`, `thumb_path`, `consent_at`, `consent_version`, `status` (`visible` | `hidden_pending_review` | `removed`), `removed_reason`, `created_at`.
  - Row security: insert only through the Edge Function (service role) after the check-in and limit checks.
  - Select through `can_view_user_content(uploader_id)` and `status = 'visible'`, or the uploader, or MFA admins.
  - Audit-logged (allowlisted columns, alias for the uploader).
- Bucket `race-photos`: private; select policy uses the same rule; no user write policies.
- Settings:
  - `photos.per_runner_per_race` (5);
  - `photos.max_upload_bytes` (1 MB after compression);
  - `photos.enabled` (off until launch of the feature).
- pgTAP:
  - posting needs a check-in;
  - the limit applies;
  - the consent tick is required;
  - Private/Public visibility, followers, blocks;
  - "photo of me" hides the photo (if chosen);
  - admin removal;
  - account deletion removes the files;
  - no anon access.

## 4. Screens (sketch)
- Race page (after check-in): **Add photos** (system photo picker, no media permission), the tick, the disclaimer, and an "N of 5 left" count.
- Race page: **Photos from runners** gallery (thumbnails; tap for full size). Report on each photo, with "This is a photo of me" first.
- Admin → Reports: photo shown through a signed link; Remove photo; "photo of me" reports first.

## 5. Store rules (rechecked 31 Oct 2026)
**Apple, App Review Guideline 1.2 (read in full today):** UGC apps must have:
- a method for filtering objectionable material from being posted;
- a way to report offensive content, with timely responses;
- the ability to block abusive users;
- published contact information.

Apple names "nonconsensual intimate imagery" as a specific risk, and says the developer must remove violating content. 5.1.1 asks for the out-of-process photo picker rather than full Photos access.

**Google Play, User Generated Content policy + Child Safety Standards:** the sources are the ones read for Phase 3 (`docs/phase-3/POLICY-CHECK.md`). Google's help site is blocked in this cloud session, so today's recheck used secondary summaries. Google's help page says it is updating the UGC policy (incidental sexual content and moderation guidance); recheck the live text before building. Requirements:
- users accept the terms (which define objectionable content) before posting, and can't skip that step;
- in-app reporting of users and content;
- blocking;
- robust ongoing moderation;
- incidental sexual content must be removed or hidden (never allowed if illegal or child endangerment);
- the Child Safety Standards: published standards, in-app reporting, acting on CSAM, a child-safety contact.

**What race photos add beyond what RunLime already has:**
1. **Filtering before posting (Apple 1.2 "filtering objectionable material").** Profile photos rely on reports after posting. A gallery of other people's photos is a bigger exposure. Options:
   - (a) a pre-publication check: an admin approves each photo; slow, but free;
   - (b) an automated image-safety scan; it needs a new third-party service, a register row, a Privacy Policy update and an owner decision; free tiers exist but have limits;
   - (c) post-moderation only (report + 48 h review), as for profile photos; the weakest answer to 1.2.

   **Decision needed (§9.1).** My recommendation: (a) for the first weeks, then decide on (b) from the volume.
2. **People who never agreed (bystanders, other runners).** The uploader's tick is the main safeguard. The "This is a photo of me" report must work for people with no account too: a web form on the support page, because a bystander may not have the app.
3. **Children at races.** Children attend; the tick says no child is the main subject. Reports involving a child go through the existing child-safety path (urgent).
4. **Data safety form / App Privacy label (Phase 8):** add "Photos" as user content shared with other users, and keep "location not collected" true by stripping EXIF.
5. **Terms acceptance before posting:** existing sign-up acceptance covers it if the Terms version that adds §8 is accepted again. A Terms change means asking existing users to accept the new version before they can post photos.
6. No camera permission: use the system picker only (as for profile photos), so no camera or media permission is added.

## 6. Storage estimate (Supabase Free: 1 GB file storage, 5 GB egress a month, shared with everything else)
Assumptions: an average race has 150 RunLime runners checked in; 20% post photos; 3 photos each (limit 5); 400 KB full + 40 KB thumbnail.
- Per race: 90 photos × 440 KB ≈ **40 MB stored**.
- Free storage: about **20 races** in total before the 1 GB limit (profile photos use little: 1,000 runners × 60 KB ≈ 60 MB).
- Egress per race: 300 viewers × 20 thumbnails (0.8 MB) + 30 full photos (12 MB) ≈ **3.8 GB**. **This passes the 5 GB monthly egress allowance after one or two busy races.**
- Conclusion: the free tier covers the pilot only. For launch, choose one of:
  - **Supabase Pro (cost, about US$25/month, already planned at launch):** 100 GB storage and 250 GB egress included;
  - **Cloudflare R2 for photo files:** 10 GB storage free, no egress fees; a new service, so a register row, a Privacy Policy update and your decision.

  Also options: delete race photos after a set time (setting, e.g. 12 months), and keep the 5-photo limit.

## 7. Work estimate
- Backend: table, bucket, policies, Edge Function, settings, report type, alerts, pgTAP. About 3 days.
- App: upload flow, gallery, report option. About 2–3 days.
- Website: admin queue changes, "photo of me" web form. About 1 day.
- Legal text, store forms notes, RETEST. About 1 day.
- Total about 6–9 working days. Moderation option (b) adds 1–2 days plus the new service.

## 8. Legal drafts: text ready to insert when the feature is built
These are not in `docs/legal/` yet on purpose: those pages are published to the live site and the pilot. Describing a feature that doesn't exist would mislead pilot users. They go in with the feature, as a new Terms version that users accept again.

**Terms of Use, new §6A "Race photos" (draft):**
> Runners who checked in at a race with GPS can share photos taken at that race. You may share a photo only if you took it or have permission to share it, everyone who can be identified in it agreed, and no child is the main subject. Photos are shared at your own risk: once others have seen a photo, RunLime cannot control copies they make. You keep the rights to your photos and give RunLime a licence to store and show them to the people your privacy setting allows, for as long as you keep them in RunLime. We may remove any photo that breaks these Terms or our Moderation Policy. Anyone (including people without a RunLime account) can ask us to remove a photo of themselves through the in-app report or our support page; we review these first.

**Privacy Policy additions (draft):**
- What we collect: "Race photos you choose to share (with the date and the race). We remove location and other hidden details (EXIF data) before they are stored. We never show where a photo was taken."
- Who sees it: "On a Private account, only your approved followers; on a Public account, everyone signed in. Never on the public website."
- How long: "Until you delete the photo or your account, or we remove it for breaking our rules [or after N months, if you choose a retention limit]."
- If a removal request names you: "We use what you tell us only to find and review the photo."

**Attorney questions:**
1. Is "shared at your own risk" enforceable and adequate in Trinidad and Tobago?
2. Are consent ticks for identifiable people sufficient, given the Data Protection Act 2011 (parts in force)?
3. Removal requests from people without an account.
4. Photos where a child appears in the background.
5. The licence wording.

## 9. Decisions needed before building
1. Filtering before posting: (a) admin approval first, (b) automated scan (new service), or (c) reports only. Recommendation: (a) at first.
2. Hide a photo as soon as someone reports "this is a photo of me", until reviewed? Recommendation: yes. The risk is someone hiding others' photos by misuse; repeat misuse is handled like other abuse.
3. Retention: keep until deleted, or delete after N months (setting)?
4. At launch: Supabase Pro storage, or Cloudflare R2 for photo files?
