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
