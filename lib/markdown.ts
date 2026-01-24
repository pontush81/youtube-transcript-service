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
  lines.push(`> **Video:** [Watch on YouTube](${metadata.url})`);
  lines.push(`>`);
  lines.push(`> **Created:** ${new Date(metadata.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`);

  if (metadata.submitter) {
    lines.push(`>`);
    lines.push(`> **Submitted by:** ${metadata.submitter}`);
  }

  if (metadata.tags && metadata.tags.length > 0) {
    lines.push(`>`);
    lines.push(`> **Tags:** ${metadata.tags.join(', ')}`);
  }

  if (metadata.notes) {
    lines.push('');
    lines.push(`**Notes:** ${metadata.notes}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(transcript);
  lines.push('');

  return lines.join('\n');
}
