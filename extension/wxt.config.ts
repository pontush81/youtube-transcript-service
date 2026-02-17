import { defineConfig } from 'wxt';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Transcript Tool',
    description: 'YouTube transcripts, AI summaries & chat',
    icons: {
      16: 'icon-16.png',
      32: 'icon-32.png',
      48: 'icon-48.png',
      128: 'icon-128.png',
    },
    permissions: ['storage', 'cookies', 'tabs'],
    host_permissions: [
      'https://www.youtube.com/*',
      'https://youtube-transcript-service-two.vercel.app/*',
      'https://*.clerk.accounts.dev/*',
    ],
  },
  vite: () => ({
    plugins: [preact(), tailwindcss()],
  }),
});
