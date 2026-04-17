# Gateway Listing Video Generator

Generate branded 30-second property listing promo videos for Gateway Real Estate Advisors using HyperFrames.

## Brand Identity

**Colors:**
- Background: `#1E2F39` (navy) or `#152229` (dark navy)
- Accent / CTA: `#C8A84B` (gold)
- Text primary: `#FFFFFF`
- Text secondary: `#E4E3D4` (cream)
- Text muted: `#A2B6C0` (blue-gray)

**Fonts:**
- Headlines / display: `EB Garamond` (serif, elegant)
- Body / labels / stats: `Montserrat` (sans-serif, clean)

**Logos (reference from project root):**
- Horizontal: `./brand/logo-horizontal.svg` — use as watermark top-left on all scenes
- Stacked: `./brand/logo-stacked.svg` — use large and centered on final CTA scene

**GSAP:** Always load from `./node_modules/gsap/dist/gsap.min.js` (local, not CDN)

## Workflow

When the user invokes `/listing-video`, follow these steps:

### Step 1 — Collect property details
Ask the user for (or extract from their message):
- Address
- Price
- Beds / Baths
- Key features (up to 4 bullet points)
- Agent name(s)
- Photos (dropped in chat — extract from transcript as shown below)

### Step 2 — Extract photos from transcript

```python
import json, base64, os

transcript = os.path.expanduser(
    "~/.claude/projects/" + 
    os.getcwd().replace("/", "-").lstrip("-") +
    "/<latest>.jsonl"
)
# Find the most recent user message with images
images = []
with open(transcript) as f:
    for line in f:
        obj = json.loads(line)
        msg = obj.get("message", {})
        if msg.get("role") == "user":
            for block in msg.get("content", []):
                if isinstance(block, dict) and block.get("type") == "image":
                    images.append(block["source"]["data"])

# Save last N images as photos
for i, data in enumerate(images[-len(photos_expected):]):
    with open(f"./media/photo{i+1}.jpg", "wb") as f:
        f.write(base64.b64decode(data))
```

Run this via Bash tool to save photos to `./media/photo1.jpg`, `./media/photo2.jpg`, etc.

### Step 3 — Generate composition

Create `/home/user/nebraska-promo/index.html` (or a new project dir) using the template below.
The composition project must be a **separate directory** from the GitHub Pages repo root.

Use `npx hyperframes init /home/user/<slug>-promo` to scaffold, then replace `index.html`.
Copy media files and `node_modules/` (or run `npm install gsap` in the new dir).

### Step 4 — Render

```bash
npx hyperframes render /home/user/<slug>-promo --quality high --fps 30
```

Output: `/home/user/GatewayHQ.github.io/renders/<slug>-promo_<timestamp>.mp4`

### Step 5 — Commit and serve download link

```bash
# In GatewayHQ.github.io repo:
git add renders/<file>.mp4
git commit -m "Add listing video: <address>"
git push -u origin <branch>
```

Then use `mcp__github__get_file_contents` to get the raw GitHub download URL.

---

