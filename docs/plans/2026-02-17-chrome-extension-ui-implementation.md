# Chrome Extension UI Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Chrome extension widget to take over YouTube's full sidebar with YouTube-native styling, dark mode, and improved UX.

**Architecture:** Replace the small inline widget with a full-height sidebar that hides YouTube's recommendations. Use CSS custom properties for YouTube-native theming with automatic dark mode detection. All tabs load on-demand (no auto-fetch). Widget state persists across navigations.

**Tech Stack:** Preact, Tailwind CSS v4, WXT, Chrome Storage API, Shadow DOM

**Worktree:** `/Users/pontus.horberg-Local/Sourcecode/youtube-transcript-service/.worktrees/chrome-extension/extension`

**Design doc:** `docs/plans/2026-02-17-chrome-extension-ui-redesign.md`

---

### Task 1: CSS Foundation — YouTube-native custom properties + dark mode

**Files:**
- Rewrite: `src/entrypoints/youtube.content/style.css`

**Step 1: Replace style.css with YouTube-native CSS custom properties**

Replace the entire contents of `src/entrypoints/youtube.content/style.css` with:

```css
@import "tailwindcss";

/* YouTube-native theming via CSS custom properties */
:host {
  display: block !important;
  font-family: "Roboto", "Arial", sans-serif;

  /* Light mode (default) */
  --bg-primary: #ffffff;
  --bg-secondary: #f2f2f2;
  --bg-hover: #f2f2f2;
  --bg-active: #def1ff;
  --text-primary: #0f0f0f;
  --text-secondary: #606060;
  --text-link: #065fd4;
  --border: #e5e5e5;
  --accent: #065fd4;
  --accent-hover: #0450b5;
  --accent-light: #def1ff;
  --error: #cc0000;
  --success: #2ba640;

  /* Chat bubbles */
  --bubble-user: #065fd4;
  --bubble-user-text: #ffffff;
  --bubble-ai: #f2f2f2;
  --bubble-ai-text: #0f0f0f;

  /* Skeleton loader */
  --skeleton-base: #e5e5e5;
  --skeleton-shine: #f2f2f2;
}

:host(.dark) {
  --bg-primary: #0f0f0f;
  --bg-secondary: #272727;
  --bg-hover: #3f3f3f;
  --bg-active: #263850;
  --text-primary: #f1f1f1;
  --text-secondary: #aaaaaa;
  --text-link: #3ea6ff;
  --border: #3f3f3f;
  --accent: #3ea6ff;
  --accent-hover: #67b8ff;
  --accent-light: #263850;
  --error: #ff4444;
  --success: #4caf50;

  --bubble-user: #3ea6ff;
  --bubble-user-text: #0f0f0f;
  --bubble-ai: #272727;
  --bubble-ai-text: #f1f1f1;

  --skeleton-base: #3f3f3f;
  --skeleton-shine: #4f4f4f;
}

/* Skeleton animation */
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

.skeleton {
  background: var(--skeleton-base);
  border-radius: 4px;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
```

**Step 2: Verify build succeeds**

Run: `cd /Users/pontus.horberg-Local/Sourcecode/youtube-transcript-service/.worktrees/chrome-extension/extension && npm run build`
Expected: Build succeeds without errors.

**Step 3: Commit**

```bash
git add src/entrypoints/youtube.content/style.css
git commit -m "feat(extension): YouTube-native CSS custom properties with dark mode"
```

---

### Task 2: Dark mode detection in content script

**Files:**
- Modify: `src/entrypoints/youtube.content/index.tsx`

**Step 1: Add dark mode observer to content script**

Add a function that watches YouTube's `<html>` element for the `dark` attribute and toggles a `.dark` class on our shadow host element.

In `index.tsx`, add this function before `handleVideoPage`:

