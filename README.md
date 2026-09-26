# Laya Feed Control

> **Privacy-first, client-side social feed control powered by Laya's System 1 non-autoregressive decision engine.**

**Laya Feed Control** is a high-performance Chromium Manifest V3 browser extension (for Google Chrome and Microsoft Edge) that provides fine-grained, evidence-based, client-side control over social media feeds and web discussions. It integrates multi-select hierarchical topic filtering, keyword/creator preferences, an evidence-backed misinformation engine with a dedicated India preset, a universal real-time multilingual abuse and obfuscation guard across `<all_urls>`, an intrinsic adult/pornographic content safety filter, and smooth short-form video navigation (Shorts, Reels, TikTok) powered by local WebGPU inference.

---

## 1. Core Capabilities & Scope

### Multi-Select Topic Filtering (ANY vs ALL)
- Custom hierarchical topic taxonomy (`Education -> Mathematics -> Calculus`, `Technology -> AI`, etc.).
- Flexible logical matching modes:
  - **Match ANY selected topic (OR)**: Displays items that substantively match any chosen topic.
  - **Match ALL selected topics (AND)**: Requires content to substantively match all selected topics together.
- Hierarchical inheritance: Selecting a parent category automatically matches valid child topics.

### Keyword & Creator Preferences
- Independent include/exclude phrase matching and whole-word regex filtering.
- Creator allowlists and blocklists. Excluded keywords deterministically override topic matches.

### Evidence-Based Misinformation Controls (with India Preset)
- Evaluates factual claims against a bounded, versioned offline evidence corpus.
- Dedicated preset: **"Hide verified false claims about India"** (backed by PIB, RBI, CPCB, and official records).
- Six explicit claim statuses: `Supported`, `Contradicted`, `Disputed`, `Opinion/Satire`, `Insufficient evidence`, or `Not assessed`.
- **Protected Criticism Policy**: Journalism, economic critique, satire, and debunking quotes are explicitly preserved and never mislabeled as false.

### Universal Real-Time Multilingual Abuse Guard (<all_urls>)
- Runs across all websites and discussion threads in real time via low-latency DOM `MutationObserver`.
- **Anti-Obfuscation Engine**: Neutralizes masked profanity, asterisks, leetspeak, zero-width spaces, and homoglyphs (e.g. `ma*ar`, `m@d@r`, `ch**iya`, `f*ck`, `b*tch`, `bkl`, `mc`, `bc`).
- **Zero Language Gap**: Multilingual coverage for Devanagari Hindi/Marathi, Romanized Hinglish, English, Spanish, French, German, Russian, and Arabic.
- **Scunthorpe Problem Immunity**: Preserves benign words (`mature`, `matter`, `matrix`, `assistant`, `classic`, `pass`, `madagascar`).
- **Sovereign Enforcement Action**: Interactive blur with click-to-reveal Sovereign Laya Badge (`🛡️ Abusive comment hidden by Laya • Click to view`), silent container collapse (`hide`), or in-place text redaction (`redact`).

### Intrinsic Adult & Pornographic Content Safety Layer
- Unconditional baseline safety filter operating across social media feeds and comments without exposing or mentioning any user-facing option or setting in the UI.
- Intercepts adult hosting domains (`onlyfans.com`, `pornhub.com`, `xvideos.com`, etc.), porn bot solicitations (`link in bio for nudes`, `selling spicy content in bio`), and explicit porn media across multiple scripts and languages.
- Detects platform-level NSFW metadata (Reddit `[nsfw]` attributes, `[data-nsfw="true"]`, `.nsfw` classes, and NSFW flair badges).
- Cannot be bypassed by an allowed creator, safeguarding feeds even if a creator account is compromised.
- Strictly immune to Scunthorpe false positives in educational, medical, or cosmetic contexts (`sexual harassment`, `University of Sussex`, `adult literacy`, `nude lipstick shade`).

### Seamless Feed & Bounded Video Skipping
- Reversibly collapses blocked items in standard feeds without breaking virtualized scroll positions.
- In short-form video feeds (Shorts, Reels, TikTok), mutes and pauses active media and triggers native navigation events with a bounded skip counter (max 8) to prevent infinite loops, black players, or orphaned audio.

