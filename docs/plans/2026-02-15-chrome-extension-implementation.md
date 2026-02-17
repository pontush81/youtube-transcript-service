# Chrome Extension Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Chrome extension that shows YouTube transcripts, AI summaries, and chat directly on YouTube pages, connected to our existing Next.js backend.

**Architecture:** WXT (Manifest V3) extension with Preact + Tailwind CSS. Content script injects a sidebar widget on YouTube video pages. Background service worker handles API calls and Clerk auth. No new backend endpoints needed — the extension talks to existing APIs.

**Tech Stack:** WXT, Preact, TypeScript, Tailwind CSS v4, @clerk/chrome-extension, chrome.storage

**Design doc:** `docs/plans/2026-02-15-chrome-extension-design.md`

---

## Task 1: Scaffold WXT Project

**Files:**
- Create: `extension/package.json`
- Create: `extension/wxt.config.ts`
- Create: `extension/tsconfig.json`
- Create: `extension/.env.example`
- Create: `extension/.gitignore`

**Step 1: Initialize extension directory**

```bash
cd .worktrees/chrome-extension
mkdir extension && cd extension
```

**Step 2: Create package.json**

```json
{
  "name": "transcript-extension",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wxt",
    "build": "wxt build",
    "zip": "wxt zip"
  }
}
```

**Step 3: Install dependencies**

```bash
pnpm add preact @clerk/chrome-extension
pnpm add -D wxt @preact/preset-vite tailwindcss @tailwindcss/vite typescript
```

**Step 4: Create wxt.config.ts**

```typescript
import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Transcript Tool',
    description: 'YouTube transcripts, AI summaries & chat',
    permissions: ['storage', 'cookies', 'tabs'],
    host_permissions: [
      'https://www.youtube.com/*',
      'https://youtube-transcript-service-two.vercel.app/*',
    ],
  },
  vite: () => ({
    plugins: [preact(), tailwindcss()],
  }),
});
```

**Step 5: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "paths": {
      "react": ["./node_modules/preact/compat/"],
      "react-dom": ["./node_modules/preact/compat/"]
    }
  }
}
```

**Step 6: Create .env.example**

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
VITE_API_BASE_URL=https://youtube-transcript-service-two.vercel.app
```

**Step 7: Create .gitignore**

```
node_modules/
.output/
.wxt/
.env
```

**Step 8: Verify build works**

```bash
pnpm build
```

Expected: Build succeeds (with warnings about missing entrypoints, which is fine).

**Step 9: Commit**

```bash
git add extension/
git commit -m "feat(extension): scaffold WXT project with Preact + Tailwind"
```

---

## Task 2: Content Script — Empty Widget on YouTube

**Files:**
- Create: `extension/src/entrypoints/youtube.content/index.tsx`
- Create: `extension/src/entrypoints/youtube.content/style.css`
- Create: `extension/src/entrypoints/youtube.content/Widget.tsx`
- Create: `extension/public/icon-128.png` (placeholder)

**Step 1: Create Tailwind CSS entry**

File: `extension/src/entrypoints/youtube.content/style.css`
```css
@import "tailwindcss";
```

**Step 2: Create Widget shell component**

