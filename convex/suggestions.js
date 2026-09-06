import { action } from "./_generated/server";
import { v } from "convex/values";

export const generateSuggestion = action({
  args: {
    statsSummary: v.string(),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { suggestion: "Set your Gemini API key in Convex environment variables to get AI-powered suggestions." };
    }

    const prompt = `You are a productivity coach analyzing a student's focus data. The student is an Electrical Engineering student pursuing coding jobs. They track their study time across tags: Projects, Academics, DSA, Code, Rest.

Here is their recent stats summary:
${args.statsSummary}

Based on this data, give ONE specific, actionable suggestion in 1-2 sentences. Be direct and data-driven. Reference specific numbers from their data. Don't be generic. Focus on what they should change THIS week.`;

    try {
      const requestBody = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 100,
          temperature: 0.7,
        },
      });

      let response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody,
        }
      );

      if (response.status === 429) {
        console.warn("Gemini 3.1 Flash Lite rate limited. Falling back to Gemini 2.5 Flash...");
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: requestBody,
          }
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API error:", errorText);
        return { suggestion: "Could not generate suggestion. Check your Gemini API key." };
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return { suggestion: text || "Keep up the great work! Consistency is key." };
    } catch (error) {
      console.error("Gemini API call failed:", error);
      return { suggestion: "Could not reach the AI suggestion service. Try again later." };
    }
  },
});
