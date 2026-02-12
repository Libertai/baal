# LiberClaw Design Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Match the Expo app to the LiberClaw mockup designs across desktop and mobile — fix backgrounds, effects, layouts, and add missing UI elements.

**Architecture:** Bottom-up approach. Fix global CSS effects first, then fix per-screen backgrounds, then restructure layouts (sidebar, chat, create, deploy, mobile tabs). All changes are frontend-only in `apps/liberclaw/`.

**Tech Stack:** Expo/React Native, NativeWind (Tailwind), TypeScript, Expo Router

---

### Task 1: Fix Global CSS Effects

**Files:**
- Modify: `apps/liberclaw/global.css`

**Step 1: Add carbon-fiber texture class**

Add after the `.mesh-bg` block:

```css
/* Carbon fiber subtle texture overlay (web only) */
.carbon-fiber {
  background-image:
    repeating-linear-gradient(
      0deg,
      rgba(255, 255, 255, 0.03) 0px,
      rgba(255, 255, 255, 0.03) 1px,
      transparent 1px,
      transparent 2px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.03) 0px,
      rgba(255, 255, 255, 0.03) 1px,
      transparent 1px,
      transparent 2px
    );
  background-size: 4px 4px;
}
```

**Step 2: Add spin-slow animation for deploy ring**

Add inside `@layer components`:

```css
@keyframes spin-slow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-spin-slow {
  animation: spin-slow 8s linear infinite;
}
```

**Step 3: Verify existing classes are intact**

Confirm `hero-glow`, `mesh-bg`, `scan-line`, `glass-widget`, `claw-btn`, `map-grid` all still exist. No changes needed to them.

**Step 4: Commit**

```bash
git add apps/liberclaw/global.css
git commit -m "feat(ui): add carbon-fiber texture and spin-slow animation CSS classes"
```

---

### Task 2: Fix Per-Screen Backgrounds

**Files:**
- Modify: `apps/liberclaw/app/(tabs)/index.tsx` — remove `mesh-bg`
- Modify: `apps/liberclaw/app/(tabs)/chat.tsx` — add carbon fiber + subtle grid
- Modify: `apps/liberclaw/app/agent/[id]/index.tsx` — fix backgrounds for detail vs deploy views
- Modify: `apps/liberclaw/app/agent/create.tsx` — add `hero-glow` + carbon fiber

**Step 1: Dashboard — remove mesh-bg**

In `apps/liberclaw/app/(tabs)/index.tsx` line 454, change:
```tsx
<View className={`flex-1 bg-surface-base ${isWeb ? "mesh-bg" : ""}`}>
```
to:
```tsx
<View className="flex-1 bg-surface-base">
```

**Step 2: Chat — add carbon fiber + subtle grid on web**

In `apps/liberclaw/app/(tabs)/chat.tsx`, wrap the main `KeyboardAvoidingView` content. Find the `KeyboardAvoidingView` at line 452 and add background overlays after the opening tag:

```tsx
<KeyboardAvoidingView
  className="flex-1 bg-surface-base"
  behavior={Platform.OS === "ios" ? "padding" : undefined}
  keyboardVerticalOffset={90}
>
  {/* Subtle texture overlays (web) */}
  {Platform.OS === "web" && (
    <>
      <View className="absolute inset-0 carbon-fiber pointer-events-none" style={{ zIndex: 0 } as any} />
      <View
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 0, backgroundImage: "linear-gradient(to right, #2d2830 1px, transparent 1px), linear-gradient(to bottom, #2d2830 1px, transparent 1px)", backgroundSize: "40px 40px", opacity: 0.03 } as any}
      />
    </>
  )}
```

**Step 3: Agent Detail — remove mesh-bg from detail view, keep hero-glow for deploy**

In `apps/liberclaw/app/agent/[id]/index.tsx` line 281, change:
```tsx
className={`flex-1 bg-surface-base ${isWeb ? "mesh-bg" : ""}`}
```
to:
```tsx
className="flex-1 bg-surface-base"
```

Then in the `DeploymentView` function, add hero-glow + mesh background. Wrap the existing content at line 94-95:
```tsx
return (
  <View className="px-4 py-6">
    {/* Background effects (web) */}
    {isWeb && (
      <>
        <View className="absolute inset-0 hero-glow pointer-events-none" style={{ zIndex: 0 } as any} />
        <View className="absolute inset-0 mesh-bg pointer-events-none" style={{ zIndex: 0 } as any} />
      </>
    )}
```