File: `extension/src/entrypoints/youtube.content/Widget.tsx`
```tsx
import { useState } from 'preact/hooks';

type Tab = 'transcript' | 'summary' | 'chat';

interface Props {
  videoId: string;
}

export function Widget({ videoId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('transcript');
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        class="mb-4 w-full rounded-lg border border-gray-200 bg-white p-2 text-left text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
      >
        📋 Transcript Tool ▸
      </button>
    );
  }

  return (
    <div class="mb-4 rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div class="flex items-center justify-between border-b border-gray-100 px-4 py-2">
        <span class="text-sm font-semibold text-gray-900">Transcript Tool</span>
        <button
          onClick={() => setCollapsed(true)}
          class="text-gray-400 hover:text-gray-600"
          title="Minimize"
        >
          ▾
        </button>
      </div>

      {/* Tabs */}
      <div class="flex border-b border-gray-100">
        {(['transcript', 'summary', 'chat'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            class={`flex-1 px-3 py-2 text-xs font-medium capitalize ${
              activeTab === tab
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div class="p-4">
        <p class="text-xs text-gray-500">
          Active: {activeTab} | Video: {videoId}
        </p>
      </div>
    </div>
  );
}
```

**Step 3: Create content script entry**

File: `extension/src/entrypoints/youtube.content/index.tsx`
```tsx
import './style.css';
import { render } from 'preact';
import { Widget } from './Widget';

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  cssInjectionMode: 'ui',
  runAt: 'document_end',

  async main(ctx) {
    let ui: Awaited<ReturnType<typeof createShadowRootUi>> | null = null;

    function getVideoId(url: string): string | null {
      const match = url.match(/[?&]v=([^&]+)/);
      return match?.[1] ?? null;
    }

    function waitForElement(selector: string, timeout = 5000): Promise<Element | null> {
      return new Promise((resolve) => {
        const existing = document.querySelector(selector);
        if (existing) { resolve(existing); return; }

        const observer = new MutationObserver(() => {
          const el = document.querySelector(selector);
          if (el) { observer.disconnect(); resolve(el); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
      });
    }

    async function handleVideoPage() {
      const videoId = getVideoId(window.location.href);
      if (!videoId) {
        ui?.remove();
        ui = null;
        return;
      }

      const anchor = await waitForElement('#secondary', 5000);
      if (!anchor) return;

      ui?.remove();

      ui = await createShadowRootUi(ctx, {
        name: 'transcript-widget',
        position: 'inline',
        anchor: '#secondary',
        append: 'first',
        onMount(container) {
          const wrapper = document.createElement('div');
          container.append(wrapper);
          render(<Widget videoId={videoId} />, wrapper);
          return wrapper;
        },
        onRemove(wrapper) {
          if (wrapper) render(null, wrapper);
        },
      });

      ui.mount();
    }

    await handleVideoPage();

    // Handle YouTube SPA navigation
    ctx.addEventListener(window, 'wxt:locationchange', () => {
      handleVideoPage();
    });
    ctx.addEventListener(document, 'yt-navigate-finish' as any, () => {
      handleVideoPage();
    });
  },
});
```

**Step 4: Add a placeholder icon**

Create a simple 128x128 PNG icon (can be a colored square for now).

**Step 5: Build and test manually**

```bash
cd extension && pnpm dev
```

Open Chrome → `chrome://extensions` → Enable Developer Mode → Load `extension/.output/chrome-mv3`.
Navigate to any YouTube video. Widget should appear in sidebar with tabs.

**Step 6: Commit**

```bash
git add extension/src/ extension/public/
git commit -m "feat(extension): content script with widget shell on YouTube"
```

---

## Task 3: Background Service Worker — API Layer

**Files:**
- Create: `extension/src/entrypoints/background.ts`
- Create: `extension/src/lib/api.ts`

**Step 1: Create API client**

File: `extension/src/lib/api.ts`
```typescript
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://youtube-transcript-service-two.vercel.app';

interface TranscriptResponse {
  markdown: string;
  title: string;
  videoId: string;
}

interface SummaryResponse {
  summary: string;
  keyTakeaways: string[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function fetchTranscript(url: string, token?: string): Promise<TranscriptResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/api/transcript`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url }),
  });

  if (!res.ok) throw new Error(`Transcript fetch failed: ${res.status}`);
  return res.json();
}

