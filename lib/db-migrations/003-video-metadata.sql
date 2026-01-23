-- Migration: Add video_metadata table for YouTube video information
-- Run this migration to enable rich metadata display on transcripts page

-- Create video_metadata table
CREATE TABLE IF NOT EXISTS video_metadata (
  video_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  duration_seconds INTEGER,
  channel_id TEXT,
  channel_name TEXT,
  thumbnail_url TEXT,
  published_at TIMESTAMPTZ,
  view_count INTEGER,
  like_count INTEGER,
  tags TEXT[],
  transcript_language TEXT,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for channel grouping/filtering
CREATE INDEX IF NOT EXISTS video_metadata_channel_idx ON video_metadata(channel_id);

-- Index for sorting by publish date
CREATE INDEX IF NOT EXISTS video_metadata_published_idx ON video_metadata(published_at DESC);

-- Index for popular videos
CREATE INDEX IF NOT EXISTS video_metadata_views_idx ON video_metadata(view_count DESC NULLS LAST);

COMMENT ON TABLE video_metadata IS 'YouTube video metadata for enhanced transcript browsing';
COMMENT ON COLUMN video_metadata.duration_seconds IS 'Video duration in seconds';
COMMENT ON COLUMN video_metadata.tags IS 'YouTube video tags/keywords as array';
COMMENT ON COLUMN video_metadata.transcript_language IS 'Language code of fetched transcript';