## Composition Template

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=1920, height=1080"/>
  <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600;700&family=Montserrat:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="./node_modules/gsap/dist/gsap.min.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:1920px; height:1080px; overflow:hidden; background:#1E2F39; }
    body { font-family:'Montserrat',sans-serif; color:#fff; }

    #root { position:relative; width:1920px; height:1080px; overflow:hidden; }

    /* Scenes */
    .scene { position:absolute; inset:0; opacity:0; background:#1E2F39; }

    /* Logo watermark — top-left every scene */
    .logo-mark {
      position:absolute; top:48px; left:64px;
      width:320px; opacity:0; z-index:10;
    }

    /* Photo backgrounds */
    .photo-bg {
      position:absolute; inset:0;
      width:100%; height:100%; object-fit:cover; opacity:0;
    }
    .photo-overlay {
      position:absolute; inset:0;
      background:linear-gradient(to bottom,
        rgba(21,34,41,0.15) 0%,
        rgba(21,34,41,0.6) 55%,
        rgba(21,34,41,0.95) 100%);
    }

    /* Scene 1: Hero */
    .s1-content { position:absolute; bottom:130px; left:120px; right:120px; }
    .eyebrow {
      font-size:12px; font-weight:600; letter-spacing:5px;
      text-transform:uppercase; color:#A2B6C0; margin-bottom:20px;
      opacity:0; display:block;
    }
    .address {
      font-family:'EB Garamond',Georgia,serif;
      font-size:96px; font-weight:600; line-height:1;
      color:#fff; letter-spacing:-1px;
      opacity:0; transform:translateY(32px);
    }
    .price {
      font-size:52px; font-weight:300; color:#E4E3D4;
      margin-top:20px; opacity:0; transform:translateY(20px);
    }
    .price span { color:#C8A84B; font-weight:700; }

    /* Gold accent bar */
    .gold-bar {
      position:absolute; bottom:0; left:0;
      width:100%; height:4px; background:#C8A84B; opacity:0;
    }

    /* Scene 2: Features */
    #scene-2 { display:flex; flex-direction:column; justify-content:center; padding:0 160px; }
    .section-label {
      font-size:12px; font-weight:600; letter-spacing:5px;
      text-transform:uppercase; color:#C8A84B; margin-bottom:52px; opacity:0;
    }
    .features-list { list-style:none; }
    .feature-item {
      display:flex; align-items:center; gap:36px;
      padding:30px 0; border-bottom:1px solid rgba(255,255,255,0.08);
      opacity:0; transform:translateX(-48px);
    }
    .features-list li:first-child { border-top:1px solid rgba(255,255,255,0.08); }
    .feature-num { font-size:12px; font-weight:700; color:#C8A84B; width:24px; flex-shrink:0; }
    .feature-text { font-size:40px; font-weight:400; color:#E4E3D4; letter-spacing:-0.3px; }
    .feature-text strong { font-weight:700; color:#fff; }

    /* Scene 3: Stats */
    #scene-3 { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:64px; }
    .stats-heading {
      font-size:12px; font-weight:600; letter-spacing:5px;
      text-transform:uppercase; color:#A2B6C0; opacity:0;
    }
    .stats-grid { display:grid; grid-template-columns:repeat(3, 380px); gap:2px; }
    .stat-card {
      background:#152229; padding:72px 40px 64px; text-align:center;
      opacity:0; transform:scale(0.88);
    }
    .stat-card:first-child { border-radius:16px 0 0 16px; }
    .stat-card:last-child  { border-radius:0 16px 16px 0; }
    .stat-value {
      font-family:'EB Garamond',Georgia,serif;
      font-size:88px; font-weight:600; color:#fff; line-height:1;
    }
    .stat-unit { font-size:40px; font-weight:300; color:#C8A84B; }
    .stat-label {
      font-size:13px; font-weight:500; letter-spacing:3px;
      text-transform:uppercase; color:#A2B6C0; margin-top:16px;
    }

    /* Scene 4: CTA */
    #scene-4 .photo-bg { filter:brightness(0.22) saturate(0.4); }
    .s4-overlay { position:absolute; inset:0; background:rgba(21,34,41,0.55); }
    .s4-content {
      position:absolute; inset:0;
      display:flex; flex-direction:column; align-items:center;
      justify-content:center; text-align:center; padding:80px;
    }
    .logo-stacked { width:280px; opacity:0; margin-bottom:56px; }
    .cta-heading {
      font-family:'EB Garamond',Georgia,serif;
      font-size:88px; font-weight:600; color:#fff;
      letter-spacing:-1px; line-height:1.02;
      opacity:0; transform:translateY(32px);
    }
    .gold-divider { width:60px; height:2px; background:#C8A84B; margin:44px auto; opacity:0; }
    .agent-names { font-size:32px; font-weight:500; color:#E4E3D4; opacity:0; }
    .brokerage {
      font-size:14px; font-weight:500; letter-spacing:4px;
      text-transform:uppercase; color:#A2B6C0; margin-top:10px; opacity:0;
    }
    .tagline {
      font-size:13px; font-weight:400; letter-spacing:3px;
      text-transform:uppercase; color:#C8A84B; margin-top:28px; opacity:0;
    }

    /* Fade overlay */
    #fade-overlay {
      position:absolute; inset:0; background:#152229;
      opacity:0; pointer-events:none; z-index:999;
    }
  </style>
</head>
<body>
<div id="root"
  data-composition-id="listing-promo"
  data-start="0"
  data-duration="30"
  data-width="1920"
  data-height="1080">

  <!-- Scene 1: Hero -->
  <div id="scene-1" class="scene">
    <img class="photo-bg" id="photo1" src="./photo1.jpg" alt="">
    <div class="photo-overlay"></div>
    <img class="logo-mark" src="../GatewayHQ.github.io/brand/logo-horizontal.svg" alt="Gateway">
    <div class="s1-content">
      <span class="eyebrow">Gateway Real Estate Advisors</span>
      <h1 class="address"><!-- ADDRESS --></h1>
      <p class="price">Listed at <span><!-- PRICE --></span></p>
    </div>
    <div class="gold-bar"></div>
  </div>

  <!-- Scene 2: Features -->
  <div id="scene-2" class="scene">
    <img class="logo-mark" src="../GatewayHQ.github.io/brand/logo-horizontal.svg" alt="Gateway">
    <p class="section-label">Key Features</p>
    <ul class="features-list">
      <!-- FEATURE ITEMS: copy as needed -->
      <li class="feature-item">
        <span class="feature-num">01</span>
        <span class="feature-text"><strong><!-- FEATURE 1 TITLE --></strong> — <!-- FEATURE 1 DETAIL --></span>
      </li>
    </ul>
  </div>

  <!-- Scene 3: Stats -->
  <div id="scene-3" class="scene">
    <img class="logo-mark" src="../GatewayHQ.github.io/brand/logo-horizontal.svg" alt="Gateway">
    <p class="stats-heading">Property at a Glance</p>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value"><!-- BEDS --></div>
        <div class="stat-label">Bedrooms</div>
      </div>
      <div class="stat-card">
        <div class="stat-value"><!-- BATHS --><span class="stat-unit"><!-- .5 if applicable --></span></div>
        <div class="stat-label">Bathrooms</div>
      </div>
      <div class="stat-card">
        <div class="stat-value"><!-- STAT --><span class="stat-unit"><!-- UNIT --></span></div>
        <div class="stat-label"><!-- STAT LABEL --></div>
      </div>
    </div>
  </div>

  <!-- Scene 4: CTA -->
  <div id="scene-4" class="scene">
    <img class="photo-bg" id="photo2" src="./photo2.jpg" alt="">
    <div class="s4-overlay"></div>
    <div class="s4-content">
      <img class="logo-stacked" src="../GatewayHQ.github.io/brand/logo-stacked.svg" alt="Gateway">
      <h2 class="cta-heading">Schedule a Tour Today</h2>
      <div class="gold-divider"></div>
      <p class="agent-names"><!-- AGENT NAMES --></p>
      <p class="brokerage">Gateway Real Estate Advisors</p>
      <p class="tagline">Opening Doors to Your Future</p>
    </div>
  </div>

  <div id="fade-overlay"></div>
</div>

<script>
window.__timelines = window.__timelines || {};
const overlay = document.getElementById('fade-overlay');
const s1 = document.getElementById('scene-1');
const s2 = document.getElementById('scene-2');
const s3 = document.getElementById('scene-3');
const s4 = document.getElementById('scene-4');
const photo1 = document.getElementById('photo1');
const photo2 = document.getElementById('photo2');
const tl = gsap.timeline({ paused: true });

// Scene 1: Hero (0–8.5s)
tl
  .set(s1, { opacity:1 }, 0)
  .to(photo1, { opacity:1, duration:1.8, ease:'power2.out' }, 0)
  .to(s1.querySelector('.gold-bar'), { opacity:1, duration:0.6, ease:'power2.out' }, 0.5)
  .to(s1.querySelector('.logo-mark'), { opacity:1, duration:0.7, ease:'power2.out' }, 0.7)
  .to(s1.querySelector('.eyebrow'), { opacity:1, duration:0.7, ease:'power2.out' }, 1)
  .to(s1.querySelector('.address'), { opacity:1, y:0, duration:1, ease:'power3.out' }, 1.5)
  .to(s1.querySelector('.price'), { opacity:1, y:0, duration:0.9, ease:'power3.out' }, 2.3)

// Transition 1→2 (t=8)
tl
  .to(overlay, { opacity:1, duration:0.4, ease:'power2.inOut' }, 8)
  .set(s1, { opacity:0 }, 8.35)
  .set(s2, { opacity:1 }, 8.35)
  .to(overlay, { opacity:0, duration:0.4, ease:'power2.inOut' }, 8.45)

// Scene 2: Features (8.5–16s)
tl
  .to(s2.querySelector('.logo-mark'), { opacity:1, duration:0.6, ease:'power2.out' }, 8.8)
  .to(s2.querySelector('.section-label'), { opacity:1, duration:0.6, ease:'power2.out' }, 9)
  .to(s2.querySelectorAll('.feature-item'), {
    opacity:1, x:0, duration:0.75, ease:'power3.out', stagger:0.45
  }, 9.6)

// Transition 2→3 (t=16)
tl
  .to(overlay, { opacity:1, duration:0.4, ease:'power2.inOut' }, 16)
  .set(s2, { opacity:0 }, 16.35)
  .set(s3, { opacity:1 }, 16.35)
  .to(overlay, { opacity:0, duration:0.4, ease:'power2.inOut' }, 16.45)

// Scene 3: Stats (16.5–23s)
tl
  .to(s3.querySelector('.logo-mark'), { opacity:1, duration:0.6, ease:'power2.out' }, 16.7)
  .to(s3.querySelector('.stats-heading'), { opacity:1, duration:0.6, ease:'power2.out' }, 17)
  .to(s3.querySelectorAll('.stat-card'), {
    opacity:1, scale:1, duration:0.75, ease:'back.out(1.5)', stagger:0.2
  }, 17.6)

// Transition 3→4 (t=23)
tl
  .to(overlay, { opacity:1, duration:0.4, ease:'power2.inOut' }, 23)
  .set(s3, { opacity:0 }, 23.35)
  .set(s4, { opacity:1 }, 23.35)
  .to(overlay, { opacity:0, duration:0.4, ease:'power2.inOut' }, 23.45)

// Scene 4: CTA (23.5–30s)
tl
  .to(photo2, { opacity:1, duration:1.4, ease:'power2.out' }, 23.5)
  .to(s4.querySelector('.logo-stacked'), { opacity:1, duration:0.8, ease:'power2.out' }, 24)
  .to(s4.querySelector('.cta-heading'), { opacity:1, y:0, duration:1, ease:'power3.out' }, 24.8)
  .to(s4.querySelector('.gold-divider'), { opacity:1, duration:0.5, ease:'power2.out' }, 25.7)
  .to(s4.querySelector('.agent-names'), { opacity:1, duration:0.6, ease:'power2.out' }, 26.1)
  .to(s4.querySelector('.brokerage'), { opacity:1, duration:0.5, ease:'power2.out' }, 26.5)
  .to(s4.querySelector('.tagline'), { opacity:1, duration:0.5, ease:'power2.out' }, 27)

window.__timelines['listing-promo'] = tl;
</script>
</body>
</html>
```

---

## Quick-Start Checklist

When invoked, do the following in order:

1. Collect property info (address, price, beds, baths, features, agent names)
2. Ask user to drop photos in chat; extract via transcript script above
3. `npx hyperframes init /home/user/<slug>-promo` 
4. `cd /home/user/<slug>-promo && npm install gsap`
5. Replace `index.html` with the filled-in template above
6. Copy photos to `/home/user/<slug>-promo/photo1.jpg` etc.
7. `npx hyperframes lint /home/user/<slug>-promo` — fix any errors
8. `npx hyperframes render /home/user/<slug>-promo --quality high --fps 30`
9. `git add renders/<file>.mp4 && git commit && git push`
10. Use `mcp__github__get_file_contents` to get the raw download URL for the user
