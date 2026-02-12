# UI Design Brief: Baal AI Agent Platform

## Project Overview

Design a modern, intuitive web interface for **Baal** — a platform that lets users create and manage AI agents running on cloud infrastructure. Think of it as "Heroku for AI agents" but accessed through a beautiful web UI.

## What is Baal?

Baal is a Telegram bot that deploys autonomous AI agents to cloud VMs. Each agent:
- Has its own personality (customizable system prompt)
- Can execute code, browse the web, manage files
- Runs 24/7 on dedicated cloud infrastructure
- Has persistent memory and can run background tasks
- Costs ~$0.40/day in cloud compute

Currently it's Telegram-only. We need a web UI that works standalone AND as a Telegram Mini App.

## Target Users

1. **Developers** — Want coding assistants, DevOps helpers, automation agents
2. **Power users** — Researchers, writers, productivity hackers
3. **Casual users** — First-time AI users who want "ChatGPT but customizable"

Age range: 18-45, tech-savvy, mobile-first but appreciate desktop power features.

## Core User Journeys

### Journey 1: Create Your First Agent (3-5 minutes)
1. Open app → see beautiful landing/welcome
2. Click "Create Agent" → simple wizard
3. Choose a name: "CodeBuddy"
4. Pick a model (with clear descriptions and use cases)
5. Hit "Deploy" → watch progress (takes 2-5 min)
6. Success! → Start chatting immediately

**Pain point**: 2-5 minute wait can feel long. Need engaging progress visualization.

### Journey 2: Chat with Agent
1. Select agent from list
2. Send message → get streaming response
3. Agent uses tools (bash, web search, file operations)
4. Upload files via drag-and-drop
5. Download agent's output files
6. Chat history persists forever

**Pain point**: Tool execution can be noisy. Need graceful way to show/hide technical details.

### Journey 3: Manage Multiple Agents
1. View dashboard with all agents
2. See status at a glance (running, deploying, failed)
3. Quick actions: chat, update, delete, customize
4. Handle failures: retry deployment, view logs

**Pain point**: Users may have 3+ agents. Need clear visual hierarchy.

### Journey 4: Customize Agent Personality
1. Click "Edit Soul" (personality editor)
2. Modify system prompt (free text, 500-2000 chars)
3. Save → agent redeploys (takes ~30 seconds)
4. Test new behavior in chat

**Pain point**: System prompts are technical. Need helper text/examples.

### Journey 5: Account Management
1. **Free users**: See message limits (50/day), upgrade CTA
2. **Premium users**: Connect LibertAI API key, view balance
3. Check usage stats, manage billing
4. View agent slots (e.g., 2/3 used)

## Key Features to Design For

### 1. Agent Creation Wizard
- **Step 1**: Name input (friendly, no jargon)
- **Step 2**: Model selection (cards with emojis, descriptions, badges)
- **Step 3**: Review & confirm
- **Progress Tracker**: Visual progress with 6 steps, live updates, ETA

**Challenge**: Make 2-5 minute deployment feel engaging, not boring.

### 2. Agent Dashboard/List
- Show all user's agents with status indicators
- Filter: All | Running | Failed | Deploying
- Quick actions based on status
- Mobile: list view, Desktop: grid/card view

**Challenge**: Distinguish between healthy agents and those needing attention.

### 3. Chat Interface
- Real-time streaming (like ChatGPT)
- Show tool execution (optional, toggleable)
- File upload: drag-and-drop zone
- File download: agent offers files, user clicks to download
- Message history: infinite scroll, paginated
- Agent "personality" visible (model name, status indicator)

**Challenge**: Balance simplicity (casual users) with power (show tools, file ops).

### 4. Tool Visibility Toggle
- Button: "Show Tools" / "Hide Tools"
- When ON: see bash commands, web searches, file operations
- When OFF: clean chat like ChatGPT
- Default: OFF for new users, respects user preference

**Challenge**: Make technical details accessible but not overwhelming.

### 5. Personality Editor
- Text area for system prompt
- Character counter (500-2000 chars recommended)
- Save button → redeploys agent (~30s)
- Optional: Preset templates ("Python Expert", "Creative Writer")

**Challenge**: Make prompt engineering approachable for non-technical users.

