# Gateway Agent Toolkit: Audit, November 2026

Read-only audit run on 2026-11-09 against `main` @ `5e84057` (branch `toolkit-refresh-2026-11`).
Method: served locally (`python3 -m http.server`), driven with headless Chromium/Playwright
at 1280px and 390px, plus code reading. Line numbers refer to the audited commit.

## 1. Tool inventory (landing page)

All 9 cards navigate correctly and render with **zero JS console errors**. The only 404 is
`config.js`, which is git-ignored and expected to be missing.

| Tool | Page / module | Last commit | Status |
|---|---|---|---|
| Social Media Builder | `page-social` / `app/social.js` | 2026-06-09 | Works. Overlaps with Graphics; Open House is weak (see 3c, 3d). Buffer bar on top. |
| Multifamily OM Builder | `page-multifamily` / `app/multifamily.js` | 2026-07-01 | Loads. Has an admin password fallback (3k). |
| Leasing OM Builder | `page-leasing` / `app/leasing.js` | 2026-05-26 | Loads, no errors. |
| Valuation Tool | `page-valuation` / `app/valuation.js` | 2026-05-26 | Loads, no errors. |
| Invoice Generator | `page-invoice` / `app/invoice.js` | 2026-05-26 | Loads, no errors. |
| Home Valuation Generator | `page-home-valuation` / `app/home-valuation.js` | 2026-05-26 | Loads. Rentcast comps need a key (not exercised, since it costs money). |
| Video Generator | `page-video` / `app/video/*` | 2026-07-15 | Loads, no errors. |
| Social & Mailer Graphics | `page-graphics` / `app/social/*` | 2026-06-02 | Works. Strongest output; becomes the main social tool. |
| Photo Enhancer | `page-photo-enhancer` / `app/photo-enhancer.js` | 2026-07-21 | Loads, no errors. |

Not exercised on purpose: Buffer (`/api/buffer*` was blocked in the test browser), AI calls, and Rentcast.

## 2. Social tools, field by field

### Social Media Builder (`page-social`, `app/social.js`, 3,477 lines)
- **Templates:** 3 premium commercial templates (Exclusively Offered, Investment Alert,
  Just Sold Premium); 8 generic headings (Just Listed, Just Sold, Under Contract, For Sale,
  For Lease, Just Leased, Price Reduced, Investment Opportunity); and 6 residential
  (New Listing, Just Sold, Under Contract, Open House, Price Reduced, Coming Soon).
- **Fields:** heading, property name, address, price; residential beds, baths, SF, lot,
  garage, year; commercial SF, rate, detail; about 20 toggleable metrics (price/unit,
  price/SF, units, cap, NOI, year built, occupancy, lot, building SF, zoning, market badge,
  DOM, submarket, class, financing, SF, unit mix); a unit-mix table; condensed mode;
  photo enhance; saved presets; QR; mailers.
- **Size:** one 1080×1350 canvas. The "Square" export is a center crop (3d).
- **Export:** PNG via `toDataURL`, plus Buffer Send Now and Schedule.

### Social & Mailer Graphics (`page-graphics`, `app/social/*.js`, about 720 lines)
- **Templates (8):** Just Listed, Just Closed, Open House, For Lease, Coming Soon,
  By the Numbers, Testimonial, Meet the Advisor.
- **Fields:** property type (Commercial / Residential), template, theme, size, headline,
  city, subtitle, kicker, photo, 0–4 generic stat value/label rows, Agent 1 and Agent 2
  (name, phone, title, headshot), and brokerage (editable).
- **Themes:** Luxe Dark, Slate, Ivory.
- **Sizes:** 1080×1350, 1080×1080, 1080×1920, 1200×1200 (labelled "LinkedIn", but not the
  1200×628 feed size), and a 6×4 postcard at 300 dpi.
- **Export:** PNG of the current size, plus an "All social sizes" zip via JSZip, rendered
  off-screen at full resolution. File name is `<title-slug>_<sizeId>.png`.
- **Extras:** AI caption with no Fair Housing rules in the prompt; no profile save.

