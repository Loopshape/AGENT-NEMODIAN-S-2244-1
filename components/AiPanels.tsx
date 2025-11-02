import React from 'react';
import type { AiState, Agent, Consensus, GroundingChunk } from '../types';

/**
 * Determines the inline CSS styles for an AgentCard based on its status.
 * @param {Agent} agent - The agent object.
 * @returns {React.CSSProperties} The style object for the card.
 */
const getAgentCardStyle = (agent: Agent): React.CSSProperties => {
    switch (agent.status) {
        case 'working':
            return {
                borderColor: agent.color,
                boxShadow: `0 0 25px ${agent.color}99`,
                animation: 'agentPulse 2s infinite ease-in-out',
            };
        case 'error':
            return {
                borderColor: '#CF6679',
                boxShadow: `0 0 15px #CF667999`,
                animation: 'agentError 0.5s linear',
            };
        case 'idle':
            return {
                borderColor: agent.color,
                animation: 'agentIdle 3s infinite ease-in-out',
            };
        case 'done':
            return {
                borderColor: agent.color,
                opacity: 0.9,
            };
        default:
            return {
                borderColor: agent.color,
            };
    }
};

/**
 * A card component to display the status and information of a single AI agent.
 * @param {{ agent: Agent }} props - Component props.
 * @param {Agent} props.agent - The agent data to display.
 * @returns {React.ReactElement} The rendered agent card.
 */
const AgentCard: React.FC<{ agent: Agent }> = ({ agent }) => (
    <div
        className={`agent-card bg-[#313328] rounded-lg p-3 mb-2 border-l-4 transition-all duration-300`}
        style={getAgentCardStyle(agent)}
    >
        <div
            className="agent-title font-bold text-sm mb-1"
            style={{ color: agent.status === 'error' ? '#CF6679' : agent.color }}
        >
            {agent.title}
        </div>
        <div className="agent-subtitle text-xs text-[#999966] mb-1.5">{agent.subtitle}</div>
        <div className="agent-content text-xs min-h-[20px] flex items-center">
            {agent.status === 'working' && (
                <div className="quantum-spinner w-4 h-4 inline-block mr-1.5 relative">
                    <div className="absolute w-full h-full border-2 border-transparent border-t-[#03DAC6] rounded-full quantum-spinner::before"></div>
                    <div className="absolute w-full h-full border-2 border-transparent border-b-[#BB86FC] rounded-full quantum-spinner::after"></div>
                </div>
            )}
            {agent.status === 'done' && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
            )}
            {agent.status === 'error' && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            )}
            {agent.content}
        </div>
    </div>
);


/**
 * A panel to display the results of a multi-agent consensus run.
 * It shows all generated candidates, their scores, and contributing agents.
 * @param {{ consensus: Consensus }} props - Component props.
 * @param {Consensus} props.consensus - The consensus result data.
 * @returns {React.ReactElement} The rendered consensus panel.
 */
const ConsensusPanel: React.FC<{ consensus: Consensus }> = ({ consensus }) => (
    <div className="consensus-panel bg-[#313328] border border-[#BB86FC] rounded-lg p-3.5 mt-4 max-h-72 overflow-y-auto">
        <div className="consensus-header font-bold text-[#BB86FC] mb-2.5 flex justify-between items-center">
            <span>Multi-Agent Consensus Results</span>
            <span className="bg-[#BB86FC] text-white px-1.5 py-0.5 rounded-full text-xs">Score: {consensus.score}</span>
        </div>
        <div>
            {consensus.allCandidates.map((c, i) => (
                <div key={i} className={`candidate-item bg-white/5 rounded p-2 mb-2 border-l-4 ${i === 0 ? 'border-l-[#4ac94a] bg-green-500/10' : 'border-l-[#03DAC6]'}`}>
                    <div className="text-xs text-[#999966] flex justify-between mb-1">
                        <span>{c.agents.join(', ')}</span>
                        <span>Count: {c.count}</span>
                    </div>
                    <div className="text-xs font-mono whitespace-pre-wrap max-h-20 overflow-hidden text-ellipsis">
                        {c.content.substring(0, 200)}{c.content.length > 200 ? '...' : ''}
                    </div>
                </div>
            ))}
        </div>
    </div>
);

/**
 * A panel to display the web sources used for grounding a Gemini API response.
 * @param {{ chunks: GroundingChunk[] }} props - Component props.
 * @param {GroundingChunk[]} props.chunks - The array of grounding chunks from the API.
 * @returns {React.ReactElement} The rendered grounding panel.
 */
