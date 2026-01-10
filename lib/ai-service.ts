import { GoogleGenAI } from "@google/genai";

export type EmailCategory = 'Governmental' | 'Marketing (AD)' | 'Spam Type' | 'Administrational' | 'Other';

export interface AIAnalysisResult {
    summary: string;
    category: EmailCategory;
    actionRequired?: string;
}

export interface DigestResult {
    marketing: number;
    governmental: number;
    administrational: number;
    spam: number;
}

// Consolidate model name in one place for easy updates.
// 'gemini-1.5-flash' is the standard efficient model.
// If you have access to 'gemini-2.0-flash-exp', you can change it here.
const MODEL_NAME = "gemini-2.5-flash";

const GENERATION_CONFIG = {
    temperature: 0.4, // Lower temperature for more deterministic categorization
    topK: 32,
    topP: 1,
};

export class GeminiService {
    private client: GoogleGenAI;

    constructor(apiKey: string) {
        if (!apiKey) throw new Error("API Key is required to initialize Gemini Service");
        this.client = new GoogleGenAI({ apiKey });
    }

    /**
     * FOCUS FEATURE: Analyze a single email
     */
    async analyzeSingleEmail(subject: string, body: string, language: string = 'English'): Promise<AIAnalysisResult> {
        const prompt = `
      Analyze the following email.
      Output Language: ${language}
      
      Task:
      1. Categorize it into exactly one of these types: Governmental, Marketing (AD), Spam Type, Administrational, Other.
      2. Write a concise 1-2 sentence summary of the core message.
      3. Identify if any immediate action is required (e.g., Pay Bill, Verify Account).

      Email Subject: ${subject}
      Email Body:
      ${body.substring(0, 5000)} // Truncate to avoid huge tokens

      Return ONLY a JSON object in this format (no markdown):
      {
        "category": "CategoryName", // Must be one of the English terms listed above, do NOT translate the category name.
        "summary": "The summary string", // Translate this to the Output Language
        "actionRequired": "Action string or null" // Translate this to the Output Language
      }
    `;

        try {
            const response = await this.client.models.generateContent({
                model: MODEL_NAME,
                config: GENERATION_CONFIG,
                contents: prompt
            });

            // Handle both function and property access for text
            let text = "";
            if (typeof (response as any).text === 'function') {
                text = (response as any).text();
            } else if ((response as any).text) {
                text = (response as any).text;
            }

            // Clean markdown code blocks if present
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr) as AIAnalysisResult;
        } catch (error) {
            console.error("Gemini Analysis Failed:", error);
            throw error;
        }
    }

    /**
     * OVERVIEW FEATURE: Analyze unread headers for stats
     */
    async generateDigest(headers: { subject: string; sender: string }[]): Promise<DigestResult> {
        if (headers.length === 0) return { marketing: 0, governmental: 0, administrational: 0, spam: 0 };

        const prompt = `
       Classify the following email headers into: Governmental, Marketing, Spam, Administrational.
       Return count of each.

       Headers:
       ${headers.map(h => `- From: ${h.sender}, Subject: ${h.subject}`).join('\n')}

       Return ONLY JSON:
       { "marketing": 0, "governmental": 0, "administrational": 0, "spam": 0 }
     `;

        try {
            const response = await this.client.models.generateContent({
                model: MODEL_NAME,
                config: GENERATION_CONFIG,
                contents: prompt
            });

            let text = "";
            if (typeof (response as any).text === 'function') {
                text = (response as any).text();
            } else if ((response as any).text) {
                text = (response as any).text;
            }

            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr) as DigestResult;
        } catch (error) {
            console.error("Digest Generation Failed:", error);
            // Return zeros on failure rather than crashing
            return { marketing: 0, governmental: 0, administrational: 0, spam: 0 };
        }
    }

    /**
     * AUDIT FEATURE: Batch categorize emails
     */
    async batchCategorize(emails: { id: string; subject: string; sender: string }[]): Promise<Record<string, EmailCategory>> {
        if (emails.length === 0) return {};

        const prompt = `
       Classify each email by ID into exactly one of these categories based on the STRICT definitions below:
       
       1. Governmental: Emails originating from recognized government bodies, regulatory agencies, or legally required notifications. Use for tax, legal compliance, or official notices.
       2. Marketing (AD): Promotional materials, newsletters, advertisements, and non-essential commercial communications. Use for sales, offers, and subscriptions.
       3. Spam Type: Unsolicited, malicious, or low-value bulk emails, including phishing attempts and confirmed spam.
       4. Administrational: Internal communications, project updates, system notifications, billing alerts, or essential operational correspondence. Use for receipts, invoices, and workflow updates.
       5. Other: If it fits none of the above.

       Emails:
       ${emails.map(e => `ID: ${e.id} | From: ${e.sender} | Subject: ${e.subject}`).join('\n')}

       Return ONLY JSON map: {"id1": "CategoryName", "id2": "CategoryName"}
     `;

        try {
            const response = await this.client.models.generateContent({
                model: MODEL_NAME,
                config: GENERATION_CONFIG,
                contents: prompt
            });

            let text = "";
            if (typeof (response as any).text === 'function') {
                text = (response as any).text();
            } else if ((response as any).text) {
                text = (response as any).text;
            }

            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (error) {
            console.error("Batch Categorization Failed:", error);
            return {};
        }
    }
}
