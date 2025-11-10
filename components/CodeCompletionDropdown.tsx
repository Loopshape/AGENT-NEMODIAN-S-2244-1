// components/CodeCompletionDropdown.tsx
import React, { useRef, useEffect } from 'react';

interface CodeCompletionDropdownProps {
    suggestions: string[];
    selectedSuggestionIndex: number;
    position: { top: number; left: number }; // Pixel position relative to parent
    onSelect: (suggestion: string) => void;
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
            className="absolute bg-[#313328] border border-[#4ac94a] rounded-md shadow-lg max-h-60 overflow-y-auto z-50 p-1"
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`,
                fontSize: `${fontSize}px`,
                minWidth: '200px',
                pointerEvents: 'auto', // Ensure it's interactive
            }}
            role="listbox"
            aria-label="Code Completion Suggestions"
        >
            {suggestions.map((suggestion, index) => (
                <div
                    key={index}
                    className={`px-3 py-1 cursor-pointer text-[#f0f0e0] hover:bg-[#4ac94a]/30 rounded ${
                        index === selectedSuggestionIndex ? 'bg-[#4ac94a]/50' : ''
                    }`}
                    onClick={() => onSelect(suggestion)}
                    role="option"
                    aria-selected={index === selectedSuggestionIndex}
                    id={`completion-option-${index}`}
                >
                    {suggestion}
                </div>
            ))}
        </div>
    );
};