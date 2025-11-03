import React, { useState, useEffect, useRef } from 'react';
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
        useSearch: boolean;
    }) => void;
    personas: Persona[];
    initialState: { prompt: string; mode: AiMode; snippet?: string } | null;
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

// --- START: Tokenizer-based Highlighter (from Editor.tsx) ---
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
    // New types for better highlighting
    meta: 'text-cyan-400', // for doctype, processing instructions, etc.
    variable: 'text-teal-300', // for PHP variables
    'at-rule': 'text-purple-400', // for CSS @rules
    unknown: 'text-slate-300',
    error: 'bg-red-500/20 underline decoration-red-400 decoration-wavy',
};

const languageRules: Record<string, { type: string; regex: RegExp; errorMessage?: string }[]> = {
    js: [
        { type: 'error', regex: /^`[^`]*$/, errorMessage: 'Unterminated template literal.' },
        { type: 'error', regex: /^"[^"\n]*$/, errorMessage: 'Unterminated string literal.' },
        { type: 'error', regex: /^'[^'\n]*$/, errorMessage: 'Unterminated string literal.' },
        { type: 'comment', regex: /^(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/ },
        { type: 'string', regex: /^`(?:\\[\s\S]|[^`])*`|^"(?:\\.|[^"])*"|^'(?:\\.|[^'])*'/ },
        { type: 'string', regex: /^\/(?!\*)(?:[^\r\n\[/\\]|\\.|\[(?:[^\r\n\]\\]|\\.)*\])+\/[gimsuy]*/ }, // Regex
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
        { type: 'whitespace', regex: /^\s+/ },
    ],
    html: [
        { type: 'error', regex: /^<[\w\d\-]+(?:(?:"[^"]*"|'[^']*'|[^>])+)?$/, errorMessage: 'Unclosed HTML tag.' },
        { type: 'meta', regex: /^<!DOCTYPE[\s\S]*?>/i },
        { type: 'comment', regex: /^<!--[\s\S]*?-->/ },
        { type: 'tag', regex: /^<\/?[\w\d\-]+/ },
        { type: 'attr-name', regex: /^\s+[\w\d\-]+(?==)/ },
        { type: 'op', regex: /^=/ },
        { type: 'attr-value', regex: /^"(?:\\.|[^"])*"|^'(?:\\.|[^'])*'/ },
        { type: 'tag', regex: /^>/ },
        { type: 'text', regex: /^[^<]+/ },
        { type: 'whitespace', regex: /^\s+/ },
    ],
    css: [
        { type: 'error', regex: /^"[^"\n]*$/, errorMessage: 'Unterminated string.' },
        { type: 'error', regex: /^'[^'\n]*$/, errorMessage: 'Unterminated string.' },
        { type: 'error', regex: /^\/\*[\s\S]*?$/, errorMessage: 'Unterminated comment block.' },
        { type: 'comment', regex: /^\/\*[\s\S]*?\*\// },
        { type: 'at-rule', regex: /^@[\w\-]+/ },
        { type: 'string', regex: /^"(?:\\.|[^"])*"|^'(?:\\.|[^'])*'/ },
        { type: 'property', regex: /^[a-zA-Z\-]+(?=\s*:)/ },
        { type: 'selector', regex: /^(?:[.#]?[a-zA-Z0-9\-_*]+|\[[^\]]+\]|:{1,2}[a-zA-Z\-]+(?:\([^\)]+\))?)/ },
        { type: 'function', regex: /^\b(?:url|var|calc|rgb|rgba|hsl|hsla)(?=\()/ },
        { type: 'color', regex: /^#(?:[0-9a-fA-F]{3,8})\b/ },
        { type: 'number', regex: /^\b-?\d+(\.\d+)?(px|em|rem|%|vw|vh|s|deg|fr|ms)?\b/i },
        {
            type: 'keyword',
            regex: /^\b(!important|auto|inherit|initial|unset|none|block|inline|inline-block|flex|grid|absolute|relative|fixed|static|sticky|solid|dashed|dotted|hidden|visible|scroll|uppercase|lowercase|capitalize|center|left|right|justify|start|end|bold|normal|italic)\b/i,
        },
        { type: 'op', regex: /^[:;,>+~]/ },
        { type: 'bracket', regex: /^[\[\]{}()]/ },
        { type: 'whitespace', regex: /^\s+/ },
    ],
    xml: [
        { type: 'error', regex: /^<[\w\d\-:]+(?:(?:"[^"]*"|'[^']*'|[^>])+)?$/, errorMessage: 'Unclosed XML tag.' },
        { type: 'comment', regex: /^<!--[\s\S]*?-->/ },
        { type: 'meta', regex: /^<\?[\s\S]*?\?>/ },
        { type: 'meta', regex: /^<!\[CDATA\[[\s\S]*?\]\]>/ },
        { type: 'tag', regex: /^<\/?[\w\d\-:]+/ },
        { type: 'attr-name', regex: /^\s+[\w\d\-:]+(?==)/ },
        { type: 'op', regex: /^=/ },
        { type: 'attr-value', regex: /^"(?:\\.|[^"])*"|^'(?:\\.|[^'])*'/ },
        { type: 'tag', regex: /^\/?>/ },
        { type: 'text', regex: /^[^<]+/ },
        { type: 'whitespace', regex: /^\s+/ },
    ],
    php: [
        // This combines PHP and HTML. Order is crucial.
        // 1. PHP-specific syntax first.
        { type: 'meta', regex: /^<\?php|^\?>|<\?=/ },
        { type: 'comment', regex: /^(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)/ },
        { type: 'variable', regex: /^\$[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*/ },
        { type: 'string', regex: /^"(?:\\.|[^"\\])*"|^'(?:\\.|[^'\\])*'/ },
        { type: 'number', regex: /^\b\d+(\.\d+)?(?:e[+-]?\d+)?\b/i },
        {
            type: 'keyword',
            regex: /^\b(?:echo|if|else|elseif|while|for|foreach|function|return|const|class|new|public|protected|private|static|__halt_compiler|abstract|and|array|as|break|callable|case|catch|clone|continue|declare|default|die|do|empty|enddeclare|endfor|endforeach|endif|endswitch|endwhile|eval|exit|extends|final|finally|global|goto|implements|include|include_once|instanceof|insteadof|interface|isset|list|namespace|or|print|require|require_once|switch|throw|trait|try|unset|use|var|xor|yield|__CLASS__|__DIR__|__FILE__|__FUNCTION__|__LINE__|__METHOD__|__NAMESPACE__|__TRAIT__)\b/i,
        },
        { type: 'boolean', regex: /^\b(true|false)\b/i },
        { type: 'null', regex: /^\bnull\b/i },
        { type: 'function', regex: /^\b[a-zA-Z_][\w_]*(?=\s*\()/ },
        { type: 'op', regex: /^->|=>|==|===|!=|!==|<=|>=|[-+*\/%<>&|^~?:.,;]/ },
        { type: 'bracket', regex: /^[\[\]{}()]/ },

        // 2. HTML syntax.
        { type: 'comment', regex: /^<!--[\s\S]*?-->/ },
        { type: 'tag', regex: /^<\/?[\w\d\-]+/ },
        { type: 'attr-name', regex: /^\s+[\w\d\-]+(?==)/ },
        { type: 'op', regex: /^=/ },
        { type: 'attr-value', regex: /^"(?:\\.|[^"])*"|^'(?:\\.|[^'])*'/ },
        { type: 'tag', regex: /^>/ },

        // 3. Generic text and whitespace.
        { type: 'text', regex: /^[^<>$]+/ },
        { type: 'whitespace', regex: /^\s+/ },
    ],
    sql: [
        { type: 'comment', regex: /^(--[^\n]*|\/\*[\s\S]*?\*\/)/ },
        { type: 'string', regex: /^'(?:[^']|'')*'/ }, // SQL strings use '' to escape '
        { type: 'number', regex: /^\b-?\d+(\.\d+)?\b/ },
        {
            type: 'keyword',
            regex: /^\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DATABASE|ALTER|DROP|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP\sBY|ORDER\sBY|ASC|DESC|LIMIT|OFFSET|HAVING|AS|DISTINCT|COUNT|SUM|AVG|MAX|MIN|CASE|WHEN|THEN|ELSE|END|AND|OR|NOT|IN|LIKE|BETWEEN|IS|NULL|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|INDEX|VIEW)\b/i,
        },
        { type: 'boolean', regex: /^\b(TRUE|FALSE)\b/i},
        { type: 'function', regex: /^\b[a-zA-Z_]\w*(?=\s*\()/i },
        { type: 'id', regex: /^`[^`]*`|"[^"]*"/ }, // Quoted identifiers
        { type: 'op', regex: /^[,;*<>=!%|&^~.\-+/]+/ },
        { type: 'bracket', regex: /^[()]/ },
        { type: 'id', regex: /^\b[a-zA-Z_]\w*\b/ },
        { type: 'whitespace', regex: /^\s+/ },
    ],
    json: [
        { type: 'error', regex: /^"[^"\n]*$/, errorMessage: 'Unterminated string.' },
        { type: 'key', regex: /^"(?:\\.|[^"])*"(?=\s*:)/ },
        { type: 'string', regex: /^"(?:\\.|[^"])*"/ },
        { type: 'number', regex: /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i },
        { type: 'keyword', regex: /^\b(true|false|null)\b/ },
        { type: 'op', regex: /^[:,]/ },
        { type: 'bracket', regex: /^[\[\]{}()]/ },
        { type: 'whitespace', regex: /^\s+/ },
    ],
    py: [
        { type: 'error', regex: /^(?:'''[\s\S]*?$|"""[\s\S]*?$)/, errorMessage: 'Unterminated multi-line string.' },
        { type: 'error', regex: /^'[^'\n]*$/, errorMessage: 'Unterminated string.' },
        { type: 'error', regex: /^"[^"\n]*$/, errorMessage: 'Unterminated string.' },
        { type: 'comment', regex: /^#[^\n]*/ },
        { type: 'string', regex: /^(?:[furbFUBR]{0,2})?(?:'''[\s\S]*?'''|"""[\s\S]*?"""|'[^'\n]*'|"[^"\n]*")/ },
        {
            type: 'keyword',
            regex: /^\b(def|return|if|else|elif|for|while|import|from|as|class|try|except|finally|with|lambda|yield|in|is|not|and|or|pass|continue|break|async|await|assert|del|global|nonlocal|raise)\b/,
        },
        { type: 'boolean', regex: /^\b(True|False)\b/ },
        { type: 'null', regex: /^\b(None)\b/ },
        { type: 'function', regex: /^\b[a-zA-Z_]\w*(?=\s*\()/ },
        { type: 'meta', regex: /^@\w+/ }, // Decorators
        { type: 'number', regex: /^\b\d+(\.\d+)?\b/ },
        { type: 'op', regex: /^[-+*/%=<>!&|^~:.,;@]/ },
        { type: 'bracket', regex: /^[\[\]{}()]/ },
        { type: 'whitespace', regex: /^\s+/ },
    ],
    bash: [
        { type: 'comment', regex: /^#[^\n]*/ },
        { type: 'string', regex: /^"(?:\\.|[^"])*"|^'(?:\\.|[^'])*'/ },
        { 
            type: 'keyword', 
            regex: /^\b(if|then|else|elif|fi|case|esac|for|select|while|until|do|done|in|function|time|coproc)\b/ 
        },
        {
            type: 'function', // built-ins
            regex: /^\b(alias|bg|bind|break|builtin|caller|cd|command|compgen|complete|compopt|continue|declare|dirs|disown|echo|enable|eval|exec|exit|export|false|fc|fg|getopts|hash|help|history|jobs|kill|let|local|logout|mapfile|popd|printf|pushd|pwd|read|readarray|readonly|return|set|shift|shopt|source|suspend|test|times|trap|true|type|typeset|ulimit|umask|unalias|unset|wait)\b/
        },
        { type: 'variable', regex: /^\$([a-zA-Z_]\w*|\d+|\?|#|@|\*|\$)/ },
        { type: 'variable', regex: /^\$\{[^}]*\}/ },
        { type: 'number', regex: /^\b\d+\b/ },
        { type: 'op', regex: /^(\[\[|\]\]|\|\||&&|;|\||&|>|<|>>|<<|`)/ },
        { type: 'bracket', regex: /^[()]/ },
        { type: 'whitespace', regex: /^\s+/ },
    ],
};

interface Token {
    type: string;
    value: string;
    errorMessage?: string;
}

const tokenize = (text: string, language: string): Token[] => {
    const rules = languageRules[language] || [];
    if (rules.length === 0) {
        return [{ type: 'unknown', value: text }];
    }

    const tokens: Token[] = [];
    let position = 0;

    while (position < text.length) {
        let matched = false;
        for (const rule of rules) {
            const match = rule.regex.exec(text.slice(position));
            if (match && match[0].length > 0) {
                // Ensure non-empty match
                tokens.push({ type: rule.type, value: match[0], errorMessage: rule.errorMessage });
                position += match[0].length;
                matched = true;
                break;
            }
        }
        if (!matched) {
            tokens.push({ type: 'unknown', value: text[position], errorMessage: `Invalid or unexpected token.` });
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
            const isError = !!token.errorMessage;
            const safeTitle = token.errorMessage?.replace(/"/g, '&quot;');
            const titleAttr = isError ? `title="${safeTitle}"` : '';
            const className = isError ? typeToClassMap['error'] : typeToClassMap[token.type] || typeToClassMap['unknown'];

            const escapedValue = escapeHtml(token.value);

            return `<span class="${className}" ${titleAttr}>${escapedValue}</span>`;
        })
        .join('');
};
// --- END: Tokenizer-based Highlighter ---

/**
 * A modal for users to enter prompts, configure AI settings, and submit requests to the Gemini API.
 * It supports different modes like single AI, multi-agent orchestrator, and search-grounded queries.
 * @param {PromptModalProps} props - The component props.
 * @returns {React.ReactElement | null} The rendered modal or null if not open.
 */
export const PromptModal: React.FC<PromptModalProps> = ({ isOpen, onClose, onSubmit, personas, initialState }) => {
    const [prompt, setPrompt] = useState('');
    const [context, setContext] = useState('');
    const [snippet, setSnippet] = useState('');
    const [mode, setMode] = useState<AiMode>('ai');
    const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
    const [useSearch, setUseSearch] = useState(false);

    const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isOpen) {
            // Reset state on open
            setContext('');
            setSnippet('');
            setSelectedAgents([]);
            setUseSearch(false);

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
        onSubmit({ prompt, context, snippet, mode, selectedAgents, useSearch });
    };

    if (!isOpen) return null;

    const isSubmitDisabled = mode === 'orchestrator' && selectedAgents.length < 2;

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
                        <div className="pt-2">
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
                                useSearch
                                    ? 'Ask a question for real-time search...'
                                    : mode === 'orchestrator'
                                    ? 'Describe the task for the agent collective...'
                                    : 'Describe what you want to generate, refactor, or optimize...'
                            }
                            className="w-full h-24 p-2 bg-[#22241e] text-[#f0f0e0] border border-[#999966] rounded focus:ring-2 focus:ring-[#4ac94a] focus:border-[#4ac94a] outline-none transition-colors"
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
                            />
                            <pre
                                className="absolute top-0 left-0 w-full h-full p-2 font-mono pointer-events-none overflow-y-auto text-sm"
                                aria-hidden="true"
                            >
                                <code dangerouslySetInnerHTML={{ __html: highlight(snippet, 'js') }} />
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
