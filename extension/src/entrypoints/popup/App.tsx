import { useEffect } from 'preact/hooks';
import { SignedIn, SignedOut, SignInButton, UserButton, useAuth, useUser } from '@clerk/chrome-extension';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'https://youtube-transcript-service-two.vercel.app';

function AuthSync() {
  const { getToken, isSignedIn } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    async function syncAuth() {
      if (isSignedIn) {
        const token = await getToken();
        const isPro = user?.publicMetadata?.plan === 'pro';
        await chrome.storage.local.set({ authToken: token, isPro });
      } else {
        await chrome.storage.local.remove(['authToken', 'isPro']);
      }
    }
    syncAuth();
  }, [isSignedIn, getToken, user]);

  return null;
}

export function App() {
  return (
    <div class="w-80 p-4">
      <h1 class="mb-3 text-base font-bold text-gray-900">Transcript Tool</h1>
      <AuthSync />

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
        <div class="mb-4 flex items-center justify-between">
          <span class="text-sm text-gray-600">Signed in</span>
          <UserButton />
        </div>
        <a
          href={`${API_BASE}/transcripts`}
          target="_blank"
          class="block w-full rounded-lg border border-gray-200 px-4 py-2 text-center text-sm text-gray-700 hover:bg-gray-50"
        >
          Open library
        </a>
      </SignedIn>
    </div>
  );
}