export async function saveToLibrary(url: string, token: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/api/add`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ url }),
  });

  if (!res.ok) throw new Error(`Save failed: ${res.status}`);
  return res.json();
}

export async function chatWithVideo(
  videoId: string,
  message: string,
  history: ChatMessage[],
  token: string,
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ videoId, message, history }),
  });

  if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
  const data = await res.json();
  return data.response;
}
```

**Step 2: Create background service worker**

File: `extension/src/entrypoints/background.ts`
```typescript
import { fetchTranscript, saveToLibrary, chatWithVideo } from '../lib/api';

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleMessage(message).then(sendResponse).catch((err) => {
      sendResponse({ success: false, error: err.message });
    });
    return true; // async response
  });

  async function handleMessage(message: any): Promise<any> {
    switch (message.type) {
      case 'FETCH_TRANSCRIPT': {
        const data = await fetchTranscript(message.url, message.token);
        return { success: true, data };
      }
      case 'SAVE_TO_LIBRARY': {
        const data = await saveToLibrary(message.url, message.token);
        return { success: true, data };
      }
      case 'CHAT': {
        const response = await chatWithVideo(
          message.videoId,
          message.message,
          message.history || [],
          message.token,
        );
        return { success: true, response };
      }
      default:
        return { success: false, error: `Unknown message type: ${message.type}` };
    }
  }
});
```

**Step 3: Build and verify no errors**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add extension/src/entrypoints/background.ts extension/src/lib/api.ts
git commit -m "feat(extension): background service worker with API layer"
```

---

## Task 4: Transcript Tab

**Files:**
- Create: `extension/src/entrypoints/youtube.content/tabs/TranscriptTab.tsx`
- Modify: `extension/src/entrypoints/youtube.content/Widget.tsx`

**Step 1: Create TranscriptTab component**

File: `extension/src/entrypoints/youtube.content/tabs/TranscriptTab.tsx`
```tsx
import { useState, useEffect, useRef } from 'preact/hooks';

interface TranscriptSegment {
  timestamp: string;
  seconds: number;
  text: string;
}

interface Props {
  videoId: string;
}

function parseTranscriptMarkdown(markdown: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    // Match lines like "**[00:21]** And now the bots..."
    const match = line.match(/\*\*\[(\d{1,2}:\d{2}(?::\d{2})?)\]\*\*\s*(.*)/);
    if (match) {
      const timestamp = match[1];
      const text = match[2];
      const parts = timestamp.split(':').map(Number);
      const seconds = parts.length === 3
        ? parts[0] * 3600 + parts[1] * 60 + parts[2]
        : parts[0] * 60 + parts[1];
      segments.push({ timestamp, seconds, text });
    }
  }

  return segments;
}

function seekVideo(seconds: number) {
  const video = document.querySelector('video');
  if (video) {
    video.currentTime = seconds;
    video.play();
  }
}

