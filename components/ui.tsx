
import React, { useState, useRef, useEffect } from 'react';
import type { OrchestratorSettings, EditorStats, TerminalLine } from '../types';

interface HeaderProps {
    onToggleLeftPanel: () => void;
    onOpenFile: () => void;
    onSaveFile: () => void;
    onSaveAs: () => void;
    onTogglePreview: () => void;
    isPreviewing: boolean;
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
 * @param {() => void} props.onTogglePreview - Toggles the live HTML preview panel.
 * @param {boolean} props.isPreviewing - Indicates if the live preview is active.
 * @param {() => void} props.onRunAI - Opens the prompt modal for a single Quantum AI run.
 * @param {() => void} props.onRunOrchestrator - Opens the prompt modal for a Multi-Agent Consensus run.
 * @returns {React.ReactElement} The rendered header component.
 */
export const Header: React.FC<HeaderProps> = (props) => (
    <header className="grid-in-header bg-[#2e3026] border-b border-[#22241e] flex items-center justify-between px-3 py-1.5 relative overflow-hidden quantum-scan">
        <div className="flex gap-3 items-center z-10">
            <button onClick={props.onToggleLeftPanel} className="bg-[#a03333] hover:bg-[#3366a0] text-sm px-2 py-1.5 rounded transition-colors">
                ☰
            </button>
            <div className="font-extrabold quantum-pulse">Nemodian 2244-1 :: Quantum Fractal AI</div>
        </div>
        <div className="flex gap-2 items-center z-10">
            <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#4ac94a]"></div>
                <div className="text-xs text-[#cfcfbd]">Quantum AI: Ready</div>
            </div>
            <button
                onClick={props.onOpenFile}
                className="bg-[#a03333] hover:bg-[#3366a0] text-xs px-2 py-1.5 rounded transition-colors"
            >
                Open
            </button>
            <button
                onClick={props.onSaveFile}
                className="bg-[#a03333] hover:bg-[#3366a0] text-xs px-2 py-1.5 rounded transition-colors"
            >
                Save
            </button>
            <button
                onClick={props.onSaveAs}
                className="bg-[#a03333] hover:bg-[#3366a0] text-xs px-2 py-1.5 rounded transition-colors"
            >
                Save As
            </button>
            <button
                onClick={props.onTogglePreview}
                className={`text-xs px-2 py-1.5 rounded transition-colors ${
                    props.isPreviewing
                        ? 'bg-yellow-600 text-white hover:bg-yellow-700 ring-2 ring-offset-2 ring-offset-[#2e3026] ring-yellow-400'
                        : 'bg-[#f0ad4e] border-[#f0ad4e] text-[#3a3c31] hover:bg-yellow-400'
                }`}
            >
                {props.isPreviewing ? 'Close Preview' : 'Live Preview'}
            </button>
            <button
                onClick={props.onRunAI}
                className="bg-[#5bc0de] border-[#5bc0de] hover:bg-cyan-400 text-xs px-2 py-1.5 rounded transition-colors"
            >
                Quantum AI
            </button>
            <button
                onClick={props.onRunOrchestrator}
                className="bg-[#4ac94a] border-[#4ac94a] hover:bg-green-400 text-xs px-2 py-1.5 rounded transition-colors"
            >
                Orchestrator
            </button>
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
    <div
        id="status-bar"
        className="grid-in-status bg-[#22241e] flex justify-between items-center px-3 text-xs h-[1.5em] relative"
    >
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-30">
            {[...Array(5)].map((_, i) => (
                <div
                    key={i}
                    className="quantum-thread absolute w-px h-full bg-gradient-to-b from-transparent via-[#BB86FC] to-transparent"
                    style={{ left: `${20 + i * 15}%`, animationDelay: `${i * 0.3}s` }}
                ></div>
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
    onAnalyzeSelection: () => void;
    onRunOrchestrator: () => void;
    history: string[];
    historyIndex: number;
    onRevertToState: (index: number) => void;
    editorFontSize: number;
    onFontSizeChange: (size: number) => void;
    onSaveDraft: () => void;
    onLoadDraft: () => void;
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
 * @param {() => void} props.onAnalyzeSelection - Opens the prompt modal with the currently selected editor text.
 * @param {() => void} props.onRunOrchestrator - Opens the prompt modal for a Multi-Agent Consensus run.
 * @param {string[]} props.history - An array of editor content states for the history view.
 * @param {number} props.historyIndex - The current index in the history array.
 * @param {(index: number) => void} props.onRevertToState - Callback to revert the editor to a specific history state.
 * @param {number} props.editorFontSize - The current font size of the editor in pixels.
 * @param {(size: number) => void} props.onFontSizeChange - Callback to update the editor's font size.
 * @param {() => void} props.onSaveDraft - Saves the current editor content to local storage.
 * @param {() => void} props.onLoadDraft - Loads the editor content from local storage.
 * @returns {React.ReactElement} The rendered left panel component.
 */
export const LeftPanel: React.FC<LeftPanelProps> = (props) => {
    const [isHistoryOpen, setIsHistoryOpen] = useState(true);

    return (
        <aside
            className={`bg-[#313328] border-r border-[#22241e] p-2.5 box-border flex flex-col gap-2 overflow-y-auto w-60 transition-all duration-300 ${
                props.isOpen ? 'ml-0' : '-ml-60'
            }`}
        >
            <button onClick={props.onUndo} className="bg-[#a03333] hover:bg-[#3366a0] text-white text-xs w-full text-left p-1.5 rounded">
                UNDO
            </button>
            <button onClick={props.onRedo} className="bg-[#a03333] hover:bg-[#3366a0] text-white text-xs w-full text-left p-1.5 rounded">
                REDO
            </button>

            <div className="mt-5 text-xs text-[#999966]">
                <p className="font-bold">Quantum Actions:</p>
                <button
                    onClick={() => props.onQuickAction('optimize')}
                    className="bg-[#a03333] hover:bg-[#3366a0] text-white text-xs w-full text-left mt-2 p-1.5 rounded"
                >
                    Quantum Optimize
                </button>
                <button
                    onClick={() => props.onQuickAction('document')}
                    className="bg-[#a03333] hover:bg-[#3366a0] text-white text-xs w-full text-left mt-1 p-1.5 rounded"
                >
                    Fractal Document
                </button>
                <button
                    onClick={() => props.onQuickAction('refactor')}
                    className="bg-[#a03333] hover:bg-[#3366a0] text-white text-xs w-full text-left mt-1 p-1.5 rounded"
                >
                    Hyper Refactor
                </button>
                <button
                    onClick={props.onAnalyzeSelection}
                    className="bg-[#5bc0de] hover:bg-cyan-400 text-white text-xs w-full text-left mt-1 p-1.5 rounded"
                >
                    Analyze Selection
                </button>
                <button
                    onClick={props.onRunOrchestrator}
                    className="bg-[#4ac94a] hover:bg-green-400 text-white text-xs w-full text-left mt-1 p-1.5 rounded"
                >
                    Multi-Agent Consensus
                </button>
            </div>

            <div className="mt-5 text-xs text-[#999966]">
                <p className="font-bold">Local Drafts:</p>
                <button
                    onClick={props.onSaveDraft}
                    className="bg-[#f0ad4e] hover:bg-yellow-400 text-white text-xs w-full text-left mt-2 p-1.5 rounded"
                >
                    Save Draft
                </button>
                <button
                    onClick={props.onLoadDraft}
                    className="bg-[#f0ad4e] hover:bg-yellow-400 text-white text-xs w-full text-left mt-1 p-1.5 rounded"
                >
                    Load Draft
                </button>
            </div>

            <div className="mt-5 text-xs text-[#999966]">
                <p className="font-bold">Orchestrator Settings:</p>
                <div className="mt-1">
                    <label htmlFor="agent-count">Agent Count:</label>
                    <input
                        type="number"
                        id="agent-count"
                        min="2"
                        max="8"
                        value={props.settings.agentCount}
                        onChange={(e) =>
                            props.onSettingsChange({ ...props.settings, agentCount: parseInt(e.target.value) })
                        }
                        className="w-16 ml-2 bg-[#22241e] text-white border border-[#999966] p-0.5 rounded"
                    />
                </div>
                <div className="mt-1">
                    <label htmlFor="max-rounds">Max Rounds:</label>
                    <input
                        type="number"
                        id="max-rounds"
                        min="1"
                        max="10"
                        value={props.settings.maxRounds}
                        onChange={(e) =>
                            props.onSettingsChange({ ...props.settings, maxRounds: parseInt(e.target.value) })
                        }
                        className="w-16 ml-2 bg-[#22241e] text-white border border-[#999966] p-0.5 rounded"
                    />
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
                <button
                    onClick={() => setIsHistoryOpen((prev) => !prev)}
                    className="font-bold w-full text-left flex justify-between items-center p-1 rounded hover:bg-white/5"
                >
                    <span>Editor History</span>
                    <span
                        className="transition-transform duration-200"
                        style={{ transform: isHistoryOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                    >
                        ▼
                    </span>
                </button>
                {isHistoryOpen && (
                    <div className="mt-2 max-h-48 overflow-y-auto pr-1 border-l-2 border-gray-700 pl-2">
                        {props.history
                            .map((content, index) => (
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
                            ))
                            .reverse()}
                    </div>
                )}
            </div>
        </aside>
    );
};

interface FooterProps {
    onInvoke: () => void;
    isLoading: boolean;
    onToggleTerminal: () => void;
}

/**
 * Renders the main application footer, containing the primary AI invocation button.
 * @param {FooterProps} props - The component props.
 * @param {() => void} props.onInvoke - Function to call when the invoke button is clicked.
 * @param {boolean} props.isLoading - Indicates if an AI process is currently running, disabling the button.
 * @param {() => void} props.onToggleTerminal - Function to toggle the terminal visibility.
 * @returns {React.ReactElement} The rendered footer component.
 */
export const Footer: React.FC<FooterProps> = (props) => (
    <footer className="grid-in-footer flex items-center justify-between px-3 py-1.5 bg-[#2e3026] border-t border-[#22241e]">
        <div />
        <button
            onClick={props.onInvoke}
            className="bg-[#4ac94a] hover:bg-green-400 text-white font-bold px-8 py-2.5 rounded transition-colors disabled:bg-gray-500 text-lg quantum-pulse"
            disabled={props.isLoading}
        >
            {props.isLoading ? 'Processing...' : 'Invoke Quantum AI...'}
        </button>
        <button
            onClick={props.onToggleTerminal}
            className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1.5 rounded transition-colors"
        >
            Terminal
        </button>
    </footer>
);

interface PreviewPanelProps {
    htmlContent: string;
    onClose: () => void;
}

/**
 * Renders a panel to show a live preview of HTML content.
 * The content is sandboxed and loaded via the `srcDoc` attribute for security and live updates.
 * @param {PreviewPanelProps} props - The component props.
 * @param {string} props.htmlContent - The HTML string to be rendered in the iframe.
 * @param {() => void} props.onClose - Callback to close the preview panel.
 * @returns {React.ReactElement} The rendered preview panel.
 */
export const PreviewPanel: React.FC<PreviewPanelProps> = ({ htmlContent, onClose }) => {
    return (
        <div className="flex flex-col flex-1 bg-white border-l-2 border-[#22241e] min-w-[300px]">
            <div className="bg-[#2e3026] text-[#f0f0e0] p-2 flex justify-between items-center border-b border-[#4ac94a] flex-shrink-0">
                <span>Live Preview</span>
                <button
                    onClick={onClose}
                    className="text-xl leading-none text-gray-400 hover:text-white transition-colors"
                >
                    &times;
                </button>
            </div>
            <iframe
                srcDoc={htmlContent}
                title="Preview"
                className="w-full h-full border-none"
                sandbox="allow-scripts"
            ></iframe>
        </div>
    );
};

interface TerminalProps {
    isOpen: boolean;
    onClose: () => void;
    history: TerminalLine[];
    onSubmit: (command: string) => void;
}

// --- START: Terminal Syntax Highlighter Logic ---
const typeToClassMap: Record<string, string> = {
    comment: 'text-slate-500 italic',
    string: 'text-lime-400',
    number: 'text-amber-500 font-semibold',
    keyword: 'text-pink-400 font-semibold',
    type: 'text-sky-300',
    function: 'text-[#4ac94a]',
    bracket: 'text-purple-400 font-bold',
    op: 'text-slate-400',
    id: 'text-slate-300',
    tag: 'text-pink-400 font-semibold',
    'attr-name': 'text-sky-300',
    'attr-value': 'text-lime-400',
    color: 'text-fuchsia-400 font-semibold',
    property: 'text-sky-300',
    selector: 'text-amber-500',
    key: 'text-sky-300',
    boolean: 'text-pink-400',
    null: 'text-purple-400',
    meta: 'text-cyan-400',
    variable: 'text-teal-300',
    'at-rule': 'text-purple-400',
    unknown: 'text-slate-300',
    error: 'bg-red-500/20 underline decoration-red-400 decoration-wavy',
};

const languageRules: Record<string, { type: string; regex: RegExp }[]> = {
    js: [
        { type: 'comment', regex: /^(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/ },
        { type: 'string', regex: /^`(?:\\[\s\S]|[^`])*`|^"(?:\\.|[^"])*"|^'(?:\\.|[^'])*'/ },
        { type: 'number', regex: /^\b(?:0x[a-fA-F0-9]+|[0-9]+(?:\.[0-9]+)?(?:e[+-]?\d+)?)\b/i },
        {
            type: 'keyword',
            regex: /^\b(?:if|else|for|while|function|return|const|let|var|class|new|in|of|switch|case|break|continue|try|catch|throw|async|await|export|import|from|default|extends|super|instanceof|typeof|void|delete|yield|debugger|with|get|set)\b/,
        },
        { type: 'boolean', regex: /^\b(true|false)\b/ },
        { type: 'null', regex: /^\b(null|undefined)\b/ },
        { type: 'function', regex: /^\b[a-zA-Z_$][\w$]*(?=\s*\()/ },
        { type: 'bracket', regex: /^[\[\]{}()]/ },
        { type: 'op', regex: /^=>|\.\.\.|==|===|!=|!==|<=|>=|[-+*/%=<>!&|^~?:.,;]/ },
        { type: 'id', regex: /^\b[a-zA-Z_$][\w$]*\b/ },
    ],
    py: [
        { type: 'comment', regex: /^#[^\n]*/ },
        { type: 'string', regex: /^(?:[furbFUBR]{0,2})?(?:'''[\s\S]*?'''|"""[\s\S]*?"""|'[^'\n]*'|"[^"\n]*")/ },
        {
            type: 'keyword',
            regex: /^\b(def|return|if|else|elif|for|while|import|from|as|class|try|except|finally|with|lambda|yield|in|is|not|and|or|pass|continue|break|async|await|assert|del|global|nonlocal|raise)\b/,
        },
        { type: 'boolean', regex: /^\b(True|False)\b/ },
        { type: 'null', regex: /^\b(None)\b/ },
        { type: 'function', regex: /^\b[a-zA-Z_]\w*(?=\s*\()/ },
        { type: 'meta', regex: /^@\w+/ },
        { type: 'number', regex: /^\b\d+(\.\d+)?\b/ },
        { type: 'op', regex: /^[-+*/%=<>!&|^~:.,;@]/ },
        { type: 'bracket', regex: /^[\[\]{}()]/ },
    ],
    bash: [
        { type: 'comment', regex: /^#[^\n]*/ },
        { type: 'string', regex: /^"(?:\\.|[^"])*"|^'(?:\\.|[^'])*'/ },
        {
            type: 'keyword',
            regex: /^\b(if|then|else|elif|fi|case|esac|for|select|while|until|do|done|in|function|time|coproc)\b/,
        },
        {
            type: 'function', // built-ins
            regex: /^\b(alias|bg|bind|break|builtin|caller|cd|command|compgen|complete|compopt|continue|declare|dirs|disown|echo|enable|eval|exec|exit|export|false|fc|fg|getopts|hash|help|history|jobs|kill|let|local|logout|mapfile|popd|printf|pushd|pwd|read|readarray|readonly|return|set|shift|shopt|source|suspend|test|times|trap|true|type|typeset|ulimit|umask|unalias|unset|wait)\b/,
        },
        { type: 'variable', regex: /^\$([a-zA-Z_]\w*|\d+|\?|#|@|\*|\$)/ },
        { type: 'variable', regex: /^\$\{[^}]*\}/ },
        { type: 'number', regex: /^\b\d+\b/ },
        { type: 'op', regex: /^(\[\[|\]\]|\|\||&&|;|\||&|>|<|>>|<<|`)/ },
        { type: 'bracket', regex: /^[()]/ },
    ],
    json: [
        { type: 'key', regex: /^"(?:\\.|[^"])*"(?=\s*:)/ },
        { type: 'string', regex: /^"(?:\\.|[^"])*"/ },
        { type: 'number', regex: /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i },
        { type: 'keyword', regex: /^\b(true|false|null)\b/ },
        { type: 'op', regex: /^[:,]/ },
        { type: 'bracket', regex: /^[\[\]{}()]/ },
    ],
    // Add other languages as needed
};

const tokenize = (text: string, language: string): { type: string; value: string }[] => {
    const rules = languageRules[language] || [];
    if (rules.length === 0) {
        return [{ type: 'unknown', value: text }];
    }

    const tokens: { type: string; value: string }[] = [];
    let position = 0;

    while (position < text.length) {
        let matched = false;
        for (const rule of rules) {
            const match = rule.regex.exec(text.slice(position));
            if (match && match[0].length > 0) {
                tokens.push({ type: rule.type, value: match[0] });
                position += match[0].length;
                matched = true;
                break;
            }
        }
        if (!matched) {
            tokens.push({ type: 'unknown', value: text[position] });
            position++;
        }
    }
    return tokens;
};

const escapeHtml = (str: string) => {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

const highlight = (text: string, language: string): string => {
    if (!text) return '';
    const tokens = tokenize(text, language);
    return tokens
        .map((token) => {
            const className = typeToClassMap[token.type] || typeToClassMap['unknown'];
            return `<span class="${className}">${escapeHtml(token.value)}</span>`;
        })
        .join('');
};

const FormattedTerminalOutput: React.FC<{ content: string }> = ({ content }) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]+?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: content.substring(lastIndex, match.index) });
        }
        const language = match[1] || 'plaintext';
        const code = match[2];
        parts.push({ type: 'code', language, content: code });
        lastIndex = codeBlockRegex.lastIndex;
    }

    if (lastIndex < content.length) {
        parts.push({ type: 'text', content: content.substring(lastIndex) });
    }

    if (parts.length === 0) {
        parts.push({ type: 'text', content });
    }

    return (
        <>
            {parts.map((part, index) => {
                if (part.type === 'code') {
                    return (
                        <pre key={index} className="bg-black/30 rounded p-2 my-1 overflow-x-auto text-xs">
                            <code dangerouslySetInnerHTML={{ __html: highlight(part.content, part.language) }} />
                        </pre>
                    );
                }
                return <span key={index}>{part.content}</span>;
            })}
        </>
    );
};
// --- END: Terminal Syntax Highlighter Logic ---

