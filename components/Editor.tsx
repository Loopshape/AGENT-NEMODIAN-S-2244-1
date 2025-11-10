import React, { useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo } from 'react';
import { typeToClassMap, tokenize, escapeHtml } from '../utils/highlighter'; // Import shared highlighter utilities

interface EditorProps {
    content: string;
    setContent: (content: string) => void;
    fileType: string;
    onStatsChange: (stats: { cursor: string; lines: number; chars: number }) => void;
    fontSize: number;
}

// --- START: Tokenizer-based Highlighter (using shared utils) ---

/**
 * Highlights a given text, applying syntax highlighting and editor selection.
 * @param {string} text - The input text to highlight.
 * @param {string} language - The language identifier.
 * @param {number} selectionStart - The start index of the editor selection.
 * @param {number} selectionEnd - The end index of the editor selection.
 * @returns {string} The HTML string with syntax highlighting and selection spans.
 */
const highlight = (text: string, language: string, selectionStart: number, selectionEnd: number): string => {
    if (!text) return '';
    const tokens = tokenize(text, language);

    let currentOffset = 0;
    return tokens
        .map((token) => {
            const isError = !!token.errorMessage;
            const safeTitle = token.errorMessage?.replace(/"/g, '&quot;');
            const titleAttr = isError ? `title="${safeTitle}"` : '';
            const className = isError ? typeToClassMap['error'] : typeToClassMap[token.type] || typeToClassMap['unknown'];

            let styledContent = escapeHtml(token.value);

            // Apply selection highlighting if active and valid
            if (selectionStart !== undefined && selectionEnd !== undefined && selectionStart < selectionEnd) {
                const tokenStart = currentOffset;
                const tokenEnd = currentOffset + token.value.length;

                // Check for overlap between token and selection
                const overlapStart = Math.max(tokenStart, selectionStart);
                const overlapEnd = Math.min(tokenEnd, selectionEnd);

                if (overlapStart < overlapEnd) {
                    // There is an overlap, split the token's value
                    const beforeSelection = escapeHtml(token.value.substring(0, overlapStart - tokenStart));
                    const inSelection = escapeHtml(token.value.substring(overlapStart - tokenStart, overlapEnd - tokenStart));
                    const afterSelection = escapeHtml(token.value.substring(overlapEnd - tokenStart));

                    styledContent = `${beforeSelection}<span class="editor-selection">${inSelection}</span>${afterSelection}`;
                }
            }
            
            currentOffset += token.value.length; // Update offset for the next token

            return `<span class="${className}" ${titleAttr}>${styledContent}</span>`;
        })
        .join('');
};
// --- END: Tokenizer-based Highlighter ---

export const Editor: React.FC<EditorProps> = ({ content, setContent, fileType, onStatsChange, fontSize }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const highlightRef = useRef<HTMLElement>(null);
    const linesRef = useRef<HTMLDivElement>(null);
    const [lines, setLines] = useState<number[]>([]);
    // State to track selection in the textarea
    const [selectionStart, setSelectionStart] = useState(0);
    const [selectionEnd, setSelectionEnd] = useState(0);

    const syncScroll = useCallback(() => {
        if (textareaRef.current && highlightRef.current && linesRef.current) {
            const { scrollTop, scrollLeft } = textareaRef.current;
            highlightRef.current.scrollTop = scrollTop;
            highlightRef.current.scrollLeft = scrollLeft;
            linesRef.current.scrollTop = scrollTop;
        }
    }, []);

    const handleContentChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            setContent(e.target.value);
            // Update selection immediately after content change to keep it accurate
            setSelectionStart(e.target.selectionStart);
            setSelectionEnd(e.target.selectionEnd);
        },
        [setContent]
    );

    // Memoize the highlighted content, now including selection info
    const highlightedContent = useMemo(
        () => highlight(content + '\n', fileType, selectionStart, selectionEnd),
        [content, fileType, selectionStart, selectionEnd]
    );

    useLayoutEffect(() => {
        const lineCount = content.split('\n').length;
        setLines(Array.from({ length: lineCount }, (_, i) => i + 1));
    }, [content]);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const updateStatsAndSelection = () => {
            const { selectionStart, selectionEnd } = textarea;
            const textToCursor = content.substring(0, selectionStart);
            const line = textToCursor.split('\n').length;
            const col = selectionStart - textToCursor.lastIndexOf('\n');
            onStatsChange({
                cursor: `${line}:${col}`,
                lines: content.split('\n').length,
                chars: content.length,
            });
            setSelectionStart(selectionStart);
            setSelectionEnd(selectionEnd);
        };

        // Initial update and event listeners
        updateStatsAndSelection(); // Call once on mount
        textarea.addEventListener('keyup', updateStatsAndSelection);
        textarea.addEventListener('click', updateStatsAndSelection);
        textarea.addEventListener('select', updateStatsAndSelection); // Listen for selection changes
        return () => {
            textarea.removeEventListener('keyup', updateStatsAndSelection);
            textarea.removeEventListener('click', updateStatsAndSelection);
            textarea.removeEventListener('select', updateStatsAndSelection);
        };
    }, [content, onStatsChange]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = e.currentTarget.selectionStart;
            const end = e.currentTarget.selectionEnd;
            const value = e.currentTarget.value;
            const indentedValue = value.substring(0, start) + '  ' + value.substring(end);
            setContent(indentedValue);
            setTimeout(() => {
                e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
                setSelectionStart(start + 2); // Update selection state after tab
                setSelectionEnd(start + 2);
            }, 0);
        }
    };

    return (
        <div className="flex-1 flex relative bg-[#22241e] overflow-hidden">
            <div
                ref={linesRef}
                className="text-right text-slate-600 select-none pr-3 pt-2 text-xs"
                style={{ lineHeight: '1.5em', fontSize: `${fontSize}px` }}
            >
                {lines.map((num) => (
                    <div key={num}>{num}</div>
                ))}
            </div>
            <div className="relative flex-1 h-full">
                <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={handleContentChange}
                    onScroll={syncScroll}
                    onKeyDown={handleKeyDown}
                    spellCheck="false"
                    className="absolute inset-0 w-full h-full p-2 bg-transparent text-transparent caret-white outline-none resize-none font-mono text-xs leading-normal"
                    style={{ lineHeight: '1.5em', fontSize: `${fontSize}px` }}
                    aria-label="Code Editor"
                />
                <pre
                    className="absolute inset-0 w-full h-full p-2 font-mono text-xs leading-normal pointer-events-none overflow-hidden"
                    style={{ lineHeight: '1.5em', fontSize: `${fontSize}px` }}
                    aria-hidden="true"
                >
                    <code
                        ref={highlightRef}
                        dangerouslySetInnerHTML={{ __html: highlightedContent }}
                    />
                </pre>
            </div>
        </div>
    );
};