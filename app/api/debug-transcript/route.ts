import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get('v') || 'aircAruvnKk';

  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const html = await response.text();

    // Check for markers
    const hasPlayerResponse = html.includes('ytInitialPlayerResponse');
    const hasCaptionTracks = html.includes('captionTracks');
    const hasConsent = html.includes('consent.youtube.com');

    // Try to find start marker
    const startMarker = 'ytInitialPlayerResponse = ';
    const startIndex = html.indexOf(startMarker);

    let captionTracksCount = 0;
    let firstTrackLang = '';
    let firstTrackUrl = '';

    if (startIndex !== -1) {
      // Extract JSON
      let depth = 0;
      let jsonStart = startIndex + startMarker.length;
      let jsonEnd = jsonStart;
      let started = false;

      for (let i = jsonStart; i < html.length && i < jsonStart + 500000; i++) {
        const char = html[i];
        if (char === '{') {
          if (!started) started = true;
          depth++;
        } else if (char === '}') {
          depth--;
          if (started && depth === 0) {
            jsonEnd = i + 1;
            break;
          }
        }
      }

      if (jsonEnd > jsonStart) {
        try {
          const jsonStr = html.substring(jsonStart, jsonEnd);
          const json = JSON.parse(jsonStr);
          const tracks =
            json.captions?.playerCaptionsTracklistRenderer?.captionTracks;
          captionTracksCount = tracks?.length || 0;
          if (tracks && tracks.length > 0) {
            firstTrackLang = tracks[0].languageCode;
            firstTrackUrl = tracks[0].baseUrl?.substring(0, 100) || '';
          }
        } catch (e) {
          return NextResponse.json({
            error: 'JSON parse error',
            message: (e as Error).message,
          });
        }
      }
    }

    return NextResponse.json({
      status: response.status,
      htmlLength: html.length,
      hasPlayerResponse,
      hasCaptionTracks,
      hasConsent,
      startIndex,
      captionTracksCount,
      firstTrackLang,
      firstTrackUrl,
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Fetch error',
      message: (error as Error).message,
    });
  }
}
