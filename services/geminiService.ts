/// <reference types="node" /> // Temporarily kept for TS checking in mixed environment, will be removed if no Node.js globals are used

import { GoogleGenAI, GenerateContentResponse, Type } from '@google/genai';
import type { Candidate, Persona, CodeReviewFinding, GroundingChunk } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    console.warn('Gemini API key not found. Please set the API_KEY environment variable.');
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

// Cache configuration for search grounding
const CACHE_PREFIX = 'gemini_search_cache_';
const CACHE_EXPIRATION_MS = 30 * 60 * 1000; // 30 minutes

// Cache configuration for code completion
const COMPLETION_CACHE_PREFIX = 'gemini_completion_cache_';
const COMPLETION_CACHE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Generates a unique cache key based on the prompt, context, and grounding parameters.
 * @param {string} prompt - The user's specific request.
 * @param {string} context - The current code or context from the editor.
 * @param {boolean} withSearch - Whether search grounding is enabled.
 * @param {boolean} withMaps - Whether maps grounding is enabled.
 * @param {number | null} latitude - Optional latitude for Maps grounding.
 * @param {number | null} longitude - Optional longitude for Maps grounding.
 * @returns {string} The cache key.
 */
const getCacheKey = (
    prompt: string,
    context: string,
    withSearch: boolean,
    withMaps: boolean,
    latitude: number | null,
    longitude: number | null,
): string => {
    const keyData = { prompt, context, withSearch, withMaps, latitude, longitude };
    const jsonString = JSON.stringify(keyData);
    // Safely encode Unicode characters before Base64 encoding
    const encodedString = encodeURIComponent(jsonString).replace(/%([0-9A-F]{2})/g, (match, p1) =>
        String.fromCharCode(parseInt(p1, 16))
    );
    return CACHE_PREFIX + btoa(encodedString); // Base64 encode for safer localStorage keys
};

/**
 * Loads cached data if available and not expired.
 * @param {string} key - The cache key.
 * @returns {{ code: string; groundingChunks?: GroundingChunk[] } | null} Cached data or null.
 */
const loadFromCache = (key: string): { code: string; groundingChunks?: GroundingChunk[] } | null => {
    try {
        // Ensure localStorage is available before attempting to use it
        if (typeof localStorage === 'undefined') {
            return null;
        }
        const cachedItem = localStorage.getItem(key);
        if (cachedItem) {
            const { timestamp, code, groundingChunks } = JSON.parse(cachedItem);
            if (Date.now() - timestamp < CACHE_EXPIRATION_MS) {
                console.log(`Loading from cache: ${key}`);
                return { code, groundingChunks };
            } else {
                console.log(`Cache expired for: ${key}`);
                localStorage.removeItem(key); // Clean up expired cache
            }
        }
    } catch (error) {
        console.error('Error loading from cache:', error);
        // Only attempt to remove from localStorage if it exists and error is not due to its absence
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(key); // Remove potentially corrupted cache entry
        }
    }
    return null;
};

/**
 * Saves generated content and grounding chunks to cache.
 * @param {string} key - The cache key.
 * @param {string} code - The generated code.
 * @param {GroundingChunk[]} groundingChunks - The associated grounding chunks.
 */
const saveToCache = (key: string, code: string, groundingChunks: GroundingChunk[]) => {
    try {
        // Ensure localStorage is available before attempting to use it
        if (typeof localStorage === 'undefined') {
            return;
        }
        const itemToCache = {
            timestamp: Date.now(),
            code,
            groundingChunks,
        };
        localStorage.setItem(key, JSON.stringify(itemToCache));
        console.log(`Saved to cache: ${key}`);
    } catch (error) {
        console.error('Error saving to cache:', error);
    }
};

/**
 * Generates content as a stream with the "thinking" feature enabled and processes the stream.
 * This provides a more detailed, step-by-step generation process for complex tasks.
 * It calls a callback function on each chunk to allow for real-time UI updates.
 * If no onUpdate callback is provided, it accumulates the entire response and returns it.
 * @param {string} prompt - The user's specific request.
 * @param {string} context - The current code or context from the editor.
 * @param {boolean} withSearch - Whether to enable Google Search grounding for the request.
 * @param {boolean} withMaps - Whether to enable Google Maps grounding for the request.
 * @param {number} latitude - Optional latitude for Maps grounding.
 * @param {number} longitude - Optional longitude for Maps grounding.
 * @param {(update: { code: string; groundingChunks?: GroundingChunk[] }) => void} [onUpdate] - Optional callback for each stream update.
 * @returns {Promise<{ code: string; groundingChunks?: GroundingChunk[] }>} A promise that resolves with the final code and grounding chunks.
 */
