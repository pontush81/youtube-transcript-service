import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';

interface TranscriptSegment {
  timestamp: string;
  seconds: number;
  text: string;
}

interface ApiSegment {
  text: string;
  offset: number;
  duration: number;
}

interface Props {
  videoId: string;
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function apiSegmentsToTranscript(apiSegments: ApiSegment[]): TranscriptSegment[] {
  return apiSegments.map((seg) => ({
    timestamp: formatTimestamp(seg.offset),
    seconds: seg.offset,
    text: seg.text,
  }));
}

function seekVideo(seconds: number) {
  const video = document.querySelector('video');
  if (video) {
    video.currentTime = seconds;
    video.play();
  }
}

function highlightMatch(text: string, query: string): preact.JSX.Element {
  if (!query) return <>{text}</>;

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span
            key={i}
            style={{
              background: 'var(--accent-light)',
              color: 'var(--accent)',
              borderRadius: '2px',
              padding: '0 2px',
              fontWeight: 600,
            }}
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function TranscriptTab({ videoId }: Props) {
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const activeSegmentRef = useRef<HTMLDivElement>(null);

  // Track video time
  useEffect(() => {
    const video = document.querySelector('video');
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, []);

  // Auto-scroll active segment into view
  useEffect(() => {
    if (activeSegmentRef.current && !searchQuery) {
      activeSegmentRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentTime, searchQuery]);

  const loadTranscript = useCallback(async () => {
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
        if (response.data.segments && response.data.segments.length > 0) {
          setSegments(apiSegmentsToTranscript(response.data.segments));
        }
        setLoaded(true);
      } else {
        setError(response.error || 'Failed to fetch transcript');
      }
    } catch {
      setError('Communication error');
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  const filteredSegments = useMemo(() => {
    if (!searchQuery) return segments;
    const q = searchQuery.toLowerCase();
    return segments.filter((seg) => seg.text.toLowerCase().includes(q));
  }, [segments, searchQuery]);

  const currentIndex = useMemo(() => {
    if (searchQuery) return -1;
    return segments.findLastIndex((s) => s.seconds <= currentTime);
  }, [segments, currentTime, searchQuery]);

  // --- Initial CTA state ---
  if (!loaded && !loading && !error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
          gap: '12px',
        }}
      >
        <p
          style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            textAlign: 'center',
            lineHeight: '18px',
            margin: 0,
          }}
        >
          Load the transcript to read along, search, and jump to any moment.
        </p>
        <button
          onClick={loadTranscript}
          style={{
            background: 'var(--accent)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '18px',
            padding: '8px 20px',
            fontSize: '14px',
            fontWeight: 500,
            fontFamily: 'Roboto, Arial, sans-serif',
            cursor: 'pointer',
          }}
        >
          Load transcript
        </button>
      </div>
    );
  }

  // --- Loading skeleton ---
  if (loading) {
    return (
      <div style={{ padding: '12px 0' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '8px 12px',
            }}
          >
            <div
              className="skeleton"
              style={{
                width: '48px',
                height: '14px',
                flexShrink: 0,
                marginTop: '1px',
              }}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div
                className="skeleton"
                style={{
                  width: `${60 + (i % 3) * 15}%`,
                  height: '14px',
                }}
              />
              {i % 2 === 0 && (
                <div
                  className="skeleton"
                  style={{
                    width: `${40 + (i % 4) * 10}%`,
                    height: '14px',
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
          gap: '12px',
        }}
      >
        <p
          style={{
            fontSize: '13px',
            color: 'var(--error)',
            textAlign: 'center',
            margin: 0,
            lineHeight: '18px',
          }}
        >
          {error}
        </p>
        <button
          onClick={loadTranscript}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: '18px',
            padding: '6px 16px',
            fontSize: '13px',
            fontFamily: 'Roboto, Arial, sans-serif',
            color: 'var(--accent)',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  // --- Empty state ---
  if (segments.length === 0) {
    return (
      <div
        style={{
          padding: '32px 16px',
          textAlign: 'center',
          fontSize: '13px',
          color: 'var(--text-secondary)',
        }}
      >
        No transcript available for this video.
      </div>
    );
  }

  // --- Loaded: search + segment list ---
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search input */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <input
          type="text"
          placeholder="Search transcript..."
          value={searchQuery}
          onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
          style={{
            width: '100%',
            padding: '6px 10px',
            fontSize: '13px',
            fontFamily: 'Roboto, Arial, sans-serif',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Search results count */}
      {searchQuery && (
        <div
          style={{
            padding: '4px 12px',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          {filteredSegments.length} result{filteredSegments.length !== 1 ? 's' : ''} found
        </div>
      )}

      {/* Segment list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
        }}
      >
        {filteredSegments.length === 0 && searchQuery ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              fontSize: '13px',
              color: 'var(--text-secondary)',
            }}
          >
            No matching segments found.
          </div>
        ) : (
          filteredSegments.map((seg, i) => {
            const isActive = !searchQuery && segments.indexOf(seg) === currentIndex;
            return (
              <div
                key={`${seg.seconds}-${i}`}
                ref={isActive ? activeSegmentRef : undefined}
                onClick={() => seekVideo(seg.seconds)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '6px 12px',
                  borderLeft: isActive
                    ? '3px solid var(--accent)'
                    : '3px solid transparent',
                  background: isActive ? 'var(--accent-light)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = isActive
                    ? 'var(--accent-light)'
                    : 'transparent';
                }}
              >
                <span
                  style={{
                    fontFamily: 'Roboto Mono, monospace',
                    fontSize: '12px',
                    color: 'var(--accent)',
                    flexShrink: 0,
                    marginTop: '1px',
                    lineHeight: '18px',
                  }}
                >
                  {seg.timestamp}
                </span>
                <span
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    lineHeight: '18px',
                    wordBreak: 'break-word',
                  }}
                >
                  {searchQuery ? highlightMatch(seg.text, searchQuery) : seg.text}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
