import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  extractPlaylistId,
  fetchPlaylistMetadata,
  fetchPlaylistVideos,
  fetchTranscript,
  fetchVideoTitle,
} from '@/lib/youtube';
import { generateMarkdown } from '@/lib/markdown';
import { saveToBlob } from '@/lib/storage';
import { saveTranscriptEmbeddings } from '@/lib/embeddings';
import { sql } from '@/lib/db';
import { fetchAndSaveVideoMetadata } from '@/lib/video-metadata';

export const maxDuration = 300; // 5 minutes for playlist processing

// GET - Fetch playlist info and videos
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'URL krävs' }, { status: 400 });
  }

  const playlistId = extractPlaylistId(url);
  if (!playlistId) {
    return NextResponse.json({ error: 'Ogiltig spellist-URL' }, { status: 400 });
  }

  try {
    const [metadata, videos] = await Promise.all([
      fetchPlaylistMetadata(playlistId),
      fetchPlaylistVideos(playlistId),
    ]);

    return NextResponse.json({
      playlistId,
      title: metadata.title,
      channelTitle: metadata.channelTitle,
      videoCount: metadata.videoCount,
      thumbnail: metadata.thumbnail,
      videos: videos.slice(0, 50), // Limit to 50 videos
    });
  } catch (error) {
    console.error('Playlist fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Kunde inte hämta spellistan' },
      { status: 500 }
    );
  }
}

// POST - Process playlist videos
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { videoIds, submitter } = await request.json();

    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json({ error: 'Inga videor valda' }, { status: 400 });
    }

    if (videoIds.length > 20) {
      return NextResponse.json(
        { error: 'Max 20 videor åt gången' },
        { status: 400 }
      );
    }

    const results: Array<{
      videoId: string;
      title: string;
      success: boolean;
      error?: string;
      downloadUrl?: string;
    }> = [];

    for (const videoId of videoIds) {
      try {
        // Fetch title
        const title = await fetchVideoTitle(videoId);

        // Fetch transcript
        const transcript = await fetchTranscript(videoId);

        // Generate markdown
        const markdown = generateMarkdown(transcript, {
          title,
          videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          submitter,
          createdAt: new Date().toISOString(),
        });

        // Save to blob
        const downloadUrl = await saveToBlob(videoId, markdown);

        // Save embeddings
        try {
          await saveTranscriptEmbeddings({
            blobUrl: downloadUrl,
            videoId,
            videoTitle: title,
            markdownContent: markdown,
          });
        } catch {
          // Embeddings are optional, don't fail the whole operation
        }

        // Link to user
        try {
          await sql`
            INSERT INTO user_transcripts (user_id, video_id, blob_url, is_public)
            VALUES (${userId}, ${videoId}, ${downloadUrl}, true)
            ON CONFLICT (user_id, video_id) DO UPDATE SET
              blob_url = EXCLUDED.blob_url
          `;
        } catch {
          // Linking is optional
        }

        // Fetch and save video metadata
        try {
          await fetchAndSaveVideoMetadata(videoId);
        } catch {
          // Metadata is optional
        }

        results.push({
          videoId,
          title,
          success: true,
          downloadUrl,
        });
      } catch (error) {
        results.push({
          videoId,
          title: videoId,
          success: false,
          error: error instanceof Error ? error.message : 'Okänt fel',
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `${successful} av ${videoIds.length} videor transkriberades`,
      results,
      summary: { successful, failed, total: videoIds.length },
    });
  } catch (error) {
    console.error('Playlist process error:', error);
    return NextResponse.json(
      { error: 'Kunde inte bearbeta spellistan' },
      { status: 500 }
    );
  }
}