**Step 4: Create Agent — add hero-glow + carbon fiber**

In `apps/liberclaw/app/agent/create.tsx`, inside the `ScrollView` (after line 84), add:

```tsx
<ScrollView
  className="flex-1 bg-surface-base"
  contentContainerStyle={{ padding: 24, flexGrow: 1 }}
  keyboardShouldPersistTaps="handled"
>
  {/* Background effects (web) */}
  {isWeb && (
    <>
      <View className="absolute inset-0 hero-glow pointer-events-none" style={{ zIndex: 0, position: 'fixed' } as any} />
      <View className="absolute inset-0 carbon-fiber pointer-events-none" style={{ zIndex: 0, position: 'fixed' } as any} />
    </>
  )}
```

**Step 5: Fix blue color in dashboard ICON_COLORS**

In `apps/liberclaw/app/(tabs)/index.tsx` line 32, change `"#448aff"` to `"#ff8533"` (orange-light from palette).

**Step 6: Commit**

```bash
git add apps/liberclaw/app
git commit -m "fix(ui): correct per-screen backgrounds — remove misused mesh-bg, add hero-glow and carbon fiber where appropriate"
```

---

### Task 3: Chat Input Glow Effect

**Files:**
- Modify: `apps/liberclaw/app/(tabs)/chat.tsx`

**Step 1: Add orange gradient blur behind input card**

Find the input area View around line 520 (`<View className="border-t border-surface-border">`). Replace the existing glow backdrop with the mockup's version:

```tsx
<View className="border-t border-surface-border">
  {/* Orange gradient glow behind input (web) */}
  {Platform.OS === "web" && (
    <View
      className="absolute -inset-0.5 rounded-xl pointer-events-none"
      style={{
        background: "linear-gradient(to right, #ff5e00, #dc2626)",
        opacity: 0.2,
        filter: "blur(12px)",
        zIndex: 0,
      } as any}
    />
  )}
```

**Step 2: Add status footer below input**

After the closing `</View>` of the input area `bg-surface-raised` block (around line 592), add:

```tsx
{/* Status footer */}
{Platform.OS === "web" && (
  <View className="py-2 items-center">
    <Text className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
      LiberClaw Autonomous Environment v1.0.0 •{" "}
      <Text className="text-claw-orange">System Secure</Text>
    </Text>
  </View>
)}
```

**Step 3: Commit**

```bash
git add apps/liberclaw/app/(tabs)/chat.tsx
git commit -m "feat(ui): add orange gradient glow behind chat input and status footer"
```

---

### Task 4: Desktop Sidebar — Dynamic Agent List

**Files:**
- Modify: `apps/liberclaw/components/layout/SidebarNav.tsx`

**Step 1: Import useAgents and useRouter, add agent fetching**

Add import at top:
```tsx
import { useAgents } from "@/lib/hooks/useAgents";
```

Inside `SidebarNav`, after the existing hooks:
```tsx
const { data: agentsData } = useAgents();
const agents = agentsData?.agents ?? [];
const runningAgents = agents.filter((a) => a.deployment_status === "running");
const otherAgents = agents.filter((a) => a.deployment_status !== "running");
```

**Step 2: Replace static NAV_ITEMS with dynamic agent list**

Remove the `NAV_ITEMS` constant and its `.map()` block (lines 11-24 and 114-199). Replace the nav items section with:

