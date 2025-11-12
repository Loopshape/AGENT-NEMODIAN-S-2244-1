// components/CodeCompletionDropdown.tsx
import React, { useRef, useEffect } from 'react';
import { CompletionSuggestion } from '../services/geminiService'; // Import the new type

interface CodeCompletionDropdownProps {
    suggestions: CompletionSuggestion[]; // Updated type
    selectedSuggestionIndex: number;
    position: { top: number; left: number }; // Pixel position relative to parent
    onSelect: (suggestion: string) => void; // Still returns just the suggestion string
    onClose: () => void;
    fontSize: number;
}

export const CodeCompletionDropdown: React.FC<CodeCompletionDropdownProps> = ({
    suggestions,
    selectedSuggestionIndex,
    position,
    onSelect,
    onClose,
    fontSize,
}) => {
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        // Add a small delay to avoid immediately closing if triggered by a click
        const timeoutId = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [onClose]);

    // Scroll selected item into view
    useEffect(() => {
        if (dropdownRef.current) {
            const selectedItem = dropdownRef.current.children[selectedSuggestionIndex] as HTMLElement;
            if (selectedItem) {
                selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [selectedSuggestionIndex]);


    if (suggestions.length === 0) {
        return null;
    }

    return (
        <div
            ref={dropdownRef}
            className="absolute bg-panel border border-accent rounded-md shadow-lg max-h-60 overflow-y-auto z-50 p-1 custom-scrollbar"
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                fontSize: `${fontSize}px`,
                minWidth: '250px',
                pointerEvents: 'auto', // Ensure it's interactive
                fontFamily: 'Fira Code, monospace', // Ensure font consistency
                boxShadow: '0 4px 15px rgba(0,0,0,0.3), 0 0 10px rgba(6, 182, 212, 0.3)',
            }}
            role="listbox"
            aria-label="Code Completion Suggestions"
        >
            {suggestions.map((item, index) => (
                <div
                    key={index}
                    className={`px-3 py-1.5 cursor-pointer text-white hover:bg-accent/30 rounded ${
                        index === selectedSuggestionIndex ? 'bg-accent/50' : ''
                    }`}
                    onClick={() => onSelect(item.suggestion)} // Pass only the suggestion string
                    role="option"
                    aria-selected={index === selectedSuggestionIndex}
                    id={`completion-option-${index}`}
                >
                    <div className="font-bold text-white/90" style={{ whiteSpace: 'pre-wrap' }}>{item.suggestion}</div>
                    {item.documentation && (
                        <div className="text-xs text-slate-400 font-normal mt-1 p-1 bg-black/20 rounded" style={{ fontSize: `${fontSize * 0.8}px`, whiteSpace: 'pre-wrap' }}>
                            {item.documentation}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};