const GroundingPanel: React.FC<{ chunks: GroundingChunk[] }> = ({ chunks }) => (
    <div className="grounding-panel bg-yellow-900/20 border border-[#FFD54F] rounded-lg p-3.5 mt-4">
        <div className="flex items-center gap-2 font-bold text-[#FFD54F] mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 3.5a1.5 1.5 0 01.5 2.915V9.5a1.5 1.5 0 01-3 0V6.415A1.5 1.5 0 0110 3.5z" />
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM2 10a8 8 0 1116 0 8 8 0 01-16 0z" />
            </svg>
            <span>Grounded on Real-Time Google Search</span>
        </div>
        <ol className="list-decimal list-inside text-xs space-y-2 pl-1">
            {chunks.map((chunk, i) => chunk.web && (
                <li key={i} className="truncate">
                    <a href={chunk.web.uri} target="_blank" rel="noopener noreferrer" 
                       title={chunk.web.title || chunk.web.uri}
                       className="text-sky-400 hover:underline hover:text-sky-300 transition-colors">
                        {chunk.web.title || chunk.web.uri}
                    </a>
                </li>
            ))}
        </ol>
    </div>
);

/**
 * A panel to display the final generated code from an AI run.
 * @param {{ code: string }} props - Component props.
 * @param {string} props.code - The generated code string.
 * @returns {React.ReactElement} The rendered code panel.
 */
const GeneratedCodePanel: React.FC<{ code: string }> = ({ code }) => (
    <div className="generated-code-panel bg-black/30 rounded-lg p-3.5 mt-4 max-h-72 overflow-y-auto border border-gray-700">
        <div className="font-bold text-[#4ac94a] mb-2.5">Generated Code</div>
        <pre className="text-xs font-mono whitespace-pre-wrap text-slate-300">
            <code>{code}</code>
        </pre>
    </div>
);

interface AiResponsePanelProps {
    isOpen: boolean;
    aiState: AiState;
    onClose: () => void;
    onApplyCode: (code: string) => void;
    onCopyCode: (code: string) => void;
}

/**
 * The main container panel for displaying all AI-related responses.
 * It orchestrates the display of agent statuses, consensus results, grounding info,
 * and generated code. It also provides actions to apply or copy the generated code.
 * @param {AiResponsePanelProps} props - The component props.
 * @param {boolean} props.isOpen - Controls whether the panel is visible.
 * @param {AiState} props.aiState - The current state of the AI, including agents, results, and loading status.
 * @param {() => void} props.onClose - Callback function to close the panel.
 * @param {(code: string) => void} props.onApplyCode - Callback to apply the generated code to the editor.
 * @param {(code: string) => void} props.onCopyCode - Callback to copy the generated code to the clipboard.
 * @returns {React.ReactElement | null} The rendered AI response panel or null if not open.
 */
export const AiResponsePanel: React.FC<AiResponsePanelProps> = ({ isOpen, aiState, onClose, onApplyCode, onCopyCode }) => {
    if (!isOpen) return null;

    const codeToActOn = aiState.consensus?.selectedCandidate ?? aiState.generatedCode;

    return (
        <div className="fixed bottom-20 right-5 w-[500px] max-h-[600px] bg-[#313328] border border-[#4ac94a] rounded-lg p-4 overflow-y-auto z-40 shadow-2xl">
            <button onClick={onClose} className="absolute top-1 right-2 text-[#999966] text-xl">&times;</button>
            <div>
                {aiState.agents.map(agent => <AgentCard key={agent.name} agent={agent} />)}

                {aiState.generatedCode && !aiState.consensus && <GeneratedCodePanel code={aiState.generatedCode} />}
                
                {codeToActOn && (
                    <div className="mt-4 pt-2.5 border-t border-gray-700 flex gap-2">
                        <button onClick={() => onCopyCode(codeToActOn)} className="flex-1 bg-[#4ac94a] hover:bg-green-400 text-xs px-2 py-1.5 rounded transition-colors">Copy Code</button>
                        <button onClick={() => onApplyCode(codeToActOn)} className="flex-1 bg-[#5bc0de] hover:bg-cyan-400 text-xs px-2 py-1.5 rounded transition-colors">Apply to Editor</button>
                    </div>
                )}
                
                {aiState.consensus && <ConsensusPanel consensus={aiState.consensus} />}
                {aiState.groundingChunks && aiState.groundingChunks.length > 0 && <GroundingPanel chunks={aiState.groundingChunks} />}
            </div>
        </div>
    );
};