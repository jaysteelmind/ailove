import { GrokService } from './GrokService';
import { MessageRepository } from '../repositories/MessageRepository';
import { UserRepository } from '../repositories/UserRepository';
import { DateRepository } from '../repositories/DateRepository';

export interface MessageSuggestionInput {
  userId: string;
  matchId: string;
  conversationContext?: string;
}

export interface DatePrepInput {
  userId: string;
  dateId: string;
}

export interface ConversationAnalysis {
  tone: string;
  topics: string[];
  emotionalContext: string;
  suggestions: string[];
}

export class AICoachingService {
  constructor(
    private grokService: GrokService,
    private messageRepo: MessageRepository,
    private userRepo: UserRepository,
    private dateRepo: DateRepository
  ) {}

  /**
   * Generate message suggestions based on conversation history
   */
  async getMessageSuggestions(
    input: MessageSuggestionInput
  ): Promise<{ suggestions: string[] }> {
    // 1. Get recent conversation history
    const messages = await this.messageRepo.findByMatchId(input.matchId, {
      limit: 10
    });

    // 2. Build context for Grok
    const conversationHistory = messages
      .reverse()
      .map(msg => {
        const isUser = msg.senderId === input.userId;
        return `${isUser ? 'You' : 'Them'}: ${msg.content}`;
      })
      .join('\n');

    // 3. Create coaching prompt
    const prompt = `You are an AI dating coach. Based on this conversation, suggest 3 natural, engaging message responses that would keep the conversation flowing positively.

Conversation so far:
${conversationHistory}

${input.conversationContext ? `Additional context: ${input.conversationContext}` : ''}

Provide 3 message suggestions that are:
- Natural and conversational
- Show genuine interest
- Ask engaging questions or share relevant thoughts
- Are appropriate for a dating context
- Keep the conversation moving forward

Format as JSON array of strings.`;

    // 4. Get suggestions from Grok
    const response = await this.grokService.getCompletion(prompt, { maxTokens: 300, temperature: 0.8 });

    // 5. Parse suggestions
    try {
      // Remove markdown code blocks if present
      let jsonText = response.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonText = jsonMatch[1].trim();
      }
      
      const suggestions = JSON.parse(jsonText);
      return { suggestions: Array.isArray(suggestions) ? suggestions : [response] };
    } catch (error) {
      // Fallback: split by newlines if not valid JSON
      const suggestions = response
        .split('\n')
        .filter(s => s.trim().length > 0)
        .filter(s => !s.startsWith('```'))
        .filter(s => !s.startsWith('[') && !s.startsWith(']'))
        .map(s => s.replace(/^["']|["']$/g, '').trim())
        .filter(s => s.length > 10)
        .slice(0, 3);
      
      return { suggestions: suggestions.length > 0 ? suggestions : [
        "What are your favorite types of cuisines?",
        "Have you tried any new restaurants lately?",
        "Do you enjoy cooking, or do you prefer dining out?"
      ]};
    }
  }

  /**
   * Generate date preparation guide
   */
  async getDatePreparationGuide(input: DatePrepInput): Promise<{
    conversationStarters: string[];
    topics: string[];
    thingsToAvoid: string[];
    safetyTips: string[];
    venueInsights?: string;
  }> {
    // 1. Get date details
    const date = await this.dateRepo.findById(input.dateId);
    if (!date) {
      throw new Error('Date not found');
    }

    // 2. Get user and partner profiles
    const partnerId = date.userId === input.userId ? date.partnerId : date.userId;
    const [user, partner] = await Promise.all([
      this.userRepo.findById(input.userId),
      this.userRepo.findById(partnerId)
    ]);

    if (!user || !partner) {
      throw new Error('User not found');
    }

    // 3. Get conversation history for context
    const messages = await this.messageRepo.findByMatchId(date.matchId, {
      limit: 20
    });

    // 4. Build context
    const conversationSummary = messages.length > 0
      ? `Recent conversation topics: ${messages.slice(0, 5).map(m => m.content.substring(0, 50)).join(', ')}`
      : 'No previous conversation history.';

    const location = date.location as any;
    const activityType = date.activityType || 'general';

    // 5. Create preparation prompt
    const prompt = `You are an AI dating coach preparing someone for an upcoming date. Generate a comprehensive date preparation guide.

Date Details:
- Activity: ${activityType}
- Location: ${location.name}
- Partner: ${partner.firstName}

${conversationSummary}

Provide a date preparation guide with:
1. 5 conversation starters (natural, engaging, relevant to their previous chats)
2. 5 good topics to discuss
3. 3 things to avoid in conversation
4. 5 safety tips for first dates
5. Brief insights about the venue type

Format as JSON with keys: conversationStarters, topics, thingsToAvoid, safetyTips, venueInsights`;

    // 6. Get guide from Grok
    const response = await this.grokService.getCompletion(prompt, { maxTokens: 800, temperature: 0.7 });

    // 7. Parse response
    try {
      let jsonText = response.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonText = jsonMatch[1].trim();
      }
      const guide = JSON.parse(jsonText);
      return guide;
    } catch {
      // Fallback structure
      return {
        conversationStarters: [
          "What's been the highlight of your week?",
          "I loved what you said about [topic from chat], tell me more!",
          "Have you been to this area before?"
        ],
        topics: ["Hobbies", "Travel", "Food preferences", "Career aspirations", "Fun weekend activities"],
        thingsToAvoid: ["Past relationships", "Politics", "Overly personal questions"],
        safetyTips: [
          "Meet in a public place",
          "Tell a friend where you'll be",
          "Keep your phone charged",
          "Trust your instincts",
          "Have your own transportation arranged"
        ],
        venueInsights: `${location.name} is a great choice for a ${activityType}.`
      };
    }
  }

  /**
   * Analyze conversation for coaching insights
   */
  async analyzeConversation(
    matchId: string,
    userId: string
  ): Promise<ConversationAnalysis> {
    // 1. Get conversation history
    const messages = await this.messageRepo.findByMatchId(matchId, {
      limit: 20
    });

    if (messages.length === 0) {
      return {
        tone: 'neutral',
        topics: [],
        emotionalContext: 'Conversation just started',
        suggestions: ['Start with a friendly greeting!']
      };
    }

    // 2. Build conversation text
    const conversationText = messages
      .reverse()
      .map(msg => {
        const isUser = msg.senderId === userId;
        return `${isUser ? 'You' : 'Them'}: ${msg.content}`;
      })
      .join('\n');

    // 3. Create analysis prompt
    const prompt = `Analyze this dating conversation and provide coaching insights.

Conversation:
${conversationText}

Provide analysis with:
1. Overall tone (positive/neutral/needs_improvement)
2. Main topics discussed (array of strings)
3. Emotional context (brief description)
4. 3 suggestions to improve the conversation

Format as JSON with keys: tone, topics, emotionalContext, suggestions`;

    // 4. Get analysis from Grok
    const response = await this.grokService.getCompletion(prompt, { maxTokens: 400, temperature: 0.6 });

    // 5. Parse analysis
    try {
      let jsonText = response.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonText = jsonMatch[1].trim();
      }
      const analysis = JSON.parse(jsonText);
      return analysis;
    } catch {
      // Fallback
      return {
        tone: 'positive',
        topics: ['General conversation'],
        emotionalContext: 'Engaging and friendly',
        suggestions: [
          'Keep asking open-ended questions',
          'Share personal stories',
          'Show genuine interest in their responses'
        ]
      };
    }
  }