export function TranscriptTab({ videoId }: Props) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [rawMarkdown, setRawMarkdown] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track video playback time
  useEffect(() => {
    const video = document.querySelector('video');
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, []);

  async function loadTranscript() {
    setLoading(true);
    setError(null);

    try {
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'FETCH_TRANSCRIPT', url: `https://www.youtube.com/watch?v=${videoId}` },
          resolve,
        );
      });

      if (response.success) {
        setRawMarkdown(response.data.markdown);
        setSegments(parseTranscriptMarkdown(response.data.markdown));
      } else {
        setError(response.error || 'Failed to fetch transcript');
      }
    } catch {
      setError('Communication error');
    } finally {
      setLoading(false);
    }
  }

  // Auto-load transcript on mount
  useEffect(() => { loadTranscript(); }, [videoId]);

  function copyTranscript() {
    navigator.clipboard.writeText(rawMarkdown);
  }

  if (loading) {
    return <div class="py-8 text-center text-sm text-gray-500">Loading transcript...</div>;
  }

  if (error) {
    return (
      <div class="py-4">
        <p class="mb-2 text-sm text-red-600">{error}</p>
        <button onClick={loadTranscript} class="text-sm text-blue-600 hover:underline">
          Try again
        </button>
      </div>
    );
  }

  if (segments.length === 0) {
    return <div class="py-8 text-center text-sm text-gray-500">No transcript available</div>;
  }

  // Find current segment
  const currentIndex = segments.findLastIndex((s) => s.seconds <= currentTime);

  return (
    <div>
      <div ref={containerRef} class="max-h-96 overflow-y-auto">
        {segments.map((seg, i) => (
          <div
            key={i}
            class={`cursor-pointer border-l-2 px-3 py-2 text-sm hover:bg-gray-50 ${
              i === currentIndex
                ? 'border-blue-600 bg-blue-50'
                : 'border-transparent'
            }`}
            onClick={() => seekVideo(seg.seconds)}
          >
            <span class="mr-2 font-mono text-xs text-blue-600">{seg.timestamp}</span>
            <span class="text-gray-700">{seg.text}</span>
          </div>
        ))}
      </div>

      <div class="flex gap-2 border-t border-gray-100 px-3 py-2">
        <button
          onClick={copyTranscript}
          class="text-xs text-gray-500 hover:text-gray-700"
        >
          📋 Copy
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Update Widget to render TranscriptTab**

In `Widget.tsx`, import and render `TranscriptTab` when `activeTab === 'transcript'`:

```tsx
import { TranscriptTab } from './tabs/TranscriptTab';

// In the Content area, replace placeholder:
<div class="p-0">
  {activeTab === 'transcript' && <TranscriptTab videoId={videoId} />}
  {activeTab === 'summary' && <div class="p-4 text-xs text-gray-500">Coming soon</div>}
  {activeTab === 'chat' && <div class="p-4 text-xs text-gray-500">Coming soon</div>}
</div>
```

**Step 3: Test manually**

Load extension in Chrome, go to a YouTube video. Transcript should auto-load with clickable timestamps. Clicking a timestamp should seek the video.

**Step 4: Commit**

```bash
git add extension/src/
git commit -m "feat(extension): transcript tab with timestamps and video sync"
```

---

## Task 5: Summary Tab

**Files:**
- Create: `extension/src/entrypoints/youtube.content/tabs/SummaryTab.tsx`
- Modify: `extension/src/entrypoints/youtube.content/Widget.tsx`
- Modify: `extension/src/entrypoints/background.ts`
- Modify: `extension/src/lib/api.ts`

**Step 1: Add summary API call**

Add to `extension/src/lib/api.ts`:
```typescript
export async function fetchSummary(markdown: string): Promise<SummaryResponse> {
  // Summary is generated client-side by sending transcript to our API
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Give me a summary with key takeaways of this transcript. Format: start with "## Key Takeaways" as bullet points, then "## Summary" as a short paragraph.',
      context: markdown,
    }),
  });

  if (!res.ok) throw new Error(`Summary failed: ${res.status}`);
  const data = await res.json();
  return { summary: data.response, keyTakeaways: [] };
}
```

**Step 2: Add SUMMARIZE message type to background.ts**

```typescript
case 'SUMMARIZE': {
  const data = await fetchSummary(message.markdown);
  return { success: true, data };
}
```

**Step 3: Create SummaryTab component**

File: `extension/src/entrypoints/youtube.content/tabs/SummaryTab.tsx`
```tsx
import { useState } from 'preact/hooks';

interface Props {
  videoId: string;
}

export function SummaryTab({ videoId }: Props) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateSummary() {
    setLoading(true);
    setError(null);

    try {
      // First get the transcript
      const transcriptRes = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'FETCH_TRANSCRIPT', url: `https://www.youtube.com/watch?v=${videoId}` },
          resolve,
        );
      });

      if (!transcriptRes.success) {
        setError('Could not fetch transcript');
        return;
      }

      // Then summarize it
      const summaryRes = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'SUMMARIZE', markdown: transcriptRes.data.markdown },
          resolve,
        );
      });

      if (summaryRes.success) {
        setSummary(summaryRes.data.summary);
        // Cache locally
        chrome.storage.local.set({ [`summary_${videoId}`]: summaryRes.data.summary });
      } else {
        setError(summaryRes.error || 'Summary generation failed');
      }
    } catch {
      setError('Communication error');
    } finally {
      setLoading(false);
    }
  }

  // Check cache on mount
  useState(() => {
    chrome.storage.local.get(`summary_${videoId}`, (result) => {
      const cached = result[`summary_${videoId}`];
      if (cached) setSummary(cached);
    });
  });

  if (loading) {
    return <div class="py-8 text-center text-sm text-gray-500">Generating summary...</div>;
  }

  if (!summary) {
    return (
      <div class="flex flex-col items-center gap-3 py-8">
        <button
          onClick={generateSummary}
          class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          ⚡ Summarize video
        </button>
        {error && <p class="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <div class="max-h-96 overflow-y-auto px-4 py-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
        {summary}
      </div>
      <div class="flex gap-2 border-t border-gray-100 px-3 py-2">
        <button
          onClick={() => navigator.clipboard.writeText(summary)}
          class="text-xs text-gray-500 hover:text-gray-700"
        >
          📋 Copy
        </button>
      </div>
    </div>
  );
}
```

**Step 4: Update Widget.tsx**

Import `SummaryTab` and render when active:
```tsx
import { SummaryTab } from './tabs/SummaryTab';

// Replace summary placeholder:
{activeTab === 'summary' && <SummaryTab videoId={videoId} />}
```

**Step 5: Test manually**

Click "Summarize video" — should show AI-generated summary. Reload page — summary should load from cache.

**Step 6: Commit**

```bash
git add extension/src/
git commit -m "feat(extension): summary tab with AI generation and local cache"
```

---

## Task 6: Popup with Clerk Auth

**Files:**
- Create: `extension/src/entrypoints/popup/index.html`
- Create: `extension/src/entrypoints/popup/main.tsx`
- Create: `extension/src/entrypoints/popup/App.tsx`
- Create: `extension/src/entrypoints/popup/style.css`
- Modify: `extension/wxt.config.ts` (add Clerk host_permissions)

**Step 1: Update wxt.config.ts with Clerk permissions**

Add to `host_permissions`:
```
'https://*.clerk.accounts.dev/*'
```

**Step 2: Create popup HTML**

File: `extension/src/entrypoints/popup/index.html`
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Transcript Tool</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

**Step 3: Create popup entry**

File: `extension/src/entrypoints/popup/main.tsx`
```tsx
import { render } from 'preact';
import { ClerkProvider } from '@clerk/chrome-extension';
import { App } from './App';
import './style.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

render(
  <ClerkProvider
    publishableKey={PUBLISHABLE_KEY}
    afterSignOutUrl={chrome.runtime.getURL('popup.html')}
    signInFallbackRedirectUrl={chrome.runtime.getURL('popup.html')}
    signUpFallbackRedirectUrl={chrome.runtime.getURL('popup.html')}
    syncHost={import.meta.env.VITE_API_BASE_URL}
  >
    <App />
  </ClerkProvider>,
  document.getElementById('app')!,
);
```

**Step 4: Create popup App**

File: `extension/src/entrypoints/popup/App.tsx`
```tsx
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth } from '@clerk/chrome-extension';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://youtube-transcript-service-two.vercel.app';

