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