```tsx
{/* Active agents */}
{runningAgents.map((agent) => {
  const isActive = pathname.includes(`/agent/${agent.id}`) ||
    (pathname.includes("/chat") && /* add selectedAgent tracking if needed */ false);

  if (isActive) {
    return (
      <Pressable
        key={agent.id}
        onPress={() => router.push(`/agent/${agent.id}/chat` as never)}
        className="flex-row items-center px-3 py-2.5 rounded-lg mb-1 bg-claw-orange/10 border border-claw-orange/30 relative overflow-hidden"
      >
        <View
          style={[
            { position: "absolute", right: 0, top: 0, bottom: 0, width: 3, backgroundColor: "#ff5e00", borderRadius: 2 },
            { boxShadow: "0 0 8px rgba(255,94,0,0.6)" } as WebStyle,
          ]}
        />
        <View className="w-8 h-8 rounded bg-surface-raised border border-claw-orange/20 items-center justify-center">
          <MaterialIcons name="psychology" size={18} color="#ff5e00" />
        </View>
        <View className="ml-3 flex-1">
          <Text className="font-bold text-sm text-white" numberOfLines={1}>{agent.name}</Text>
          <View className="flex-row items-center gap-1.5 mt-0.5">
            <PulseDot />
            <Text className="text-[10px] text-claw-orange font-mono">ONLINE</Text>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      key={agent.id}
      onPress={() => router.push(`/agent/${agent.id}/chat` as never)}
      style={(state) => [
        { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginBottom: 4 },
        (state as WebPressableState).hovered && { backgroundColor: "rgba(255,255,255,0.05)" },
      ]}
    >
      <View className="w-8 h-8 rounded bg-surface-raised border border-white/10 items-center justify-center">
        <MaterialIcons name="smart-toy" size={18} color="#64748b" />
      </View>
      <View className="ml-3 flex-1">
        <Text className="font-medium text-sm text-slate-400" numberOfLines={1}>{agent.name}</Text>
        <Text className="text-[10px] text-slate-500 font-mono mt-0.5">IDLE</Text>
      </View>
    </Pressable>
  );
})}

{/* Stopped/other agents */}
{otherAgents.map((agent) => (
  <Pressable
    key={agent.id}
    onPress={() => router.push(`/agent/${agent.id}` as never)}
    style={(state) => [
      { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, marginBottom: 4 },
      (state as WebPressableState).hovered && { backgroundColor: "rgba(255,255,255,0.05)" },
    ]}
  >
    <View className="w-8 h-8 rounded bg-surface-raised border border-white/10 items-center justify-center">
      <MaterialIcons name="smart-toy" size={18} color="#64748b" />
    </View>
    <View className="ml-3 flex-1">
      <Text className="font-medium text-sm text-slate-400" numberOfLines={1}>{agent.name}</Text>
      <Text className="text-[10px] text-slate-500 font-mono mt-0.5">
        {agent.deployment_status === "failed" ? "FAILED" : "SLEEPING"}
      </Text>
    </View>
  </Pressable>
))}
```

**Step 3: Commit**

```bash
git add apps/liberclaw/components/layout/SidebarNav.tsx
git commit -m "feat(ui): sidebar shows real agent names with dynamic status"
```

---

### Task 5: Chat Desktop Header

**Files:**
- Modify: `apps/liberclaw/app/(tabs)/chat.tsx`

**Step 1: Replace simple header with mockup-style header**

Find the header View at line 458. Replace with:

```tsx
<View
  className="px-6 py-3 border-b border-surface-border flex-row items-center justify-between"
  style={[
    { backgroundColor: "rgba(10, 8, 16, 0.95)" },
    Platform.OS === "web" && { backdropFilter: "blur(8px)" } as any,
  ]}
>
  <View className="flex-row items-center gap-4">
    <View>
      <View className="flex-row items-center gap-2">
        <Text className="text-white font-bold text-lg">{selectedAgent?.name ?? "Chat"}</Text>
        <View className="px-2 py-0.5 rounded bg-claw-orange/20 border border-claw-orange/40">
          <Text className="text-claw-orange text-[10px] font-mono uppercase tracking-wide">Autonomous</Text>
        </View>
      </View>
      <Text className="text-xs text-text-tertiary font-mono">
        Running on Node: <Text className="text-claw-orange">LC-{selectedAgentId?.slice(0, 4).toUpperCase()}</Text>
      </Text>
    </View>
  </View>
  <View className="flex-row items-center gap-4">
    <View className="flex-row items-center gap-2 px-3 py-1.5 rounded-full bg-black border border-surface-border">
      <View
        className="w-2 h-2 rounded-full bg-claw-orange"
        style={Platform.OS === "web" ? { animation: "pulse 2s ease-in-out infinite", boxShadow: "0 0 8px #ff5e00" } as any : undefined}
      />
      <Text className="text-xs font-mono text-text-secondary">NETWORK STABLE</Text>
    </View>
    <TouchableOpacity onPress={() => setSelectedAgentId(null)}>
      <MaterialIcons name="swap-horiz" size={20} color="#8a8494" />
    </TouchableOpacity>
    <TouchableOpacity onPress={() => router.push(`/agent/${selectedAgentId}/chat`)}>
      <MaterialIcons name="open-in-new" size={20} color="#8a8494" />
    </TouchableOpacity>
  </View>
</View>
```

**Step 2: Commit**