```typescript
function setupDarkModeObserver(shadowHost: Element) {
  const html = document.documentElement;

  function updateTheme() {
    const isDark = html.hasAttribute('dark');
    if (isDark) {
      shadowHost.classList.add('dark');
    } else {
      shadowHost.classList.remove('dark');
    }
  }

  updateTheme();

  const observer = new MutationObserver(updateTheme);
  observer.observe(html, { attributes: true, attributeFilter: ['dark'] });
  return observer;
}
```

Then in the `createShadowRootUi` config, update `onMount` to call `setupDarkModeObserver`:

```typescript
onMount(container, shadow, shadowHost) {
  setupDarkModeObserver(shadowHost);
  const wrapper = document.createElement('div');
  container.append(wrapper);
  render(<Widget videoId={videoId} />, wrapper);
  return wrapper;
},
```

Note: `createShadowRootUi`'s `onMount` callback receives `(container, shadow, shadowHost)` — the third argument is the host element (`<transcript-widget>`).

**Step 2: Build and verify**

Run: `npm run build`
Expected: Build succeeds. On YouTube, the widget host element gets `.dark` class when YouTube is in dark mode.

**Step 3: Commit**

```bash
git add src/entrypoints/youtube.content/index.tsx
git commit -m "feat(extension): auto-detect YouTube dark mode"
```

---

### Task 3: Full sidebar takeover — hide recommendations

**Files:**
- Modify: `src/entrypoints/youtube.content/index.tsx`

**Step 1: Hide YouTube's secondary content when widget is open**

Add helper functions to show/hide YouTube's own sidebar content:

```typescript
function hideSecondaryContent() {
  const secondary = document.querySelector('#secondary');
  if (!secondary) return;
  Array.from(secondary.children).forEach((child) => {
    if (child.tagName?.toLowerCase() !== 'transcript-widget') {
      (child as HTMLElement).style.display = 'none';
    }
  });
}

function showSecondaryContent() {
  const secondary = document.querySelector('#secondary');
  if (!secondary) return;
  Array.from(secondary.children).forEach((child) => {
    if (child.tagName?.toLowerCase() !== 'transcript-widget') {
      (child as HTMLElement).style.display = '';
    }
  });
}
```

Update `handleVideoPage` to pass these functions to the Widget via props. Change the render call:

```typescript
render(
  <Widget
    videoId={videoId}
    onOpen={hideSecondaryContent}
    onMinimize={showSecondaryContent}
    onClose={() => {
      showSecondaryContent();
      ui?.remove();
      ui = null;
    }}
  />,
  wrapper,
);
```

Also call `hideSecondaryContent()` right after `ui.mount()`.

**Step 2: Build and verify**

Expected: When widget is open, recommended videos are hidden. Full sidebar space available.

**Step 3: Commit**

```bash
git add src/entrypoints/youtube.content/index.tsx
git commit -m "feat(extension): hide recommendations when widget is open"
```

---

### Task 4: Widget redesign — three states with persistence

**Files:**
- Rewrite: `src/entrypoints/youtube.content/Widget.tsx`

**Step 1: Rewrite Widget.tsx with three states and persistent storage**