### 6. Deployment Progress
- 6 steps: Create VM → Verify → Wait → Deploy code → Health check → Configure HTTPS
- Visual progress bar (0-100%)
- Step checklist (✅ done, 🔄 in progress, ⏳ waiting)
- Live updates via Server-Sent Events (SSE)
- ETA countdown

**Challenge**: Turn waiting into an engaging experience.

### 7. Status & Health Indicators
- **Running** 🟢: Green, "healthy" vibe
- **Deploying** 🟡: Yellow, progress indicator
- **Failed** 🔴: Red, clear "Retry" button
- **Stopped**: Gray, "Start" button

**Challenge**: Status must be immediately obvious at a glance.

### 8. Account Dashboard
- **Free tier**: Message usage (23/50), reset timer, upgrade CTA
- **Premium**: API key status (masked), balance display
- Agent slots: "3/3 agents • 🟢 2 running • 🔴 1 failed"
- Quick navigation to agents, settings, logout

**Challenge**: Encourage upgrades without being pushy.

## Platform Constraints

### Telegram Mini App Integration
- Must work inside Telegram (iframe-like)
- Viewport: typically 390x600px on mobile
- Has native back button, bottom action button
- Can trigger haptic feedback
- Theme: light/dark mode from Telegram

### Responsive Requirements
- Mobile-first (320px minimum)
- Tablet (768px+): expanded layouts
- Desktop (1024px+): multi-column, sidebar nav
- Works on touch AND mouse/keyboard

### Technical Constraints
- Backend is Python FastAPI (SSE for streaming)
- No WebSockets (SSE only)
- SQLite database
- Agent response times: 1-5 seconds per message
- Deployment times: 2-5 minutes
- File uploads: up to 20MB
- Must handle slow 3G connections gracefully

## Design Principles

1. **Approachable** — Non-technical users should feel confident
2. **Transparent** — Show what's happening (deployment, tool execution)
3. **Delightful** — Surprise and delight (animations, easter eggs)
4. **Fast** — Perceived performance matters more than actual speed
5. **Forgiving** — Easy to undo, clear error messages, retry options
6. **Powerful** — Advanced features available but not in your face

## Visual References / Inspiration

- **Vercel Dashboard** — Clean, modern, deployment progress
- **Replicate** — AI model marketplace, model cards
- **ChatGPT** — Streaming chat, simple, accessible
- **Railway** — Deployment logs, real-time updates
- **Linear** — Beautiful UI, attention to detail
- **Telegram Mini Apps** — Native feel, bottom sheets, swipe gestures

## Specific Design Challenges

### Challenge 1: The 2-5 Minute Wait
Deployment takes 2-5 minutes. How do we make this engaging?

**Options to explore:**
- Animated illustrations (agent "coming to life")
- Fun facts about AI, cloud computing
- Preview of what the agent can do
- Progress gamification (achievements?)
- Optional: let user customize agent while waiting

### Challenge 2: Tool Execution Noise
Agents execute bash commands, search the web, read files. This is fascinating for developers but overwhelming for casual users.

**Options to explore:**
- Collapsible/expandable tool cards
- Visual icons for tool types (🔧 bash, 🌐 web, 📁 file)
- Summary view vs. detailed view
- Animations that draw attention without being distracting

### Challenge 3: Multi-Agent Management
Power users may have 5+ agents. How do we show status, enable quick actions, and avoid clutter?

**Options to explore:**
- Card grid with status badges
- List view with inline actions
- Quick filter/search
- Grouped by status (running, failed, deploying)

### Challenge 4: Mobile vs Desktop
Telegram Mini App is mobile-only (small viewport). Standalone web can be desktop.

**Key question**: One responsive layout or two distinct UIs?

**Options to explore:**
- Adaptive: sidebar on desktop, bottom tabs on mobile
- Different info density (more compact on mobile)
- Gestures on mobile (swipe to delete, pull to refresh)

### Challenge 5: Error States
VMs can fail to deploy, agents can crash, network can be slow.

**Options to explore:**
- Friendly error messages (no technical jargon)
- Clear recovery actions (Retry, Delete, Contact Support)
- Contextual help ("This usually happens when...")
- Option to view logs (for technical users)

## What We Need From You

### 1. Information Architecture
- Navigation structure (sidebar, tabs, breadcrumbs?)
- Page hierarchy (what pages exist, how they connect)
- User flows (annotated wireflows)

