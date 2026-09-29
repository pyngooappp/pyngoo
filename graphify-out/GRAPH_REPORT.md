# Graph Report - anonymous-voice-chat  (2026-09-29)

## Corpus Check
- 157 files · ~395,712 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 36 file(s) not represented in the graph (top: .xml 11, (none) 9, .plist 3)

## Summary
- 595 nodes · 1115 edges · 59 communities (24 shown, 35 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.87)
- Token cost: 671,075 input · 0 output

## Community Hubs (Navigation)
- Capacitor Native Plugins
- Streaming & Rewards UI
- App Routing & Streamer Cockpit
- iOS Native Type Primitives
- Gold Market & Ads
- Auth & Account Security Rules
- Google Service Account Token Helper
- iOS Build & Deploy Pipeline
- Package Manifest Metadata
- NPM Dependencies List
- TypeScript App Config
- 10-Language i18n System
- Push Notification Permission Flow
- TypeScript Node Config
- Sound Manager (Call Tones)
- Dev Dependencies List
- Android Default Test Boilerplate
- AI Face Verification Rule
- Screen Guard Capacitor Plugin
- AdMob Reward Video Service
- Android MainActivity
- Oxlint Config Rules
- NPM Scripts
- Android Gradle Wrapper
- Shopier Payment Service
- Supabase Nano-Tier Polling Ban
- Capacitor App Config
- Icon Sprite Sheet
- App Entry Point
- Vite Build Config
- TS Project References
- Zero-Bot Policy Rule
- Promo Video Transcripts
- iOS SPM Package Manifest
- NPM Override: node-fetch
- Vercel Rewrites Config
- Vercel Config (root)
- AI Diagnosis Method Rule
- Platform Identity Rule
- Test File Cleanup Rule
- Android Splash Screen Image
- Android App Icon
- Android Icon Foreground Layer
- Android Round App Icon
- iOS App Icon
- iOS Splash Screen Image
- Landing Page Screenshot
- Favicon Brand Mark
- App Logo Icon
- Default Female Avatar
- Default Male Avatar

## God Nodes (most connected - your core abstractions)
1. `react` - 28 edges
2. `lucide-react` - 26 edges
3. `supabase` - 26 edges
4. `react-i18next` - 25 edges
5. `App()` - 23 edges
6. `soundManager` - 23 edges
7. `sendTelegramAlert()` - 18 edges
8. `compilerOptions` - 18 edges
9. `logTransaction()` - 15 edges
10. `compilerOptions` - 15 edges

## Surprising Connections (you probably didn't know these)
- `Automatic Build and Desktop Deploy Rule` --semantically_similar_to--> `Derleme ve Canlı Yayın Disiplini (CLAUDE.md)`  [INFERRED] [semantically similar]
  .agents/rules/AGENTS.md → CLAUDE.md
- `Google OAuth Data Policy (email, profile, openid scopes)` --semantically_similar_to--> `Strict Auth & Registration Security Rules`  [INFERRED] [semantically similar]
  public/privacy.html → .agents/rules/AGENTS.md
- `React + TypeScript + Vite Template Doc` --semantically_similar_to--> `Derleme ve Canlı Yayın Disiplini (CLAUDE.md)`  [INFERRED] [semantically similar]
  README.md → CLAUDE.md
- `Mandatory Multilingual Rule (10 Languages)` --semantically_similar_to--> `Zorunlu 10 Dil Kuralı (CLAUDE.md)`  [INFERRED] [semantically similar]
  .agents/rules/AGENTS.md → CLAUDE.md
- `hreflang Alternate Links for 10 Languages` --semantically_similar_to--> `Mandatory Multilingual Rule (10 Languages)`  [INFERRED] [semantically similar]
  index.html → .agents/rules/AGENTS.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Pyngoo Multi-Layer Security Audit Procedure** — _agents_skills_pyngoo_security_auditor_skill_security_auditor, _agents_rules_agents_verification_discipline, _agents_rules_agents_server_side_security, _agents_rules_agents_auth_registration_security [INFERRED 0.85]
