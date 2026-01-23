'use client';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
    />
  );
}

export function TranscriptCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex gap-4">
        {/* Thumbnail skeleton */}
        <Skeleton className="w-24 h-16 sm:w-32 sm:h-20 flex-shrink-0 rounded-md" />
        <div className="flex-1 min-w-0">
          {/* Title */}
          <Skeleton className="h-5 w-3/4 mb-2" />
          {/* Date */}
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </div>
  );
}

export function TranscriptListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <TranscriptCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TranscriptDetailSkeleton() {
  return (
    <div className="bg-white p-8 md:p-12 rounded-xl shadow-sm border border-gray-200">
      {/* Title */}
      <Skeleton className="h-8 w-2/3 mb-4" />
      {/* Meta */}
      <Skeleton className="h-4 w-1/3 mb-8" />
      {/* Content */}
      <div className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <div className="h-6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

export function ChatMessageSkeleton() {
  return (
    <div className="flex gap-3 animate-pulse">
      <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}
