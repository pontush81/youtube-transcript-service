export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface TranscriptChunk {
  content: string;
  videoId: string;
  videoTitle: string;
  timestampStart: string | null;
}

export interface ChatParams {
  messages: Message[];
  context: TranscriptChunk[];
  mode: 'strict' | 'hybrid';
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface Source {
  videoId: string;
  title: string;
  timestamp: string | null;
}

export interface AIProvider {
  chat(params: ChatParams): AsyncIterable<string>;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