export const generateWithThinkingStream = async (
    prompt: string,
    context: string,
    withSearch: boolean,
    withMaps: boolean,
    latitude: number | null,
    longitude: number | null,
    onUpdate?: (update: { code: string; groundingChunks?: GroundingChunk[] }) => void
): Promise<{ code: string; groundingChunks?: GroundingChunk[] }> => {
    const fullPrompt = `You are a world-class software architect and principal engineer, an expert in complex algorithms and system design. Your mission is to generate, refactor, or optimize code to solve sophisticated algorithmic challenges.
Internally, you must deconstruct the problem, think step-by-step, consider various data structures, analyze time and space complexity, and anticipate edge cases to architect the most robust and performant solution.

User Request: "${prompt}"

Current Code Context:
\`\`\`
${context}
\`\`\`

Produce only the final, complete, and production-ready code block as your response. Do not include any explanations, markdown formatting, or other text outside of the code.
`;
    // FIX: Use a flexible type for config to allow dynamic property assignment.
    const config: any = {
        thinkingConfig: { thinkingBudget: 32768 },
        tools: [],
        toolConfig: {},
    };

    if (withSearch) {
        config.tools.push({ googleSearch: {} });
    }
    if (withMaps) {
        config.tools.push({ googleMaps: {} });
        if (latitude !== null && longitude !== null) {
            config.toolConfig.retrievalConfig = {
                latLng: {
                    latitude,
                    longitude,
                },
            };
        }
    }
    // Remove tools array if empty
    if (config.tools.length === 0) {
        delete config.tools;
        delete config.toolConfig;
    }

    // Attempt to load from cache if grounding is used
    // Note: LocalStorage is not available in Node.js CLI environment, this will only work in browser.
    const cacheKey = getCacheKey(prompt, context, withSearch, withMaps, latitude, longitude);
    if (typeof localStorage !== 'undefined' && (withSearch || withMaps) && cacheKey) {
        const cachedResult = loadFromCache(cacheKey);
        if (cachedResult) {
            onUpdate?.(cachedResult); // Provide the complete cached result immediately
            return cachedResult;
        }
    }

    const stream = await ai.models.generateContentStream({
        model: 'gemini-2.5-pro',
        contents: fullPrompt,
        config: config,
    });

    let accumulatedCode = '';
    let allGroundingChunks: GroundingChunk[] = [];

    for await (const chunk of stream) {
        try {
            // Ensure chunk text is valid before appending
            const text = chunk.text;
            if (typeof text === 'string') {
                accumulatedCode += text;
            } else if (text != null) {
                console.warn('Received a stream chunk with non-string text content:', chunk);
            }

            // Safely process grounding chunks
            const newChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (Array.isArray(newChunks)) {
                // FIX: Explicitly type the newChunk parameter in forEach to `import('@google/genai').GroundingChunk`
                // to match the type returned by the API, then map it to the local `GroundingChunk` interface.
                newChunks.forEach((newChunk: import('@google/genai').GroundingChunk) => {
                    const mappedChunk: GroundingChunk = {
                        web: newChunk.web ? {
                            uri: newChunk.web.uri,
                            title: newChunk.web.title,
                            // FIX: Removed 'snippet' as it is not present in the @google/genai GroundingChunkWeb type.
                        } : undefined,
                        maps: newChunk.maps ? {
                            uri: newChunk.maps.uri,
                            title: newChunk.maps.title,
                            // FIX: newChunk.maps.placeAnswerSources is often an object from the API, not always an array.
                            // The local MapsGrounding type expects an array of MapsPlaceAnswerSource.
                            // The API structure for MapsGrounding is like:
                            // { uri: string, title: string, placeAnswerSources?: { reviewSnippets: { text: string, url: string }[] } }
                            placeAnswerSources: newChunk.maps.placeAnswerSources ?
                                [{ // Wrap the single API `placeAnswerSources` object into an array to match local type.
                                    reviewSnippets: newChunk.maps.placeAnswerSources.reviewSnippets?.map(review => ({
                                        displayText: (review as any).text, // API often uses 'text' not 'displayText'
                                        uri: (review as any).url, // API often uses 'url' not 'uri'
                                    })),
                                }] : undefined,
                        } : undefined,
                    };

                    // Only add unique web URIs or unique maps URIs
                    if (mappedChunk.web?.uri && !allGroundingChunks.some((existing) => existing.web?.uri === mappedChunk.web?.uri)) {
                        allGroundingChunks.push(mappedChunk);
                    } else if (mappedChunk.maps?.uri && !allGroundingChunks.some((existing) => existing.maps?.uri === mappedChunk.maps?.uri)) {
                        allGroundingChunks.push(mappedChunk);
                    }
                });
            }

            // Provide the latest state to the caller
            onUpdate?.({
                code: accumulatedCode,
                groundingChunks: allGroundingChunks.length > 0 ? allGroundingChunks : undefined,
            });
        } catch (error) {
            console.error('Error processing stream chunk. The stream will continue.', { error, chunk });
            // This ensures a single malformed chunk doesn't stop the entire process
        }
    }

    const finalResult = {
        code: accumulatedCode,
        groundingChunks: allGroundingChunks.length > 0 ? allGroundingChunks : undefined,
    };

    // After stream completes, save the final result to cache if grounding was used
    if (typeof localStorage !== 'undefined' && (withSearch || withMaps) && cacheKey && accumulatedCode) {
        saveToCache(cacheKey, accumulatedCode, allGroundingChunks);
    }
    return finalResult;
};

