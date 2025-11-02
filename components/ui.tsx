import React, { useState } from 'react';
import type { OrchestratorSettings, EditorStats } from '../types';

interface HeaderProps {
    onToggleLeftPanel: () => void;
    onOpenFile: () => void;
    onSaveFile: () => void;
    onSaveAs: () => void;
    onRenderHTML: () => void;
    onRunAI: () => void;
    onRunOrchestrator: () => void;
}

/**
 * Renders the main application header.
 * Provides primary actions like file operations and invoking AI features.
 * @param {HeaderProps} props - The component props.
 * @param {() => void} props.onToggleLeftPanel - Toggles the visibility of the left sidebar.
 * @param {() => void} props.onOpenFile - Opens a file from the user's disk.
 * @param {() => void} props.onSaveFile - Saves the current editor content.
 * @param {() => void} props.onSaveAs - Saves the current editor content with a new name.
 * @param {() => void} props.onRenderHTML - Opens a preview panel for HTML content.
 * @param {() => void} props.onRunAI - Opens the prompt modal for a single Quantum AI run.
 * @param {() => void} props.onRunOrchestrator - Opens the prompt modal for a Multi-Agent Consensus run.
 * @returns {React.ReactElement} The rendered header component.
 */
export const Header: React.FC<HeaderProps> = (props) => (
    <header className="grid-in-header bg-[#2e3026] border-b border-[#22241e] flex items-center justify-between px-3 py-1.5 relative overflow-hidden quantum-scan">
        <div className="flex gap-3 items-center z-10">
            <button onClick={props.onToggleLeftPanel} className="bg-[#a03333] hover:bg-[#3366a0] text-sm px-2 py-1.5 rounded transition-colors">☰</button>
            <div className="font-extrabold quantum-pulse">Nemodian 2244-1 :: Quantum Fractal AI</div>
        </div>
        <div className="flex gap-2 items-center z-10">
            <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#4ac94a]"></div>
                <div className="text-xs text-[#cfcfbd]">Quantum AI: Ready</div>
            </div>
            <button onClick={props.onOpenFile} className="bg-[#a03333] hover:bg-[#3366a0] text-xs px-2 py-1.5 rounded transition-colors">Open</button>
            <button onClick={props.onSaveFile} className="bg-[#a03333] hover:bg-[#3366a0] text-xs px-2 py-1.5 rounded transition-colors">Save</button>
            <button onClick={props.onSaveAs} className="bg-[#a03333] hover:bg-[#3366a0] text-xs px-2 py-1.5 rounded transition-colors">Save As</button>
            <button onClick={props.onRenderHTML} className="bg-[#f0ad4e] border-[#f0ad4e] text-[#3a3c31] hover:bg-yellow-400 text-xs px-2 py-1.5 rounded transition-colors">Render HTML</button>
            <button onClick={props.onRunAI} className="bg-[#5bc0de] border-[#5bc0de] hover:bg-cyan-400 text-xs px-2 py-1.5 rounded transition-colors">Quantum AI</button>
            <button onClick={props.onRunOrchestrator} className="bg-[#4ac94a] border-[#4ac94a] hover:bg-green-400 text-xs px-2 py-1.5 rounded transition-colors">Orchestrator</button>
        </div>
    </header>
);

interface StatusBarProps {
    fileName: string;
    stats: EditorStats;
}

/**
 * Renders the status bar at the bottom of the editor.
 * Displays the current file name and editor statistics.
 * @param {StatusBarProps} props - The component props.
 * @param {string} props.fileName - The name of the currently active file.
 * @param {EditorStats} props.stats - An object containing editor stats like cursor position, line count, etc.
 * @returns {React.ReactElement} The rendered status bar component.
 */
export const StatusBar: React.FC<StatusBarProps> = ({ fileName, stats }) => (
    <div id="status-bar" className="grid-in-status bg-[#22241e] flex justify-between items-center px-3 text-xs h-[1.5em] relative">
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-30">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="quantum-thread absolute w-px h-full bg-gradient-to-b from-transparent via-[#BB86FC] to-transparent" style={{ left: `${20 + i * 15}%`, animationDelay: `${i * 0.3}s` }}></div>
            ))}
        </div>
        <div>{fileName || 'No File Loaded'}</div>
        <div>{`Cursor: ${stats.cursor} | Lines: ${stats.lines} | Chars: ${stats.chars} | History: ${stats.history}`}</div>
    </div>
);