```bash
git add apps/liberclaw/app/(tabs)/chat.tsx
git commit -m "feat(ui): chat header matches mockup with agent name, badge, and network status"
```

---

### Task 6: Create Agent — Desktop 2-Column Layout with Deployment Preview

**Files:**
- Modify: `apps/liberclaw/app/agent/create.tsx`

This is the largest task. The create page needs a 2-column layout on desktop with a Deployment Preview side panel.

**Step 1: Add DeploymentPreview component inside create.tsx**

Add above the `CreateAgentScreen` function:

```tsx
function DeploymentPreview({ name, model }: { name: string; model: string }): React.JSX.Element {
  const brand = MODEL_BRANDS[model] ?? model;
  const initial = name ? name.charAt(0).toUpperCase() : "L";

  return (
    <View
      className="rounded-3xl overflow-hidden relative"
      style={isWeb ? {
        background: "linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(255,94,0,0.3)",
        boxShadow: "0 0 15px rgba(255,94,0,0.1)",
      } as any : {
        backgroundColor: "#131018",
        borderWidth: 1,
        borderColor: "#2a2235",
        borderRadius: 24,
      }}
    >
      {/* Map grid + scan line background */}
      {isWeb && (
        <>
          <View className="absolute inset-0 map-grid" style={{ opacity: 0.5 } as any} />
          <View className="scan-line" />
        </>
      )}

      <View className="relative p-6" style={{ zIndex: 10 }}>
        <Text className="text-lg font-bold text-white uppercase mb-6 pb-4 border-b border-white/10">
          Deployment Preview
        </Text>

        {/* Agent info card */}
        <View className="bg-surface-raised/80 border border-white/10 rounded-xl p-4 mb-6" style={isWeb ? { backdropFilter: "blur(8px)" } as any : undefined}>
          <View className="flex-row items-center gap-3 mb-4">
            <View
              className="w-12 h-12 rounded-lg items-center justify-center"
              style={[
                { backgroundColor: "#ff5e00" },
                isWeb && { background: "linear-gradient(135deg, #ff5e00, #dc2626)", boxShadow: "0 0 12px rgba(255,94,0,0.3)" } as any,
              ]}
            >
              <Text className="text-white font-bold text-xl">{initial}</Text>
            </View>
            <View>
              <Text className="text-white font-bold">{name || "Agent-01"}</Text>
              <Text className="text-[10px] text-text-tertiary font-mono">ID: 0x8a...2b9c</Text>
            </View>
          </View>
          <View className="gap-3 font-mono">
            <View className="flex-row justify-between">
              <Text className="text-text-tertiary text-xs">Model:</Text>
              <Text className="text-claw-orange text-xs">{brand}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-text-tertiary text-xs">Network:</Text>
              <Text className="text-claw-orange text-xs">LiberClaw Mainnet</Text>
            </View>
          </View>
        </View>

        {/* Initialization sequence */}
        <Text className="text-xs font-bold text-text-tertiary uppercase mb-3">Initialization Sequence</Text>
        <View className="gap-3 mb-6">
          {[
            { done: true, label: "Wallet Connected" },
            { done: true, label: "Permissions Granted" },
            { done: false, active: true, label: "Deploying to Decentralized Substrate..." },
            { done: false, label: "Live Activation" },
          ].map((item, i) => (
            <View key={i} className="flex-row items-center gap-3" style={{ opacity: !item.done && !item.active ? 0.5 : 1 }}>
              <View className={`w-5 h-5 rounded-full items-center justify-center ${item.done ? "bg-claw-orange/20" : "bg-white/10 border border-white/10"}`}>
                {item.done ? (
                  <MaterialIcons name="check" size={12} color="#ff5e00" />
                ) : item.active ? (
                  <View className="w-1.5 h-1.5 bg-claw-orange rounded-full" />
                ) : null}
              </View>
              <Text className={`text-xs ${item.active ? "text-white font-bold" : item.done ? "text-text-secondary" : "text-text-tertiary"}`}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Mini terminal */}
        <View className="bg-black/50 rounded-lg p-3 border border-white/5 mb-6">
          <Text className="font-mono text-[10px] text-text-tertiary">{">"} init_claw_protocol()</Text>
          <Text className="font-mono text-[10px] text-text-tertiary">{">"} allocating_resources...</Text>
          <Text className="font-mono text-[10px] text-claw-orange">{">"} waiting for confirmation_</Text>
        </View>

        {/* Notice */}
        <View className="flex-row gap-3 p-3 bg-claw-orange/10 border border-claw-orange/20 rounded-lg">
          <MaterialIcons name="info-outline" size={14} color="#ff5e00" style={{ marginTop: 2 }} />
          <Text className="text-[10px] text-text-secondary leading-tight flex-1">
            By deploying this agent, you agree to the LiberClaw autonomous execution protocols.
          </Text>
        </View>
      </View>
    </View>
  );
}
```