export function App() {
  return (
    <div class="w-80 p-4">
      <h1 class="mb-3 text-base font-bold text-gray-900">Transcript Tool</h1>

      <SignedOut>
        <p class="mb-3 text-sm text-gray-600">
          Sign in to save transcripts and chat with videos.
        </p>
        <SignInButton mode="modal">
          <button class="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Sign in
          </button>
        </SignInButton>
      </SignedOut>

      <SignedIn>
        <div class="flex items-center justify-between mb-4">
          <span class="text-sm text-gray-600">Signed in</span>
          <UserButton />
        </div>
        <a
          href={`${API_BASE}/transcripts`}
          target="_blank"
          class="block w-full rounded-lg border border-gray-200 px-4 py-2 text-center text-sm text-gray-700 hover:bg-gray-50"
        >
          📚 Open library
        </a>
      </SignedIn>
    </div>
  );
}
```

**Step 5: Create popup styles**

File: `extension/src/entrypoints/popup/style.css`
```css
@import "tailwindcss";
```

**Step 6: Test**

Click extension icon → popup should show Sign in button. After signing in, should show user avatar and library link.

**Step 7: Commit**

```bash
git add extension/src/entrypoints/popup/
git commit -m "feat(extension): popup with Clerk authentication"
```

---

## Task 7: Auth Token Flow to Content Script

**Files:**
- Modify: `extension/src/entrypoints/background.ts`
- Create: `extension/src/lib/auth.ts`
- Modify: `extension/src/entrypoints/youtube.content/Widget.tsx`

**Step 1: Create auth helper for content script**

File: `extension/src/lib/auth.ts`
```typescript
export interface AuthState {
  isSignedIn: boolean;
  isPro: boolean;
  token: string | null;
}

