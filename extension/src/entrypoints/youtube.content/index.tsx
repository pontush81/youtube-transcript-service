import './style.css';
import { render } from 'preact';
import { Widget } from './Widget';

export default defineContentScript({
  matches: ['*://*.youtube.com/*'],
  cssInjectionMode: 'ui',
  runAt: 'document_end',

  async main(ctx) {
    let ui: Awaited<ReturnType<typeof createShadowRootUi>> | null = null;
    let darkModeObserver: MutationObserver | null = null;

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

    // Dark mode: watch YouTube's <html dark> attribute
    function setupDarkModeObserver(shadowHost: Element) {
      const html = document.documentElement;

      function updateTheme() {
        const isDark = html.hasAttribute('dark');
        if (isDark) {
          shadowHost.classList.add('dark');
        } else {
          shadowHost.classList.remove('dark');
        }
      }

      updateTheme();

      const observer = new MutationObserver(updateTheme);
      observer.observe(html, { attributes: true, attributeFilter: ['dark'] });
      return observer;
    }

    // Sidebar takeover: hide/show YouTube's recommendation content
    function hideSecondaryContent() {
      const secondary = document.querySelector('#secondary');
      if (!secondary) return;
      Array.from(secondary.children).forEach((child) => {
        if (child.tagName?.toLowerCase() !== 'transcript-widget') {
          (child as HTMLElement).style.display = 'none';
        }
      });
    }

    function showSecondaryContent() {
      const secondary = document.querySelector('#secondary');
      if (!secondary) return;
      Array.from(secondary.children).forEach((child) => {
        if (child.tagName?.toLowerCase() !== 'transcript-widget') {
          (child as HTMLElement).style.display = '';
        }
      });
    }

    async function handleVideoPage() {
      const videoId = getVideoId(window.location.href);
      if (!videoId) {
        showSecondaryContent();
        ui?.remove();
        ui = null;
        darkModeObserver?.disconnect();
        darkModeObserver = null;
        return;
      }

      const anchor = await waitForElement('#secondary', 5000);
      if (!anchor) return;

      ui?.remove();
      darkModeObserver?.disconnect();

      ui = await createShadowRootUi(ctx, {
        name: 'transcript-widget',
        position: 'inline',
        anchor: '#secondary',
        append: 'first',
        onMount(container, _shadow, shadowHost) {
          darkModeObserver = setupDarkModeObserver(shadowHost);

          const wrapper = document.createElement('div');
          container.append(wrapper);
          render(
            <Widget
              videoId={videoId}
              onOpen={hideSecondaryContent}
              onMinimize={showSecondaryContent}
              onClose={() => {
                showSecondaryContent();
                ui?.remove();
                ui = null;
              }}
            />,
            wrapper,
          );
          return wrapper;
        },
        onRemove(wrapper) {
          if (wrapper) render(null, wrapper);
        },
      });

      ui.mount();
      hideSecondaryContent();
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
