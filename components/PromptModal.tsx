import React, { useState, useEffect, useRef } from 'react';
import type { Persona } from '../types';
import type { AiMode } from '../App';
import { highlightBasic, escapeHtml } from '../utils/highlighter'; // Import shared highlighter utilities

interface PromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: {
        prompt: string;
        context: string;
        snippet: string;
        mode: AiMode;
        selectedAgents: string[];
        useSearch: boolean;
        useMaps: boolean;
    }) => void;
    personas: Persona[];
    initialState: { prompt: string; mode: AiMode; snippet?: string } | null;
    userLocation: { latitude: number; longitude: number } | null;
    geolocationError: string | null;
}

/**
 * A button used for selecting the execution mode in the prompt modal.
 * @param {object} props - Component props.
 * @param {boolean} props.active - Whether this button represents the currently active mode.
 * @param {() => void} props.onClick - The click handler.
 * @param {React.ReactNode} props.children - The button's content.
 * @returns {React.ReactElement} The rendered mode button.
 */
const ModeButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
    active,
    onClick,
    children,
}) => (
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
const AgentCard: React.FC<{ persona: Persona; selected: boolean; onClick: () => void }> = ({
    persona,
    selected,
    onClick,
}) => (
    <button
        type="button"
        onClick={onClick}
        title={persona.description}
        className={`p-2 rounded border text-left transition-all duration-200 ${
            selected
                ? 'bg-[#4ac94a]/30 border-[#4ac94a] shadow-lg -translate-y-0.5'
                : 'bg-white/5 border-transparent hover:border-white/20'
        }`}
    >
        <div className="font-semibold text-xs text-[#f0f0e0]">{persona.name}</div>
    </button>
);

/**
 * A modal for users to enter prompts, configure AI settings, and submit requests to the Gemini API.
 * It supports different modes like single AI, multi-agent orchestrator, and search-grounded queries.
 * @param {PromptModalProps} props - The component props.
 * @returns {React.ReactElement | null} The rendered modal or null if not open.
 */
export const PromptModal: React.FC<PromptModalProps> = ({ isOpen, onClose, onSubmit, personas, initialState, userLocation, geolocationError }) => {
    const [prompt, setPrompt] = useState('');
    const [context, setContext] = useState('');
    const [snippet, setSnippet] = useState('');
    const [mode, setMode] = useState<AiMode>('ai');
    const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
    const [useSearch, setUseSearch] = useState(false);
    const [useMaps, setUseMaps] = useState(false);

    const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isOpen) {
            // Reset state on open
            setContext('');
            setSnippet('');
            setSelectedAgents([]);
            setUseSearch(false);
            setUseMaps(false);

            // Set initial state from props
            if (initialState) {
                setPrompt(initialState.prompt);
                setMode(initialState.mode);
                setSnippet(initialState.snippet || '');
            } else {
                setPrompt('');
                setMode('ai');
                setSnippet('');
            }

            // Autofocus the prompt textarea
            setTimeout(() => {
                promptTextareaRef.current?.focus();
            }, 100);
        }
    }, [isOpen, initialState]);

    const handleAgentToggle = (personaName: string) => {
        setSelectedAgents((prev) =>
            prev.includes(personaName) ? prev.filter((name) => name !== personaName) : [...prev, personaName]
        );
    };

    const handleSubmit = () => {
        if (isSubmitDisabled) return;
        onSubmit({ prompt, context, snippet, mode, selectedAgents, useSearch, useMaps });
    };

    if (!isOpen) return null;

    const isSubmitDisabled = mode === 'orchestrator' && selectedAgents.length < 2;

    const disableMapsCheckbox = !userLocation && !geolocationError; // Disable if no location or no error yet

    return (
        <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl bg-[#313328] border border-[#4ac94a] rounded-lg shadow-2xl flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="p-4 border-b border-gray-700">
                    <h2 className="text-lg font-bold text-[#f0f0e0] animation-title-pulse">Invoke Quantum AI</h2>
                </header>

                <div className="p-4 space-y-4 overflow-y-auto">
                    <div className="flex gap-2 items-center">
                        <ModeButton active={mode === 'ai'} onClick={() => setMode('ai')}>
                            Quantum AI
                        </ModeButton>
                        <ModeButton active={mode === 'orchestrator'} onClick={() => setMode('orchestrator')}>
                            Multi-Agent Consensus
                        </ModeButton>
                    </div>

                    {mode === 'ai' && (
                        <div className="pt-2 flex flex-col gap-2">
                            <label
                                htmlFor="useSearch"
                                className="flex items-center gap-3 text-sm text-[#f0f0e0] cursor-pointer"
                            >
                                <input
                                    type="checkbox"
                                    id="useSearch"
                                    checked={useSearch}
                                    onChange={(e) => setUseSearch(e.target.checked)}
                                    className="w-4 h-4 bg-[#22241e] border-[#999966] rounded text-[#4ac94a] focus:ring-2 focus:ring-offset-0 focus:ring-offset-[#313328] focus:ring-[#4ac94a]"
                                />
                                <div>
                                    <span className="font-bold">Enable Search Grounding</span>
                                    <span className="text-xs text-gray-400 font-normal block">
                                        For up-to-date information from Google Search.
                                    </span>
                                </div>
                            </label>

                            <label
                                htmlFor="useMaps"
                                className={`flex items-center gap-3 text-sm text-[#f0f0e0] ${disableMapsCheckbox ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                <input
                                    type="checkbox"
                                    id="useMaps"
                                    checked={useMaps}
                                    onChange={(e) => setUseMaps(e.target.checked)}
                                    disabled={disableMapsCheckbox}
                                    className="w-4 h-4 bg-[#22241e] border-[#999966] rounded text-[#4ac94a] focus:ring-2 focus:ring-offset-0 focus:ring-offset-[#313328] focus:ring-[#4ac94a]"
                                />
                                <div>
                                    <span className="font-bold">Enable Maps Grounding</span>
                                    <span className="text-xs text-gray-400 font-normal block">
                                        For location-based information from Google Maps.
                                        {!userLocation && !geolocationError && (
                                            <span className="text-yellow-400 ml-1"> (Waiting for geolocation...)</span>
                                        )}
                                        {geolocationError && (
                                            <span className="text-red-400 ml-1"> (Geolocation error: {geolocationError})</span>
                                        )}
                                        {userLocation && (
                                            <span className="text-green-400 ml-1"> (Using current location)</span>
                                        )}
                                    </span>
                                </div>
                            </label>
                        </div>
                    )}

                    <div>
                        <label htmlFor="prompt" className="block text-sm font-bold text-[#f0f0e0] mb-2">
                            Your Request
                        </label>
                        <textarea
                            id="prompt"
                            ref={promptTextareaRef}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={
                                useSearch || useMaps
                                    ? 'Ask a question for real-time search or maps...'
                                    : mode === 'orchestrator'
                                    ? 'Describe the task for the agent collective...'
                                    : 'Describe what you want to generate, refactor, or optimize...'
                            }
                            className="w-full h-24 p-2 bg-[#22241e] text-[#f0f0e0] border border-[#999966] rounded focus:ring-2 focus:ring-[#4ac94a] focus:border-[#4ac94a] outline-none transition-colors"
                            style={{ fontFamily: 'Fira Code, monospace' }} // Ensure font consistency
                        />
                    </div>

                    {mode === 'orchestrator' && (
                        <div className="space-y-2">
                            <h3 className="text-sm font-bold text-[#f0f0e0]">
                                Select Specialist Agents (Consensus Group)
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 rounded bg-black/10 border border-white/10">
                                {personas.map((p) => (
                                    <AgentCard
                                        key={p.name}
                                        persona={p}
                                        selected={selectedAgents.includes(p.name)}
                                        onClick={() => handleAgentToggle(p.name)}
                                    />
                                ))}
                            </div>
                            <p
                                className={`text-xs transition-colors ${
                                    selectedAgents.length < 2 ? 'text-yellow-500' : 'text-gray-400'
                                }`}
                            >
                                Select at least 2 agents. Currently selected: {selectedAgents.length}
                            </p>
                        </div>
                    )}

                    <div>
                        <label htmlFor="snippet" className="block text-sm font-bold text-[#f0f0e0] mb-2">
                            Paste a Code Snippet (optional)
                        </label>
                        <div className="relative">
                            <textarea
                                id="snippet"
                                value={snippet}
                                onChange={(e) => setSnippet(e.target.value)}
                                placeholder="Paste relevant code here..."
                                className="w-full h-32 p-2 bg-[#22241e] text-transparent caret-white font-mono border border-[#999966] rounded focus:ring-2 focus:ring-[#4ac94a] focus:border-[#4ac94a] outline-none transition-colors"
                                spellCheck="false"
                                style={{ fontFamily: 'Fira Code, monospace' }} // Ensure font consistency
                            />
                            <pre
                                className="absolute top-0 left-0 w-full h-full p-2 font-mono pointer-events-none overflow-y-auto text-sm"
                                aria-hidden="true"
                                style={{ fontFamily: 'Fira Code, monospace' }} // Ensure font consistency
                            >
                                <code dangerouslySetInnerHTML={{ __html: highlightBasic(snippet, 'js') }} />
                            </pre>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="context" className="block text-sm font-bold text-[#f0f0e0] mb-2">
                            Additional Context (optional)
                        </label>
                        <textarea
                            id="context"
                            value={context}
                            onChange={(e) => setContext(e.target.value)}
                            placeholder="Provide any extra information, constraints, or requirements..."
                            className="w-full h-20 p-2 bg-[#22241e] text-[#f0f0e0] border border-[#999966] rounded focus:ring-2 focus:ring-[#4ac94a] focus:border-[#4ac94a] outline-none transition-colors"
                            style={{ fontFamily: 'Fira Code, monospace' }} // Ensure font consistency
                        />
                    </div>
                </div>

                <footer className="p-4 border-t border-gray-700 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="bg-[#a03333] hover:bg-red-700 text-white font-bold px-4 py-2 rounded transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitDisabled}
                        className="bg-[#4ac94a] hover:bg-green-400 text-white font-bold px-8 py-2 rounded transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                        {isSubmitDisabled ? 'Select more agents' : 'Invoke AI'}
                    </button>
                </footer>
            </div>
        </div>
    );
};