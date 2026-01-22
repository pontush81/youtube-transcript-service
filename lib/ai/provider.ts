import { AIProvider } from './types';
import { OpenAIProvider } from './openai';

export function getAIProvider(name: 'openai' | 'claude' = 'openai'): AIProvider {
  switch (name) {
    case 'openai':
      return new OpenAIProvider();
    case 'claude':
      throw new Error('Claude provider not implemented yet');
    default:
      return new OpenAIProvider();
  }
}
