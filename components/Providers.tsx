'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { svSE } from '@clerk/localizations';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider localization={svSE}>
      {children}
    </ClerkProvider>
  );
}