export interface CompletionSuggestion {
    suggestion: string;
    documentation?: string;
}

/**
 * Requests code completion suggestions from the Gemini API, including documentation.
 * Implements client-side caching to reduce redundant API calls for the same prefixes.
 * @param {string} code - The full code content.
 * @param {number} cursorOffset - The absolute character offset of the cursor.
 * @param {string} fileType - The language type of the file (e.g., 'js', 'html').
 * @returns {Promise<CompletionSuggestion[]>} A promise that resolves to an array of completion suggestion objects.
 */
export const requestCodeCompletion = async (
    code: string,
    cursorOffset: number,
    fileType: string
): Promise<CompletionSuggestion[]> => {
    // Extract content before cursor
    const contextBeforeCursor = code.substring(0, cursorOffset);
    // A simple heuristic for what the user might be typing: the last word or identifier part
    const lastWordMatch = contextBeforeCursor.match(/[\w.$]+$/);
    const currentPrefix = lastWordMatch ? lastWordMatch[0] : '';

    // Check cache first
    const cacheKey = `${COMPLETION_CACHE_PREFIX}${fileType}:${currentPrefix}`;
    if (typeof localStorage !== 'undefined') { // Check if localStorage is available
        try {
            const cachedItem = localStorage.getItem(cacheKey);
            if (cachedItem) {
                const { timestamp, suggestions } = JSON.parse(cachedItem);
                if (Date.now() - timestamp < COMPLETION_CACHE_EXPIRATION_MS) {
                    console.log(`Loading completion from cache: ${currentPrefix}`);
                    return suggestions;
                } else {
                    localStorage.removeItem(cacheKey); // Clean up expired cache
                }
            }
        } catch (error) {
            console.error('Error loading completion from cache:', error);
            localStorage.removeItem(cacheKey); // Remove potentially corrupted cache entry
        }
    }

    const model = 'gemini-2.5-flash'; // Optimized for speed

    // Craft a precise prompt
    const prompt = `You are an expert code completion AI. Given the following code snippet and the cursor position, provide highly relevant code completion suggestions.
The user has typed up to the cursor. Provide completions for the token or structure directly following the cursor.

Code context leading to cursor (language: ${fileType}):
\`\`\`${fileType}
${contextBeforeCursor}
\`\`\`

Based on this context, provide 3 to 5 concise and direct code completion suggestions.
For each suggestion, also provide detailed documentation including multi-line function signatures, parameter hints, and a brief description. Ensure this documentation clearly shows parameters and their types on separate lines if needed for clarity.
Do NOT generate entire functions, explanations, or code blocks. Just the raw completion strings and their documentation.
Return only a JSON array of objects, for example:
[
    { "suggestion": "console.log", "documentation": "console.log(message?: any, ...optionalParams: any[]): void\\nLogs messages to the console." },
    { "suggestion": "Math.random", "documentation": "Math.random(): number\\nReturns a pseudo-random number between 0 and 1." }
]
`;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            suggestion: {
                                type: Type.STRING,
                                description: 'The code completion string.',
                            },
                            documentation: {
                                type: Type.STRING,
                                description: 'Detailed documentation for the suggestion, including multi-line function signatures, parameter hints, and a brief description, possibly spanning several lines.',
                            },
                        },
                        required: ['suggestion'], // Documentation is optional, but preferred
                    },
                },
                // Small thinking budget for faster response, max output tokens for brevity
                thinkingConfig: { thinkingBudget: 50 },
                maxOutputTokens: 1000, // Increased to allow for more detailed documentation (from 750 to 1000)
            },
        });

        let jsonStr = response.text.trim();
        // Remove markdown code block fences if present in the response
        if (jsonStr.startsWith('```json') && jsonStr.endsWith('```')) {
            jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
        }

        const suggestions: CompletionSuggestion[] = JSON.parse(jsonStr);

        if (!Array.isArray(suggestions) || !suggestions.every(s => typeof s.suggestion === 'string')) {
            console.error('Invalid completion response format:', suggestions);
            return [];
        }

        // Cache the results
        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem(cacheKey, JSON.stringify({ suggestions, timestamp: Date.now() }));
                console.log(`Saved completion to cache: ${currentPrefix}`);
            } catch (cacheError) {
                console.warn('Could not save completion to cache:', cacheError);
            }
        }

        return suggestions;

    } catch (error) {
        console.error('Error requesting code completion:', error);
        return [];
    }
};

