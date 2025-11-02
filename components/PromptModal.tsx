import React, { useState, useEffect } from 'react';
import type { Persona } from '../types';
import type { AiMode } from '../App';

interface PromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: {
        prompt: string;
        context: string;
        snippet: string;
        mode: AiMode;
        selectedAgents: string[];
    }) => void;
    personas: Persona[];
    initialState: { prompt: string, mode: AiMode } | null;
}

/**
 * A button used for selecting the execution mode in the prompt modal.
 * @param {object} props - Component props.
 * @param {boolean} props.active - Whether this button represents the currently active mode.
 * @param {() => void} props.onClick - The click handler.
 * @param {React.ReactNode} props.children - The button's content.
 * @returns {React.ReactElement} The rendered mode button.
 */
const ModeButton: React.FC<{ active: boolean, onClick: () => void, children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        className={`px-3 py-1.5 text-sm rounded transition-colors ${
            active ? 'bg-[#4ac94a] text-white font-bold' : 'bg-white/10 hover:bg-white/20'
        }`}
    >
        {children}
    </button>
);

/**
 * A card for selecting an AI agent persona in the multi-agent consensus mode.
 * @param {object} props - Component props.
 * @param {Persona} props.persona - The persona data for this card.
 * @param {boolean} props.selected - Whether this persona is currently selected.
 * @param {() => void} props.onClick - The click handler.
 * @returns {React.ReactElement} The rendered agent card.
 */
const AgentCard: React.FC<{ persona: Persona, selected: boolean, onClick: () => void }> = ({ persona, selected, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        title={persona.description}
        className={`p-2 rounded border text-left transition-all duration-200 ${
            selected ? 'bg-[#4ac94a]/30 border-[#4ac94a] shadow-lg -translate-y-0.5' : 'bg-white/5 border-transparent hover:border-white/20'
        }`}
    >
        <div className="font-semibold text-xs text-[#f0f0e0]">{persona.name}</div>
    </button>
);

/**
 * A modal dialog for users to input prompts for the AI. It supports different modes
 * like single AI, multi-agent consensus, and grounded search. It allows for a main
 * request, pasted code snippets, and additional context.
 * @param {PromptModalProps} props - The component props.
 * @param {boolean} props.isOpen - Controls whether the modal is visible.
 * @param {() => void} props.onClose - Callback function to close the modal.
 * @param {(data: { prompt: string; context: string; snippet: string; mode: AiMode; selectedAgents: string[] }) => void} props.onSubmit - Callback function to submit the prompt data to the main app.
 * @param {Persona[]} props.personas - An array of available AI agent personas for the orchestrator mode.
 * @param {{ prompt: string, mode: AiMode } | null} props.initialState - Pre-fills the modal's state, used for quick actions.
 * @returns {React.ReactElement | null} The rendered prompt modal or null if not open.
 */
export const PromptModal: React.FC<PromptModalProps> = ({ isOpen, onClose, onSubmit, personas, initialState }) => {
    const [mode, setMode] = useState<AiMode>('ai');
    const [prompt, setPrompt] = useState('');
    const [context, setContext] = useState('');
    const [snippet, setSnippet] = useState('');
    const [selectedAgents, setSelectedAgents] = useState<string[]>([]);

    useEffect(() => {
        if (initialState) {
            setMode(initialState.mode);
            setPrompt(initialState.prompt);
            // Pre-select 4 agents if orchestrator mode is opened
            if (initialState.mode === 'orchestrator') {
                setSelectedAgents(personas.slice(0, 4).map(p => p.name));
            }
        } else {
            // Reset state if no initial state
            setPrompt('');
            setContext('');
            setSnippet('');
            setSelectedAgents([]);
        }
    }, [initialState, personas]);

    if (!isOpen) return null;

    const handleAgentClick = (agentName: string) => {
        setSelectedAgents(prev =>
            prev.includes(agentName)
                ? prev.filter(name => name !== agentName)
                : [...prev, agentName]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({ prompt, context, snippet, mode, selectedAgents });
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-3xl bg-[#313328] border-2 border-[#4ac94a] rounded-lg flex flex-col shadow-2xl max-h-[90vh]">
                <div className="bg-[#2e3026] text-[#f0f0e0] p-3 flex justify-between items-center border-b border-[#4ac94a]">
                    <h2 className="text-lg font-bold quantum-pulse">Quantum Invocation</h2>
                    <button onClick={onClose} className="text-2xl leading-none hover:text-red-500 transition-colors">&times;</button>
                </div>
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-[#999966] mb-2">Execution Mode</label>
                        <div className="flex gap-2">
                            <ModeButton active={mode === 'ai'} onClick={() => setMode('ai')}>Quantum AI</ModeButton>
                            <ModeButton active={mode === 'orchestrator'} onClick={() => setMode('orchestrator')}>Multi-Agent Consensus</ModeButton>
                            <ModeButton active={mode === 'search'} onClick={() => setMode('search')}>Search & Generate</ModeButton>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="main-prompt" className="block text-sm font-semibold text-[#999966] mb-2">
                            Your Request
                        </label>
                        <textarea
                            id="main-prompt"
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            placeholder="e.g., 'Refactor this component to use React Hooks and add error boundaries'"
                            className="w-full h-32 p-2 bg-[#22241e] border border-[#999966] text-[#f0f0e0] font-mono rounded text-sm focus:border-[#4ac94a] focus:ring-0 outline-none"
                        />
                    </div>
                     <div>
                        <label htmlFor="snippet-prompt" className="block text-sm font-semibold text-[#999966] mb-2">
                            Pasted Code Snippet (Optional)
                        </label>
                        <textarea
                            id="snippet-prompt"
                            value={snippet}
                            onChange={e => setSnippet(e.target.value)}
                            placeholder="Paste relevant code snippets, helper functions, or data structures here."
                            className="w-full h-24 p-2 bg-[#22241e] border border-[#999966] text-[#f0f0e0] font-mono rounded text-sm focus:border-[#4ac94a] focus:ring-0 outline-none"
                        />
                    </div>
                     <div>
                        <label htmlFor="context-prompt" className="block text-sm font-semibold text-[#999966] mb-2">
                            Additional Context (Optional)
                        </label>
                        <textarea
                            id="context-prompt"
                            value={context}
                            onChange={e => setContext(e.target.value)}
                            placeholder="Provide any extra code, examples, or constraints here. This will be sent to the AI along with the editor's content."
                            className="w-full h-24 p-2 bg-[#22241e] border border-[#999966] text-[#f0f0e0] font-mono rounded text-sm focus:border-[#4ac94a] focus:ring-0 outline-none"
                        />
                    </div>
                    {mode === 'orchestrator' && (
                        <div>
                             <label className="block text-sm font-semibold text-[#999966] mb-2">Select Specialist Agents</label>
                             <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                {personas.map(p => (
                                    <AgentCard 
                                        key={p.name} 
                                        persona={p} 
                                        selected={selectedAgents.includes(p.name)} 
                                        onClick={() => handleAgentClick(p.name)}
                                    />
                                ))}
                             </div>
                        </div>
                    )}
                <div className="bg-[#2e3026] p-3 flex justify-end gap-3 border-t border-[#4ac94a] mt-auto">
                    <button type="button" onClick={onClose} className="bg-[#a03333] hover:bg-[#3366a0] px-4 py-2 rounded transition-colors text-sm">Cancel</button>
                    <button type="submit" onClick={handleSubmit} className="bg-[#4ac94a] hover:bg-green-400 font-bold px-6 py-2 rounded transition-colors text-sm">Invoke</button>
                </div>
                </form>
            </div>
        </div>
    );
};