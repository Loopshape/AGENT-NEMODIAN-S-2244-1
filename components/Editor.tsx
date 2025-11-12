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
    onSelectionChange: (start: number, end: number) => void; // New prop for selection changes
    isFindReplaceOpen: boolean; // New prop for Find/Replace widget visibility
    onFindReplaceToggle: () => void; // New prop to toggle Find/Replace visibility
}

// --- START: Tokenizer-based Highlighter (using shared utils) ---

/**
 * Highlights a given text, applying syntax highlighting and editor selection.
 * @param {string} text - The input text to highlight.
 * @param {string} language - The language identifier.
 * @param {number} selectionStart - The start index of the editor selection (relative to `text`).
 * @param {number} selectionEnd - The end index of the editor selection (relative to `text`).
 * @param {{start: number, end: number}[]} searchMatches - Array of ranges for all search matches.
 * @param {number} activeMatchIndex - Index of the currently active search match.
 * @returns {string} The HTML string with syntax highlighting and selection spans.
 */
const highlight = (
    text: string,
    language: string,
    selectionStart: number,
    selectionEnd: number,
    searchMatches: { start: number; end: number }[] = [],
    activeMatchIndex: number = -1
): string => {
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

            const tokenStart = currentOffset;
            const tokenEnd = currentOffset + token.value.length;

            // Apply search highlighting
            let tempStyledContent = '';
            let lastSearchHighlightIndex = 0;

            searchMatches.forEach((match, index) => {
                const matchStart = match.start;
                const matchEnd = match.end;

                const overlapStart = Math.max(tokenStart, matchStart);
                const overlapEnd = Math.min(tokenEnd, matchEnd);

                if (overlapStart < overlapEnd) {
                    // Part of the token is a search match
                    const beforeMatch = styledContent.substring(lastSearchHighlightIndex, overlapStart - tokenStart);
                    const inMatch = styledContent.substring(overlapStart - tokenStart, overlapEnd - tokenStart);
                    const afterMatch = styledContent.substring(overlapEnd - tokenStart);

                    const matchClass = index === activeMatchIndex ? 'editor-active-match' : 'editor-search-match';

                    tempStyledContent += beforeMatch + `<span class="${matchClass}">${inMatch}</span>`;
                    lastSearchHighlightIndex = overlapEnd - tokenStart;
                    styledContent = tempStyledContent + afterMatch; // Update styledContent for next iteration
                }
            });

            // If no search matches, or if there's content after the last search match in this token
            if (tempStyledContent === '') {
                // If no search highlights were applied, use the original styledContent
                styledContent = escapeHtml(token.value);
            } else if (lastSearchHighlightIndex < escapeHtml(token.value).length) {
                // If there was content after the last search match in this token, append it
                tempStyledContent += styledContent.substring(lastSearchHighlightIndex);
                styledContent = tempStyledContent;
            } else {
                styledContent = tempStyledContent;
            }

            // Apply selection highlighting if active and valid
            if (selectionStart !== undefined && selectionEnd !== undefined && selectionStart < selectionEnd) {
                const overlapStart = Math.max(tokenStart, selectionStart);
                const overlapEnd = Math.min(tokenEnd, selectionEnd);

                if (overlapStart < overlapEnd) {
                    // There is an overlap, split the token's value
                    const beforeSelection = styledContent.substring(0, overlapStart - tokenStart);
                    const inSelection = styledContent.substring(overlapStart - tokenStart, overlapEnd - tokenStart);
                    const afterSelection = styledContent.substring(overlapEnd - tokenStart);

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

export const Editor: React.FC<EditorProps> = ({ content, setContent, fileType, onStatsChange, fontSize, onSelectionChange, isFindReplaceOpen, onFindReplaceToggle }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const highlightCodeRef = useRef<HTMLElement>(null); // Refers to the <code> element
    const linesRef = useRef<HTMLDivElement>(null);
    const editorMainAreaRef = useRef<HTMLDivElement>(null); // Ref for the relative container for dropdown
    const findInputRef = useRef<HTMLInputElement>(null); // Ref for find input

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

    // Find and Replace State
    const [findQuery, setFindQuery] = useState('');
    const [replaceQuery, setReplaceQuery] = useState('');
    const [caseSensitive, setCaseSensitive] = useState(false);
    const [useRegex, setUseRegex] = useState(false); // Deferred for now, but kept in state for future
    const [allMatches, setAllMatches] = useState<{ start: number; end: number }[]>([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

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
            testLine.style.lineHeight = '1.5em'; // Explicitly match line-height
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
        const textareaStyle = getComputedStyle(textarea);

        // Copy all relevant styles from the textarea to the dummy div for precise measurement
        Object.assign(dummyDiv.style, {
            position: 'absolute',
            visibility: 'hidden',
            whiteSpace: 'pre-wrap',
            fontFamily: textareaStyle.fontFamily,
            fontSize: textareaStyle.fontSize,
            lineHeight: textareaStyle.lineHeight,
            padding: textareaStyle.padding,
            border: textareaStyle.border,
            boxSizing: textareaStyle.boxSizing,
            width: `${textarea.clientWidth}px`, // Match clientWidth for wrapping
            height: `${textarea.clientHeight}px`,
            overflow: textareaStyle.overflow, // Mimic scroll behavior
            wordBreak: textareaStyle.wordBreak,
            wordWrap: textareaStyle.wordWrap,
            // Ensure padding-top and padding-bottom are zeroed out if they were set by virtualization
            paddingTop: '0px',
            paddingBottom: '0px',
            top: `${textarea.offsetTop}px`, // Align to textarea's position
            left: `${textarea.offsetLeft}px`,
        });

        const textBeforeCursor = textarea.value.substring(0, cursorOffset);
        dummyDiv.textContent = textBeforeCursor;

        const cursorMarker = document.createElement('span'); // An empty span at the exact cursor position
        dummyDiv.appendChild(cursorMarker);
        dummyDiv.appendChild(document.createTextNode(textarea.value.substring(cursorOffset)));

        document.body.appendChild(dummyDiv);

        // Temporarily apply textarea's scroll to the dummyDiv to get correct scroll-adjusted position
        // This is key for accurate measurement of visible text position
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
    }, []);

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
                // Line numbers should only scroll horizontally if they have content wider than their container
                // but typically they don't; keep this if future styling might make them wide
                linesRef.current.scrollLeft = scrollLeft;
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
            onSelectionChange(textarea.selectionStart, textarea.selectionEnd); // Report new selection
            textarea.focus(); // Ensure textarea keeps focus
            // Manually trigger scroll handler to update virtualization after content change
            handleScroll({ currentTarget: textarea } as React.UIEvent<HTMLTextAreaElement>);
        }, 0);

        hideCompletion();
    }, [currentCompletionStartIndex, currentCompletionPrefix.length, setContent, hideCompletion, handleScroll, onSelectionChange]);

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
            onSelectionChange(e.target.selectionStart, e.target.selectionEnd); // Report new selection
            triggerCompletionCheck(); // Trigger debounced completion check
        },
        [setContent, triggerCompletionCheck, onSelectionChange]
    );

    // Find/Replace Logic
    const updateMatches = useCallback(() => {
        if (!findQuery) {
            setAllMatches([]);
            setCurrentMatchIndex(-1);
            return;
        }

        const matches: { start: number; end: number }[] = [];
        let searchContent = content;
        let query = findQuery;

        if (!caseSensitive) {
            searchContent = searchContent.toLowerCase();
            query = query.toLowerCase();
        }

        let lastIndex = 0;
        while (lastIndex !== -1) {
            const index = searchContent.indexOf(query, lastIndex);
            if (index !== -1) {
                matches.push({ start: index, end: index + query.length });
                lastIndex = index + query.length;
            } else {
                lastIndex = -1;
            }
        }
        setAllMatches(matches);
        setCurrentMatchIndex(matches.length > 0 ? 0 : -1);
    }, [content, findQuery, caseSensitive]);

    useEffect(() => {
        updateMatches();
    }, [updateMatches]);

    const scrollToMatch = useCallback((index: number) => {
        if (index === -1 || !textareaRef.current || allMatches.length === 0) return;
        const match = allMatches[index];
        textareaRef.current.setSelectionRange(match.start, match.end);
        textareaRef.current.focus();
        onSelectionChange(match.start, match.end); // Report new selection
        // Calculate scroll position to bring match into view
        const lineNumber = content.substring(0, match.start).split('\n').length - 1;
        const scrollTop = lineNumber * effectiveLineHeight;
        textareaRef.current.scrollTop = scrollTop - (viewportHeight / 3); // Scroll to 1/3 down
    }, [allMatches, content, effectiveLineHeight, viewportHeight, onSelectionChange]);


    const findNext = useCallback(() => {
        if (allMatches.length === 0) return;
        const nextIndex = (currentMatchIndex + 1) % allMatches.length;
        setCurrentMatchIndex(nextIndex);
        scrollToMatch(nextIndex);
    }, [allMatches, currentMatchIndex, scrollToMatch]);

    const findPrevious = useCallback(() => {
        if (allMatches.length === 0) return;
        const prevIndex = (currentMatchIndex - 1 + allMatches.length) % allMatches.length;
        setCurrentMatchIndex(prevIndex);
        scrollToMatch(prevIndex);
    }, [allMatches, currentMatchIndex, scrollToMatch]);

    const replaceCurrent = useCallback(() => {
        if (currentMatchIndex === -1 || allMatches.length === 0 || !replaceQuery) return;

        const match = allMatches[currentMatchIndex];
        const newContent =
            content.substring(0, match.start) +
            replaceQuery +
            content.substring(match.end);

        setContent(newContent);
        // Re-calculate matches after replacement
        setTimeout(() => updateMatches(), 0);
    }, [content, allMatches, currentMatchIndex, replaceQuery, setContent, updateMatches]);

    const replaceAll = useCallback(() => {
        if (allMatches.length === 0 || !replaceQuery) return;

        let newContent = content;
        // Iterate backwards to avoid issues with index shifts
        for (let i = allMatches.length - 1; i >= 0; i--) {
            const match = allMatches[i];
            newContent =
                newContent.substring(0, match.start) +
                replaceQuery +
                newContent.substring(match.end);
        }
        setContent(newContent);
        // All matches are gone, reset state
        setFindQuery('');
        setReplaceQuery('');
        setAllMatches([]);
        setCurrentMatchIndex(-1);
    }, [content, allMatches, replaceQuery, setContent]);


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
            onSelectionChange(selectionStart, selectionEnd); // Report new selection

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
    }, [content, onStatsChange, handleScroll, showCompletion, getCompletionPosition, onSelectionChange]);

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

        // Handle Ctrl/Cmd+F for find/replace toggle
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            onFindReplaceToggle();
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
                onSelectionChange(start + 2, start + 2); // Report new selection
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
                    const newCursorPos = Math.max(lineStart, start - 2);
                    e.currentTarget.selectionStart = e.currentTarget.selectionEnd = newCursorPos;
                    setSelectionStartFull(newCursorPos);
                    setSelectionEndFull(newCursorPos);
                    onSelectionChange(newCursorPos, newCursorPos); // Report new selection
                }, 0);
            }
        }
    };

    // FIX: Define a dedicated keydown handler for the find/replace input fields.
    // This handler will correctly type `e` as `React.KeyboardEvent<HTMLInputElement>`.
    const handleFindReplaceInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) {
                findPrevious();
            } else {
                findNext();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onFindReplaceToggle();
        }
    };

    // Auto-focus find input when widget opens
    useEffect(() => {
        if (isFindReplaceOpen) {
            setTimeout(() => findInputRef.current?.focus(), 100);
        }
    }, [isFindReplaceOpen]);

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

    const searchMatchesRelative = useMemo(() => {
        const offsetToRenderedStart = contentLines.slice(0, startRenderedLine).join('\n').length + (startRenderedLine > 0 ? 1 : 0);
        return allMatches
            .map(match => ({
                start: Math.max(0, match.start - offsetToRenderedStart),
                end: Math.max(0, match.end - offsetToRenderedStart),
            }))
            .filter(match => match.start < renderedContent.length && match.end > 0);
    }, [allMatches, startRenderedLine, contentLines, renderedContent.length]);

    const activeMatchIndexRelative = useMemo(() => {
        if (currentMatchIndex === -1 || allMatches.length === 0) return -1;
        const activeMatch = allMatches[currentMatchIndex];
        return searchMatchesRelative.findIndex(m => m.start === Math.max(0, activeMatch.start - (contentLines.slice(0, startRenderedLine).join('\n').length + (startRenderedLine > 0 ? 1 : 0))));
    }, [currentMatchIndex, allMatches, searchMatchesRelative, contentLines, startRenderedLine]);


    // Memoize the highlighted content, now including relative selection info
    const highlightedContent = useMemo(
        () => highlight(renderedContent + '\n', fileType, selectionStartRelative, selectionEndRelative, searchMatchesRelative, activeMatchIndexRelative),
        [renderedContent, fileType, selectionStartRelative, selectionEndRelative, searchMatchesRelative, activeMatchIndexRelative]
    );

    // Memoize line numbers for rendering
    const renderedLineNumbers = useMemo(() => {
        const lines = [];
        // Add an extra line number if content is empty or ends with a newline
        const effectiveTotalLines = totalLines === 0 || content.endsWith('\n') ? totalLines + 1 : totalLines;
        for (let i = startRenderedLine; i < Math.min(effectiveTotalLines, endRenderedLine); i++) {
            lines.push(i + 1);
        }
        return lines.map((num) => (
            <div key={num} className="h-[1.5em] flex items-center justify-end">{num}</div> // Ensure fixed height and right align for each line number
        ));
    }, [startRenderedLine, endRenderedLine, totalLines, content]);

    return (
        <div className="flex-1 flex relative bg-[#22241e] overflow-hidden">
            <div
                ref={linesRef}
                className="text-right text-slate-600 select-none pr-3 pt-2 text-xs overflow-y-hidden overflow-x-hidden" // Changed overflow to hidden for vertical axis
                style={{ lineHeight: '1.5em', fontSize: `${fontSize}px`, paddingTop: `${paddingTop}px`, paddingBottom: `${paddingBottom}px`, fontFamily: 'Fira Code, monospace', flexShrink: 0 }} // Ensure font consistency, prevent shrinking
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
                    className="absolute inset-0 w-full h-full p-2 font-mono text-xs leading-normal pointer-events-none overflow-y-hidden whitespace-pre" // Changed overflow-x-hidden to whitespace-pre
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

                {isFindReplaceOpen && (
                    <div className="absolute top-2 right-2 bg-[#2e3026] border border-[#03DAC6] rounded shadow-lg p-2 flex flex-col gap-1.5 z-50">
                        <div className="flex items-center gap-2">
                            <input
                                ref={findInputRef}
                                type="text"
                                placeholder="Find"
                                value={findQuery}
                                onChange={(e) => setFindQuery(e.target.value)}
                                // FIX: Use the dedicated keydown handler for input fields.
                                onKeyDown={handleFindReplaceInputKeyDown}
                                className="bg-[#22241e] text-[#f0f0e0] text-xs p-1 rounded border border-[#999966] focus:outline-none focus:ring-1 focus:ring-[#03DAC6] w-32"
                                style={{ fontFamily: 'Fira Code, monospace' }}
                            />
                            <button
                                onClick={findPrevious}
                                title="Previous Match (Shift+Enter)"
                                className="bg-gray-700 hover:bg-gray-600 text-white text-xs p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={allMatches.length === 0}
                            >
                                ▲
                            </button>
                            <button
                                onClick={findNext}
                                title="Next Match (Enter)"
                                className="bg-gray-700 hover:bg-gray-600 text-white text-xs p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={allMatches.length === 0}
                            >
                                ▼
                            </button>
                            <span className="text-xs text-gray-400">{currentMatchIndex + 1}/{allMatches.length}</span>
                            <button
                                onClick={onFindReplaceToggle}
                                className="text-gray-400 hover:text-red-500 text-lg ml-1"
                                title="Close"
                            >
                                &times;
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Replace"
                                value={replaceQuery}
                                onChange={(e) => setReplaceQuery(e.target.value)}
                                // FIX: Use the dedicated keydown handler for input fields.
                                onKeyDown={handleFindReplaceInputKeyDown}
                                className="bg-[#22241e] text-[#f0f0e0] text-xs p-1 rounded border border-[#999966] focus:outline-none focus:ring-1 focus:ring-[#03DAC6] w-32"
                                style={{ fontFamily: 'Fira Code, monospace' }}
                            />
                            <button
                                onClick={replaceCurrent}
                                title="Replace Current Match"
                                className="bg-[#03DAC6] hover:bg-[#03a99e] text-black text-xs px-2 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={currentMatchIndex === -1 || !replaceQuery}
                            >
                                Replace
                            </button>
                            <button
                                onClick={replaceAll}
                                title="Replace All Matches"
                                className="bg-[#BB86FC] hover:bg-[#a082f0] text-black text-xs px-2 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={allMatches.length === 0 || !replaceQuery}
                            >
                                All
                            </button>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={caseSensitive}
                                    onChange={(e) => setCaseSensitive(e.target.checked)}
                                    className="w-3 h-3 bg-[#22241e] border-[#999966] rounded text-[#03DAC6] focus:ring-0"
                                />
                                <span className="ml-1">Aa</span>
                            </label>
                            {/* Regex option currently deferred */}
                            {/* <label className="flex items-center cursor-pointer opacity-50">
                                <input
                                    type="checkbox"
                                    checked={useRegex}
                                    onChange={(e) => setUseRegex(e.target.checked)}
                                    className="w-3 h-3 bg-[#22241e] border-[#999966] rounded text-[#03DAC6] focus:ring-0"
                                    disabled
                                />
                                <span className="ml-1">.*</span>
                            </label> */}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};