import { fetchTranscript, fetchSummary, saveToLibrary, chatWithVideo } from '../lib/api';

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((err) => {
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
      case 'SUMMARIZE': {
        const data = await fetchSummary(message.markdown);
        return { success: true, data };
      }
      case 'SAVE_TO_LIBRARY': {
        const data = await saveToLibrary(message.url);
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
      case 'OPEN_POPUP': {
        // Chrome doesn't allow programmatic popup opening from content scripts.
        // Open the extension popup page in a new tab instead.
        chrome.tabs.create({ url: chrome.runtime.getURL('/popup.html') });
        return { success: true };
      }
      case 'GET_AUTH_STATE': {
        const result = await chrome.storage.local.get(['authToken', 'isPro']);
        return {
          isSignedIn: !!result.authToken,
          isPro: !!result.isPro,
          token: result.authToken || null,
        };
      }
      case 'SET_AUTH_STATE': {
        await chrome.storage.local.set({
          authToken: message.token,
          isPro: message.isPro,
        });
        return { success: true };
      }
      default:
        return { success: false, error: `Unknown message type: ${message.type}` };
    }
  }
});