  /**
   * Get post-date follow-up suggestions
   */
  async getPostDateFollowUp(
    dateId: string,
    userId: string
  ): Promise<{ suggestions: string[] }> {
    const date = await this.dateRepo.findById(dateId);
    if (!date) {
      throw new Error('Date not found');
    }

    // Get partner info
    const partnerId = date.userId === userId ? date.partnerId : date.userId;
    const partner = await this.userRepo.findById(partnerId);

    const prompt = `You are an AI dating coach. The user just completed a date. Suggest 3 follow-up messages they could send to ${partner?.firstName || 'their date'} to express appreciation and keep the connection going.

Date details:
- Activity: ${date.activityType || 'date'}
- Status: ${date.status}

Provide 3 warm, genuine follow-up message suggestions.
Format as JSON array of strings.`;

    const response = await this.grokService.getCompletion(prompt, { maxTokens: 200, temperature: 0.8 });

    try {
      let jsonText = response.trim();
      const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonText = jsonMatch[1].trim();
      }
      const suggestions = JSON.parse(jsonText);
      return { suggestions: Array.isArray(suggestions) ? suggestions : [response] };
    } catch {
      return {
        suggestions: [
          "I had a wonderful time today! Thank you for such great conversation.",
          "Really enjoyed our date! Would love to do this again soon.",
          "Thanks for an amazing evening! You made it really special."
        ]
      };
    }
  }
}