- **Ten-Language Multilingual Synchronization System** — claude_multilingual_rule, _agents_rules_agents_multilingual_rule, _agents_rules_multilingual_sync_rule, index_hreflang_10_languages [INFERRED 0.90]
- **iOS TestFlight Build & Deploy Pipeline** — _github_workflows_ios_build_workflow, ios_app_capapp_spm_readme_package, claude_mobile_admob_integration [INFERRED 0.75]

## Communities (59 total, 35 thin omitted)

### Community 0 - "Capacitor Native Plugins"
Cohesion: 0.06
Nodes (63): ref, @capacitor/browser, face-api.js, lucide-react, react, react-i18next, CookieBanner(), CookieBannerProps (+55 more)

### Community 1 - "Streaming & Rewards UI"
Cohesion: 0.08
Nodes (39): agora-rtc-sdk-ng, react-router-dom, src_assets_avatar_female, src_assets_avatar_male, DailyRewards(), DailyRewardsProps, REWARDS, Layout() (+31 more)

### Community 2 - "App Routing & Streamer Cockpit"
Cohesion: 0.10
Nodes (35): App(), parseJwt(), StreamerCockpit(), StreamerCockpitProps, Explore(), ExploreProps, HostCenter(), HostCenterProps (+27 more)

### Community 3 - "iOS Native Type Primitives"
Cohesion: 0.07
Nodes (26): Any, AnyHashable, AVFoundation, Bool, Capacitor, Data, Error, AppDelegate (+18 more)

### Community 4 - "Gold Market & Ads"
Cohesion: 0.12
Nodes (28): @capacitor-community/admob, @capacitor/core, GoldPackage, Market(), MarketProps, ADMOB_APP_IDS, REAL_AD_UNITS, TEST_AD_UNITS (+20 more)

### Community 5 - "Auth & Account Security Rules"
Cohesion: 0.08
Nodes (31): Strict Auth & Registration Security Rules, check_email_exists RPC, checkNicknameTaken Function, claimShellAccount() Recovery Function, public.is_caller_staff() Function, Database Orphan Record Cleanup (One-Time Setup), public.purge_user_data(uuid) Function, Server-Side Security Rules (RPC/Token/RLS) (+23 more)

### Community 6 - "Google Service Account Token Helper"
Cohesion: 0.08
Nodes (20): b64url(), corsHeaders, getAccessToken(), json(), ServiceAccount, TEXTS, ref_jsr_supabase, ref_npm_agora_token_2_0_5 (+12 more)

### Community 7 - "iOS Build & Deploy Pipeline"
Cohesion: 0.08
Nodes (27): Automatic Build and Desktop Deploy Rule, Mandatory Multilingual Rule (10 Languages), Multilingual Synchronization Rule, build-ios Job (macos-15), Build Env Vars (VITE_SUPABASE_URL, VITE_AGORA_APP_ID, VITE_REVENUECAT_IOS_API_KEY), ExportOptions.plist (app.pyngoo.chat, team FX59PMTS6R), Upload Signed IPA to TestFlight Step, Build and Deploy to TestFlight Workflow (+19 more)

### Community 8 - "Package Manifest Metadata"
Cohesion: 0.09
Nodes (22): name, private, type, version, autoprefixer, @capacitor/android, @capacitor/app, @capacitor-firebase/messaging (+14 more)

### Community 9 - "NPM Dependencies List"
Cohesion: 0.10
Nodes (20): dependencies, agora-rtc-sdk-ng, @capacitor/app, @capacitor/browser, @capacitor-community/admob, @capacitor/core, @capacitor-firebase/messaging, @capawesome/capacitor-apple-sign-in (+12 more)

### Community 10 - "TypeScript App Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 11 - "10-Language i18n System"
Cohesion: 0.16
Nodes (15): i18next, i18next-browser-languagedetector, enTranslation, initialDetectedLanguage, resources, trTranslation, extraTranslations, arLanding (+7 more)