interface LeftPanelProps {
    isOpen: boolean;
    settings: OrchestratorSettings;
    onSettingsChange: (newSettings: OrchestratorSettings) => void;
    onUndo: () => void;
    onRedo: () => void;
    onQuickAction: (action: 'optimize' | 'document' | 'refactor') => void;
    onRunOrchestrator: () => void;
    history: string[];
    historyIndex: number;
    onRevertToState: (index: number) => void;
    editorFontSize: number;
    onFontSizeChange: (size: number) => void;
}

/**
 * Renders the collapsible left panel containing quick actions, settings, and editor history.
 * @param {LeftPanelProps} props - The component props.
 * @param {boolean} props.isOpen - Controls whether the panel is visible.
 * @param {OrchestratorSettings} props.settings - The current settings for the AI orchestrator.
 * @param {(newSettings: OrchestratorSettings) => void} props.onSettingsChange - Callback to update orchestrator settings.
 * @param {() => void} props.onUndo - Triggers an undo action in the editor.
 * @param {() => void} props.onRedo - Triggers a redo action in the editor.
 * @param {(action: 'optimize' | 'document' | 'refactor') => void} props.onQuickAction - Triggers a predefined AI action.
 * @param {() => void} props.onRunOrchestrator - Opens the prompt modal for a Multi-Agent Consensus run.
 * @param {string[]} props.history - An array of editor content states for the history view.
 * @param {number} props.historyIndex - The current index in the history array.
 * @param {(index: number) => void} props.onRevertToState - Callback to revert the editor to a specific history state.
 * @param {number} props.editorFontSize - The current font size of the editor in pixels.
 * @param {(size: number) => void} props.onFontSizeChange - Callback to update the editor's font size.
 * @returns {React.ReactElement} The rendered left panel component.
 */
