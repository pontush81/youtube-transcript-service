import { useState, useEffect } from 'preact/hooks';
import { TranscriptTab } from './tabs/TranscriptTab';
import { SummaryTab } from './tabs/SummaryTab';
import { ChatTab } from './tabs/ChatTab';
import { SaveButton } from './SaveButton';
import { getAuthState, type AuthState } from '../../lib/auth';

type Tab = 'transcript' | 'summary' | 'chat';

interface Props {
  videoId: string;
}

export function Widget({ videoId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('transcript');
  const [collapsed, setCollapsed] = useState(false);
  const [auth, setAuth] = useState<AuthState>({ isSignedIn: false, isPro: false, token: null });

  useEffect(() => {
    getAuthState().then(setAuth);
  }, []);

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
      <div>
        {activeTab === 'transcript' && <TranscriptTab videoId={videoId} />}
        {activeTab === 'summary' && <SummaryTab videoId={videoId} />}
        {activeTab === 'chat' && <ChatTab videoId={videoId} auth={auth} />}
      </div>

      <SaveButton videoId={videoId} auth={auth} />
    </div>
  );
}
