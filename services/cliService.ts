/// <reference types="node" />

import { GoogleGenAI, GenerateContentResponse, Type } from '@google/genai';
import type { Candidate, Persona, CodeReviewFinding, GroundingChunk } from '../types';
import { generateWithThinkingStream, runMultiAgentConsensus, personas, runCodeReview, quickFixCode } from './geminiService';

// Node.js specific imports for CLI
import * as fs from 'fs';
import * as path from 'path';

const API_KEY = process.env.API_KEY;

// Only initialize GoogleGenAI if API_KEY is present; the CLI checks this earlier.
const ai = new GoogleGenAI({ apiKey: API_KEY! });

// Helper to read file content for CLI
function readFileContent(filepath: string): string {
    if (!fs.existsSync(filepath)) {
        throw new Error(`File not found: ${filepath}`);
    }
    return fs.readFileSync(filepath, 'utf8');
}

function formatGroundingChunksForCLI(chunks: GroundingChunk[]): string {
    if (chunks.length === 0) return '';
    let output = '\n--- Grounding Sources ---\n';
    chunks.forEach((chunk, i) => {
        if (chunk.web) {
            output += `\n[WEB ${i + 1}] Title: ${chunk.web.title || 'N/A'}\nURI: ${chunk.web.uri || 'N/A'}\n`;
            // FIX: Removed chunk.web.snippet as it is not present in the @google/genai GroundingChunkWeb type.
        }
        if (chunk.maps) {
            output += `\n[MAPS ${i + 1}] Title: ${chunk.maps.title || 'N/A'}\nURI: ${chunk.maps.uri || 'N/A'}\n`;
            if (chunk.maps.placeAnswerSources && chunk.maps.placeAnswerSources.length > 0) {
                chunk.maps.placeAnswerSources.forEach((source, j) => {
                    if (source.reviewSnippets && source.reviewSnippets.length > 0) {
                        source.reviewSnippets.forEach((review, k) => {
                            output += `  Review ${k + 1}: ${review.displayText || 'N/A'}\n`;
                            output += `  Review URI: ${review.uri || 'N/A'}\n`;
                        });
                    }
                });
            }
        }
    });
    return output + '\n-------------------------\n';
}

/**
 * CLI wrapper for generateWithThinkingStream.
 * @param {string} prompt - The user's specific request.
 * @param {string} [codeContext=''] - Optional current code context.
 * @param {boolean} [withSearch=false] - Whether to enable Google Search grounding.
 * @param {boolean} [withMaps=false] - Whether to enable Google Maps grounding.
 * @param {number | null} [latitude=null] - Optional latitude for Maps grounding.
 * @param {number | null} [longitude=null] - Optional longitude for Maps grounding.
 * @returns {Promise<void>}
 */
export async function cliGenerate(
    prompt: string,
    codeContext: string = '',
    withSearch: boolean = false,
    withMaps: boolean = false,
    latitude: number | null = null,
    longitude: number | null = null,
): Promise<void> {
    if (withMaps && (latitude === null || longitude === null)) {
        console.error('Error: --maps option requires both --lat and --lon arguments.');
        (process as any).exit(1);
    }
    console.error('Generating code with Quantum AI...'); // Use stderr for progress messages
    const { code, groundingChunks } = await generateWithThinkingStream(
        prompt,
        codeContext,
        withSearch,
        withMaps,
        latitude,
        longitude,
        // No onUpdate callback for CLI as we want the full result
    );
    console.log(code);
    if (groundingChunks && groundingChunks.length > 0) {
        console.error(formatGroundingChunksForCLI(groundingChunks));
    }
}

/**
 * CLI wrapper for runMultiAgentConsensus.
 * @param {string} prompt - The user's specific request.
 * @param {string} selectedAgentsCSV - Comma-separated list of agent names.
 * @param {string} [codeContext=''] - Optional current code context.
 * @returns {Promise<void>}
 */
export async function cliOrchestrate(
    prompt: string,
    selectedAgentsCSV: string,
    codeContext: string = '',
): Promise<void> {
    const selectedAgents = selectedAgentsCSV.split(',').map(s => s.trim()).filter(Boolean);
    if (selectedAgents.length < 2) {
        console.error('Error: Multi-Agent Consensus requires at least two agents.');
        (process as any).exit(1);
    }
    console.error(`Running Multi-Agent Consensus with agents: ${selectedAgents.join(', ')}`);
    const candidates = await runMultiAgentConsensus(prompt, codeContext, selectedAgents);

    if (candidates.length > 0) {
        const topCandidate = candidates[0];
        console.log(`--- Multi-Agent Consensus Result ---`);
        console.log(`Top Candidate Score: ${topCandidate.score.toFixed(2)}`);
        console.log(`Agents in Consensus: ${topCandidate.agents.join(', ')}`);
        console.log('\nGenerated Code:\n');
        console.log(topCandidate.content);
        if (candidates.length > 1) {
            console.log('\n--- Other Candidates (Summary) ---');
            candidates.slice(1).forEach((c, i) => {
                console.log(`Candidate ${i + 2} (Score: ${c.score.toFixed(2)}, Agents: ${c.agents.join(', ')})`);
                console.log(c.content.substring(0, 100) + (c.content.length > 100 ? '...' : ''));
            });
        }
        console.log('------------------------------------');
    } else {
        console.error('Error: Multi-Agent Consensus failed to produce any candidates.');
        (process as any).exit(1);
    }
}