### Community 12 - "Push Notification Permission Flow"
Cohesion: 0.26
Nodes (15): Props, PushOpenBridge(), PushPermissionPrompt(), ensureWebFirebase(), FIREBASE_WEB_CONFIG, getPushPermission(), isNative(), isPushSupported() (+7 more)

### Community 13 - "TypeScript Node Config"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 15 - "Dev Dependencies List"
Cohesion: 0.13
Nodes (15): devDependencies, autoprefixer, @capacitor/android, @capacitor/cli, @capacitor/ios, oxlint, postcss, tailwindcss (+7 more)

### Community 16 - "Android Default Test Boilerplate"
Cohesion: 0.24
Nodes (8): ExampleInstrumentedTest, ExampleUnitTest, androidx.test.ext.junit.runners.AndroidJUnit4, assert, context, instrumentationregistry, org.junit.runner.RunWith, org.junit.Test

### Community 17 - "AI Face Verification Rule"
Cohesion: 0.33
Nodes (9): Mandatory AI Face Verification for Female Profiles, No AI Assistant/Model Names in Codebase Rule, No AI Tool Footprints Rule, Pyngoo Landing Page Accessibility Snapshot #1, Pyngoo Landing Page Accessibility Snapshot #2, Landing Page Feature: Yapay Zeka Doğrulaması (AI Verification), Landing Page Feature: %100 Gizlilik & Anonimlik, Landing Page Feature: Hediye Topla & Kazan (Gift-to-Cash) (+1 more)

### Community 18 - "Screen Guard Capacitor Plugin"
Cohesion: 0.39
Nodes (6): ScreenGuardPlugin, com.getcapacitor.annotation.CapacitorPlugin, com.getcapacitor.Plugin, com.getcapacitor.PluginCall, com.getcapacitor.PluginMethod, windowmanager

### Community 20 - "Android MainActivity"
Cohesion: 0.47
Nodes (4): MainActivity, android.os.Bundle, com.getcapacitor.BridgeActivity, Override

### Community 21 - "Oxlint Config Rules"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 22 - "NPM Scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 23 - "Android Gradle Wrapper"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

### Community 25 - "Supabase Nano-Tier Polling Ban"
Cohesion: 0.67
Nodes (3): Supabase Nano Tier Load Control (Connection Pool 15), Periyodik Polling Yasağı (CLAUDE.md), Supabase Nano Katman Koruma Kuralı (CLAUDE.md)

### Community 27 - "Icon Sprite Sheet"
Cohesion: 0.67
Nodes (3): Icon Sprite Sheet (icons.svg), Social Brand Icon Symbols (bluesky, discord, github, x), UI Icon Symbols (documentation, social/contact)

## Ambiguous Edges - Review These
- `pingoo.txt Transcript Fragment` → `sponsor_ad.txt Transcript Fragment`  [AMBIGUOUS]
  graphify-out/transcripts/pingoo.txt · relation: conceptually_related_to

## Knowledge Gaps
- **205 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `corsHeaders` (+200 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 267 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **35 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `pingoo.txt Transcript Fragment` and `sponsor_ad.txt Transcript Fragment`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `react` connect `Capacitor Native Plugins` to `Streaming & Rewards UI`, `App Routing & Streamer Cockpit`, `Gold Market & Ads`, `Package Manifest Metadata`, `Push Notification Permission Flow`, `App Entry Point`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `react-i18next` connect `Capacitor Native Plugins` to `Streaming & Rewards UI`, `App Routing & Streamer Cockpit`, `Gold Market & Ads`, `Package Manifest Metadata`, `10-Language i18n System`, `Push Notification Permission Flow`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `dependencies` connect `NPM Dependencies List` to `Package Manifest Metadata`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _205 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Capacitor Native Plugins` be split into smaller, more focused modules?**
  _Cohesion score 0.05877167205406994 - nodes in this community are weakly interconnected._
- **Should `Streaming & Rewards UI` be split into smaller, more focused modules?**
  _Cohesion score 0.07764876632801161 - nodes in this community are weakly interconnected._