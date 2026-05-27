import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const getFitnessAdvice = async (prompt: string, userContext?: string) => {
  const model = genAI.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are an expert AI Personal Trainer. 
    User Context: ${userContext || "General fitness enthusiast"}
    User Query: ${prompt}
    
    Provide professional, encouraging, and science-based fitness advice. 
    If recommending a workout or diet, be specific.`,
  });

  const response = await model;
  return response.text;
};
