
import React, { useState, useRef, useEffect, useCallback } from 'react';

interface EditorProps {
    content: string;
    setContent: (content: string) => void;
    fileType: string;
    onStatsChange: (stats: { cursor: string; lines: number; chars: number; }) => void;
    fontSize: number;
}

// --- START: Tokenizer-based Highlighter ---

// Mapping of token types to Tailwind CSS classes
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
    property: 'text-sky-300',
    selector: 'text-amber-500',
    key: 'text-sky-300',
    boolean: 'text-pink-400',
    null: 'text-purple-400',
    unknown: 'bg-red-500/20',
    error: 'bg-red-500/20 underline decoration-red-400 decoration-wavy',
};

// Language definitions with tokenization rules (order matters)
const languageRules: Record<string, { type: string, regex: RegExp, errorMessage?: string }[]> = {
    js: [
        { type: 'error', regex: /^`[^`]*$/, errorMessage: "Unterminated template literal." },
        { type: 'error', regex: /^"[^"\n]*$/, errorMessage: "Unterminated string literal." },
        { type: 'error', regex: /^'[^'\n]*$/, errorMessage: "Unterminated string literal." },
        { type: 'comment', regex: /^(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/ },
        { type: 'string', regex: /^`(?:\\[\s\S]|[^`])*`|^"(?:\\.|[^"])*"|^'(?:\\.|[^'])*'/ },
        { type: 'number', regex: /^\b(?:0x[a-fA-F0-9]+|[0-9]+(?:\.[0-9]+)?(?:e[+-]?\d+)?)\b/i },
        { type: 'keyword', regex: /^\b(?:if|else|for|while|function|return|const|let|var|class|new|in|of|switch|case|break|continue|try|catch|throw|async|await|export|import|from|default|extends|super|instanceof|typeof|void|delete)\b/ },
        { type: 'boolean', regex: /^\b(true|false)\b/ },
        { type: 'null', regex: /^\b(null|undefined)\b/ },
        { type: 'function', regex: /^\b[a-zA-Z_$][\w$]*(?=\s*\()/ },
        { type: 'bracket', regex: /^[\[\]{}()]/ },
        { type: 'op', regex: /^==|===|!=|!==|<=|>=|=>|[-+*/%=<>!&|^~?:.,;]/ },
        { type: 'id', regex: /^\b[a-zA-Z_$][\w$]*\b/ },
        { type: 'whitespace', regex: /^\s+/ },
    ],
    html: [
        { type: 'error', regex: /^&lt;[\w\d\-]+(?:(?:"[^"]*"|'[^']*'|[^>])+)?$/, errorMessage: "Unclosed HTML tag." },
        { type: 'comment', regex: /^&lt;!--[\s\S]*?--&gt;/ },
        { type: 'tag', regex: /^&lt;\/?[\w\d\-]+/ },
        { type: 'attr-name', regex: /^\s+[\w\d\-]+(?==)/ },
        { type: 'op', regex: /^=/ },
        { type: 'attr-value', regex: /^"(?:\\.|[^"])*"|^'(?:\\.|[^'])*'/ },
        { type: 'tag', regex: /^&gt;/ },
        { type: 'whitespace', regex: /^\s+/ },
        { type: 'default', regex: /^[^<&]+/ },
    ],
    css: [
        { type: 'error', regex: /^"[^"\n]*$/, errorMessage: "Unterminated string." },
        { type: 'error', regex: /^'[^'\n]*$/, errorMessage: "Unterminated string." },
        { type: 'error', regex: /^\/\*[\s\S]*?$/, errorMessage: "Unterminated comment block." },
        { type: 'comment', regex: /^\/\*[\s\S]*?\*\// },
        { type: 'string', regex: /^"(?:\\.|[^"])*"|^'(?:\\.|[^'])*'/ },
        { type: 'selector', regex: /^(?:[.#]?[a-zA-Z0-9\-_*]+|\[[^\]]+\])(?:\s*[:>+~]\s*)?/ },
        { type: 'property', regex: /^[a-zA-Z\-]+(?=\s*:)/ },
        { type: 'number', regex: /^\b-?\d+(\.\d+)?(px|em|rem|%|vw|vh|s)?\b/i },
        { type: 'op', regex: /^[:;,#.]/ },
        { type: 'bracket', regex: /^[\[\]{}()]/ },
        { type: 'whitespace', regex: /^\s+/ },
    ],
    json: [
        { type: 'error', regex: /^"[^"\n]*$/, errorMessage: "Unterminated string." },
        { type: 'key', regex: /^"(?:\\.|[^"])*"(?=\s*:)/ },
        { type: 'string', regex: /^"(?:\\.|[^"])*"/ },
        { type: 'number', regex: /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i },
        { type: 'keyword', regex: /^\b(true|false|null)\b/ },
        { type: 'op', regex: /^[:,]/ },
        { type: 'bracket', regex: /^[\[\]{}()]/ },
        { type: 'whitespace', regex: /^\s+/ },
    ],
    py: [
        { type: 'error', regex: /^(?:'''[\s\S]*?$|"""[\s\S]*?$)/, errorMessage: "Unterminated multi-line string." },
        { type: 'error', regex: /^'[^'\n]*$/, errorMessage: "Unterminated string." },
        { type: 'error', regex: /^"[^"\n]*$/, errorMessage: "Unterminated string." },
        { type: 'comment', regex: /^#[^\n]*/ },
        { type: 'string', regex: /^(?:'''[\s\S]*?'''|"""[\s\S]*?"""|'[^']*'|"[^"]*")/ },
        { type: 'keyword', regex: /^\b(def|return|if|else|elif|for|while|import|from|as|class|try|except|with|lambda|yield|in|is|not|and|or|pass|continue|break)\b/ },
        { type: 'function', regex: /^\b[a-zA-Z_]\w*(?=\s*\()/ },
        { type: 'number', regex: /^\b\d+(\.\d+)?\b/ },
        { type: 'op', regex: /^[-+*/%=<>!&|^~:.,;@]/ },
        { type: 'bracket', regex: /^[\[\]{}()]/ },
        { type: 'whitespace', regex: /^\s+/ },
    ]
};

interface Token {
    type: string;
    value: string;
    errorMessage?: string;
}

/**
 * Breaks down a string of code into a series of tokens based on language-specific rules.
 * @param {string} text - The input code string.
 * @param {string} language - The language identifier (e.g., 'js', 'html').
 * @returns {Token[]} An array of token objects.
 */
const tokenize = (text: string, language: string): Token[] => {
    const rules = languageRules[language] || [];
    if (rules.length === 0) {
        return [{ type: 'default', value: text }];
    }
    
    const tokens: Token[] = [];
    let position = 0;

    while (position < text.length) {
        let matched = false;
        for (const rule of rules) {
            const match = rule.regex.exec(text.slice(position));
            if (match) {
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

/**
 * Applies syntax highlighting to a code string by converting it into a series of styled <span> elements.
 * It first escapes HTML entities in the input text to prevent XSS and rendering issues,
 * then tokenizes the text and wraps each token in a span with the appropriate CSS class.
 * It also adds a title attribute for tooltips on tokens that represent errors.
 * @param {string} text - The raw code string to highlight.
 * @param {string} language - The language identifier (e.g., 'js', 'html').
 * @returns {string} An HTML string with syntax highlighting applied.
 */
const highlight = (text: string, language: string): string => {
    if (!text) return '';
    // Escape HTML entities once before tokenizing
    const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const tokens = tokenize(safeText, language);

    return tokens.map(token => {
        const isError = !!token.errorMessage;
        // Escape the error message for the title attribute
        const safeTitle = token.errorMessage?.replace(/"/g, '&quot;');
        const titleAttr = isError ? `title="${safeTitle}"` : '';

        // Apply 'error' class if there's an error message, otherwise use the type-specific class.
        const className = isError 
            ? typeToClassMap['error'] 
            : typeToClassMap[token.type] || '';
        
        // The token value is already escaped, so it can be safely rendered.
        return `<span class="${className}" ${titleAttr}>${token.value}</span>`;
    }).join('');
};

// --- END: Tokenizer-based Highlighter ---


/**
 * A decorative component representing a "fractal node" for visual effect in the editor background.
 * @returns {React.ReactElement} The rendered fractal node div.
 */
const FractalNode = () => (
    <div
        className="fractal-node absolute w-1 h-1 rounded-full bg-cyan-400"
        style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 2}s`,
            background: Math.random() > 0.5 ? 'var(--agent-nexus)' : 'var(--agent-cognito)',
        }}
    />
);