/**
 * An array of predefined AI agent personas. Each persona has a unique specialization
 * to guide the code generation process during multi-agent consensus.
 * @type {Persona[]}
 */
export const personas: Persona[] = [
    {
        name: 'Performance Optimizer',
        description:
            'Focuses on maximum performance, low-level optimization, bit-twiddling, and efficient memory usage. Writes highly optimized, fast code.',
    },
    {
        name: 'Code Readability Advocate',
        description:
            'Prioritizes clean, elegant, and maintainable code. Uses design patterns, clear naming conventions, and extensive comments.',
    },
    {
        name: 'Modernist Developer',
        description:
            'Leverages the latest language features, functional programming concepts, and modern idioms to write concise and expressive code.',
    },
    {
        name: 'Theoretical Scientist',
        description:
            'Approaches problems from a mathematical or theoretical computer science perspective, ensuring algorithmic purity and correctness.',
    },
    {
        name: 'Simplicity Champion',
        description:
            "Advocates for simple, straightforward, and easy-to-understand solutions, avoiding unnecessary complexity. Prefers brute-force if it's clearer.",
    },
    {
        name: 'Scalability Architect',
        description:
            'Designs solutions that can handle massive datasets and high concurrency, considering distributed systems principles.',
    },
    {
        name: 'Security Specialist',
        description:
            'Focuses on secure coding practices, identifying potential vulnerabilities, and implementing robust defenses against common exploits.',
    },
    {
        name: 'UI/UX Futurist',
        description:
            'Prioritizes an exceptional and intuitive user experience, focusing on accessibility, modern design patterns, and fluid interactivity.',
    },
    {
        name: 'API Architect',
        description:
            'Designs clean, maintainable, and scalable API contracts. Focuses on RESTful principles, data modeling, and clear versioning strategies.',
    },
    {
        name: 'Legacy Code Modernizer',
        description:
            'Specializes in refactoring outdated codebases, untangling monolithic structures, and upgrading them with modern design patterns and technologies.',
    },
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
export const runMultiAgentConsensus = async (
    prompt: string,
    context: string,
    selectedPersonaNames: string[]
): Promise<Candidate[]> => {
    const selectedPersonas = personas.filter((p) => selectedPersonaNames.includes(p.name));
    if (selectedPersonas.length === 0) {
        return [];
    }

    const prompts = selectedPersonas.map((persona) => {
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

    const promises = prompts.map((p) =>
        ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: p,
        })
    );

    const responses = await Promise.all(promises);

    const candidatesMap = new Map<string, { agents: string[]; count: number }>();
    responses.forEach((res, i) => {
        const content = res.text.trim();
        if (content) {
            // Updated regex to more robustly extract code blocks, if present
            const codeMatch = content.match(/```(?:[\w\s]*)\n?([\s\S]*?)```/);
            const finalContent = (codeMatch && codeMatch[1] ? codeMatch[1].trim() : content).trim();

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

    return Array.from(candidatesMap.entries())
        .map(([content, data]) => ({
            content,
            agents: data.agents,
            count: data.count,
            avgEntropy: Math.random() * 2 + 5, // mock entropy
            score: data.count + (Math.random() * 2 + 5) * 0.1,
        }))
        .sort((a, b) => b.score - a.score);
};

/**
 * Analyzes a block of code for potential issues and provides structured feedback.
 * The AI is prompted to act as an expert code reviewer, focusing on bugs, security,
 * style, and performance, and to return its findings in a specific JSON format.
 * @param {string} codeContent - The code to be reviewed.
 * @returns {Promise<CodeReviewFinding[]>} A promise that resolves to an array of code review findings.
 */
export const runCodeReview = async (codeContent: string): Promise<CodeReviewFinding[]> => {
    const prompt = `You are a world-class AI code reviewer with deep expertise in identifying bugs, security vulnerabilities, style inconsistencies, and performance bottlenecks.
Analyze the following code meticulously. For each issue you find, provide a concise and actionable suggestion.
Do not comment on correct code. Only report issues that need attention.

Code to review:
\`\`\`
${codeContent}
\`\`\`

Return your findings as a JSON object that adheres to the provided schema.
`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    findings: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                line_number: {
                                    type: Type.INTEGER,
                                    description: 'The line number where the issue occurs.',
                                },
                                severity: {
                                    type: Type.STRING,
                                    description: 'The severity of the issue. Must be one of: Critical, Warning, Suggestion.',
                                },
                                category: {
                                    type: Type.STRING,
                                    description:
                                        'The category of the issue. Must be one of: Bug, Security, Style, Performance.',
                                },
                                suggestion: {
                                    type: Type.STRING,
                                    description: 'A clear, actionable suggestion to fix the issue.',
                                },
                            },
                            required: ['line_number', 'severity', 'category', 'suggestion'],
                        },
                    },
                },
                required: ['findings'],
            },
        },
    });

    try {
        let jsonResponseText = response.text.trim();
        // Remove markdown code block fences if present in the response
        if (jsonResponseText.startsWith('```json') && jsonResponseText.endsWith('```')) {
            jsonResponseText = jsonResponseText.substring(7, jsonResponseText.length - 3).trim();
        }

        const jsonResponse = JSON.parse(jsonResponseText);
        if (jsonResponse && Array.isArray(jsonResponse.findings)) {
            return jsonResponse.findings as CodeReviewFinding[];
        }
        return [];
    } catch (e) {
        console.error('Failed to parse code review response:', e);
        throw new Error('Could not parse AI code review response.');
    }
};

/**
 * Performs a quick AI-driven fix on a given code content.
 * This uses a faster model for general bug fixes, syntax corrections, and minor improvements.
 * @param {string} codeContent - The code to be fixed.
 * @returns {Promise<string>} A promise that resolves to the fixed code string.
 */
export const quickFixCode = async (codeContent: string): Promise<string> => {
    const prompt = `You are an expert software engineer whose sole task is to review and fix code for common issues such as syntax errors, logical bugs, and style inconsistencies. Your response must ONLY contain the corrected, complete, and production-ready code block. Do not include any explanations, markdown formatting, or other text outside of the code. Just the code.

Code to fix:
\`\`\`
${codeContent}
\`\`\`
`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', // Using a faster model for quick fixes
        contents: prompt,
    });

    // The guideline states: "Produce only the final, complete, and production-ready code block as your response.
    // Do not include any explanations, markdown formatting, or other text outside of the code."
    // So, response.text should already be the code.
    let generatedCode = response.text.trim();
    // Remove markdown code block fences if present in the response
    const codeMatch = generatedCode.match(/```(?:[\w\s]*)\n?([\s\S]*?)```/);
    return (codeMatch && codeMatch[1] ? codeMatch[1].trim() : generatedCode).trim();
};