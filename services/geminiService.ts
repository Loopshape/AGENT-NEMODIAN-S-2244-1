import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import type { Candidate, Persona } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("Gemini API key not found. Please set the API_KEY environment variable.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

/**
 * Generates content using the Gemini model with Google Search grounding.
 * This is ideal for queries that require up-to-date information from the web.
 * @param {string} prompt - The user's prompt for the AI.
 * @returns {Promise<GenerateContentResponse>} A promise that resolves with the grounded generation result.
 */
export const generateWithSearch = async (prompt: string): Promise<GenerateContentResponse> => {
  return ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      tools: [{googleSearch: {}}],
    },
  });
};

/**
 * Generates content as a stream with the "thinking" feature enabled.
 * This provides a more detailed, step-by-step generation process for complex tasks.
 * The system prompt primes the AI to act as a world-class software architect.
 * @param {string} prompt - The user's specific request.
 * @param {string} context - The current code or context from the editor.
 * @returns {Promise<AsyncGenerator<GenerateContentResponse>>} A promise that resolves with an async iterable stream of generated content chunks.
 */
// FIX: Make the function async to ensure proper promise type inference for the stream.
export const generateWithThinkingStream = async (prompt: string, context: string) => {
    const fullPrompt = `You are a world-class software architect and principal engineer, an expert in complex algorithms and system design. Your mission is to generate, refactor, or optimize code to solve sophisticated algorithmic challenges.
Internally, you must deconstruct the problem, think step-by-step, consider various data structures, analyze time and space complexity, and anticipate edge cases to architect the most robust and performant solution.

User Request: "${prompt}"

Current Code Context:
\`\`\`
${context}
\`\`\`

Produce only the final, complete, and production-ready code block as your response. Do not include any explanations, markdown formatting, or other text outside of the code.
`;
    return ai.models.generateContentStream({
      model: "gemini-2.5-pro",
      contents: fullPrompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 }
      },
    });
};

/**
 * An array of predefined AI agent personas. Each persona has a unique specialization
 * to guide the code generation process during multi-agent consensus.
 * @type {Persona[]}
 */
export const personas: Persona[] = [
    { name: "Performance Optimizer", description: "Focuses on maximum performance, low-level optimization, bit-twiddling, and efficient memory usage. Writes highly optimized, fast code." },
    { name: "Code Readability Advocate", description: "Prioritizes clean, elegant, and maintainable code. Uses design patterns, clear naming conventions, and extensive comments." },
    { name: "Modernist Developer", description: "Leverages the latest language features, functional programming concepts, and modern idioms to write concise and expressive code." },
    { name: "Robustness Engineer", description: "Emphasizes resilience and reliability. Writes code with comprehensive error handling, input validation, and edge-case management." },
    { name: "Data Structures Specialist", description: "Solves problems from a data-structures-first perspective, always choosing the most optimal data structure for the task at hand." },
    { name: "Theoretical Scientist", description: "Approaches problems from a mathematical or theoretical computer science perspective, ensuring algorithmic purity and correctness." },
    { name: "Simplicity Champion", description: "Advocates for simple, straightforward, and easy-to-understand solutions, avoiding unnecessary complexity. Prefers brute-force if it's clearer." },
    { name: "Scalability Architect", description: "Designs solutions that can handle massive datasets and high concurrency, considering distributed systems principles." },
    { name: "Security Specialist", description: "Focuses on secure coding practices, identifying potential vulnerabilities, and implementing robust defenses against common exploits." },
    { name: "UI/UX Futurist", description: "Prioritizes an exceptional and intuitive user experience, focusing on accessibility, modern design patterns, and fluid interactivity." },
    { name: "API Architect", description: "Designs clean, maintainable, and scalable API contracts. Focuses on RESTful principles, data modeling, and clear versioning strategies." },
    { name: "Legacy Code Modernizer", description: "Specializes in refactoring outdated codebases, untangling monolithic structures, and upgrading them with modern design patterns and technologies." },
];

/**
 * Orchestrates a multi-agent consensus process. It sends the same prompt to multiple AI agents,
 * each with a specialized persona. It then collects, aggregates, and scores the generated code
 * candidates to find the optimal solution.
 * @param {string} prompt - The user's request for code generation or modification.
 * @param {string} context - The existing code context to be worked on.
 * @param {string[]} selectedPersonaNames - An array of names of the personas to use for this consensus run.
 * @returns {Promise<Candidate[]>} A promise that resolves to an array of scored code candidates, sorted by their consensus score.
 */
export const runMultiAgentConsensus = async (prompt: string, context: string, selectedPersonaNames: string[]): Promise<Candidate[]> => {
    const selectedPersonas = personas.filter(p => selectedPersonaNames.includes(p.name));
    if (selectedPersonas.length === 0) {
        return [];
    }

    const prompts = selectedPersonas.map(persona => {
        return `You are an AI software engineer with a highly specialized expert persona.
Persona: ${persona.description}

Your mission is to fulfill the user's request based *strictly* on your assigned persona. Analyze the problem, consider all constraints and possibilities from your persona's unique viewpoint, and generate the optimal code solution.

User Request: "${prompt}"

Current Code Context:
\`\`\`
${context}
\`\`\`

Produce only the final, complete, and production-ready code block as your response. Do not include any explanations, markdown formatting, or other text outside of the code.`;
    });

    const promises = prompts.map(p => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: p,
    }));

    const responses = await Promise.all(promises);

    const candidatesMap = new Map<string, { agents: string[], count: number }>();
    responses.forEach((res, i) => {
        const content = res.text.trim();
        if (content) {
            const codeMatch = content.match(/```(?:[\w]*)\n?([\s\S]*?)```/);
            const finalContent = (codeMatch ? codeMatch[1] : content).trim();

            if (!finalContent) return;

            if (!candidatesMap.has(finalContent)) {
                candidatesMap.set(finalContent, { agents: [], count: 0 });
            }
            const agentName = selectedPersonas[i].name;
            const entry = candidatesMap.get(finalContent)!;
            entry.agents.push(agentName);
            entry.count += 1;
        }
    });

    return Array.from(candidatesMap.entries()).map(([content, data]) => ({
        content,
        agents: data.agents,
        count: data.count,
        avgEntropy: Math.random() * 2 + 5, // mock entropy
        score: data.count + (Math.random() * 2 + 5) * 0.1,
    })).sort((a, b) => b.score - a.score);
};