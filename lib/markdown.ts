interface TranscriptMetadata {
  title: string;
  videoId: string;
  url: string;
  submitter?: string;
  tags?: string[];
  notes?: string;
  createdAt: string;
}

// Formatera transkript med styckeindelning för bättre läsbarhet
function formatTranscript(transcript: string): string {
  // 1. Dela upp vid talarbyten (>> markerar ny talare)
  let text = transcript.replace(/\s*>>\s*/g, '\n\n**Talare:** ');

  // 2. Om inga talarbyten, dela upp i stycken baserat på meningar
  if (!transcript.includes('>>')) {
    // Hitta meningar (punkt följt av mellanslag och stor bokstav)
    const sentences = transcript.split(/(?<=[.!?])\s+(?=[A-ZÅÄÖ])/);

    // Gruppera i stycken om ~3-4 meningar
    const paragraphs: string[] = [];
    let currentParagraph: string[] = [];

    for (const sentence of sentences) {
      currentParagraph.push(sentence);
      // Skapa nytt stycke var 3-4:e mening, eller vid naturliga pauser
      if (currentParagraph.length >= 3 &&
          (currentParagraph.length >= 4 || sentence.endsWith('?') || sentence.endsWith('!'))) {
        paragraphs.push(currentParagraph.join(' '));
        currentParagraph = [];
      }
    }

    // Lägg till eventuella kvarvarande meningar
    if (currentParagraph.length > 0) {
      paragraphs.push(currentParagraph.join(' '));
    }

    text = paragraphs.join('\n\n');
  }

  return text;
}

export function generateMarkdown(
  transcript: string,
  metadata: TranscriptMetadata
): string {
  const lines: string[] = [];

  lines.push(`# ${metadata.title}`);
  lines.push('');
  lines.push(`> **Video:** [Se på YouTube](${metadata.url})`);
  lines.push(`>`);
  lines.push(`> **Skapad:** ${new Date(metadata.createdAt).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })}`);

  if (metadata.submitter) {
    lines.push(`>`);
    lines.push(`> **Inskickad av:** ${metadata.submitter}`);
  }

  if (metadata.tags && metadata.tags.length > 0) {
    lines.push(`>`);
    lines.push(`> **Taggar:** ${metadata.tags.join(', ')}`);
  }

  if (metadata.notes) {
    lines.push('');
    lines.push(`**Anteckningar:** ${metadata.notes}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(formatTranscript(transcript));
  lines.push('');

  return lines.join('\n');
}
