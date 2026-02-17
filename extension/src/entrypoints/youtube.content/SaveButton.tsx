import { useState } from 'preact/hooks';
import type { AuthState } from '../../lib/auth';

interface Props {
  videoId: string;
  auth: AuthState;
}

export function SaveButton({ videoId, auth }: Props) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

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

  // Not signed in
  if (!auth.isSignedIn) {
    return (
      <div style={containerStyle}>
        <span
          style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            fontFamily: 'Roboto, sans-serif',
          }}
        >
          Sign in to save to your library
        </span>
      </div>
    );
  }

  // Saved
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

  // Saving or ready to save
  return (
    <div style={containerStyle}>
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          ...buttonStyle,
          ...(saving ? { opacity: '0.5', cursor: 'default' } : {}),
        }}
      >
        {saving ? 'Saving...' : 'Save to library'}
      </button>
    </div>
  );
}
