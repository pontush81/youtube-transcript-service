interface TranscriptMetadata {
  title: string;
  videoId: string;
  url: string;
  submitter?: string;
  tags?: string[];
  notes?: string;
  createdAt: string;
}

export function generateMarkdown(
  transcript: string,
  metadata: TranscriptMetadata
): string {
  const lines: string[] = [];

  lines.push(`# ${metadata.title}`);
  lines.push('');
  lines.push('## Metadata');
  lines.push('');
  lines.push(`- **Video-ID:** ${metadata.videoId}`);
  lines.push(`- **URL:** ${metadata.url}`);
  lines.push(`- **Skapad:** ${metadata.createdAt}`);

  if (metadata.submitter) {
    lines.push(`- **Inskickad av:** ${metadata.submitter}`);
  }

  if (metadata.tags && metadata.tags.length > 0) {
    lines.push(`- **Taggar:** ${metadata.tags.join(', ')}`);
  }

  if (metadata.notes) {
    lines.push(`- **Anteckningar:** ${metadata.notes}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Transkript');
  lines.push('');
  lines.push(transcript);
  lines.push('');

  return lines.join('\n');
}
