
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GeminiResponse } from "../types";

const REQUEST_TIMEOUT_MS = 600000; // Increased to 10 minutes

// Helper for exponential backoff
const MAX_RETRIES = 3;
const BASE_DELAY = 2000;

async function callWithRetry<T>(fn: () => Promise<T>, attempt = 1): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    // Inspect error for rate limit indicators (429 or RESOURCE_EXHAUSTED)
    const isRateLimit = 
      e.status === 429 || 
      e.code === 429 || 
      e.status === 'RESOURCE_EXHAUSTED' ||
      (e.message && (
        e.message.includes('429') || 
        e.message.includes('quota') || 
        e.message.includes('RESOURCE_EXHAUSTED')
      ));

    if (isRateLimit && attempt <= MAX_RETRIES) {
      const delay = BASE_DELAY * Math.pow(2, attempt - 1); // 2s, 4s, 8s
      console.warn(`Gemini API rate limit hit. Retrying in ${delay}ms (Attempt ${attempt}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callWithRetry(fn, attempt + 1);
    }
    throw e;
  }
}

interface GenerateAgentOptions {
  modelName: string;
  contents: any[];
  systemInstruction?: string;
  useSearch?: boolean;
  thinkingBudget?: number;
}

export const generateAgentResponse = async ({
  modelName,
  contents,
  systemInstruction,
  useSearch,
  thinkingBudget
}: GenerateAgentOptions): Promise<GeminiResponse> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const tools: any[] = [];
    if (useSearch) {
      tools.push({ googleSearch: {} });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      // Wrap the API call in a closure for retry logic
      const makeRequest = async () => {
        return await ai.models.generateContent({
          model: modelName,
          contents: { parts: contents },
          config: {
            systemInstruction: systemInstruction,
            tools: tools.length > 0 ? tools : undefined,
            // If thinkingBudget is provided and greater than 0, use it. Otherwise, disable thinking (0).
            thinkingConfig: { thinkingBudget: thinkingBudget && thinkingBudget > 0 ? thinkingBudget : 0 }
          },
        });
      };

      const response = await callWithRetry(makeRequest);

      clearTimeout(timeoutId);
      return { 
        text: response.text || "",
        groundingMetadata: response.candidates?.[0]?.groundingMetadata 
      };
    } catch (e: any) {
      if (e.name === 'AbortError') {
        throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds.`);
      }
      throw e;
    }
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return { text: "", error: error.message || "Unknown error" };
  }
};

interface GenerateChatOptions {
  modelName: string;
  history: { role: string; parts: { text: string }[] }[];
  systemInstruction?: string;
}

export const generateChatResponse = async ({
  modelName,
  history,
  systemInstruction
}: GenerateChatOptions): Promise<GeminiResponse> => {
  try {
     const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
     
     const makeRequest = async () => {
       return await ai.models.generateContent({
          model: modelName,
          contents: history,
          config: {
             systemInstruction: systemInstruction,
             temperature: 0.7,
             // Allow a small thinking budget for high-quality chat responses if using Pro
             thinkingConfig: modelName.includes('pro') ? { thinkingBudget: 4000 } : { thinkingBudget: 0 }
          }
       });
     };

     const response = await callWithRetry(makeRequest);

     return {
        text: response.text || "",
        groundingMetadata: response.candidates?.[0]?.groundingMetadata
     };
  } catch (error: any) {
     console.error("Gemini Chat Error:", error);
     return { text: "", error: error.message };
  }
};

export const transcribeAudio = async (audioBase64: string, mimeType: string): Promise<GeminiResponse> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Explicitly using gemini-3-flash-preview as requested for audio tasks
    const modelName = 'gemini-3-flash-preview'; 

    const makeRequest = async () => {
      return await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            { inlineData: { mimeType: mimeType, data: audioBase64 } },
            { text: "Transcribe this audio meeting accurately. Then, extract the following in valid JSON format: 1. A brief 'summary'. 2. A list of 'decisions'. 3. A list of 'actionItems'. 4. The full 'transcript'. JSON Structure: { summary: string, decisions: string[], actionItems: string[], transcript: string }" }
          ]
        },
        config: {
          responseMimeType: "application/json"
        }
      });
    };

    const response = await callWithRetry(makeRequest);

    return {
      text: response.text || "",
    };
  } catch (error: any) {
    console.error("Transcription Error:", error);
    return { text: "", error: error.message };
  }
};
