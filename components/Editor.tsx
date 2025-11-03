
import React, { useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo } from 'react';

interface EditorProps {
    content: string;
    setContent: (content: string) => void;
    fileType: string;
    onStatsChange: (stats: { cursor: string; lines: number; chars: number }) => void;
    fontSize: number;
}

// --- START: Tokenizer-based Highlighter ---

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
        { type: 'number', regex: /^\b(?:0x[a-fA-F0-9]+|[0-9]+(?:\.[0-9]+)?(?:e[+-]?\d+)?)\b/i },
        {
            type: 'keyword',
            regex: /^\b(?:if|else|for|while|function|return|const|let|var|class|new|in|of|switch|case|break|continue|try|catch|throw|async|await|export|import|from|default|extends|super|instanceof|typeof|void|delete)\b/,
        },
        { type: 'boolean', regex: /^\b(true|false)\b/ },
        { type: 'null', regex: /^\b(null|undefined)\b/ },
        { type: 'function', regex: /^\b[a-zA-Z_$][\w$]*(?=\s*\()/ },
        { type: 'bracket', regex: /^[\[\]{}()]/ },
        { type: 'op', regex: /^==|===|!=|!==|<=|>=|=>|[-+*/%=<>!&|^~?:.,;]/ },
        { type: 'id', regex: /^\b[a-zA-Z_$][\w$]*\b/ },
        { type: 'whitespace', regex: /^\s+/ },
    ],
    html: [
        { type: 'error', regex: /^<[\w\d\-]+(?:(?:"[^"]*"|'[^']*'|[^>])+)?$/, errorMessage: 'Unclosed HTML tag.' },
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
        { type: 'string', regex: /^"(?:\\.|[^"])*"|^'(?:\\.|[^'])*'/ },
        { type: 'selector', regex: /^(?:[.#]?[a-zA-Z0-9\-_*]+|\[[^\]]+\])(?:\s*[:>+~]\s*)?/ },
        { type: 'property', regex: /^[a-zA-Z\-]+(?=\s*:)/ },
        { type: 'number', regex: /^\b-?\d+(\.\d+)?(px|em|rem|%|vw|vh|s)?\b/i },
        { type: 'op', regex: /^[:;,#.]/ },
        { type: 'bracket', regex: /^[\[\]{}()]/ },
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
        { type: 'string', regex: /^(?:'''[\s\S]*?'''|"""[\s\S]*?"""|'[^']*'|"[^"]*")/ },
        {
            type: 'keyword',
            regex: /^\b(def|return|if|else|elif|for|while|import|from|as|class|try|except|with|lambda|yield|in|is|not|and|or|pass|continue|break)\b/,
        },
        { type: 'function', regex: /^\b[a-zA-Z_]\w*(?=\s*\()/ },
        { type: 'number', regex: /^\b\d+(\.\d+)?\b/ },
        { type: 'op', regex: /^[-+*/%=<>!&|^~:.,;@]/ },
        { type: 'bracket', regex: /^[\[\]{}()]/ },
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
    if (rules.length === 0) return [{ type: 'unknown', value: text }];
    const tokens: Token[] = [];
    let position = 0;
    while (position < text.length) {
        let matched = false;
        for (const rule of rules) {
            const match = rule.regex.exec(text.slice(position));
            if (match && match[0].length > 0) {
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

const escapeHtml = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

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

// --- START: Selection Utilities ---

const getSelectionOffset = (element: Node): { start: number; end: number } => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return { start: 0, end: 0 };
    const range = selection.getRangeAt(0);
    if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) return { start: 0, end: 0 };
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    const start = preCaretRange.toString().length;
    return { start, end: start + range.toString().length };
};

const setSelectionOffset = (element: Node, offsets: { start: number; end: number }) => {
    const { start, end } = offsets;
    if (typeof start !== 'number' || typeof end !== 'number' || start < 0 || end < 0) return;
    const range = document.createRange();
    range.selectNode(element);
    range.collapse(true);
    let charCount = 0;
    let foundStart = false;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
        const nodeLength = node.textContent?.length ?? 0;
        if (!foundStart && start >= charCount && start <= charCount + nodeLength) {
            range.setStart(node, start - charCount);
            foundStart = true;
        }
        if (foundStart && end >= charCount && end <= charCount + nodeLength) {
            range.setEnd(node, end - charCount);
            break;
        }
        charCount += nodeLength;
    }
    const selection = window.getSelection();
    if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
    }
};

// --- END: Selection Utilities ---

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

const LINE_HEIGHT_MULTIPLIER = 1.5;
const OVERSCAN_COUNT = 10;

export const Editor: React.FC<EditorProps> = ({ content, setContent, fileType, onStatsChange, fontSize }) => {
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const selectionRef = useRef<{ start: number; end: number } | null>(null);

    const [scrollTop, setScrollTop] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(0);
    const [showFractalNodes] = useState(true);
    const lastContentRef = useRef(content);

    const lineHeight = fontSize * LINE_HEIGHT_MULTIPLIER;
    const allLines = useMemo(() => content.split('\n'), [content]);
    const totalHeight = allLines.length * lineHeight;

    const startIndex = Math.max(0, Math.floor(scrollTop / lineHeight) - OVERSCAN_COUNT);
    const visibleNodeCount = Math.ceil(viewportHeight / lineHeight);
    const endIndex = Math.min(allLines.length, startIndex + visibleNodeCount + OVERSCAN_COUNT * 2);

    const visibleLines = useMemo(() => allLines.slice(startIndex, endIndex), [allLines, startIndex, endIndex]);
    const paddingTop = startIndex * lineHeight;

    // Observer to update viewport height on resize
    useEffect(() => {
        const container = editorContainerRef.current;
        if (!container) return;

        const resizeObserver = new ResizeObserver(() => {
            setViewportHeight(container.clientHeight);
        });

        resizeObserver.observe(container);
        setViewportHeight(container.clientHeight); // Initial set

        return () => resizeObserver.disconnect();
    }, []);

    useLayoutEffect(() => {
        if (selectionRef.current && editorRef.current) {
            let windowCharOffset = 0;
            for (let i = 0; i < startIndex; i++) {
                windowCharOffset += (allLines[i]?.length ?? 0) + 1; // +1 for newline
            }
            const localStart = selectionRef.current.start - windowCharOffset;
            const localEnd = selectionRef.current.end - windowCharOffset;
            setSelectionOffset(editorRef.current, { start: localStart, end: localEnd });
            selectionRef.current = null;
        }
    });

    const updateStats = useCallback(() => {
        const lines = allLines.length;
        const chars = content.length;
        let lineNum = 1,
            colNum = 0;

        const selection = window.getSelection();
        if (selection?.rangeCount && editorRef.current) {
            const localOffsets = getSelectionOffset(editorRef.current);
            let windowCharOffset = 0;
            for (let i = 0; i < startIndex; i++) {
                windowCharOffset += (allLines[i]?.length ?? 0) + 1;
            }
            const globalOffset = localOffsets.start + windowCharOffset;
            const textBefore = content.substring(0, globalOffset);
            const preCaretLines = textBefore.split('\n');
            lineNum = preCaretLines.length;
            colNum = preCaretLines[preCaretLines.length - 1].length;
        }

        onStatsChange({ cursor: `${lineNum}:${colNum}`, lines, chars });
    }, [allLines, content, onStatsChange, startIndex]);

    useEffect(() => {
        if (content !== lastContentRef.current) {
            if (editorRef.current) {
                editorRef.current.innerHTML = highlight(visibleLines.join('\n'), fileType);
            }
            lastContentRef.current = content;
        }
        updateStats();
    }, [content, fileType, visibleLines, updateStats]);

    const handleInput = () => {
        if (editorRef.current) {
            const localSelection = getSelectionOffset(editorRef.current);
            let windowCharOffset = 0;
            for (let i = 0; i < startIndex; i++) {
                windowCharOffset += (allLines[i]?.length ?? 0) + 1;
            }

            selectionRef.current = {
                start: localSelection.start + windowCharOffset,
                end: localSelection.end + windowCharOffset,
            };

            const newVisibleText = editorRef.current.innerText;
            const linesBefore = allLines.slice(0, startIndex);
            const linesAfter = allLines.slice(endIndex);
            const newContent = [...linesBefore, ...newVisibleText.split('\n'), ...linesAfter].join('\n');

            lastContentRef.current = newContent;
            setContent(newContent);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            document.execCommand('insertText', false, '    ');
        }
    };

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    }, []);

    return (
        <div
            ref={editorContainerRef}
            onScroll={handleScroll}
            className="editor-container relative flex flex-1 bg-[#3a3c31] overflow-auto"
        >
            {showFractalNodes && (
                <div className="quantum-thinking absolute inset-0 pointer-events-none z-0">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <FractalNode key={i} />
                    ))}
                </div>
            )}
            <div style={{ height: `${totalHeight}px`, position: 'relative', width: '100%' }}>
                <div
                    className="editor-window absolute top-0 left-0 w-full flex"
                    style={{ transform: `translateY(${paddingTop}px)` }}
                >
                    <div
                        className="line-numbers w-[50px] p-2.5 bg-[#313328] text-[#999966] text-right select-none sticky left-0 z-10 whitespace-pre"
                        style={{ lineHeight: `${lineHeight}px`, fontSize: `${fontSize}px` }}
                    >
                        {Array.from({ length: visibleLines.length }, (_, i) => startIndex + i + 1).join('\n')}
                    </div>
                    <div
                        ref={editorRef}
                        className="editor-content flex-1 p-2.5 box-border whitespace-pre outline-none z-10"
                        style={{ lineHeight: `${lineHeight}px`, tabSize: 4, fontSize: `${fontSize}px` }}
                        contentEditable="true"
                        spellCheck="false"
                        onInput={handleInput}
                        onKeyDown={handleKeyDown}
                        onClick={updateStats}
                        onKeyUp={updateStats}
                        dangerouslySetInnerHTML={{ __html: highlight(visibleLines.join('\n'), fileType) }}
                    ></div>
                </div>
            </div>
        </div>
    );
};
