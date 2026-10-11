# Legal documents — DRAFTS

Status: **DRAFT v2026-10-11-draft. Not legal advice. Must be reviewed by a Trinidad and Tobago attorney before launch.**

- These files are the source of truth. `scripts/sync-legal.ts` loads them into `public.legal_documents`, and the web portal serves them at `/legal/<slug>`.
- Tokens such as `{{operator_name}}` are filled from `app_settings` (`legal.*`) when the page is rendered. Until the operator details are set, pages show a "DRAFT — operator details missing" banner.

| File | Slug / URL | Store use |
|---|---|---|
| privacy-policy.md | `/legal/privacy` | Apple & Google privacy policy URL |
| terms-of-use.md | `/legal/terms` | Apple EULA link on the paywall; Google |
| moderation-policy.md | `/legal/moderation` | UGC policy (Apple 1.2, Google UGC) |
| child-safety-policy.md | `/legal/child-safety` | Google Play child safety standards (CSAE) |
| health-disclaimer.md | `/legal/health` | In-app before tracking; Apple 1.4.1 |
| community-times-notice.md | `/legal/community-times` | Shown on boards and the share screen |
| account-deletion.md | `/delete-account` (page content) | Google's account deletion URL |
| support.md | `/support` (page content) | Apple support URL |

Front matter in each file: `slug`, `title`, `version`.
