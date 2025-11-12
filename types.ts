

import type { ReactNode } from 'react';

export type AgentName = 'nexus' | 'cognito' | 'relay' | 'sentinel' | 'echo' | 'oracle';

export interface Agent {
    name: AgentName;
    title: string;
    subtitle: string;
    // FIX: Use imported ReactNode type to resolve 'React' namespace error.
    content: ReactNode;
    status: 'idle' | 'working' | 'done' | 'error';
    color: string;
}

export interface MapsPlaceAnswerSource {
    reviewSnippets?: {
        displayText?: string;
        uri?: string;
    }[];
}

export interface MapsGrounding {
    uri?: string; // FIX: Made optional to align with @google/genai types
    title?: string; // FIX: Made optional to align with @google/genai types
    placeAnswerSources?: MapsPlaceAnswerSource[];
}

export interface GroundingChunk {
    web?: {
        uri?: string; // FIX: Made optional to align with @google/genai types
        title?: string; // FIX: Made optional to align with @google/genai types
        // FIX: Removed 'snippet' as it is not present in the @google/genai GroundingChunkWeb type.
    };
    maps?: MapsGrounding; // Added for Google Maps grounding
}

export interface CodeReviewFinding {
    line_number: number;
    severity: 'Critical' | 'Warning' | 'Suggestion';
    category: 'Bug' | 'Security' | 'Style' | 'Performance';
    suggestion: string;
}

export interface AiState {
    agents: Agent[];
    isLoading: boolean;
    consensus: Consensus | null;
    generatedCode: string | null;
    groundingChunks: GroundingChunk[] | null;
    codeReviewFindings: CodeReviewFinding[] | null;
}

export interface EditorStats {
    cursor: string;
    lines: number;
    chars: number;
    history: number;
}

export interface Candidate {
    content: string;
    agents: string[];
    count: number;
    avgEntropy: number;
    score: number;
}

export interface Consensus {
    selectedCandidate: string;
    score: string;
    count: number;
    avgEntropy: string;
    rootAgent: string;
    allCandidates: Candidate[];
}

export interface OrchestratorSettings {
    agentCount: number;
    maxRounds: number;
}

export interface Persona {
    name: string;
    description: string;
}

export interface TerminalLine {
    type: 'input' | 'output' | 'error' | 'system' | 'help';
    content: string;
}

// --- File System Types for Explorer ---
export interface FileNode {
    type: 'file';
    content: string;
}

export interface FolderNode {
    type: 'folder';
    children: Record<string, FileSystemNode>;
}

export type FileSystemNode = FileNode | FolderNode;

// --- Code Snippet Type ---
export interface CodeSnippet {
    id: string; // Unique identifier
    title: string;
    code: string;
}