export async function getAuthState(): Promise<AuthState> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' }, (response) => {
      resolve(response || { isSignedIn: false, isPro: false, token: null });
    });
  });
}
```

**Step 2: Add GET_AUTH_STATE to background**

Add to background.ts message handler:
```typescript
case 'GET_AUTH_STATE': {
  // For now, check chrome.storage for cached auth state
  // This will be enhanced when Clerk background client is set up
  const result = await chrome.storage.local.get(['authToken', 'isPro']);
  return {
    isSignedIn: !!result.authToken,
    isPro: !!result.isPro,
    token: result.authToken || null,
  };
}
```

Also add listener for auth state changes from popup:
```typescript
case 'SET_AUTH_STATE': {
  await chrome.storage.local.set({
    authToken: message.token,
    isPro: message.isPro,
  });
  return { success: true };
}
```

**Step 3: Update Widget with auth awareness**

Add auth state to Widget.tsx — pass it down to tabs so Chat and Save know the user's status.

```tsx
import { getAuthState, type AuthState } from '../../lib/auth';

// Inside Widget component:
const [auth, setAuth] = useState<AuthState>({ isSignedIn: false, isPro: false, token: null });

useEffect(() => {
  getAuthState().then(setAuth);
}, []);
```

Pass `auth` to tabs that need it.

**Step 4: Commit**

```bash
git add extension/src/
git commit -m "feat(extension): auth token flow between popup, background, and content script"
```

---

## Task 8: Chat Tab (Pro Feature)

**Files:**
- Create: `extension/src/entrypoints/youtube.content/tabs/ChatTab.tsx`
- Modify: `extension/src/entrypoints/youtube.content/Widget.tsx`

**Step 1: Create ChatTab component**

File: `extension/src/entrypoints/youtube.content/tabs/ChatTab.tsx`
```tsx
import { useState } from 'preact/hooks';
import type { AuthState } from '../../../lib/auth';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  videoId: string;
  auth: AuthState;
}

export function ChatTab({ videoId, auth }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!auth.isSignedIn) {
    return (
      <div class="flex flex-col items-center gap-2 py-8 px-4 text-center">
        <p class="text-sm text-gray-600">Sign in to chat with this video</p>
        <p class="text-xs text-gray-400">Open the extension popup to sign in</p>
      </div>
    );
  }

  if (!auth.isPro) {
    return (
      <div class="flex flex-col items-center gap-2 py-8 px-4 text-center">
        <p class="text-sm text-gray-600">Chat is a Pro feature</p>
        <p class="text-xs text-gray-400">$5/month — save & chat unlimited</p>
        <button class="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
          Upgrade to Pro
        </button>
      </div>
    );
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'CHAT',
            videoId,
            message: userMessage.content,
            history: messages,
            token: auth.token,
          },
          resolve,
        );
      });

      if (response.success) {
        setMessages((prev) => [...prev, { role: 'assistant', content: response.response }]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="flex h-80 flex-col">
      {/* Messages */}
      <div class="flex-1 overflow-y-auto px-3 py-2">
        {messages.length === 0 && (
          <p class="py-4 text-center text-xs text-gray-400">Ask anything about this video</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} class={`mb-2 text-sm ${msg.role === 'user' ? 'text-right' : ''}`}>
            <span
              class={`inline-block max-w-[85%] rounded-lg px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {msg.content}
            </span>
          </div>
        ))}
        {loading && (
          <div class="mb-2 text-sm">
            <span class="inline-block rounded-lg bg-gray-100 px-3 py-2 text-gray-400">
              Thinking...
            </span>
          </div>
        )}
      </div>

      {/* Input */}
      <div class="border-t border-gray-100 px-3 py-2">
        <div class="flex gap-2">
          <input
            type="text"
            value={input}
            onInput={(e) => setInput((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask a question..."
            class="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            class="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Update Widget.tsx**

```tsx
import { ChatTab } from './tabs/ChatTab';

{activeTab === 'chat' && <ChatTab videoId={videoId} auth={auth} />}
```

**Step 3: Test**

Without sign-in: should show "Sign in" prompt. Without Pro: should show upgrade prompt. With Pro: should allow chatting.

**Step 4: Commit**

```bash
git add extension/src/
git commit -m "feat(extension): chat tab with auth gating (Pro feature)"
```

---

## Task 9: Save Button

**Files:**
- Create: `extension/src/entrypoints/youtube.content/SaveButton.tsx`
- Modify: `extension/src/entrypoints/youtube.content/Widget.tsx`

**Step 1: Create SaveButton component**

File: `extension/src/entrypoints/youtube.content/SaveButton.tsx`
```tsx
import { useState } from 'preact/hooks';
import type { AuthState } from '../../lib/auth';

interface Props {
  videoId: string;
  auth: AuthState;
}

export function SaveButton({ videoId, auth }: Props) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!auth.isSignedIn) {
    return (
      <div class="border-t border-gray-100 px-4 py-3">
        <p class="text-center text-xs text-gray-500">
          Sign in to save to your library
        </p>
      </div>
    );
  }

  if (!auth.isPro) {
    return (
      <div class="border-t border-gray-100 px-4 py-3">
        <button class="w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100">
          💎 Upgrade to Pro to save
        </button>
      </div>
    );
  }

  if (saved) {
    return (
      <div class="border-t border-gray-100 px-4 py-3">
        <div class="text-center text-sm text-green-600">✅ Saved to library</div>
      </div>
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'SAVE_TO_LIBRARY',
            url: `https://www.youtube.com/watch?v=${videoId}`,
            token: auth.token,
          },
          resolve,
        );
      });
      if (response.success) setSaved(true);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  return (
    <div class="border-t border-gray-100 px-4 py-3">
      <button
        onClick={handleSave}
        disabled={saving}
        class="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saving...' : '💾 Save to library'}
      </button>
    </div>
  );
}
```

**Step 2: Add SaveButton to Widget**

```tsx
import { SaveButton } from './SaveButton';