**Step 2: Add execution parameters section**

Add a simple `ExecutionParams` component:

```tsx
function ExecutionParams(): React.JSX.Element {
  const [aggression, setAggression] = useState(75);
  const [autonomy, setAutonomy] = useState(92);

  return (
    <View className="mt-8">
      <Text className="font-mono text-sm text-text-secondary uppercase mb-6">Execution Parameters</Text>
      <View className="gap-6">
        <View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm font-bold text-text-primary">Aggression Level</Text>
            <Text className="text-claw-orange font-mono text-sm">{aggression}%</Text>
          </View>
          <View className="h-2 bg-surface-raised rounded-full overflow-hidden">
            <View className="h-full bg-claw-orange rounded-full" style={{ width: `${aggression}%` }} />
          </View>
        </View>
        <View>
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm font-bold text-text-primary">Autonomy Threshold</Text>
            <Text className="text-claw-orange font-mono text-sm">{autonomy}%</Text>
          </View>
          <View className="h-2 bg-surface-raised rounded-full overflow-hidden">
            <View className="h-full bg-claw-orange rounded-full" style={{ width: `${autonomy}%` }} />
          </View>
        </View>
      </View>
    </View>
  );
}
```

**Step 3: Restructure the main layout to 2-column on desktop**

In `CreateAgentScreen`, wrap the step content in a 2-column grid on web. Replace the step content block + spacer + buttons (the area after the wizard progress, roughly lines 179-385) with:

```tsx
{/* 2-column layout on desktop */}
<View
  style={isWeb ? { display: "grid" as any, gridTemplateColumns: "2fr 1fr", gap: 24 } as any : undefined}
>
  {/* Left column — main form in glass-widget */}
  <View
    className="rounded-3xl p-6 mb-6"
    /* ... keep existing glass-widget styling ... */
  >
    {/* Keep all existing step content (steps 1-4) */}
    {/* Add ExecutionParams after step 3 model content */}
    {step === 3 && (
      <View>
        {/* existing model selector */}
        <ModelSelector selected={model} onSelect={setModel} />
        <ExecutionParams />
      </View>
    )}

    {/* Bottom Buttons inside the glass widget */}
    {/* ... keep existing buttons ... */}
  </View>

  {/* Right column — deployment preview (desktop only) */}
  {isWeb && (
    <DeploymentPreview name={name} model={model} />
  )}
</View>
```

**Step 4: Commit**

```bash
git add apps/liberclaw/app/agent/create.tsx
git commit -m "feat(ui): create agent 2-column layout with deployment preview panel and execution params"
```

---

### Task 7: Deploy Screen Polish

**Files:**
- Modify: `apps/liberclaw/app/agent/[id]/index.tsx`

**Step 1: Add spinning dashed ring around circular progress**

In `CircularProgress` function, add a dashed ring outside the SVG:

```tsx
<View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
  {/* Spinning dashed ring */}
  {isWeb && (
    <View
      className="absolute inset-0 rounded-full animate-spin-slow"
      style={{ border: "1px dashed rgba(255,255,255,0.1)" } as any}
    />
  )}
  {/* Inner orange blur pulse */}
  {isWeb && (
    <View
      className="absolute rounded-full"
      style={{ inset: 16, backgroundColor: "rgba(255,94,0,0.05)", filter: "blur(20px)", animation: "pulse 2s ease-in-out infinite" } as any}
    />
  )}
  <Svg ...>
```

**Step 2: Add corner blur blobs to glass widget in DeploymentView**

Inside the glass widget container (around line 110), add:

```tsx
<View style={[containerStyle, { padding: isWeb ? 32 : 20, overflow: "hidden" }]}>
  {/* Corner blur blobs */}
  {isWeb && (
    <>
      <View style={{ position: "absolute", top: 0, right: 0, width: 256, height: 256, backgroundColor: "rgba(255,94,0,0.05)", borderRadius: 9999, filter: "blur(60px)" } as any} />
      <View style={{ position: "absolute", bottom: 0, left: 0, width: 256, height: 256, backgroundColor: "rgba(255,0,60,0.05)", borderRadius: 9999, filter: "blur(60px)" } as any} />
    </>
  )}
```

