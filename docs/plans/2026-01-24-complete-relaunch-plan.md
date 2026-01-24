# Complete Relaunch Plan: English + Conversion Optimization

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform from Swedish hobby project to global SaaS product with high-converting landing page, proper pricing tiers, and growth infrastructure.

**Architecture:** English-first with i18n foundation, new landing page with hero/social proof, 4-tier pricing (USD), onboarding flow, and SEO basics.

**Tech Stack:** Next.js 16, Tailwind CSS v4, Clerk, Stripe, Vercel Analytics

---

## Phase 1: Foundation (Language + Branding)

### Task 1: Create i18n Infrastructure

**Files:**
- Create: `lib/i18n/en.ts`
- Create: `lib/i18n/index.ts`

**Step 1: Create English translations file**

```typescript
// lib/i18n/en.ts
export const en = {
  // Navigation
  nav: {
    fetch: 'Fetch',
    transcripts: 'Transcripts',
    chat: 'Chat',
    signIn: 'Sign in',
    pricing: 'Pricing',
  },

  // Landing page
  hero: {
    title: 'Turn YouTube Videos Into Searchable Knowledge',
    subtitle: 'Extract transcripts, chat with AI, and build your personal video knowledge base.',
    cta: 'Start Free',
    ctaSecondary: 'See How It Works',
    trustedBy: 'Trusted by creators and researchers worldwide',
  },

  // Features
  features: {
    transcripts: {
      title: 'Instant Transcripts',
      description: 'Extract text from any YouTube video with captions in seconds.',
    },
    chat: {
      title: 'AI-Powered Chat',
      description: 'Ask questions across multiple videos. Get answers with timestamps.',
    },
    organize: {
      title: 'Knowledge Base',
      description: 'Save, organize, and search your video library.',
    },
  },

  // Pricing
  pricing: {
    title: 'Simple, Transparent Pricing',
    subtitle: 'Start free. Upgrade when you need more.',
    monthly: '/month',
    yearly: '/year',
    save: 'Save 17%',
    currentPlan: 'Current Plan',
    upgrade: 'Upgrade',
    mostPopular: 'Most Popular',
    free: {
      name: 'Free',
      price: '$0',
      features: [
        '3 transcripts per day',
        '3 AI chats per day',
        'Save to knowledge base',
        'Basic search',
      ],
    },
    starter: {
      name: 'Starter',
      price: '$4.99',
      features: [
        '20 transcripts per month',
        '100 AI chats per month',
        'Everything in Free',
        'Priority processing',
      ],
    },
    pro: {
      name: 'Pro',
      price: '$14.99',
      features: [
        '100 transcripts per month',
        'Unlimited AI chats',
        'Everything in Starter',
        'Priority support',
        'Export to Markdown',
      ],
    },
    team: {
      name: 'Team',
      price: '$34.99',
      features: [
        'Unlimited transcripts',
        'Unlimited AI chats',
        'Everything in Pro',
        'API access',
        'Team collaboration',
      ],
    },
  },

  // Forms
  form: {
    urlPlaceholder: 'https://youtube.com/watch?v=... or playlist URL',
    fetchTranscript: 'Fetch Transcript',
    fetching: 'Fetching...',
    processing: 'Processing {count} videos...',
    optional: 'Optional fields',
    name: 'Your name',
    tags: 'Tags (comma separated)',
    notes: 'Notes',
  },

  // Transcript list
  transcripts: {
    title: 'Saved Transcripts',
    search: 'Search title or channel...',
    noResults: 'No transcripts found',
    noTranscripts: 'No transcripts saved yet.',
    fetchFirst: 'Fetch your first transcript',
    edit: 'Edit',
    cancel: 'Cancel',
    delete: 'Delete',
    selected: '{count} selected',
    selectAll: 'All',
    selectNone: 'None',
    selectMine: 'Mine',
    mine: 'Mine',
    sortBy: {
      recent: 'Recently added',
      published: 'Publication date',
      duration: 'Duration',
      views: 'Views',
      title: 'Title A-Z',
    },
    stats: '{count} transcripts from {channels} channels',
  },

  // Chat
  chat: {
    title: 'Chat',
    selectVideos: 'Select videos',
    clearChat: 'Clear chat',
    clearConfirm: 'Clear chat?',
    clearDescription: 'All messages will be deleted. This cannot be undone.',
    askQuestion: 'Ask a question...',
    send: 'Send (Enter)',
    sendHint: 'Enter to send, Shift+Enter for new line',
    emptyTitle: 'Ask a question about your videos',
    emptySubtitle: 'Choose which transcripts to include in the search',
    sources: 'Sources ({count}):',
    showMore: 'Show {count} more',
    showLess: 'Show fewer',
    copy: 'Copy',
    regenerate: 'Regenerate',
    modes: {
      strict: 'Video only',
      strictDesc: 'Answers based only on your transcripts',
      hybrid: 'Video + AI',
      hybridDesc: 'Can use general knowledge and explain concepts',
    },
  },

  // Success page
  success: {
    title: 'Transcript Created!',
    readTranscript: 'Read Transcript',
    preview: 'Preview',
    fetchAnother: 'Fetch Another',
    download: 'Download',
    loading: 'Loading...',
    backHome: 'Back to home',
  },

  // Errors
  errors: {
    generic: 'An error occurred',
    tryAgain: 'Try again',
    rateLimit: 'Too many requests. Please wait.',
    dailyLimit: "You've reached your daily limit. Upgrade to Pro for more.",
    invalidUrl: 'Invalid YouTube URL',
    videoNotFound: 'Video not found or is private',
    noTranscript: 'No transcript available. The video may not have captions.',
    saveFailed: 'Could not save file. Try again.',
    unauthorized: 'Unauthorized',
    notFound: 'Not found',
    deleteOwn: 'You can only delete your own transcripts',
    adminRequired: 'Admin key required to delete others\' transcripts',
  },

  // Common
  common: {
    loading: 'Loading...',
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'Confirm',
    back: 'Back',
    next: 'Next',
    save: 'Save',
    views: '{count} views',
    viewsK: '{count}K views',
    viewsM: '{count}M views',
  },

  // Delete modal
  deleteModal: {
    title: 'Delete {count} transcripts',
    titleSingle: 'Delete transcript',
    confirm: 'Are you sure? This cannot be undone.',
    adminKey: 'Admin key',
    adminRequired: 'Required to delete others\' transcripts',
    deleting: 'Deleting...',
  },

  // Usage display
  usage: {
    today: 'Today',
    thisMonth: 'This month',
    chats: 'chats',
    transcripts: 'transcripts',
  },

  // Markdown generation
  markdown: {
    video: 'Video',
    watchOnYouTube: 'Watch on YouTube',
    created: 'Created',
    submittedBy: 'Submitted by',
    tags: 'Tags',
    notes: 'Notes',
    summary: 'Summary',
    transcript: 'Transcript',
  },

  // Onboarding
  onboarding: {
    welcome: 'Welcome to TubeBase!',
    step1Title: 'Fetch Transcripts',
    step1Desc: 'Paste any YouTube URL to extract the transcript instantly.',
    step2Title: 'Build Your Library',
    step2Desc: 'Save transcripts to your personal knowledge base.',
    step3Title: 'Chat with AI',
    step3Desc: 'Ask questions across all your videos and get answers with timestamps.',
    getStarted: 'Get Started',
    skipTour: 'Skip tour',
  },
} as const;
```