```tsx
import { useState, useEffect } from 'preact/hooks';
import { TranscriptTab } from './tabs/TranscriptTab';
import { SummaryTab } from './tabs/SummaryTab';
import { ChatTab } from './tabs/ChatTab';
import { SaveButton } from './SaveButton';
import { getAuthState, type AuthState } from '../../lib/auth';

type Tab = 'transcript' | 'summary' | 'chat';
type WidgetState = 'open' | 'minimized' | 'closed';

interface Props {
  videoId: string;
  onOpen?: () => void;
  onMinimize?: () => void;
  onClose?: () => void;
}

export function Widget({ videoId, onOpen, onMinimize, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('transcript');
  const [widgetState, setWidgetState] = useState<WidgetState>('open');
  const [auth, setAuth] = useState<AuthState>({ isSignedIn: false, isPro: false, token: null });
  const [initialized, setInitialized] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    chrome.storage.local.get(['widgetState', 'activeTab'], (result) => {
      if (result.widgetState === 'closed') {
        setWidgetState('closed');
        onClose?.();
      } else if (result.widgetState === 'minimized') {
        setWidgetState('minimized');
        onMinimize?.();
      } else {
        setWidgetState('open');
        onOpen?.();
      }
      if (result.activeTab) {
        setActiveTab(result.activeTab);
      }
      setInitialized(true);
    });
    getAuthState().then(setAuth);
  }, []);

  // Persist state changes
  useEffect(() => {
    if (!initialized) return;
    chrome.storage.local.set({ widgetState, activeTab });
  }, [widgetState, activeTab, initialized]);

  function handleMinimize() {
    setWidgetState('minimized');
    onMinimize?.();
  }

  function handleOpen() {
    setWidgetState('open');
    onOpen?.();
  }

  function handleClose() {
    setWidgetState('closed');
    onClose?.();
  }

  if (!initialized) return null;

  if (widgetState === 'closed') return null;

  if (widgetState === 'minimized') {
    return (
      <button
        onClick={handleOpen}
        style={{
          width: '100%',
          padding: '10px 16px',
          marginBottom: '12px',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          color: 'var(--text-primary)',
          fontSize: '14px',
          fontWeight: 500,
          fontFamily: 'Roboto, Arial, sans-serif',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '10px' }}>&#9654;</span>
        Transcript Tool
      </button>
    );
  }

  // Open state
  return (
    <div
      style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        marginBottom: '12px',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 100px)',
        overflow: 'hidden',
        fontFamily: 'Roboto, Arial, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Transcript Tool
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleMinimize}
            title="Minimize"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '2px 6px',
              borderRadius: '4px',
              lineHeight: 1,
            }}
          >
            &#8722;
          </button>
          <button
            onClick={handleClose}
            title="Close"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '2px 6px',
              borderRadius: '4px',
              lineHeight: 1,
            }}
          >
            &#10005;
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        {(['transcript', 'summary', 'chat'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '10px 12px',
              fontSize: '13px',
              fontWeight: 500,
              fontFamily: 'Roboto, Arial, sans-serif',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content — scrollable, fills remaining space */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {activeTab === 'transcript' && <TranscriptTab videoId={videoId} />}
        {activeTab === 'summary' && <SummaryTab videoId={videoId} />}
        {activeTab === 'chat' && <ChatTab videoId={videoId} auth={auth} />}
      </div>

      {/* Action bar — sticky bottom */}
      <SaveButton videoId={videoId} auth={auth} />
    </div>
  );
}
```

**Step 2: Build and verify**

Run: `npm run build`
Expected: Widget fills the full sidebar height. Three states work. State persists on reload.

**Step 3: Commit**

```bash
git add src/entrypoints/youtube.content/Widget.tsx
git commit -m "feat(extension): full-height widget with three states and persistence"
```

---

### Task 5: TranscriptTab — search, lazy load, inline styles

**Files:**
- Rewrite: `src/entrypoints/youtube.content/tabs/TranscriptTab.tsx`

**Step 1: Rewrite TranscriptTab with search and lazy loading**