## 3. Known issues

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| a | Two overlapping social tools | **Confirmed** | `index.html:106` and `index.html:150`; both make listing graphics. |
| b | Open House, For Lease, and Coming Soon reuse the Just Listed renderer; date/time are generic stats | **Confirmed** | `app/social/templates.js:228-230`, `app/social/main.js:26` |
| c | Builder Residential Open House has no date/time and draws emoji | **Confirmed** | No date/time inputs; emoji drawn at `app/social.js:988-989`; "YOU ARE INVITED!" at `:980` |
| d | `downloadSocialSquare()` center-crops | **Confirmed** | `app/social.js:3247` cuts 135px off the top and bottom. |
| e | Two-agent footer hides the brokerage when titles are filled | **Confirmed (compliance)** | `app/social/templates.js:53` (`!anyTitle`) |
| f | No saved agent profile; `agents.json` has 2 agents | **Confirmed** | `app/social/main.js` has no storage; `data/agents.json` |
| g | Every card says NEW | **Mostly confirmed** | 8 of 9 say NEW; Multifamily says READY (`index.html:111-159`). |
| h | Montserrat vendored at 400/600/800, but drawn at 700 | **Confirmed** | `app/social/templates.js:48,49,56,57`. Canvas falls back to the Google Fonts 700 when online, or to a synthesized weight offline, so exports are inconsistent. |
| i | Nav overflows at 390px; preview is below a long form | **Confirmed** | `.top-nav` scrollWidth is 527px at a 390px viewport; the Graphics canvas top is at y=1385px. |
| j | `CLAUDE.md` is stale | **Confirmed** | "any branch deploys" (`CLAUDE.md:11,89`); `compositions/` (`:53,238`) and `render-listing-video.yml` (`:121`) don't exist. |
| k | Hardcoded login password; admin password fallback | **Confirmed. Flagged only, not changed.** | `app/core.js:110`; `app/multifamily.js:4841,4931`. The same literal also appears in `.github/workflows/ci.yml` (secret-scan grep). Values intentionally not reproduced here. |

## 4. Punch list, ranked by agent-adoption impact

**P0: blocks weekly use or is a compliance risk**
1. A dedicated Open House template with real date/time fields and zero setup. (Slice 1) `app/social/templates.js:228`
2. The brokerage name must always show in the two-agent footer. (Slice 1) `app/social/templates.js:53`
3. Save an agent profile so agents don't retype their name, phone, and headshot every time. (Slice 3) `app/social/main.js:94`
4. One home for social: make Graphics the main tool and relabel the Builder "Classic". (Slice 3) `index.html:106,150`
5. The AI caption prompt has no Fair Housing or superlative guard. (Slice 3 / quality bar) `app/social/ai.js:18-24`
6. Auth: a client-side password in a public repo gives no real protection. Recommendation for Daniel only. `app/core.js:110`

**P1: friction and stale signals**
1. Mobile: nav overflows at 390px, and the preview is buried under the form. (Slice 3) `styles/nav.css:2`, `index.html:1591`
2. Draw only vendored weights (no 700). (Slice 1) `app/social/templates.js:48-57`
3. Missing residential starters: Under Contract, Just Sold with represented side, Price Improvement. (Slice 2) `app/social/templates.js:225`
4. Missing CRE starters: Offering with a metric picker, Deal Tombstone, Market Snapshot with a source line. (Slice 2) `app/social/templates.js:231`
5. Replace the blanket NEW tags with dated "Updated" tags and a What's New row. (Slice 3) `index.html:111-159`
6. Builder Square export crops the header and footer. (Slice 3) `app/social.js:3247`
7. Builder Open House draws emoji and has no date/time. Superseded by the Graphics Open House; leave it in Classic. `app/social.js:988`
8. Graphics has no 1200×628 landscape size; "LinkedIn" is 1200×1200. (Slice 1) `app/social/design-tokens.js:60`
9. Export file names don't include the template, and the zip is labelled by size id, not pixels. (Slice 1) `app/social/export.js:39`
10. No low-resolution photo warning. (Slice 1) `app/social/main.js:167`

**P2: hygiene**
1. Fix `CLAUDE.md` to say deploys come from `main`, and remove the dead `compositions/` and render-workflow references. `CLAUDE.md:11,53,89,121,238`
2. The landing hero says "Select a tool to get started"; it could surface Recently Used and What's New first. `index.html:99`
3. `data/agents.json` lists only 2 agents; add placeholders for the rest, with no invented details. `data/agents.json`
4. `brand.json` accent (`#C8A84B`) differs from the Slate accent (`#9BB4C0`) in tokens. Documented, intentional per theme. `brand/brand.json:5`
5. The Builder's Buffer bar sits above the form on every visit, even when Buffer isn't connected. `index.html:171`
6. The ci.yml secret scan embeds the literal password it searches for. Move to a hash or regex when auth changes. `.github/workflows/ci.yml`