/**
 * Renders a slide-up terminal interface for executing AI commands.
 * @param {TerminalProps} props - The component props.
 * @returns {React.ReactElement} The rendered terminal component.
 */
export const Terminal: React.FC<TerminalProps> = ({ isOpen, onClose, history, onSubmit }) => {
    const [input, setInput] = useState('');
    const [commandHistory, setCommandHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const endOfHistoryRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        endOfHistoryRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onSubmit(input.trim());
            setCommandHistory((prev) => [input.trim(), ...prev]);
            setHistoryIndex(-1);
            setInput('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyIndex < commandHistory.length - 1) {
                const newIndex = historyIndex + 1;
                setHistoryIndex(newIndex);
                setInput(commandHistory[newIndex]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                const newIndex = historyIndex - 1;
                setHistoryIndex(newIndex);
                setInput(commandHistory[newIndex]);
            } else {
                setHistoryIndex(-1);
                setInput('');
            }
        }
    };

    const lineTypeStyles = {
        input: 'text-cyan-400',
        output: 'text-slate-300 whitespace-pre-wrap',
        error: 'text-red-500',
        system: 'text-yellow-500',
        help: 'text-slate-400 whitespace-pre-wrap',
    };

    return (
        <div
            className={`fixed bottom-0 left-0 right-0 h-1/2 bg-[#22241e]/95 backdrop-blur-md border-t-2 border-[#4ac94a] shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
                isOpen ? 'translate-y-0' : 'translate-y-full'
            }`}
        >
            <div className="flex flex-col h-full">
                <div className="p-2 flex justify-between items-center border-b border-gray-700 flex-shrink-0">
                    <h3 className="font-bold text-sm text-[#f0f0e0]">Quantum Terminal</h3>
                    <button onClick={onClose} className="text-xl text-gray-500 hover:text-white">
                        &times;
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 text-sm font-mono" onClick={() => inputRef.current?.focus()}>
                    {history.map((line, i) => (
                        <div key={i} className="flex gap-2">
                            <span className="text-gray-600 select-none">
                                {line.type === 'input' ? 'QF>' : '...'}
                            </span>
                            <div className={`${lineTypeStyles[line.type]}`}>
                                {line.type === 'output' ? (
                                    <FormattedTerminalOutput content={line.content} />
                                ) : (
                                    line.content
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={endOfHistoryRef} />
                </div>
                <form onSubmit={handleSubmit} className="p-2 border-t border-gray-700 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-cyan-400 font-mono text-sm select-none">QF&gt;</span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full bg-transparent text-slate-300 font-mono text-sm focus:outline-none"
                            placeholder="Type a command..."
                            spellCheck="false"
                        />
                    </div>
                </form>
            </div>
        </div>
    );
};
