import React, { useState, useEffect, useRef } from 'react';
import type { AiMode } from '../App';

interface CodeGenerationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: {
        prompt: string;
        useSearch: boolean;
        useMaps: boolean;
    }) => void;
    userLocation: { latitude: number; longitude: number } | null;
    geolocationError: string | null;
}

// FIX: Corrected typo in type annotation from `CodeGenerationModalModalProps` to `CodeGenerationModalProps`.
export const CodeGenerationModal: React.FC<CodeGenerationModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    userLocation,
    geolocationError,
}) => {
    const [prompt, setPrompt] = useState('');
    const [useSearch, setUseSearch] = useState(false);
    const [useMaps, setUseMaps] = useState(false);

    const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isOpen) {
            // Reset state on open
            setPrompt('');
            setUseSearch(false);
            setUseMaps(false);

            // Autofocus the prompt textarea
            setTimeout(() => {
                promptTextareaRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);

    const handleSubmit = () => {
        onSubmit({ prompt, useSearch, useMaps });
    };

    if (!isOpen) return null;

    const disableMapsCheckbox = !userLocation && !geolocationError;

    return (
        <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="w-full max-w-xl bg-panel border border-agent-nexus rounded-lg shadow-2xl flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="p-4 border-b border-gray-700 bg-header-bg">
                    <h2 className="text-lg font-bold text-white animation-title-pulse">AI Code Generation</h2>
                </header>

                <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar">
                    <div className="pt-2 flex flex-col gap-3">
                        <label
                            htmlFor="useSearch"
                            className="flex items-center gap-3 text-sm text-white cursor-pointer"
                        >
                            <input
                                type="checkbox"
                                id="useSearch"
                                checked={useSearch}
                                onChange={(e) => setUseSearch(e.target.checked)}
                                className="w-4 h-4 bg-status-bg border-muted-text rounded text-accent focus:ring-2 focus:ring-offset-0 focus:ring-offset-panel focus:ring-accent"
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
                            className={`flex items-center gap-3 text-sm text-white ${disableMapsCheckbox ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            <input
                                type="checkbox"
                                id="useMaps"
                                checked={useMaps}
                                onChange={(e) => setUseMaps(e.target.checked)}
                                disabled={disableMapsCheckbox}
                                className="w-4 h-4 bg-status-bg border-muted-text rounded text-accent focus:ring-2 focus:ring-offset-0 focus:ring-offset-panel focus:ring-accent"
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

                    <div>
                        <label htmlFor="prompt" className="block text-sm font-bold text-white mb-2">
                            Describe what you want to generate:
                        </label>
                        <textarea
                            id="prompt"
                            ref={promptTextareaRef}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={`e.g.,
Generate a React component for a data table with the following features:
- Responsive design
- Pagination
- Search functionality
- Sortable columns for 'name' and 'age' fields.`}
                            className="w-full h-32 p-2.5 bg-status-bg text-white border border-muted-text rounded-md focus:ring-2 focus:ring-agent-nexus focus:border-agent-nexus outline-none transition-colors"
                            style={{ fontFamily: 'Fira Code, monospace' }} // Ensure font consistency
                        />
                    </div>
                </div>

                <footer className="p-4 border-t border-gray-700 flex justify-end gap-2 bg-header-bg">
                    <button
                        onClick={onClose}
                        className="bg-error hover:bg-red-600 text-white font-bold px-4 py-2 rounded-md transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!prompt.trim()}
                        className="bg-agent-nexus hover:bg-violet-500 text-white font-bold px-8 py-2 rounded-md transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed"
                    >
                        Generate Code
                    </button>
                </footer>
            </div>
        </div>
    );
};