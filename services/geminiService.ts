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

    // Ensure we are sending valid 'contents' structure to the new SDK
    // contents here is expected to be an array of parts: [{text: '...'}, {inlineData: ...}]
    // The SDK expects contents to be: string | Part | Part[] | Content | Content[]
    // We will wrap our parts array in a Content-like structure if needed, or pass directly.
    // For this helper, we assume 'contents' is an array of Parts.

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: modelName,
      contents: { parts: contents },
      config: {
        systemInstruction: systemInstruction,
        tools: tools.length > 0 ? tools : undefined,
      },
    });

    return { 
      text: response.text || "",
      groundingMetadata: response.candidates?.[0]?.groundingMetadata 
    };
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return { text: "", error: error.message || "Unknown error occurred" };
  }
};