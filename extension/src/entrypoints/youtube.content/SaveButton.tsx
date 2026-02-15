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
          Upgrade to Pro to save
        </button>
      </div>
    );
  }

  if (saved) {
    return (
      <div class="border-t border-gray-100 px-4 py-3">
        <div class="text-center text-sm text-green-600">Saved to library</div>
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
        {saving ? 'Saving...' : 'Save to library'}
      </button>
    </div>
  );
}