Key changes from current version:
- Does NOT auto-fetch on mount — shows a "Load transcript" button first
- Adds a search field that filters/highlights matching segments
- Uses inline styles with CSS custom properties instead of Tailwind classes
- Improved auto-scroll behavior

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
    const match = line.match(/\*\*\[(\d{1,2}:\d{2}(?::\d{2})?)\]\*\*\s*(.*)/);
    if (match) {
      const timestamp = match[1];
      const text = match[2];
      const parts = timestamp.split(':').map(Number);
      const seconds =
        parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
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
  const [searchQuery, setSearchQuery] = useState('');
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // Sync with video time
  useEffect(() => {
    const video = document.querySelector('video');
    if (!video) return;
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, []);

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentTime]);

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
        setLoaded(true);
      } else {
        setError(response.error || 'Failed to fetch transcript');
      }
    } catch {
      setError('Communication error');
    } finally {
      setLoading(false);
    }
  }

  // Filter segments by search
  const filteredSegments = searchQuery
    ? segments.filter((s) => s.text.toLowerCase().includes(searchQuery.toLowerCase()))
    : segments;

  const currentIndex = filteredSegments.findLastIndex((s) => s.seconds <= currentTime);

  // Not loaded yet — show CTA
  if (!loaded && !loading && !error) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <button
          onClick={loadTranscript}
          style={{
            padding: '10px 24px',
            background: 'var(--accent)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'Roboto, Arial, sans-serif',
          }}
        >
          Load transcript
        </button>
        <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Read along with clickable timestamps
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '16px' }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <div className="skeleton" style={{ width: '48px', height: '16px' }} />
            <div className="skeleton" style={{ flex: 1, height: '16px' }} />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <p style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{error}</p>
        <button
          onClick={loadTranscript}
          style={{
            fontSize: '13px',
            color: 'var(--accent)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
        No transcript available for this video
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Search transcript..."
          value={searchQuery}
          onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            fontSize: '13px',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            outline: 'none',
            fontFamily: 'Roboto, Arial, sans-serif',
          }}
        />
      </div>

      {/* Segments */}
      <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {filteredSegments.map((seg, i) => {
          const isActive = i === currentIndex && !searchQuery;
          return (
            <div
              key={`${seg.seconds}-${i}`}
              ref={isActive ? activeRef : undefined}
              onClick={() => seekVideo(seg.seconds)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                background: isActive ? 'var(--accent-light)' : 'transparent',
                fontSize: '13px',
                lineHeight: 1.5,
                display: 'flex',
                gap: '8px',
              }}
              onMouseOver={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
              }}
              onMouseOut={(e) => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <span
                style={{
                  fontFamily: 'Roboto Mono, monospace',
                  fontSize: '12px',
                  color: 'var(--accent)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {seg.timestamp}
              </span>
              <span style={{ color: 'var(--text-primary)' }}>{seg.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 2: Build and verify**

Run: `npm run build`
Expected: Transcript tab shows "Load transcript" button. Clicking it fetches and displays transcript. Search works. Auto-scroll follows video.

**Step 3: Commit**

```bash
git add src/entrypoints/youtube.content/tabs/TranscriptTab.tsx
git commit -m "feat(extension): transcript tab with search, lazy load, YouTube styling"
```

---

### Task 6: SummaryTab — skeleton loader, on-demand, inline styles

**Files:**
- Rewrite: `src/entrypoints/youtube.content/tabs/SummaryTab.tsx`

**Step 1: Rewrite SummaryTab with skeleton loader and YouTube styling**

Key changes:
- Shows cached summary if available, otherwise shows CTA button
- Skeleton loader during generation
- Inline styles with CSS custom properties

```tsx
import { useState, useEffect } from 'preact/hooks';

interface Props {
  videoId: string;
}

export function SummaryTab({ videoId }: Props) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingCache, setCheckingCache] = useState(true);

  // Check cache on mount
  useEffect(() => {
    chrome.storage.local.get(`summary_${videoId}`, (result) => {
      const cached = result[`summary_${videoId}`];
      if (cached) setSummary(cached);
      setCheckingCache(false);
    });
  }, [videoId]);

  async function generateSummary() {
    setLoading(true);
    setError(null);

    try {
      // First fetch transcript
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

      // Then summarize
      const summaryRes = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'SUMMARIZE', markdown: transcriptRes.data.markdown },
          resolve,
        );
      });

      if (summaryRes.success) {
        setSummary(summaryRes.data.summary);
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

  if (checkingCache) return null;

  // Loading state — skeleton
  if (loading) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '20px' }}>
          Generating summary...
        </p>
        <div className="skeleton" style={{ width: '60%', height: '18px', marginBottom: '16px' }} />
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '10px', paddingLeft: '8px' }}>
            <div className="skeleton" style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, marginTop: '6px' }} />
            <div className="skeleton" style={{ flex: 1, height: '14px' }} />
          </div>
        ))}
        <div className="skeleton" style={{ width: '40%', height: '18px', marginTop: '24px', marginBottom: '12px' }} />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: '14px', marginBottom: '8px', width: i === 2 ? '70%' : '100%' }} />
        ))}
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div style={{ padding: '24px 16px' }}>
        <p style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{error}</p>
        <button
          onClick={generateSummary}
          style={{ fontSize: '13px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Try again
        </button>
      </div>
    );
  }

  // Summary loaded
  if (summary) {
    return (
      <div
        style={{
          padding: '16px',
          fontSize: '13px',
          lineHeight: 1.7,
          color: 'var(--text-primary)',
          whiteSpace: 'pre-wrap',
          overflowY: 'auto',
        }}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(summary) }}
      />
    );
  }

  // CTA — not loaded yet
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <button
        onClick={generateSummary}
        style={{
          padding: '10px 24px',
          background: 'var(--accent)',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'pointer',
          fontFamily: 'Roboto, Arial, sans-serif',
        }}
      >
        Summarize video
      </button>
      <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        AI generates key takeaways and a summary
      </p>
    </div>
  );
}

/** Minimal markdown renderer for summary output */
function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^## (.+)$/gm, '<h3 style="font-size:15px;font-weight:600;margin:16px 0 8px;color:var(--text-primary)">$1</h3>')
    .replace(/^\* (.+)$/gm, '<div style="display:flex;gap:8px;margin:4px 0;padding-left:4px"><span style="color:var(--text-secondary)">&#8226;</span><span>$1</span></div>')
    .replace(/^- (.+)$/gm, '<div style="display:flex;gap:8px;margin:4px 0;padding-left:4px"><span style="color:var(--text-secondary)">&#8226;</span><span>$1</span></div>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}
```

**Step 2: Build and verify**

Run: `npm run build`
Expected: Summary tab shows CTA button. Generates summary with skeleton loader. Caches result.

**Step 3: Commit**

```bash
git add src/entrypoints/youtube.content/tabs/SummaryTab.tsx
git commit -m "feat(extension): summary tab with skeleton loader and markdown rendering"
```

---

### Task 7: ChatTab — suggested questions, improved bubbles, inline styles

**Files:**
- Rewrite: `src/entrypoints/youtube.content/tabs/ChatTab.tsx`

**Step 1: Rewrite ChatTab with suggested questions and YouTube styling**

Key changes:
- Suggested questions shown initially
- Shift+Enter for new line
- Inline styles with CSS custom properties
- Improved bubble design

```tsx
import { useState, useEffect, useRef } from 'preact/hooks';
import type { AuthState } from '../../../lib/auth';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  videoId: string;
  auth: AuthState;
}

const SUGGESTED_QUESTIONS = [
  'Summarize the key points',
  'What are the action items?',
  'Explain the main argument',
];

export function ChatTab({ videoId, auth }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Not signed in
  if (!auth.isSignedIn) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Chat with this video
        </p>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Ask questions, get answers based on the video content
        </p>
        <button
          onClick={() => chrome.runtime.sendMessage({ type: 'OPEN_POPUP' })}
          style={{
            padding: '10px 24px',
            background: 'var(--accent)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'Roboto, Arial, sans-serif',
          }}
        >
          Sign in to start
        </button>
      </div>
    );
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'CHAT',
            videoId,
            message: userMsg.content,
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
      // Silent fail
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', minHeight: 0 }}>
        {messages.length === 0 && !loading && (
          <div style={{ padding: '24px 0' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '16px' }}>
              Ask anything about this video
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  style={{
                    padding: '8px 12px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'Roboto, Arial, sans-serif',
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              marginBottom: '10px',
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '8px 14px',
                borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                background: msg.role === 'user' ? 'var(--bubble-user)' : 'var(--bubble-ai)',
                color: msg.role === 'user' ? 'var(--bubble-user-text)' : 'var(--bubble-ai-text)',
                fontSize: '13px',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ marginBottom: '10px' }}>
            <div
              style={{
                display: 'inline-block',
                padding: '8px 14px',
                borderRadius: '12px 12px 12px 2px',
                background: 'var(--bubble-ai)',
                color: 'var(--text-secondary)',
                fontSize: '13px',
              }}
            >
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={input}
            onInput={(e) => setInput((e.target as HTMLInputElement).value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '13px',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              outline: 'none',
              fontFamily: 'Roboto, Arial, sans-serif',
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            style={{
              padding: '8px 14px',
              background: 'var(--accent)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              cursor: loading || !input.trim() ? 'default' : 'pointer',
              opacity: loading || !input.trim() ? 0.5 : 1,
              fontFamily: 'Roboto, Arial, sans-serif',
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Build and verify**

Run: `npm run build`
Expected: Chat tab shows suggested questions or sign-in prompt. Messages display correctly.

**Step 3: Commit**

```bash
git add src/entrypoints/youtube.content/tabs/ChatTab.tsx
git commit -m "feat(extension): chat tab with suggested questions and YouTube styling"
```

---

### Task 8: SaveButton — action bar with inline styles

**Files:**
- Rewrite: `src/entrypoints/youtube.content/SaveButton.tsx`

**Step 1: Rewrite SaveButton as a sticky action bar**

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

  const barStyle = {
    padding: '10px 16px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as const;

  const buttonStyle = {
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    border: 'none',
    fontFamily: 'Roboto, Arial, sans-serif',
  } as const;

  if (!auth.isSignedIn) {
    return (
      <div style={barStyle}>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Sign in to save to your library
        </span>
      </div>
    );
  }

  if (saved) {
    return (
      <div style={barStyle}>
        <span style={{ fontSize: '13px', color: 'var(--success)', fontWeight: 500 }}>
          Saved to library
        </span>
      </div>
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'SAVE_TO_LIBRARY', url: `https://www.youtube.com/watch?v=${videoId}`, token: auth.token },
          resolve,
        );
      });
      if (response.success) setSaved(true);
    } catch {
      // Silent fail
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={barStyle}>
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          ...buttonStyle,
          background: 'var(--accent)',
          color: '#ffffff',
          width: '100%',
          opacity: saving ? 0.5 : 1,
        }}
      >
        {saving ? 'Saving...' : 'Save to library'}
      </button>
    </div>
  );
}
```

**Step 2: Build and verify**

Run: `npm run build`
Expected: Action bar shows at bottom of widget. Save works for authenticated users.

**Step 3: Commit**

```bash
git add src/entrypoints/youtube.content/SaveButton.tsx
git commit -m "feat(extension): save button as sticky action bar"
```

---

### Task 9: Final build, manual test, and cleanup

**Step 1: Full build**

Run: `npm run build`
Expected: Clean build, no errors.

**Step 2: Manual test checklist**

Load extension in Chrome (`chrome://extensions` → Reload) and test on a YouTube video:

- [ ] Widget fills full sidebar, recommendations hidden
- [ ] Header shows "Transcript Tool" with [-] and [x] buttons
- [ ] Minimize ([-]) collapses to slim bar, recommendations reappear
- [ ] Click minimized bar reopens widget
- [ ] Close ([x]) removes widget completely, recommendations show
- [ ] Tab switching works (Transcript / Summary / Chat)
- [ ] Transcript tab: "Load transcript" CTA shown initially
- [ ] Transcript tab: loads and displays clickable segments
- [ ] Transcript tab: search filters segments
- [ ] Transcript tab: auto-scroll follows video playback
- [ ] Summary tab: "Summarize video" CTA shown initially
- [ ] Summary tab: skeleton loader during generation
- [ ] Summary tab: cached result loads instantly on revisit
- [ ] Chat tab: sign-in prompt for unauthenticated users
- [ ] Chat tab: suggested questions shown for authenticated users
- [ ] Save button visible at bottom
- [ ] Dark mode: toggle YouTube dark mode, widget follows
- [ ] Navigate to another video: widget persists state, content resets
- [ ] Widget state persists across page reload

**Step 3: Commit any fixes from testing**

```bash
git add -A
git commit -m "fix(extension): polish from manual testing"
```