export const LeftPanel: React.FC<LeftPanelProps> = (props) => {
    const [isHistoryOpen, setIsHistoryOpen] = useState(true);

    return (
     <aside className={`bg-[#313328] border-r border-[#22241e] p-2.5 box-border flex flex-col gap-2 overflow-y-auto w-60 transition-all duration-300 ${props.isOpen ? 'ml-0' : '-ml-60'}`}>
        <button onClick={props.onUndo} className="bg-[#a03333] hover:bg-[#3366a0] text-xs w-full text-left p-1.5 rounded">UNDO</button>
        <button onClick={props.onRedo} className="bg-[#a03333] hover:bg-[#3366a0] text-xs w-full text-left p-1.5 rounded">REDO</button>

        <div className="mt-5 text-xs text-[#999966]">
            <p className="font-bold">Quantum Actions:</p>
            <button onClick={() => props.onQuickAction('optimize')} className="bg-[#a03333] hover:bg-[#3366a0] text-xs w-full text-left mt-2 p-1.5 rounded">Quantum Optimize</button>
            <button onClick={() => props.onQuickAction('document')} className="bg-[#a03333] hover:bg-[#3366a0] text-xs w-full text-left mt-1 p-1.5 rounded">Fractal Document</button>
            <button onClick={() => props.onQuickAction('refactor')} className="bg-[#a03333] hover:bg-[#3366a0] text-xs w-full text-left mt-1 p-1.5 rounded">Hyper Refactor</button>
            <button onClick={props.onRunOrchestrator} className="bg-[#4ac94a] hover:bg-green-400 text-xs w-full text-left mt-1 p-1.5 rounded">Multi-Agent Consensus</button>
        </div>

        <div className="mt-5 text-xs text-[#999966]">
            <p className="font-bold">Orchestrator Settings:</p>
            <div className="mt-1">
                <label htmlFor="agent-count">Agent Count:</label>
                <input type="number" id="agent-count" min="2" max="8" value={props.settings.agentCount}
                    onChange={(e) => props.onSettingsChange({ ...props.settings, agentCount: parseInt(e.target.value) })}
                    className="w-16 ml-2 bg-[#22241e] text-white border border-[#999966] p-0.5 rounded" />
            </div>
            <div className="mt-1">
                <label htmlFor="max-rounds">Max Rounds:</label>
                <input type="number" id="max-rounds" min="1" max="10" value={props.settings.maxRounds}
                    onChange={(e) => props.onSettingsChange({ ...props.settings, maxRounds: parseInt(e.target.value) })}
                    className="w-16 ml-2 bg-[#22241e] text-white border border-[#999966] p-0.5 rounded" />
            </div>
        </div>

        <div className="mt-5 text-xs text-[#999966]">
            <p className="font-bold">Editor Settings:</p>
            <div className="mt-1 flex items-center justify-between">
                <label htmlFor="font-size">Font Size (px):</label>
                <input
                    type="number"
                    id="font-size"
                    min="8"
                    max="24"
                    value={props.editorFontSize}
                    onChange={(e) => props.onFontSizeChange(parseInt(e.target.value, 10))}
                    className="w-16 ml-2 bg-[#22241e] text-white border border-[#999966] p-0.5 rounded"
                />
            </div>
        </div>

        <div className="mt-5 text-xs text-[#999966]">
            <button onClick={() => setIsHistoryOpen(prev => !prev)} className="font-bold w-full text-left flex justify-between items-center p-1 rounded hover:bg-white/5">
                <span>Editor History</span>
                <span className="transition-transform duration-200" style={{ transform: isHistoryOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
            </button>
            {isHistoryOpen && (
                <div className="mt-2 max-h-48 overflow-y-auto pr-1 border-l-2 border-gray-700 pl-2">
                    {props.history.map((content, index) => (
                        <button
                            key={index}
                            onClick={() => props.onRevertToState(index)}
                            title={content}
                            className={`w-full text-left p-1 rounded text-xs mt-1 truncate transition-colors ${
                                props.historyIndex === index
                                    ? 'bg-[#4ac94a]/30 text-white font-semibold'
                                    : 'bg-[#22241e]/50 hover:bg-[#a03333]'
                            }`}
                        >
                            State {index + 1}: {content.substring(0, 30).replace(/\s+/g, ' ')}...
                        </button>
                    )).reverse()}
                </div>
            )}
        </div>
    </aside>
    )
};

interface FooterProps {
    onInvoke: () => void;
    isLoading: boolean;
}

/**
 * Renders the main application footer, containing the primary AI invocation button.
 * @param {FooterProps} props - The component props.
 * @param {() => void} props.onInvoke - Function to call when the invoke button is clicked.
 * @param {boolean} props.isLoading - Indicates if an AI process is currently running, disabling the button.
 * @returns {React.ReactElement} The rendered footer component.
 */
export const Footer: React.FC<FooterProps> = (props) => (
    <footer className="grid-in-footer flex items-center justify-center px-3 py-1.5 bg-[#2e3026] border-t border-[#22241e]">
        <button
            onClick={props.onInvoke}
            className="bg-[#4ac94a] hover:bg-green-400 text-white font-bold px-8 py-2.5 rounded transition-colors disabled:bg-gray-500 text-lg quantum-pulse"
            disabled={props.isLoading}
        >
            {props.isLoading ? 'Processing...' : 'Invoke Quantum AI...'}
        </button>
    </footer>
);


interface PreviewPanelProps {
    isOpen: boolean;
    htmlContent: string;
    onClose: () => void;
}

/**
 * Renders a modal panel to preview HTML content in an iframe.
 * The content is sandboxed and loaded from a Blob URL for security.
 * @param {PreviewPanelProps} props - The component props.
 * @param {boolean} props.isOpen - Controls whether the preview panel is visible.
 * @param {string} props.htmlContent - The HTML string to be rendered in the iframe.
 * @param {() => void} props.onClose - Callback to close the preview panel.
 * @returns {React.ReactElement | null} The rendered preview panel or null if not open.
 */
export const PreviewPanel: React.FC<PreviewPanelProps> = ({ isOpen, htmlContent, onClose }) => {
    if (!isOpen) return null;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="w-[80%] h-[80%] bg-white border-2 border-[#4ac94a] rounded-md flex flex-col shadow-2xl">
                <div className="bg-[#2e3026] text-[#f0f0e0] p-2 flex justify-between items-center border-b border-[#4ac94a]">
                    <span>Quantum Preview</span>
                    <button onClick={onClose} className="text-xl leading-none">&times;</button>
                </div>
                <iframe src={url} title="Preview" className="w-full h-full border-none" onLoad={() => URL.revokeObjectURL(url)}></iframe>
            </div>
        </div>
    );
};