/**
 * The main code editor component. It features a content-editable div with custom
 * tokenizer-based syntax highlighting, line numbers, and tab handling. It also reports
 * statistics like cursor position and line count back to the parent component.
 * @param {EditorProps} props - The component props.
 * @param {string} props.content - The current code/text content of the editor.
 * @param {(content: string) => void} props.setContent - A callback function to update the editor's content in the parent state.
 * @param {string} props.fileType - The language identifier for syntax highlighting (e.g., 'js', 'html').
 * @param {(stats: { cursor: string; lines: number; chars: number; }) => void} props.onStatsChange - A callback to report editor stats to the parent component.
 * @param {number} props.fontSize - The font size in pixels for the editor content.
 * @returns {React.ReactElement} The rendered editor component.
 */
export const Editor: React.FC<EditorProps> = ({ content, setContent, fileType, onStatsChange, fontSize }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [lineNumbers, setLineNumbers] = useState('1');
    const [showFractalNodes, setShowFractalNodes] = useState(true);

    const updateEditorState = useCallback(() => {
        if (!editorRef.current) return;
        const text = editorRef.current.innerText || '';
        const lines = text.split('\n');
        const lineCount = lines.length;

        setLineNumbers(Array.from({ length: lineCount }, (_, i) => i + 1).join('\n'));

        // Update stats
        const selection = window.getSelection();
        let lineNum = 1, colNum = 0;
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(editorRef.current);
            preCaretRange.setEnd(range.endContainer, range.endOffset);
            const preCaretText = preCaretRange.toString();
            const preCaretLines = preCaretText.split('\n');
            lineNum = preCaretLines.length;
            colNum = preCaretLines[preCaretLines.length - 1].length;
        }
        onStatsChange({ cursor: `${lineNum}:${colNum}`, lines: lineCount, chars: text.length });

    }, [onStatsChange]);

    useEffect(() => {
        // This effect is responsible for updating line numbers and stats
        // when the content changes from an external source (e.g., loading a file, AI applying code).
        updateEditorState();
    }, [content, updateEditorState]);

    const handleInput = () => {
        if (editorRef.current) {
            setContent(editorRef.current.innerText);
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            document.execCommand('insertText', false, '    ');
        }
    };
    
    return (
        <div className="editor-container relative flex flex-1 bg-[#3a3c31] overflow-auto">
            {showFractalNodes && (
                 <div className="quantum-thinking absolute inset-0 pointer-events-none z-0">
                    {Array.from({ length: 12 }).map((_, i) => <FractalNode key={i} />)}
                </div>
            )}
            <div className="line-numbers w-[50px] p-2.5 bg-[#313328] text-[#999966] text-right select-none sticky left-0 z-10 whitespace-pre"
                 style={{ lineHeight: '1.5em', fontSize: `${fontSize}px` }}>
                {lineNumbers}
            </div>
            <div
                ref={editorRef}
                className="editor-content flex-1 p-2.5 box-border whitespace-pre outline-none z-10"
                style={{ lineHeight: '1.5em', tabSize: 4, fontSize: `${fontSize}px` }}
                contentEditable="true"
                spellCheck="false"
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onClick={updateEditorState}
                onKeyUp={updateEditorState}
                dangerouslySetInnerHTML={{ __html: highlight(content, fileType) }}
            ></div>
        </div>
    );
};
