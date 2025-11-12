import React, { useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo } from 'react';
import { typeToClassMap, tokenize, escapeHtml } from '../utils/highlighter'; // Import shared highlighter utilities
import { requestCodeCompletion, CompletionSuggestion } from '../services/geminiService'; // Import the new completion service and type
import { CodeCompletionDropdown } from './CodeCompletionDropdown'; // Import the new dropdown component

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
 * @param {number} selectionStart - The start index of the editor selection (relative to `text`).
 * @param {number} selectionEnd - The end index of the editor selection (relative to `text`).
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

const BUFFER_LINES = 20; // Number of extra lines to render above and below the viewport

export const Editor: React.FC<EditorProps> = ({ content, setContent, fileType, onStatsChange, fontSize }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const highlightCodeRef = useRef<HTMLElement>(null); // Refers to the <code> element
    const linesRef = useRef<HTMLDivElement>(null);
    const editorMainAreaRef = useRef<HTMLDivElement>(null); // Ref for the relative container for dropdown

    // Virtualization state
    const [viewportHeight, setViewportHeight] = useState(0);
    const [effectiveLineHeight, setEffectiveLineHeight] = useState(0);
    const [startRenderedLine, setStartRenderedLine] = useState(0);
    const [endRenderedLine, setEndRenderedLine] = useState(0);
    const [paddingTop, setPaddingTop] = useState(0);
    const [paddingBottom, setPaddingBottom] = useState(0);

    // State to track selection in the textarea (full content indices)
    const [selectionStartFull, setSelectionStartFull] = useState(0);
    const [selectionEndFull, setSelectionEndFull] = useState(0);

    // AI Completion state
    const [showCompletion, setShowCompletion] = useState(false);
    const [suggestions, setSuggestions] = useState<CompletionSuggestion[]>([]); // Updated type
    const [currentCompletionPrefix, setCurrentCompletionPrefix] = useState('');
    const [currentCompletionStartIndex, setCurrentCompletionStartIndex] = useState(0); // Where the prefix starts in the full content
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
    const [completionPosition, setCompletionPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const [isLoadingCompletion, setIsLoadingCompletion] = useState(false);
    const completionTimeoutRef = useRef<number | null>(null);

    const contentLines = useMemo(() => content.split('\n'), [content]);
    const totalLines = contentLines.length;

    // Calculate effective line height and viewport height on mount and font size change
    useLayoutEffect(() => {
        if (textareaRef.current) {
            // Temporarily set height to auto to measure actual line height
            textareaRef.current.style.height = 'auto';
            const testLine = document.createElement('span');
            testLine.style.display = 'block';
            testLine.style.fontSize = `${fontSize}px`;
            testLine.style.fontFamily = 'Fira Code, monospace';
            testLine.textContent = 'M'; // Any character to measure height
            document.body.appendChild(testLine);
            const height = testLine.offsetHeight;
            document.body.removeChild(testLine);
            setEffectiveLineHeight(height);
            textareaRef.current.style.height = '100%'; // Reset to full height
            setViewportHeight(textareaRef.current.clientHeight);
        }
    }, [fontSize]);

    // Update viewport height on resize
    useEffect(() => {
        const resizeObserver = new ResizeObserver(entries => {
            if (entries[0] && textareaRef.current) {
                setViewportHeight(textareaRef.current.clientHeight);
            }
        });

        if (textareaRef.current) {
            resizeObserver.observe(textareaRef.current);
        }

        return () => {
            if (textareaRef.current) {
                resizeObserver.unobserve(textareaRef.current);
            }
        };
    }, []); // Only run once to set up observer

    // Helper to get pixel position of the cursor for dropdown
    const getCompletionPosition = useCallback((textarea: HTMLTextAreaElement, cursorOffset: number): { top: number; left: number } => {
        if (!textarea || !textarea.value || cursorOffset < 0 || cursorOffset > textarea.value.length) {
            return { top: 0, left: 0 };
        }

        const dummyDiv = document.createElement('div');
        Object.assign(dummyDiv.style, {
            position: 'absolute',
            visibility: 'hidden',
            whiteSpace: 'pre-wrap', // Essential for handling newlines correctly
            fontFamily: getComputedStyle(textarea).fontFamily,
            fontSize: getComputedStyle(textarea).fontSize,
            lineHeight: getComputedStyle(textarea).lineHeight,
            padding: getComputedStyle(textarea).padding,
            border: getComputedStyle(textarea).border,
            boxSizing: getComputedStyle(textarea).boxSizing,
            width: `${textarea.clientWidth}px`, // Crucial to match text wrapping
            height: `${textarea.clientHeight}px`,
            overflow: 'auto', // Mimic scroll behavior
            wordBreak: 'break-all', // Or 'normal', depends on editor's actual word-break behavior
        });

        const textBeforeCursor = textarea.value.substring(0, cursorOffset);
        dummyDiv.textContent = textBeforeCursor;
        
        const cursorMarker = document.createElement('span'); // An empty span at the exact cursor position
        dummyDiv.appendChild(cursorMarker);
        dummyDiv.appendChild(document.createTextNode(textarea.value.substring(cursorOffset)));

        document.body.appendChild(dummyDiv);

        // Temporarily apply textarea's scroll to the dummyDiv to get correct scroll-adjusted position
        dummyDiv.scrollTop = textarea.scrollTop;
        dummyDiv.scrollLeft = textarea.scrollLeft;

        const cursorRect = cursorMarker.getBoundingClientRect();
        const editorMainArea = editorMainAreaRef.current;
        if (!editorMainArea) {
             document.body.removeChild(dummyDiv);
             return { top: 0, left: 0 };
        }
        const editorMainAreaRect = editorMainArea.getBoundingClientRect();

        document.body.removeChild(dummyDiv);

        // Calculate position relative to the editor's main content area
        const left = cursorRect.left - editorMainAreaRect.left;
        const top = cursorRect.bottom - editorMainAreaRect.top;

        return {
            top: Math.max(0, top + 5), // Add a small vertical offset below cursor
            left: Math.max(0, left),
        };
    }, [fontSize]);

    // FIX: Moved `handleScroll` definition before `applyCompletion` as it's a dependency.
    // Scroll handler and virtualization logic
    const handleScroll = useCallback(
        (e: React.UIEvent<HTMLTextAreaElement>) => {
            if (!effectiveLineHeight || !viewportHeight) return;

            const { scrollTop, scrollLeft } = e.currentTarget;
            
            // Sync horizontal scroll
            if (highlightCodeRef.current && highlightCodeRef.current.parentElement) {
                highlightCodeRef.current.parentElement.scrollLeft = scrollLeft;
            }
            if (linesRef.current) {
                linesRef.current.scrollLeft = scrollLeft; // Adjust if line numbers can scroll horizontally
            }

            const firstVisibleLine = Math.floor(scrollTop / effectiveLineHeight);
            const lastVisibleLine = Math.ceil((scrollTop + viewportHeight) / effectiveLineHeight);

            const newStartRenderedLine = Math.max(0, firstVisibleLine - BUFFER_LINES);
            const newEndRenderedLine = Math.min(totalLines, lastVisibleLine + BUFFER_LINES);

            setStartRenderedLine(newStartRenderedLine);
            setEndRenderedLine(newEndRenderedLine);

            setPaddingTop(newStartRenderedLine * effectiveLineHeight);
            setPaddingBottom(Math.max(0, (totalLines - newEndRenderedLine) * effectiveLineHeight));

            // If completion is active, reposition it on scroll
            if (showCompletion && textareaRef.current) {
                setCompletionPosition(getCompletionPosition(textareaRef.current, selectionStartFull));
            }

        },
        [effectiveLineHeight, viewportHeight, totalLines, showCompletion, selectionStartFull, getCompletionPosition]
    );

    const hideCompletion = useCallback(() => {
        setShowCompletion(false);
        setSuggestions([]);
        setSelectedSuggestionIndex(0);
        setCurrentCompletionPrefix('');
        setCurrentCompletionStartIndex(0);
        setIsLoadingCompletion(false);
        if (completionTimeoutRef.current) {
            clearTimeout(completionTimeoutRef.current);
        }
    }, []);

    const applyCompletion = useCallback((suggestion: string) => { // Now receives just the suggestion string
        const textarea = textareaRef.current;
        if (!textarea) return;

        const originalContent = textarea.value;
        const newContent =
            originalContent.substring(0, currentCompletionStartIndex) +
            suggestion +
            originalContent.substring(currentCompletionStartIndex + currentCompletionPrefix.length);

        setContent(newContent); // Update editor content
        
        // Restore cursor position after applying suggestion
        setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = currentCompletionStartIndex + suggestion.length;
            setSelectionStartFull(textarea.selectionStart);
            setSelectionEndFull(textarea.selectionEnd);
            textarea.focus(); // Ensure textarea keeps focus
            // Manually trigger scroll handler to update virtualization after content change
            handleScroll({ currentTarget: textarea } as React.UIEvent<HTMLTextAreaElement>);
        }, 0);

        hideCompletion();
    }, [currentCompletionStartIndex, currentCompletionPrefix.length, setContent, hideCompletion, handleScroll]);

    // Debounced function to trigger completion check
    const triggerCompletionCheck = useCallback(() => {
        if (completionTimeoutRef.current) {
            clearTimeout(completionTimeoutRef.current);
        }
        completionTimeoutRef.current = window.setTimeout(async () => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            const cursorOffset = textarea.selectionStart;
            const textBeforeCursor = textarea.value.substring(0, cursorOffset);
            
            // Find the "word" before the cursor to complete. E.g., for "console.lo|", prefix is "lo"
            // This regex tries to capture identifiers, numbers, property access (like .prop)
            const wordMatch = textBeforeCursor.match(/[\w.$]+$/);
            const prefix = wordMatch ? wordMatch[0] : '';
            const prefixStartIndex = wordMatch ? cursorOffset - prefix.length : cursorOffset;

            // Only trigger if a relevant prefix is typed (at least 2 chars or ends with '.')
            if (prefix.length >= 2 || prefix.endsWith('.')) {
                setIsLoadingCompletion(true);
                setCurrentCompletionPrefix(prefix);
                setCurrentCompletionStartIndex(prefixStartIndex);
                setCompletionPosition(getCompletionPosition(textarea, cursorOffset));

                try {
                    const fetchedSuggestions = await requestCodeCompletion(textarea.value, cursorOffset, fileType);
                    if (fetchedSuggestions.length > 0) {
                        setSuggestions(fetchedSuggestions);
                        setShowCompletion(true);
                        setSelectedSuggestionIndex(0);
                    } else {
                        hideCompletion();
                    }
                } catch (error) {
                    console.error("Completion request failed:", error);
                    hideCompletion();
                } finally {
                    setIsLoadingCompletion(false);
                }
            } else {
                hideCompletion();
            }
        }, 300); // Debounce for 300ms
    }, [fileType, getCompletionPosition, hideCompletion]); // Added hideCompletion to dependencies for consistency

    const handleContentChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            setContent(e.target.value);
            // Update selection immediately after content change to keep it accurate
            setSelectionStartFull(e.target.selectionStart);
            setSelectionEndFull(e.target.selectionEnd);
            triggerCompletionCheck(); // Trigger debounced completion check
        },
        [setContent, triggerCompletionCheck]
    );

    // Update stats and selection positions
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
            setSelectionStartFull(selectionStart);
            setSelectionEndFull(selectionEnd);
            
            // Re-trigger scroll to ensure virtualization state is consistent with potential programmatic scroll or keyboard navigation
            handleScroll({ currentTarget: textarea } as React.UIEvent<HTMLTextAreaElement>);

            // If cursor moved and completion is active, update its position
            if (showCompletion) {
                setCompletionPosition(getCompletionPosition(textarea, selectionStart));
            }
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
            if (completionTimeoutRef.current) {
                clearTimeout(completionTimeoutRef.current);
            }
        };
    }, [content, onStatsChange, handleScroll, showCompletion, getCompletionPosition]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showCompletion) {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedSuggestionIndex((prev) => (prev + 1) % suggestions.length);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (suggestions[selectedSuggestionIndex]) {
                        applyCompletion(suggestions[selectedSuggestionIndex].suggestion); // Pass only the suggestion string
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    hideCompletion();
                    break;
                // If other keys are pressed, let default behavior happen and completion will re-evaluate
            }
        }
        
        // Handle Tab key for indentation
        if (e.key === 'Tab' && !e.shiftKey) { // Only handle plain tab for indentation
            e.preventDefault();
            const start = e.currentTarget.selectionStart;
            const end = e.currentTarget.selectionEnd;
            const value = e.currentTarget.value;
            const indentedValue = value.substring(0, start) + '  ' + value.substring(end);
            setContent(indentedValue);
            setTimeout(() => {
                e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2;
                setSelectionStartFull(start + 2); // Update selection state after tab
                setSelectionEndFull(start + 2);
            }, 0);
        } else if (e.key === 'Tab' && e.shiftKey) { // Handle Shift+Tab for dedentation
            e.preventDefault();
            const start = e.currentTarget.selectionStart;
            const end = e.currentTarget.selectionEnd;
            const value = e.currentTarget.value;

            // Find the start of the current line
            const lineStart = value.lastIndexOf('\n', start - 1) + 1;
            const textBefore = value.substring(0, lineStart);
            const textAfter = value.substring(lineStart);

            // Check if the line starts with two spaces
            if (textAfter.startsWith('  ')) {
                const dedentedValue = textBefore + textAfter.substring(2);
                setContent(dedentedValue);
                setTimeout(() => {
                    e.currentTarget.selectionStart = e.currentTarget.selectionEnd = Math.max(lineStart, start - 2);
                    setSelectionStartFull(e.currentTarget.selectionStart);
                    setSelectionEndFull(e.currentTarget.selectionEnd);
                }, 0);
            }
        }
    };

    // Slice content for rendering and calculate selection relative to sliced content
    const renderedContentLines = useMemo(() => {
        return contentLines.slice(startRenderedLine, endRenderedLine);
    }, [contentLines, startRenderedLine, endRenderedLine]);

    const renderedContent = useMemo(() => {
        return renderedContentLines.join('\n');
    }, [renderedContentLines]);

    const selectionStartRelative = useMemo(() => {
        if (selectionStartFull === 0) return 0;
        // Calculate offset from start of full content to start of rendered content
        const offsetToRenderedStart = contentLines.slice(0, startRenderedLine).join('\n').length + (startRenderedLine > 0 ? 1 : 0); // +1 for newline character if not first line

        return Math.max(0, selectionStartFull - offsetToRenderedStart);
    }, [selectionStartFull, startRenderedLine, contentLines]);

    const selectionEndRelative = useMemo(() => {
        if (selectionEndFull === 0) return 0;
        const offsetToRenderedStart = contentLines.slice(0, startRenderedLine).join('\n').length + (startRenderedLine > 0 ? 1 : 0);

        return Math.max(0, selectionEndFull - offsetToRenderedStart);
    }, [selectionEndFull, startRenderedLine, contentLines]);


    // Memoize the highlighted content, now including relative selection info
    const highlightedContent = useMemo(
        () => highlight(renderedContent + '\n', fileType, selectionStartRelative, selectionEndRelative),
        [renderedContent, fileType, selectionStartRelative, selectionEndRelative]
    );

    // Memoize line numbers for rendering
    const renderedLineNumbers = useMemo(() => {
        const lines = [];
        for (let i = startRenderedLine; i < endRenderedLine; i++) {
            lines.push(i + 1);
        }
        return lines.map((num) => (
            <div key={num}>{num}</div>
        ));
    }, [startRenderedLine, endRenderedLine]);

    return (
        <div className="flex-1 flex relative bg-[#22241e] overflow-hidden">
            <div
                ref={linesRef}
                className="text-right text-slate-600 select-none pr-3 pt-2 text-xs overflow-y-hidden overflow-x-hidden" // Changed overflow to hidden for vertical axis
                style={{ lineHeight: '1.5em', fontSize: `${fontSize}px`, paddingTop: `${paddingTop}px`, paddingBottom: `${paddingBottom}px`, fontFamily: 'Fira Code, monospace' }} // Ensure font consistency
            >
                {renderedLineNumbers}
            </div>
            <div ref={editorMainAreaRef} className="relative flex-1 h-full"> {/* This div is now relative for dropdown positioning */}
                {/* The transparent textarea holds the full content and is the source of truth for scrolling and editing */}
                <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={handleContentChange}
                    onScroll={handleScroll}
                    onKeyDown={handleKeyDown}
                    spellCheck="false"
                    className="absolute inset-0 w-full h-full p-2 bg-transparent text-transparent caret-white outline-none resize-none font-mono text-xs leading-normal z-10 overflow-auto" // Changed overflow to auto
                    style={{ lineHeight: '1.5em', fontSize: `${fontSize}px`, fontFamily: 'Fira Code, monospace' }} // Ensure font consistency
                    aria-label="Code Editor"
                />
                {/* The pre element displays the highlighted (virtualized) content */}
                <pre
                    className="absolute inset-0 w-full h-full p-2 font-mono text-xs leading-normal pointer-events-none overflow-y-hidden overflow-x-hidden" // Changed overflow to hidden for vertical axis
                    style={{ lineHeight: '1.5em', fontSize: `${fontSize}px`, paddingTop: `${paddingTop}px`, paddingBottom: `${paddingBottom}px`, fontFamily: 'Fira Code, monospace' }} // Ensure font consistency
                    aria-hidden="true"
                >
                    <code
                        ref={highlightCodeRef}
                        dangerouslySetInnerHTML={{ __html: highlightedContent }}
                    />
                </pre>

                {showCompletion && (
                    <CodeCompletionDropdown
                        suggestions={suggestions}
                        selectedSuggestionIndex={selectedSuggestionIndex}
                        position={completionPosition}
                        onSelect={(s) => applyCompletion(s)} // Ensure only suggestion string is passed to applyCompletion
                        onClose={hideCompletion}
                        fontSize={fontSize}
                    />
                )}
                {isLoadingCompletion && (
                    <div className="absolute z-50 text-xs text-gray-400 p-1 flex items-center" style={{ top: completionPosition.top + 5, left: completionPosition.left }}>
                        <div className="quantum-spinner w-3 h-3 inline-block mr-1.5 relative">
                            <div className="absolute w-full h-full border-2 border-transparent border-t-[#03DAC6] rounded-full quantum-spinner::before"></div>
                            <div className="absolute w-full h-full border-2 border-transparent border-b-[#BB86FC] rounded-full quantum-spinner::after"></div>
                        </div>
                        AI Thinking...
                    </div>
                )}
            </div>
        </div>
    );
};