// After the tabs content div, before closing widget div:
<SaveButton videoId={videoId} auth={auth} />
```

**Step 3: Test all states**

Verify the three states render correctly: not signed in, free user, Pro user.

**Step 4: Commit**

```bash
git add extension/src/
git commit -m "feat(extension): save button with auth state handling"
```

---

## Task 10: Polish & Final Build

**Files:**
- Create: `extension/public/icon-16.png`
- Create: `extension/public/icon-32.png`
- Create: `extension/public/icon-48.png`
- Create: `extension/public/icon-128.png`
- Modify: `extension/wxt.config.ts` (icons in manifest)
- Create: `extension/README.md`

**Step 1: Add proper icons**

Generate simple icons (can be done with any tool or placeholder for now). Add icon references to manifest in `wxt.config.ts`:

```typescript
manifest: {
  // ... existing config
  icons: {
    16: 'icon-16.png',
    32: 'icon-32.png',
    48: 'icon-48.png',
    128: 'icon-128.png',
  },
},
```

**Step 2: Production build**

```bash
cd extension
pnpm build
pnpm zip
```

Verify the zip is created in `extension/.output/`.

**Step 3: Manual end-to-end test**

1. Load built extension in Chrome
2. Go to a YouTube video
3. Verify transcript loads with clickable timestamps
4. Verify summary generates and caches
5. Verify popup sign-in works
6. Verify chat shows correct auth gates
7. Verify save button shows correct states

**Step 4: Commit**

```bash
git add extension/
git commit -m "feat(extension): icons, polish, and production build"
```

---

## Summary

| Task | Description | Estimated Complexity |
|------|-------------|---------------------|
| 1 | Scaffold WXT project | Low |
| 2 | Content script with widget shell | Medium |
| 3 | Background service worker + API | Medium |
| 4 | Transcript tab with timestamps | Medium |
| 5 | Summary tab with AI + cache | Medium |
| 6 | Popup with Clerk auth | Medium |
| 7 | Auth token flow | Medium |
| 8 | Chat tab (Pro gated) | Medium |
| 9 | Save button with states | Low |
| 10 | Polish and production build | Low |