### 2. Visual Design System
- Color palette (primary, secondary, status colors)
- Typography (headings, body, code)
- Spacing/layout grid
- Component library (buttons, cards, inputs, modals)
- Icon style (outlined, filled, custom?)

### 3. Key Screen Designs
Please design these screens (lo-fi or hi-fi wireframes):

1. **Landing/Home** — First screen users see
2. **Agent Creation Wizard** — All 3 steps + progress tracker
3. **Agent List/Dashboard** — Grid/list view with filters
4. **Chat Interface** — Desktop and mobile versions
5. **Personality Editor** — Modal or full-page
6. **Account Dashboard** — Free tier and premium views
7. **Error States** — Failed deployment, rate limit, server error

### 4. Interaction Patterns
- How do modals/overlays work?
- Confirmation flows (e.g., delete agent)
- Loading states (skeleton screens, spinners, progress bars)
- Animations/transitions (entrance, exit, state changes)
- Drag-and-drop behavior (file uploads)

### 5. Mobile-Specific Considerations
- Touch targets (minimum 44x44px)
- Swipe gestures
- Bottom action bar (Telegram Mini App)
- Handling keyboard on small screens

### 6. Accessibility
- Color contrast (WCAG AA minimum)
- Focus states
- Screen reader considerations
- Keyboard navigation

### 7. Dark Mode
- Full dark mode color palette
- Handle Telegram theme switching

## Deliverables

**Preferred:**
1. **Annotated wireframes** (Figma, Sketch, or even hand-drawn with notes)
2. **High-fidelity mockups** for key screens (landing, chat, agent list)
3. **Component library** (design system with reusable patterns)
4. **User flow diagrams** (how users navigate the app)
5. **Design principles doc** (rationale for key decisions)

**Bonus:**
- Interactive prototype (Figma, Framer)
- Microinteractions (Lottie animations, transition specs)
- Illustration style guide (if custom illustrations)
- Copywriting guidelines (tone, voice, example microcopy)

## Design Philosophy

We want this to feel:
- **Modern** but not trendy (avoid designs that will feel dated in 6 months)
- **Professional** but not corporate (we're fun, accessible, human)
- **Powerful** but not intimidating (advanced features without complexity)
- **Fast** even when it's slow (loading states that feel purposeful)

**Anti-patterns to avoid:**
- Generic admin dashboards (boring, overwhelming)
- Overly minimalist (too sparse, users feel lost)
- Skeuomorphic (fake 3D, textures, shadows that mimic reality)
- Dark patterns (tricking users into upgrades, hiding costs)

## Questions for You (Designer)

1. Should we have a distinct "landing page" or jump straight to agent list?
2. How do we balance "simple for beginners" with "powerful for experts"?
3. Should tool execution details be visible by default or opt-in?
4. What's the best way to visualize deployment progress?
5. How do we make the 2-5 minute wait feel shorter?
6. Mobile bottom tabs or hamburger menu?
7. Inline editing (agent name, prompt) or modal dialogs?
8. Should we use custom illustrations or stick to icons/typography?

## Budget & Timeline (Context)

- **Timeline**: Design phase: 1-2 weeks, implementation: 4-6 weeks
- **Team**: 1 designer (you), 1 frontend dev, 1 backend dev
- **Tech stack**: React + Tailwind CSS (component library TBD)
- **Existing assets**: Logo, basic branding (if needed, we can share)

## Success Metrics

Your design will be successful if:
1. **New users** can create their first agent without help (no docs needed)
2. **Casual users** don't see tool execution details unless they want to
3. **Power users** can quickly manage 5+ agents
4. **Deployment wait** doesn't cause users to close the app
5. **Mobile experience** feels native (like a Telegram Mini App should)
6. **Accessibility** score passes WCAG AA
7. **Delight factor** — users describe it as "beautiful" or "smooth"

## Final Note

This is a **platform for AI agents**, not just another chat interface. The magic is in the customization, the tool execution, the 24/7 availability, the background tasks. Your design should emphasize what makes Baal unique:

- **Agents are persistent** (not just chat sessions)
- **Agents are powerful** (execute code, browse web, manage files)
- **Agents are customizable** (personality, behavior, tools)
- **Agents are yours** (dedicated cloud VMs, full control)

Make us look like the **Vercel of AI agents** — modern, developer-friendly, delightful.

Now surprise us with your vision! 🎨