### Local-First WebGPU & WASM ML Inference
- Model inference runs 100% locally on user hardware using ONNX Runtime Web with WebGPU acceleration and multi-threaded SIMD WASM fallback.
- Calibrated non-autoregressive decision heads (`choice`, `score`, `noul`) with Shannon entropy confidence scoring.
- Zero telemetry, zero external API dependencies, zero data leakage.

### Modern Frontend Design (Infused with interfaces.dev)
- **`better-colors`**: Semantic tokens (`--color-bg-canvas`, `--color-bg-surface`, `--color-accent`, etc.) with WCAG AAA/AA verified contrast.
- **`better-ui`**: Concentric border radii ($R_{outer} = R_{inner} + \text{padding}$), tactile press scale (`scale(0.96)` on `:active`), and layered elevation shadows.
- **`better-typography`**: OpenType tabular numerals (`tabular-nums`) for jitter-free counters, latencies, and FPS benchmarks.
- **`better-layout`**: Space-first grouping and logical CSS properties (`padding-inline`, `margin-block`, `inset-inline-start`).
- **`better-accessibility`**: High-contrast `:focus-visible` indicators and `@media (prefers-reduced-motion: reduce)` compliance.

---

## 2. Supported Platforms & Routes

| Platform | Supported Routes / Surfaces | Feed Type | Skipping Support |
|---|---|---|---|
| **YouTube** | Home, Search, Subscriptions, Shorts (`/shorts/*`) | Feed / Shorts | Pause + Next / ArrowDown |
| **Instagram** | Main Feed, Explore Grid, Reels (`/reels/*`, `/reel/*`) | Feed / Shorts | Pause + ArrowDown |
| **Facebook** | Feed (`/`), Watch, Reels (`/reel/*`) | Feed / Shorts | Pause + ArrowDown |
| **X / Twitter** | Home Timelines, Search, Status Threads | Feed | Standard Reversible Hide |
| **Reddit** | Subreddit Feeds, Home, Post Cards (`shreddit-post`) | Feed | Standard Reversible Hide |
| **LinkedIn** | Home Feed (`/feed/`), Shared Updates | Feed | Standard Reversible Hide |
| **TikTok** | Web For You Feed, Following Feed (`/foryou`) | Shorts | Pause + Next / ArrowDown |
| **Threads** | Home Feed (`threads.net`) | Feed | Standard Reversible Hide |
| **Pinterest** | Home Grid, Search Grids (`/search/pins/*`) | Grid | Standard Reversible Hide |
| **Bluesky** | Home Timeline, Author Feeds (`bsky.app`) | Feed | Standard Reversible Hide |
| **Generic Web** | Conservative container validation (`article`, comments) | Generic | Reversible Hide / Blur |

---

## 3. Architecture & Topology

```
┌────────────────────────────────────────────────────────┐
│                   Web Page (Tab)                       │
│  ┌───────────────────────┐   ┌──────────────────────┐  │
│  │   Platform Adapter    │◄─►│   Feed Controller    │  │
│  │ (DOM Extraction/Hide) │   │ (State Machine/Skip) │  │
│  └───────────────────────┘   └──────────┬───────────┘  │
│  ┌──────────────────────────────────────┴───────────┐  │
│  │  AbuseGuard (<all_urls> Real-Time Observer)      │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────┼──────────────┘
                                          │ chrome.runtime
                                          ▼
┌────────────────────────────────────────────────────────┐
│               Background Service Worker                │
│  - Settings & Lifecycle Coordinator                    │
│  - Bounded Local History & Badge Counters              │
│  - Offscreen Document Lifecycle Manager                │
└────────────────────────────┬───────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────┐
│               Offscreen Document Host                  │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Dedicated Inference Web Worker          │  │
│  │  - LayaEngine (Prompt/Marker Sequence Builder)   │  │
│  │  - ONNX Runtime Web (WebGPU EP + WASM Fallback)  │  │
│  │  - Shannon Entropy Calibrated Probabilities      │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 4. Installation & Build Instructions

### Prerequisites
- Node.js v18+ (tested on Node.js v24.14.0)
- npm v9+

### Build and Package
```bash
# Install dependencies
npm install

