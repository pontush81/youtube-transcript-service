import { useState } from 'preact/hooks';

interface Props {
  videoId: string;
}

export function SaveButton({ videoId }: Props) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const response = await new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'SAVE_TO_LIBRARY',
            url: `https://www.youtube.com/watch?v=${videoId}`,
          },
          resolve,
        );
      });
      if (response.success) {
        setSaved(true);
      } else {
        setError(response.error || 'Save failed');
      }
    } catch {
      setError('Could not reach server');
    } finally {
      setSaving(false);
    }
  }

  const containerStyle: Record<string, string> = {
    padding: '10px 16px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: '0',
  };

  const buttonStyle: Record<string, string> = {
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '500',
    fontFamily: 'Roboto, sans-serif',
    border: 'none',
    cursor: 'pointer',
    width: '100%',
    backgroundColor: 'var(--accent)',
    color: '#fff',
  };

  if (saved) {
    return (
      <div style={containerStyle}>
        <span
          style={{
            fontSize: '13px',
            fontWeight: '500',
            color: 'var(--success)',
            fontFamily: 'Roboto, sans-serif',
          }}
        >
          Saved to library
        </span>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {error && (
        <span style={{ fontSize: '12px', color: 'var(--error)', marginRight: '8px' }}>
          {error}
        </span>
      )}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          ...buttonStyle,
          ...(saving ? { opacity: '0.5', cursor: 'default' } : {}),
        }}
      >
        {saving ? 'Saving...' : error ? 'Retry' : 'Save to library'}
      </button>
    </div>
  );
}
