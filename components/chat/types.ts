export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  timestamp: Date;
}

export interface Source {
  videoId: string;
  title: string;
  timestamp: string | null;
}

export interface VideoOption {
  videoId: string;
  title: string;
  url: string;
}