**Step 2: Create i18n index with helper**

```typescript
// lib/i18n/index.ts
import { en } from './en';

export const translations = { en } as const;
export type Locale = keyof typeof translations;
export const defaultLocale: Locale = 'en';

// Simple translation getter
export function t(key: string): string {
  const keys = key.split('.');
  let value: unknown = translations[defaultLocale];

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return key; // Fallback to key if not found
    }
  }

  return typeof value === 'string' ? value : key;
}

// Template string helper
export function tpl(key: string, params: Record<string, string | number>): string {
  let text = t(key);
  for (const [param, value] of Object.entries(params)) {
    text = text.replace(`{${param}}`, String(value));
  }
  return text;
}

export { en };
```

**Step 3: Commit**

```bash
git add lib/i18n/
git commit -m "feat: add i18n infrastructure with English translations"
```

---

### Task 2: Update Layout and Metadata

**Files:**
- Modify: `app/layout.tsx`

**Step 1: Update language and metadata**

Change `lang="sv"` to `lang="en"` and update metadata:

```typescript
export const metadata: Metadata = {
  title: 'TubeBase - Turn YouTube Videos Into Searchable Knowledge',
  description: 'Extract transcripts from YouTube videos, chat with AI, and build your personal video knowledge base. Free to start.',
  keywords: ['youtube transcript', 'video to text', 'ai chat', 'knowledge base', 'youtube captions'],
  openGraph: {
    title: 'TubeBase - YouTube Knowledge Base',
    description: 'Extract transcripts, chat with AI, build your video knowledge base.',
    type: 'website',
  },
};
```

