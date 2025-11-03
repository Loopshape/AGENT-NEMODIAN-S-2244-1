
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

export interface GroundingChunk {
    web?: {
        uri: string;
        title: string;
    };
}

export interface AiState {
    agents: Agent[];
    isLoading: boolean;
    consensus: Consensus | null;
    generatedCode: string | null;
    groundingChunks: GroundingChunk[] | null;
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