# Build extension bundles and POSIX forward-slash ZIP archive
npm run build

# Run automated test suite (70 tests across 23 test suites)
npm test
```

### Loading in Google Chrome or Microsoft Edge
1. Open Chrome or Edge and navigate to `chrome://extensions/` or `edge://extensions/`.
2. Turn on the **Developer mode** toggle (top-right corner).
3. Click **Load unpacked**.
4. Select either directory:
   - Primary: `C:\Users\chotu\.gemini\antigravity\scratch\laya_feed_control\dist`
   - Source: `C:\Users\chotu\.gemini\antigravity\scratch\laya_feed_control\src`

---

## 5. Verification & Test Suite Summary

```
=== Performance Measurement Results ===
Median Latency (p50): 0.04 ms
95th Percentile (p95): 0.11 ms
Engineering Budget Target: < 250 ms

✔ AdultContentDetector - Explicit Lexicon & Multi-language Support
✔ AdultContentDetector - Porn Bots, Adult Domains & Platform Markers
✔ AdultContentDetector - Scunthorpe Immunity (Benign Contexts)
✔ PolicyEngine - Intrinsic Adult Content Safety Filter
✔ AbuseDetector - Obfuscated Structures (ma*ar, ma**r, m@d@r, ch**iya, f*ck, bkl, mc, bc)
✔ AbuseDetector - Multilingual & Native Scripts (Devanagari Hindi, Hinglish, Spanish, French, German, Russian)
✔ AbuseDetector - Scunthorpe Problem Prevention (clean text immunity)
✔ AbuseGuard - Real-time DOM scanning & sovereign badge reveal
✔ Platform Adapters (YouTube, Instagram, Twitter/X, Reddit, Facebook, LinkedIn, TikTok, Threads, Pinterest, Bluesky, Generic)
✔ EvidenceStore - Misinformation & India Preset Evaluation
✔ Laya Sequence & Criteria Rendering (string, json criteria, marker indexing parity)
✔ Laya Confidence Calculation (normalized Shannon entropy calibration)
✔ PolicyEngine - Topic Matching (ANY vs ALL, hierarchy inheritance)
✔ PolicyEngine - Precedence & Conflict Resolution
✔ VideoSkipper - Navigation & Loop Protection (max 8 skips)

Total Suites: 23
Total Tests: 70 passed, 0 failed
Build Output: dist/ (clean unpacked extension), dist/laya-feed-control-v1.0.0.zip (51 POSIX entries)
```

---

## 6. Project File Structure

```
laya_feed_control/
├── dist/                                  # Production unpacked extension
│   ├── manifest.json                      # Manifest V3 configuration
│   ├── background/service-worker.js       # Background service worker
│   ├── content/content-script.js          # Injected content script
│   ├── offscreen/                         # Offscreen document & inference worker
│   ├── popup/                             # Extension popup interface
│   ├── options/                           # Options dashboard interface
│   ├── wasm/                              # ONNX runtime WASM binaries
│   ├── data/                              # Evidence & taxonomy corpora
│   └── laya-feed-control-v1.0.0.zip       # POSIX-compliant packaged ZIP
├── src/                                   # TypeScript source code
│   ├── manifest.json
│   ├── adapters/                          # 10 Platform adapters
│   ├── background/                        # Service worker
│   ├── content/                           # Content scripts & AbuseGuard
│   ├── engine/                            # Policy, Laya, Evidence, Abuse & Adult detectors
│   ├── offscreen/                         # WebGPU/WASM inference host
│   ├── popup/                             # Popup UI
│   ├── options/                           # Options dashboard
│   ├── data/                              # Topics & Evidence JSON
│   └── types/                             # TypeScript definitions
├── tests/                                 # Automated test suites
│   ├── unit/                              # 19 Unit test suites (Policy, Abuse, Adult, etc.)
│   └── integration/                       # 4 Integration test suites
├── build.mjs                              # Multi-bundle build & mirror script
├── package-zip.py                         # POSIX ZIP packaging script
├── read.me                                # Documentation file
└── package.json                           # Dependencies & scripts
```