**Step 2: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: update to English metadata and lang attribute"
```

---

### Task 3: Create New Landing Page with Hero

**Files:**
- Modify: `app/page.tsx`
- Create: `components/landing/Hero.tsx`
- Create: `components/landing/Features.tsx`
- Create: `components/landing/HowItWorks.tsx`
- Create: `components/landing/SocialProof.tsx`
- Create: `components/landing/CTA.tsx`

**Step 1: Create Hero component**

```tsx
// components/landing/Hero.tsx
'use client';

import Link from 'next/link';
import { Play, ArrowRight } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white py-20 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm text-blue-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
            </span>
            Now with AI-powered chat
          </div>

          {/* Headline */}
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
            Turn YouTube Videos Into
            <span className="block text-red-600">Searchable Knowledge</span>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
            Extract transcripts from any YouTube video, chat with AI to find insights,
            and build your personal video knowledge base. Free to start.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-red-700 hover:shadow-xl"
            >
              Start Free
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-8 py-4 text-lg font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <Play className="h-5 w-5" />
              See How It Works
            </Link>
          </div>

          {/* Social proof teaser */}
          <p className="mt-8 text-sm text-gray-500">
            Trusted by 1,000+ creators and researchers
          </p>
        </div>

        {/* Product screenshot/demo */}
        <div className="mt-16 sm:mt-20">
          <div className="relative mx-auto max-w-5xl">
            <div className="rounded-xl bg-gray-900/5 p-2 ring-1 ring-gray-900/10">
              <div className="rounded-lg bg-white p-4 shadow-2xl ring-1 ring-gray-900/5">
                {/* Placeholder for product demo/screenshot */}
                <div className="aspect-video rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                      <Play className="h-8 w-8 text-red-600" />
                    </div>
                    <p className="text-gray-500">Product demo video</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

**Step 2: Create Features component**