**Step 3: Add scan-line to terminal box**

Find the terminal `View` around line 193. Add inside it:

```tsx
<View className="mt-6 bg-black/30 border border-surface-border rounded-lg p-3 relative overflow-hidden">
  {isWeb && <View className="scan-line" />}
  {/* ... existing terminal lines ... */}
</View>
```

**Step 4: Make timeline vertical line a gradient**

Change the static fill line (around line 129-137) style to:

```tsx
style={{
  left: 15,
  top: 16,
  height: `${...}%` as any,
  ...(isWeb
    ? { background: "linear-gradient(to bottom, #ff5e00, #ff003c)" }
    : { backgroundColor: "#ff5e00" }),
}}
```

**Step 5: Add active step ping animation**

For the current step's inner dot (line 160), change to:

```tsx
<View className="w-8 h-8 rounded-full bg-surface-base border-2 border-claw-orange items-center justify-center">
  <View className="w-3 h-3 bg-claw-orange rounded-full" />
  {isWeb && (
    <View
      className="absolute w-3 h-3 bg-claw-orange rounded-full"
      style={{ animation: "ping 1s cubic-bezier(0, 0, 0.2, 1) infinite" } as any}
    />
  )}
</View>
```

**Step 6: Add footer with session ID + abort button**

After the glass widget closing `</View>`, add:

```tsx
{/* Footer */}
<View className="mt-6 flex-row justify-between items-center px-2">
  <Text className="text-xs font-mono text-text-tertiary">
    SESSION ID: <Text className="text-text-secondary">0x{agentId.slice(0, 6)}...{agentId.slice(-4)}</Text>
  </Text>
  <Pressable className="flex-row items-center gap-2">
    <MaterialIcons name="cancel" size={16} color="rgba(255,0,60,0.7)" />
    <Text className="text-sm font-mono text-claw-red/70 uppercase">Abort Deployment</Text>
  </Pressable>
</View>
```

**Step 7: Commit**

```bash
git add apps/liberclaw/app/agent/[id]/index.tsx
git commit -m "feat(ui): deploy screen — spinning ring, blur blobs, scan-line terminal, gradient timeline, abort button"
```

---

### Task 8: Mobile Tab Restructure

**Files:**
- Modify: `apps/liberclaw/app/(tabs)/_layout.tsx`
- Create: `apps/liberclaw/app/(tabs)/live.tsx`
- Create: `apps/liberclaw/app/(tabs)/history.tsx`
- Create: `apps/liberclaw/app/(tabs)/profile.tsx`
- Rename: Move chat logic into `live.tsx`, settings logic into `profile.tsx`

**Step 1: Create live.tsx**

This is the renamed chat tab. Copy `apps/liberclaw/app/(tabs)/chat.tsx` content to `apps/liberclaw/app/(tabs)/live.tsx`. At the top of the file, add a mobile status bar:

```tsx
{/* Mobile status bar */}
{!isWeb && (
  <View className="flex-row items-center justify-between px-4 py-2 bg-surface-raised border-b border-surface-border">
    <View className="flex-row items-center gap-2">
      <View className="w-2 h-2 rounded-full bg-status-running" />
      <Text className="text-[10px] font-mono font-bold text-status-running uppercase tracking-wider">Mainnet Live</Text>
    </View>
    <Text className="text-[10px] font-mono text-text-tertiary">v.1.0.0</Text>
  </View>
)}
```

Add a horizontal agent carousel when no agent is selected (mobile only):

