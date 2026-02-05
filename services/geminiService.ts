import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { GeminiResponse } from "../types";

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface GenerateAgentOptions {
  modelName: string;
  contents: any[];
  systemInstruction?: string;
  useSearch?: boolean;
}

const REQUEST_TIMEOUT_MS = 240000; // 4 minutes

export const generateAgentResponse = async ({
  modelName,
  contents,
  systemInstruction,
  useSearch
}: GenerateAgentOptions): Promise<GeminiResponse> => {
  try {
    const tools: any[] = [];
    if (useSearch) {
      tools.push({ googleSearch: {} });
    }

    // Create a timeout promise
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds. The model took too long to respond.`));
      }, REQUEST_TIMEOUT_MS);
    });

    // Ensure we are sending valid 'contents' structure to the new SDK
    // contents here is expected to be an array of parts: [{text: '...'}, {inlineData: ...}]
    // The SDK expects contents to be: string | Part | Part[] | Content | Content[]
    // We will wrap our parts array in a Content-like structure if needed, or pass directly.
    // For this helper, we assume 'contents' is an array of Parts.

    // Race the API call against the timeout
    const response = await Promise.race([
      ai.models.generateContent({
        model: modelName,
        contents: { parts: contents },
        config: {
          systemInstruction: systemInstruction,
          tools: tools.length > 0 ? tools : undefined,
        },
      }),
      timeout
    ]) as GenerateContentResponse;

    return { 
      text: response.text || "",
      groundingMetadata: response.candidates?.[0]?.groundingMetadata 
    };
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    // Provide user-friendly error message for timeouts
    let errorMessage = error.message || "Unknown error occurred";
    if (error.name === 'AbortError' || errorMessage.includes('timed out')) {
        errorMessage = "The request timed out. Try reducing the complexity of the prompt or using a faster model.";
    }
    return { text: "", error: errorMessage };
  }
};