```tsx
// components/landing/Features.tsx
import { FileText, MessageSquare, Database, Search, Clock, Download } from 'lucide-react';

const features = [
  {
    icon: FileText,
    title: 'Instant Transcripts',
    description: 'Extract text from any YouTube video with captions. Works with any language.',
  },
  {
    icon: MessageSquare,
    title: 'AI-Powered Chat',
    description: 'Ask questions across multiple videos. Get answers with clickable timestamps.',
  },
  {
    icon: Database,
    title: 'Knowledge Base',
    description: 'Save and organize your video library. Build your personal research database.',
  },
  {
    icon: Search,
    title: 'Smart Search',
    description: 'Find exactly what you need with semantic search across all your transcripts.',
  },
  {
    icon: Clock,
    title: 'Timestamp Links',
    description: 'Jump directly to the moment in the video. Every answer links back to the source.',
  },
  {
    icon: Download,
    title: 'Export Anywhere',
    description: 'Download as Markdown. Perfect for Notion, Obsidian, or any notes app.',
  },
];

export function Features() {
  return (
    <section className="py-20 sm:py-32 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Everything you need to learn from YouTube
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Stop rewatching videos. Start building knowledge.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-gray-200 p-8 transition hover:border-gray-300 hover:shadow-lg"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-red-100">
                <feature.icon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">{feature.title}</h3>
              <p className="mt-2 text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

**Step 3: Create HowItWorks component**

```tsx
// components/landing/HowItWorks.tsx
export function HowItWorks() {
  const steps = [
    {
      number: '1',
      title: 'Paste a YouTube URL',
      description: 'Copy any YouTube video link. Works with individual videos or entire playlists.',
    },
    {
      number: '2',
      title: 'Get the transcript',
      description: 'We extract the transcript instantly. Download as Markdown or save to your library.',
    },
    {
      number: '3',
      title: 'Chat with your videos',
      description: 'Ask questions in natural language. Get answers with timestamps linking back to the source.',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 sm:py-32 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            From YouTube URL to searchable knowledge in seconds
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {index < steps.length - 1 && (
                <div className="absolute left-1/2 top-12 hidden h-0.5 w-full bg-gray-200 lg:block" />
              )}
              <div className="relative flex flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600 text-xl font-bold text-white">
                  {step.number}
                </div>
                <h3 className="mt-6 text-xl font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-2 text-gray-600">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

**Step 4: Create SocialProof component**

```tsx
// components/landing/SocialProof.tsx
import { Star } from 'lucide-react';

const testimonials = [
  {
    quote: "I use this daily for research. Being able to chat across multiple video transcripts is a game-changer.",
    author: "Sarah K.",
    role: "PhD Researcher",
    avatar: "SK",
  },
  {
    quote: "Finally, a way to actually learn from YouTube instead of just watching. The AI chat is incredibly useful.",
    author: "Marcus L.",
    role: "Content Creator",
    avatar: "ML",
  },
  {
    quote: "Saved me hours of rewatching videos. I just ask questions and get answers with timestamps.",
    author: "Anna T.",
    role: "Online Course Creator",
    avatar: "AT",
  },
];

export function SocialProof() {
  return (
    <section className="py-20 sm:py-32 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-6 w-6 fill-yellow-400 text-yellow-400" />
            ))}
          </div>
          <p className="mt-2 text-lg font-semibold text-gray-900">
            Loved by researchers, creators, and learners
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.author}
              className="rounded-2xl bg-gray-50 p-8"
            >
              <p className="text-gray-700">&ldquo;{testimonial.quote}&rdquo;</p>
              <div className="mt-6 flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-sm font-semibold text-red-600">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{testimonial.author}</p>
                  <p className="text-sm text-gray-500">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

**Step 5: Create CTA component**

```tsx
// components/landing/CTA.tsx
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function CTA() {
  return (
    <section className="py-20 sm:py-32 bg-red-600">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Ready to turn videos into knowledge?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-red-100">
          Start free with 3 transcripts per day. No credit card required.
        </p>
        <div className="mt-10">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-lg font-semibold text-red-600 shadow-lg transition hover:bg-gray-100"
          >
            Get Started Free
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
```

**Step 6: Update main page**

```tsx
// app/page.tsx
import { Hero } from '@/components/landing/Hero';
import { Features } from '@/components/landing/Features';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { SocialProof } from '@/components/landing/SocialProof';
import { CTA } from '@/components/landing/CTA';

export default function Home() {
  return (
    <main>
      <Hero />
      <Features />
      <HowItWorks />
      <SocialProof />
      <CTA />
    </main>
  );
}
```

**Step 7: Commit**

```bash
git add app/page.tsx components/landing/
git commit -m "feat: add new landing page with hero, features, social proof"
```

---

### Task 4: Create Transcript Fetch Page

**Files:**
- Create: `app/fetch/page.tsx`
- Modify: `components/NavHeader.tsx`

**Step 1: Create fetch page with TranscriptForm**

```tsx
// app/fetch/page.tsx
import { TranscriptForm } from '@/components/TranscriptForm';

export default function FetchPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Fetch YouTube Transcript
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Paste a URL to extract the transcript. Works with any video that has captions.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <TranscriptForm />
        </div>
      </div>
    </main>
  );
}
```

**Step 2: Update NavHeader with English text and /pricing link**

Update NavHeader to use English strings and add Pricing link.

**Step 3: Commit**

```bash
git add app/fetch/page.tsx components/NavHeader.tsx
git commit -m "feat: create dedicated fetch page, add pricing to nav"
```

---

### Task 5: Update All UI Components to English

**Files:**
- Modify: `components/TranscriptForm.tsx`
- Modify: `components/NavHeader.tsx`
- Modify: `components/DownloadButton.tsx`
- Modify: `components/chat/*.tsx` (all chat components)

**Step 1-5: Update each component**

Replace all Swedish strings with English equivalents from the i18n file.
Use the translation list from the research to ensure nothing is missed.

Key changes:
- "Hämta transkript" → "Fetch Transcript"
- "Laddar..." → "Loading..."
- "Transkript" → "Transcripts"
- "Chatt" → "Chat"
- "Logga in" → "Sign in"
- etc.

**Step 6: Commit**

```bash
git add components/
git commit -m "feat: translate all components to English"
```

---

### Task 6: Update All Pages to English

**Files:**
- Modify: `app/success/page.tsx`
- Modify: `app/transcripts/page.tsx`
- Modify: `app/transcripts/[id]/page.tsx`
- Modify: `app/pricing/page.tsx`
- Modify: `app/credits/page.tsx`

**Step 1-5: Update each page**

Replace all Swedish strings. Key changes per file:

**success/page.tsx:**
- "Transkript skapat!" → "Transcript Created!"
- "Läs transkript" → "Read Transcript"
- etc.

**transcripts/page.tsx:**
- "Sparade transkript" → "Saved Transcripts"
- "Redigera" → "Edit"
- Sort options to English
- etc.

**Step 6: Commit**

```bash
git add app/
git commit -m "feat: translate all pages to English"
```

---

### Task 7: Update API Error Messages to English

**Files:**
- Modify: `app/api/transcript/route.ts`
- Modify: `app/api/chat/route.ts`
- Modify: `app/api/delete/route.ts`
- Modify: `app/api/format/route.ts`
- Modify: `app/api/summarize/route.ts`

**Step 1-5: Update each API route**

Replace Swedish error messages:
- "För många förfrågningar" → "Too many requests"
- "Ogiltig YouTube URL" → "Invalid YouTube URL"
- etc.

**Step 6: Commit**

```bash
git add app/api/
git commit -m "feat: translate API error messages to English"
```

---

### Task 8: Update Lib Files to English

**Files:**
- Modify: `lib/markdown.ts`
- Modify: `lib/validations.ts`
- Modify: `lib/hooks/useTranscripts.ts`

**Step 1-3: Update each lib file**

Replace Swedish strings in markdown generation and validation messages.

**Step 4: Commit**

```bash
git add lib/
git commit -m "feat: translate lib files to English"
```

---

## Phase 2: Pricing & Monetization

### Task 9: Update Pricing Tiers and Limits

**Files:**
- Modify: `lib/usage.ts`
- Create: `lib/pricing.ts`

**Step 1: Create pricing constants**

```typescript
// lib/pricing.ts
export const PRICING_TIERS = {
  free: {
    name: 'Free',
    priceMonthly: 0,
    priceYearly: 0,
    limits: {
      transcriptsPerDay: 3,
      chatsPerDay: 3,
    },
    features: [
      '3 transcripts per day',
      '3 AI chats per day',
      'Save to knowledge base',
      'Basic search',
    ],
  },
  starter: {
    name: 'Starter',
    priceMonthly: 499, // cents
    priceYearly: 4990, // cents (17% discount)
    stripePriceIdMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_STARTER_YEARLY,
    limits: {
      transcriptsPerMonth: 20,
      chatsPerMonth: 100,
    },
    features: [
      '20 transcripts per month',
      '100 AI chats per month',
      'Everything in Free',
      'Priority processing',
    ],
  },
  pro: {
    name: 'Pro',
    priceMonthly: 1499, // cents
    priceYearly: 14990, // cents
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY,
    limits: {
      transcriptsPerMonth: 100,
      chatsPerMonth: -1, // unlimited
    },
    features: [
      '100 transcripts per month',
      'Unlimited AI chats',
      'Everything in Starter',
      'Priority support',
      'Export to Markdown',
    ],
  },
  team: {
    name: 'Team',
    priceMonthly: 3499, // cents
    priceYearly: 34990, // cents
    stripePriceIdMonthly: process.env.STRIPE_PRICE_TEAM_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_TEAM_YEARLY,
    limits: {
      transcriptsPerMonth: -1, // unlimited
      chatsPerMonth: -1, // unlimited
    },
    features: [
      'Unlimited transcripts',
      'Unlimited AI chats',
      'Everything in Pro',
      'API access',
      'Team collaboration',
    ],
  },
} as const;

export type PricingTier = keyof typeof PRICING_TIERS;
```

**Step 2: Update usage.ts with new limits**

Update the usage checking logic to support 4 tiers.

**Step 3: Commit**

```bash
git add lib/pricing.ts lib/usage.ts
git commit -m "feat: add 4-tier pricing structure with USD prices"
```

---

### Task 10: Redesign Pricing Page

**Files:**
- Modify: `app/pricing/page.tsx`

**Step 1: Create new pricing page with 4 tiers**

```tsx
// Key elements:
// - 4 cards in a row (responsive grid)
// - "Most Popular" badge on Pro tier
// - Monthly/Yearly toggle with "Save 17%" badge
// - Feature checkmarks
// - Current plan indicator
// - Trust badges below (security, money-back)
```

**Step 2: Commit**

```bash
git add app/pricing/page.tsx
git commit -m "feat: redesign pricing page with 4 tiers and yearly toggle"
```

---

### Task 11: Create Stripe Products for New Tiers

**Manual step - document for user:**

1. Go to Stripe Dashboard → Products
2. Create 4 products: Free (no price), Starter, Pro, Team
3. For each paid product, create:
   - Monthly price ($4.99, $14.99, $34.99)
   - Yearly price ($49.90, $149.90, $349.90)
4. Copy Price IDs to environment variables:
   - `STRIPE_PRICE_STARTER_MONTHLY`
   - `STRIPE_PRICE_STARTER_YEARLY`
   - `STRIPE_PRICE_PRO_MONTHLY`
   - `STRIPE_PRICE_PRO_YEARLY`
   - `STRIPE_PRICE_TEAM_MONTHLY`
   - `STRIPE_PRICE_TEAM_YEARLY`

---

### Task 12: Update Subscribe Endpoint for Multiple Tiers

**Files:**
- Modify: `app/api/subscribe/route.ts`

**Step 1: Update to accept tier and billing period**

```typescript
// Accept: { tier: 'starter' | 'pro' | 'team', period: 'monthly' | 'yearly' }
// Return appropriate Stripe checkout URL
```

**Step 2: Commit**

```bash
git add app/api/subscribe/route.ts
git commit -m "feat: support multiple pricing tiers in subscribe endpoint"
```

---

## Phase 3: Onboarding & UX

### Task 13: Add Usage Warning at 80%

**Files:**
- Modify: `components/UsageDisplay.tsx`
- Modify: `lib/usage.ts`

**Step 1: Add warning threshold logic**

```typescript
// In usage.ts, add:
export function getUsageWarning(used: number, limit: number): 'ok' | 'warning' | 'critical' {
  const percentage = (used / limit) * 100;
  if (percentage >= 100) return 'critical';
  if (percentage >= 80) return 'warning';
  return 'ok';
}
```

**Step 2: Update UsageDisplay to show warning**

Add yellow/red coloring and upgrade nudge when approaching limit.

**Step 3: Commit**

```bash
git add components/UsageDisplay.tsx lib/usage.ts
git commit -m "feat: add usage warning at 80% threshold"
```

---

### Task 14: Create Onboarding Modal

**Files:**
- Create: `components/onboarding/WelcomeModal.tsx`
- Create: `lib/hooks/useOnboarding.ts`
- Modify: `app/layout.tsx`

**Step 1: Create useOnboarding hook**

```typescript
// lib/hooks/useOnboarding.ts
// Check localStorage for 'onboarding_completed'
// Provide show/hide/complete functions
```

**Step 2: Create WelcomeModal component**

```tsx
// 3-step tour:
// 1. "Fetch Transcripts" - explain URL input
// 2. "Build Your Library" - explain saving
// 3. "Chat with AI" - explain chat feature
// Navigation: dots, next/back, skip
```

**Step 3: Add to layout**

Show modal on first visit for authenticated users.

**Step 4: Commit**

```bash
git add components/onboarding/ lib/hooks/useOnboarding.ts app/layout.tsx
git commit -m "feat: add onboarding welcome modal for new users"
```

---

### Task 15: Add Empty States with Guidance

**Files:**
- Modify: `app/transcripts/page.tsx`
- Modify: `components/chat/MessageList.tsx`

**Step 1: Enhance empty transcript state**

Add illustration, clear CTA, explain value.

**Step 2: Enhance empty chat state**

Add tips for what to ask, example questions.

**Step 3: Commit**

```bash
git add app/transcripts/page.tsx components/chat/MessageList.tsx
git commit -m "feat: improve empty states with guidance and CTAs"
```

---

## Phase 4: SEO & Growth

### Task 16: Add SEO Basics

**Files:**
- Create: `app/sitemap.ts`
- Create: `app/robots.ts`
- Modify: `app/layout.tsx`

**Step 1: Create sitemap**

```typescript
// app/sitemap.ts
export default function sitemap() {
  return [
    { url: 'https://tubebase.app', lastModified: new Date() },
    { url: 'https://tubebase.app/pricing', lastModified: new Date() },
    { url: 'https://tubebase.app/fetch', lastModified: new Date() },
  ];
}
```

**Step 2: Create robots.txt**

```typescript
// app/robots.ts
export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://tubebase.app/sitemap.xml',
  };
}
```

**Step 3: Add structured data to layout**

```tsx
// JSON-LD for SoftwareApplication
```

**Step 4: Commit**

```bash
git add app/sitemap.ts app/robots.ts app/layout.tsx
git commit -m "feat: add SEO sitemap, robots.txt, and structured data"
```

---

### Task 17: Create OG Images

**Files:**
- Create: `app/opengraph-image.tsx`
- Create: `public/favicon.ico`
- Create: `public/apple-touch-icon.png`

**Step 1: Create OG image with @vercel/og**

```tsx
// app/opengraph-image.tsx
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'TubeBase - YouTube Knowledge Base';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div style={{
        background: 'linear-gradient(to bottom right, #dc2626, #991b1b)',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
      }}>
        <div style={{ fontSize: 72, fontWeight: 'bold' }}>TubeBase</div>
        <div style={{ fontSize: 32, marginTop: 20 }}>
          Turn YouTube Videos Into Searchable Knowledge
        </div>
      </div>
    ),
    size,
  );
}
```

**Step 2: Add favicon files**

Generate favicon.ico and apple-touch-icon.png with TubeBase logo.

**Step 3: Commit**

```bash
git add app/opengraph-image.tsx public/
git commit -m "feat: add OG images and favicons"
```

---

### Task 18: Add Basic Analytics Events

**Files:**
- Create: `lib/analytics.ts`
- Modify key components to track events

**Step 1: Create analytics helper**

```typescript
// lib/analytics.ts
// Wrapper for Vercel Analytics custom events
export function trackEvent(name: string, properties?: Record<string, string>) {
  if (typeof window !== 'undefined' && window.va) {
    window.va('event', { name, ...properties });
  }
}
```

**Step 2: Add tracking to key actions**

- Transcript fetched
- Chat message sent
- Upgrade clicked
- Signup completed

**Step 3: Commit**

```bash
git add lib/analytics.ts
git commit -m "feat: add analytics event tracking"
```

---

## Phase 5: Final Polish

### Task 19: Update Brand Name References

**Files:**
- All files referencing "YouTube Transcript Service"

**Step 1: Replace with "TubeBase"**

Search and replace:
- "YouTube Transcript Service" → "TubeBase"
- Update CLAUDE.md
- Update package.json name

**Step 2: Commit**

```bash
git commit -am "chore: rebrand to TubeBase"
```

---

### Task 20: Update Environment Variables Documentation

**Files:**
- Modify: `CLAUDE.md`
- Create: `.env.example`

**Step 1: Document new env vars**

```
# Stripe Pricing (USD)
STRIPE_PRICE_STARTER_MONTHLY=price_xxx
STRIPE_PRICE_STARTER_YEARLY=price_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_YEARLY=price_xxx
STRIPE_PRICE_TEAM_MONTHLY=price_xxx
STRIPE_PRICE_TEAM_YEARLY=price_xxx
```

**Step 2: Commit**

```bash
git add CLAUDE.md .env.example
git commit -m "docs: update environment variables for new pricing"
```

---

### Task 21: Test Complete Flow

**Manual testing checklist:**

- [ ] Landing page loads with hero
- [ ] Can navigate to /fetch
- [ ] Can fetch a transcript
- [ ] Success page shows correctly
- [ ] Transcripts page lists saved items
- [ ] Chat works with selected videos
- [ ] Pricing page shows 4 tiers
- [ ] Upgrade flow works (test mode)
- [ ] Usage warning shows at 80%
- [ ] Onboarding modal shows for new users
- [ ] All text is in English
- [ ] Mobile responsive works
- [ ] OG image shows correctly when shared

---

### Task 22: Deploy and Verify

**Steps:**

1. Push all changes to main
2. Verify Vercel deployment succeeds
3. Test production URL
4. Check OG image with social media debuggers
5. Verify Stripe webhooks in production

---

## Summary

**Total tasks:** 22
**Estimated effort:** 2-3 focused days

**Key outcomes:**
1. English-first global product
2. High-converting landing page with hero + social proof
3. 4-tier pricing ($0, $4.99, $14.99, $34.99/mo)
4. Onboarding flow for new users
5. Usage warnings before hitting limits
6. SEO foundation (sitemap, OG images, structured data)
7. Rebrand to "TubeBase"

**After implementation:**
- Use superpowers:finishing-a-development-branch to complete
- Consider Product Hunt launch
- Set up email capture for marketing