```tsx
{!isWeb && selectedAgentId && (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="border-b border-surface-border bg-surface-raised">
    <View className="flex-row px-4 py-3 gap-4">
      {agents.filter(a => a.deployment_status === "running").map((agent) => {
        const isActive = agent.id === selectedAgentId;
        return (
          <Pressable key={agent.id} onPress={() => setSelectedAgentId(agent.id)} className="items-center gap-1.5">
            <View className={`w-12 h-12 rounded-lg items-center justify-center ${isActive ? "border-2 border-claw-orange" : "border border-surface-border"}`}
              style={[{ backgroundColor: "#131018" }, isActive && isWeb && { boxShadow: "0 0 10px rgba(255,94,0,0.3)" } as any]}
            >
              <MaterialIcons name="smart-toy" size={20} color={isActive ? "#ff5e00" : "#5a5464"} />
              {isActive && <View className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-status-running border-2 border-surface-raised" />}
            </View>
            <Text className={`text-[10px] font-medium ${isActive ? "text-text-primary" : "text-text-tertiary"}`} numberOfLines={1} style={{ maxWidth: 60 }}>
              {agent.name}
            </Text>
          </Pressable>
        );
      })}
      <Pressable onPress={() => router.push("/agent/create")} className="items-center gap-1.5">
        <View className="w-12 h-12 rounded-lg items-center justify-center border border-dashed border-surface-border bg-surface-raised">
          <MaterialIcons name="add" size={20} color="#5a5464" />
        </View>
        <Text className="text-[10px] text-text-tertiary">Deploy</Text>
      </Pressable>
    </View>
  </ScrollView>
)}
```

**Step 2: Create history.tsx**

Simple screen showing recent activity (reuse the activity data/layout from settings.tsx):

```tsx
import { View, Text, ScrollView } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function HistoryScreen(): React.JSX.Element {
  return (
    <ScrollView className="flex-1 bg-surface-base" contentContainerStyle={{ padding: 16 }}>
      <Text className="text-2xl font-bold text-text-primary mb-6">Activity History</Text>
      <View className="bg-surface-raised border border-surface-border rounded-card p-6 items-center">
        <MaterialIcons name="history" size={48} color="#5a5464" />
        <Text className="text-text-secondary mt-4 text-center">Chat history will appear here</Text>
      </View>
    </ScrollView>
  );
}
```

**Step 3: Create profile.tsx**

Move/copy settings.tsx content to profile.tsx, rename the export to `ProfileScreen`.

**Step 4: Update _layout.tsx tab configuration**

Replace the 3-tab Tabs config with 5 tabs:

```tsx
<Tabs.Screen name="live" options={{
  title: "Live",
  tabBarIcon: ({ color }) => <MaterialIcons name="sensors" size={24} color={color} />,
}} />
<Tabs.Screen name="index" options={{
  title: "Agents",
  tabBarIcon: ({ color }) => <MaterialIcons name="smart-toy" size={24} color={color} />,
}} />
<Tabs.Screen name="chat" options={{
  // Hidden on mobile — desktop only (sidebar handles it)
  href: isDesktopWeb ? "/(tabs)/chat" : null,
  title: "Chat",
  tabBarIcon: ({ color }) => <MaterialIcons name="chat-bubble-outline" size={24} color={color} />,
}} />
<Tabs.Screen name="history" options={{
  title: "History",
  tabBarIcon: ({ color }) => <MaterialIcons name="history" size={24} color={color} />,
}} />
<Tabs.Screen name="profile" options={{
  title: "Profile",
  tabBarIcon: ({ color }) => <MaterialIcons name="person-outline" size={24} color={color} />,
}} />
<Tabs.Screen name="settings" options={{
  // Hidden — replaced by profile on mobile, still accessible on desktop sidebar
  href: isDesktopWeb ? "/(tabs)/settings" : null,
  title: "Settings",
  tabBarIcon: ({ color }) => <MaterialIcons name="settings" size={24} color={color} />,
}} />
```

**Step 5: Commit**

```bash
git add apps/liberclaw/app/(tabs)/
git commit -m "feat(ui): restructure mobile tabs — Live, Agents, History, Profile (5-tab layout)"
```

---

### Task 9: Final Polish Pass

**Files:**
- Multiple files — visual verification and minor fixes

**Step 1: Verify all screens on web**

Open `http://localhost:8081` and check:
- Dashboard: no grid background, clean dark
- Chat: carbon fiber texture, input glow, status footer, mockup-style header
- Create agent: hero-glow, glass panels, 2-column with deployment preview
- Agent detail → deploying: hero-glow, mesh, spinning ring, blur blobs, scan-line terminal
- Settings: clean dark background
- Sidebar: shows real agent names

**Step 2: Verify mobile**

Check Expo app or web with mobile viewport:
- 5-tab bar at bottom
- Live tab: status bar, agent carousel
- Profile tab: settings content
- History tab: placeholder

**Step 3: Fix any visual inconsistencies found during review**

**Step 4: Final commit**

```bash
git add -A
git commit -m "fix(ui): final polish pass for design parity"
```