/**
 * CLI wrapper for runCodeReview.
 * @param {string} filepath - Path to the code file to review.
 * @returns {Promise<void>}
 */
export async function cliReview(filepath: string): Promise<void> {
    const codeContent = readFileContent(filepath);
    console.error(`Reviewing code in ${filepath}...`);
    const findings = await runCodeReview(codeContent);

    if (findings.length > 0) {
        console.log(`--- Code Review Findings for ${filepath} ---`);
        findings.forEach((f, i) => {
            console.log(`\n${i + 1}. [${f.severity}] Category: ${f.category}`);
            console.log(`   Line: ${f.line_number}`);
            console.log(`   Suggestion: ${f.suggestion}`);
        });
        console.log('--------------------------------------------');
    } else {
        console.log(`No issues found in ${filepath}.`);
    }
}

/**
 * CLI wrapper for quickFixCode.
 * @param {string} filepath - Path to the code file to fix.
 * @returns {Promise<void>}
 */
export async function cliFix(filepath: string): Promise<void> {
    const codeContent = readFileContent(filepath);
    console.error(`Applying quick fix to ${filepath}...`);
    const fixedCode = await quickFixCode(codeContent);
    console.log(fixedCode);
}

// Main execution block for CLI
if (typeof require !== 'undefined' && (require as any).main === (module as any)) {
    // This code only runs when the script is executed directly via tsx, not when imported.
    const args = (process as any).argv.slice(2); // Skip node and script path

    const command = args[0];
    const promptIndex = args.findIndex((arg: string) => !arg.startsWith('--')); // First non-flag arg is usually prompt
    const prompt = promptIndex !== -1 ? args[promptIndex].replace(/^"|"$/g, '') : '';

    const getFlagValue = (flag: string) => {
        const index = args.indexOf(flag);
        if (index > -1 && index + 1 < args.length && !args[index + 1].startsWith('--')) {
            return args[index + 1].replace(/^"|"$/g, '');
        }
        return undefined;
    };

    const hasFlag = (flag: string) => args.includes(flag);

    // Determine the filepath argument correctly, supporting both --code and --file
    let filepath: string | undefined;
    const codeFlagIndex = args.indexOf('--code');
    const fileFlagIndex = args.indexOf('--file');

    if (codeFlagIndex !== -1 && args[codeFlagIndex + 1] && !args[codeFlagIndex + 1].startsWith('--')) {
        filepath = args[codeFlagIndex + 1].replace(/^"|"$/g, '');
    } else if (fileFlagIndex !== -1 && args[fileFlagIndex + 1] && !args[fileFlagIndex + 1].startsWith('--')) {
        filepath = args[fileFlagIndex + 1].replace(/^"|"$/g, '');
    }

    let codeContext = '';
    if (filepath) {
        try {
            codeContext = readFileContent(filepath);
        } catch (error) {
            console.error(`Error reading file: ${(error as Error).message}`);
            (process as any).exit(1);
        }
    }

    switch (command) {
        case 'generate':
            const useSearch = hasFlag('--search');
            const useMaps = hasFlag('--maps');
            const latitudeStr = getFlagValue('--lat');
            const longitudeStr = getFlagValue('--lon');

            if (!prompt) {
                console.error('Error: `generate` command requires a prompt.');
                (process as any).exit(1);
            }

            if (useMaps && (!latitudeStr || !longitudeStr)) {
                console.error('Error: When using `--maps`, `--lat <latitude>` and `--lon <longitude>` are required.');
                (process as any).exit(1);
            }

            cliGenerate(
                prompt,
                codeContext,
                useSearch,
                useMaps,
                latitudeStr ? parseFloat(latitudeStr) : null,
                longitudeStr ? parseFloat(longitudeStr) : null,
            ).catch(console.error);
            break;

        case 'orchestrate':
            const agentsCSV = getFlagValue('--agents');
            if (!prompt) {
                console.error('Error: `orchestrate` command requires a prompt.');
                (process as any).exit(1);
            }
            if (!agentsCSV) {
                console.error('Error: `orchestrate` command requires `--agents <comma-separated-list>`');
                (process as any).exit(1);
            }
            cliOrchestrate(prompt, agentsCSV, codeContext).catch(console.error);
            break;

        case 'review':
            if (!filepath) {
                console.error('Error: `review` command requires a `--file <filepath>`.');
                (process as any).exit(1);
            }
            cliReview(filepath).catch(console.error);
            break;

        case 'fix':
            if (!filepath) {
                console.error('Error: `fix` command requires a `--file <filepath>`.');
                (process as any).exit(1);
            }
            cliFix(filepath).catch(console.error);
            break;
        case 'help':
            // The shell script already handles 'help' and calls tsx with 'help' as the command
            // which will cause this default branch to be hit. We want to avoid double-printing help.
            // So, just exit cleanly here if the command is 'help'.
            // If the shell script did NOT handle help, we would put show_help() here.
            break;

        default:
            console.error(`Unknown command: "${command}"`);
            console.error('Use `./quantum_orchestrator.sh help` for usage.');
            (process as any).exit(1);
    }
}