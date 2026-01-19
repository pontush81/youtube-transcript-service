import { put } from '@vercel/blob';

export async function saveToBlob(
  videoId: string,
  content: string
): Promise<string> {
  const filename = `transcripts/${videoId}-${Date.now()}.md`;

  const blob = await put(filename, content, {
    access: 'public',
    contentType: 'text/markdown',
  });

  return blob.url;
}
