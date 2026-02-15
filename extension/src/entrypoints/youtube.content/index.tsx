import './style.css';
import { render } from 'preact';
import { Widget } from './Widget';

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  cssInjectionMode: 'ui',
  runAt: 'document_end',

  async main(ctx) {
    let ui: Awaited<ReturnType<typeof createShadowRootUi>> | null = null;

    function getVideoId(url: string): string | null {
      const match = url.match(/[?&]v=([^&]+)/);
      return match?.[1] ?? null;
    }

    function waitForElement(selector: string, timeout = 5000): Promise<Element | null> {
      return new Promise((resolve) => {
        const existing = document.querySelector(selector);
        if (existing) { resolve(existing); return; }

        const observer = new MutationObserver(() => {
          const el = document.querySelector(selector);
          if (el) { observer.disconnect(); resolve(el); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
      });
    }

    async function handleVideoPage() {
      const videoId = getVideoId(window.location.href);
      if (!videoId) {
        ui?.remove();
        ui = null;
        return;
      }

      const anchor = await waitForElement('#secondary', 5000);
      if (!anchor) return;

      ui?.remove();

      ui = await createShadowRootUi(ctx, {
        name: 'transcript-widget',
        position: 'inline',
        anchor: '#secondary',
        append: 'first',
        onMount(container) {
          const wrapper = document.createElement('div');
          container.append(wrapper);
          render(<Widget videoId={videoId} />, wrapper);
          return wrapper;
        },
        onRemove(wrapper) {
          if (wrapper) render(null, wrapper);
        },
      });

      ui.mount();
    }

    await handleVideoPage();

    // Handle YouTube SPA navigation
    ctx.addEventListener(window, 'wxt:locationchange', () => {
      handleVideoPage();
    });
    ctx.addEventListener(document, 'yt-navigate-finish' as any, () => {
      handleVideoPage();
    });
  },
});
