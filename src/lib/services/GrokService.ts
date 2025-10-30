/**
 * GrokService - Conversational AI & Trait Extraction
 */

import { config } from '../../config';

export interface TraitExtraction {
  dimension: 'values' | 'interests' | 'communication' | 'lifestyle' | 'goals';
  trait: string;
  value: number;
  confidence: number;
  evidence: string;
}

export interface ExtractionResult {
  traits: TraitExtraction[];
  conversationContext: string;
  informationGain: number;
  processingTime: number;
}

export interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GrokResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class GrokService {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly model: string;
  private readonly timeout: number;

  constructor() {
    this.apiKey = config.grok.apiKey;
    this.apiUrl = config.grok.apiUrl;
    this.model = config.grok.model || 'grok-beta';
    this.timeout = config.grok.timeout || 15000;

    if (!this.apiKey) {
      throw new Error('Grok API key not configured');
    }
  }

  async extractTraits(
    message: string,
    conversationHistory: GrokMessage[] = []
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    const systemPrompt = this.buildTraitExtractionPrompt();
    const messages: GrokMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message },
    ];

    const response = await this.callGrokAPI(messages);
    const traits = this.parseTraitResponse(response);
    const informationGain = this.calculateInformationGain(traits);
    const processingTime = Date.now() - startTime;

    return {
      traits,
      conversationContext: message,
      informationGain,
      processingTime,
    };
  }

  async extractTraitsBatch(
    messages: string[],
    conversationHistory: GrokMessage[] = []
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    const combinedMessage = messages.join('\n\n---\n\n');
    const systemPrompt = this.buildTraitExtractionPrompt();
    const apiMessages: GrokMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: combinedMessage },
    ];

    const response = await this.callGrokAPI(apiMessages);
    const traits = this.parseTraitResponse(response);
    const informationGain = this.calculateInformationGain(traits);
    const processingTime = Date.now() - startTime;

    return {
      traits,
      conversationContext: combinedMessage,
      informationGain,
      processingTime,
    };
  }

  async generateCoachingSuggestion(
    conversationHistory: GrokMessage[],
    context?: {
      matchProfile?: string;
      dateType?: string;
      currentTopic?: string;
    }
  ): Promise<string> {
    const systemPrompt = this.buildCoachingPrompt(context);
    const messages: GrokMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
    ];

    const response = await this.callGrokAPI(messages);
    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No response from Grok API');
    }
    return choice.message.content;
  }

  private buildTraitExtractionPrompt(): string {
    return `You are an expert personality analyst for a dating platform. Extract personality traits from user messages.

DIMENSIONS:
1. VALUES: Core beliefs
2. INTERESTS: Hobbies, activities
3. COMMUNICATION: Style, directness
4. LIFESTYLE: Social energy, routines
5. GOALS: Relationship timeline

OUTPUT FORMAT (JSON):
{
  "traits": [
    {
      "dimension": "values|interests|communication|lifestyle|goals",
      "trait": "specific_trait_name",
      "value": 0.0-1.0,
      "confidence": 0.0-1.0,
      "evidence": "quote from message"
    }
  ]
}

Return ONLY valid JSON, no additional text.`;
  }

  private buildCoachingPrompt(context?: {
    matchProfile?: string;
    dateType?: string;
    currentTopic?: string;
  }): string {
    let prompt = `You are an expert dating coach. Provide helpful, specific suggestions for the conversation.`;

    if (context?.matchProfile) {
      prompt += `\n\nMATCH PROFILE: ${context.matchProfile}`;
    }
    if (context?.dateType) {
      prompt += `\n\nDATE TYPE: ${context.dateType}`;
    }
    if (context?.currentTopic) {
      prompt += `\n\nCURRENT TOPIC: ${context.currentTopic}`;
    }

    return prompt;
  }

  private async callGrokAPI(
    messages: GrokMessage[],
    options?: { maxTokens?: number; temperature?: number },
    retries = 3
  ): Promise<GrokResponse> {
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const body = {
      model: this.model,
      messages,
      temperature: options?.temperature || 0.3,
      max_tokens: options?.maxTokens || 1000,
    };

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(`${this.apiUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Grok API error (${response.status}): ${error}`);
        }

        return await response.json() as GrokResponse;
      } catch (error: any) {
        if (attempt === retries - 1) {
          throw new Error(`Grok API failed after ${retries} attempts: ${error.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    throw new Error('Grok API call failed');
  }

  private parseTraitResponse(response: GrokResponse): TraitExtraction[] {
    try {
      const choice = response.choices[0];
      if (!choice) {
        return [];
      }
      
      const content = choice.message.content;
      let jsonText = content;
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonText = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonText);
      
      if (!parsed.traits || !Array.isArray(parsed.traits)) {
        throw new Error('Invalid trait response format');
      }

      return parsed.traits.filter((t: TraitExtraction) => {
        return (
          t.dimension &&
          t.trait &&
          typeof t.value === 'number' &&
          typeof t.confidence === 'number' &&
          t.confidence > 0.5
        );
      });
    } catch (error) {
      console.error('Failed to parse trait response:', error);
      return [];
    }
  }

  private calculateInformationGain(traits: TraitExtraction[]): number {
    if (traits.length === 0) {
      return 0;
    }

    const totalGain = traits.reduce(
      (sum, t) => sum + t.confidence * t.value,
      0
    );

    return totalGain / traits.length;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const messages: GrokMessage[] = [
        { role: 'user', content: 'test' },
      ];
      await this.callGrokAPI(messages);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getCompletion(prompt: string, options?: {
    maxTokens?: number;
    temperature?: number;
  }): Promise<string> {
    const messages: GrokMessage[] = [
      { role: "user", content: prompt }
    ];
    const response = await this.callGrokAPI(messages, options);
    return response.choices[0].message.content;
  }
}

export default GrokService;
