# LiberClaw Design Parity

Match the Expo app to the mockup designs across desktop and mobile.

## Reference Mockups

- Desktop: `/home/jon/Téléchargements/stitch_liberclaw-v2/stitch_liberclaw/` (7 screens with HTML+PNG)
- Mobile: `/home/jon/Téléchargements/stitch_liberclaw-mobile/screen.png`

## 1. Global CSS & Effects

**Fix `global.css`:**
- Add `carbon-fiber` class: CSS-generated subtle noise texture at `opacity-5`
- Keep `hero-glow`, `mesh-bg`, `scan-line`, `glass-widget`, `claw-btn` — but enforce correct usage
- Remove `mesh-bg` from dashboard and agent detail pages (only for deploy + specific panels)

**Per-screen background rules:**
- Chat: plain `bg-surface-base` + carbon fiber + ultra-subtle grid `opacity-[0.03]`
- Dashboard/Settings: plain `bg-surface-base`, no effects
- Create agent: `hero-glow` + carbon fiber
- Deploy: `hero-glow` + `claw-mesh-bg`
- Deployment Preview panel (create) + Live Network (landing): `map-grid` + `scan-line`

## 2. Chat Screen

**Desktop:**
- Sidebar shows real agent names from `useAgents` under "ACTIVE AGENTS"
- Chat header: agent name + "Autonomous" badge + node info + "NETWORK STABLE" pill
- Input area: glowing orange-to-red gradient blur behind the input card
- Status footer: `LiberClaw Autonomous Environment v1.0.x • System Secure`
- Tool cards: `$` in red, success in green, status labels EXECUTING/COMPLETED

**Mobile:**
- Horizontal agent carousel at top
- "MAINNET LIVE" status bar + version

## 3. Create Agent

**Desktop 2-column layout (8/4 grid):**
- Left: `glass-widget` with "NEURAL CONFIGURATION" + model cards (3-col with icon, stat, description, mono footer) + execution parameter sliders + "REVIEW & DEPLOY" claw-btn
- Right: `glass-widget` with `map-grid` + `scan-line` showing "DEPLOYMENT PREVIEW" panel (agent info, initialization checklist, mini terminal)
- Page: `hero-glow` + carbon fiber

**Mobile:** single-column, preview panel collapses below form, model cards stack vertically

## 4. Deploy Screen

- Page: `hero-glow` + `claw-mesh-bg`
- Glass widget: corner blur blobs (orange top-right, red bottom-left)
- Circular progress: spinning dashed ring + inner orange blur pulse
- Timeline: gradient vertical line, active step with `animate-ping`
- Terminal: `scan-line` inside
- Footer: session ID + "Abort Deployment" button

## 5. Mobile Tabs

5-tab layout: Live | Agents | Soul | History | Profile
- Soul tab: elevated central orb button with gradient
- Live = chat with active agent
- History = recent activity log
- Profile = settings/account

## 6. Dashboard & Settings

- Remove `mesh-bg` — plain backgrounds
- No layout changes (already match the orange theme)

## 7. Sidebar (Desktop)

- Dynamic agent list from `useAgents` hook
- Active agent highlighted (orange bg, right-edge bar, pulse dot)
- Click agent → navigate to chat
- Keep Settings + API Keys in "SYSTEM" section
