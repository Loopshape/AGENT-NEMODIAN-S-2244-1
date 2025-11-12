// components/CodeSnippetsPanel.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { CodeSnippet } from '../types';
import { highlightBasic, escapeHtml } from '../utils/highlighter';

interface CodeSnippetsPanelProps {
    snippets: CodeSnippet[];
    onAddSnippet: (title: string, code: string) => void;
    onUpdateSnippet: (id: string, newTitle: string, newCode: string) => void;
    onDeleteSnippet: (id: string) => void;
    onInsertSnippet: (code: string) => void;
    editorFontSize: number;
}

export const CodeSnippetsPanel: React.FC<CodeSnippetsPanelProps> = ({
    snippets,
    onAddSnippet,
    onUpdateSnippet,
    onDeleteSnippet,
    onInsertSnippet,
    editorFontSize,
}) => {
    const [newSnippetTitle, setNewSnippetTitle] = useState('');
    const [newSnippetCode, setNewSnippetCode] = useState('');
    const [editingSnippetId, setEditingSnippetId] = useState<string | null>(null);
    const [editedSnippetTitle, setEditedSnippetTitle] = useState('');
    const [editedSnippetCode, setEditedSnippetCode] = useState('');

    const newSnippetCodeRef = useRef<HTMLTextAreaElement>(null);
    const editedSnippetCodeRef = useRef<HTMLTextAreaElement>(null);

    const handleAdd = () => {
        if (newSnippetTitle.trim() && newSnippetCode.trim()) {
            onAddSnippet(newSnippetTitle.trim(), newSnippetCode.trim());
            setNewSnippetTitle('');
            setNewSnippetCode('');
        }
    };

    const handleEdit = (snippet: CodeSnippet) => {
        setEditingSnippetId(snippet.id);
        setEditedSnippetTitle(snippet.title);
        setEditedSnippetCode(snippet.code);
        setTimeout(() => editedSnippetCodeRef.current?.focus(), 50); // Focus after render
    };

    const handleSaveEdit = () => {
        if (editingSnippetId && editedSnippetTitle.trim() && editedSnippetCode.trim()) {
            onUpdateSnippet(editingSnippetId, editedSnippetTitle.trim(), editedSnippetCode.trim());
            setEditingSnippetId(null);
            setEditedSnippetTitle('');
            setEditedSnippetCode('');
        }
    };

    const handleCancelEdit = () => {
        setEditingSnippetId(null);
        setEditedSnippetTitle('');
        setEditedSnippetCode('');
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this snippet?')) {
            onDeleteSnippet(id);
        }
    };

    const handleCopy = useCallback((code: string) => {
        navigator.clipboard.writeText(code)
            .then(() => {
                // Optional: show a small toast notification for copy success
                console.log('Snippet copied to clipboard!');
            })
            .catch(err => {
                console.error('Failed to copy snippet: ', err);
            });
    }, []);

    // Adjust textarea height dynamically
    useEffect(() => {
        const adjustHeight = (ref: React.RefObject<HTMLTextAreaElement>) => {
            if (ref.current) {
                ref.current.style.height = 'auto';
                ref.current.style.height = `${ref.current.scrollHeight}px`;
            }
        };

        adjustHeight(newSnippetCodeRef);
        if (editingSnippetId) {
            adjustHeight(editedSnippetCodeRef);
        }
    }, [newSnippetCode, editedSnippetCode, editingSnippetId]);


    return (
        <div className="flex flex-col gap-3 pt-1 text-xs text-[#999966]">
            {/* Add New Snippet Form */}
            <div className="bg-black/20 p-2 rounded border border-white/10 flex flex-col gap-2">
                <input
                    type="text"
                    placeholder="Snippet Title"
                    value={newSnippetTitle}
                    onChange={(e) => setNewSnippetTitle(e.target.value)}
                    className="w-full p-1 bg-[#22241e] text-[#f0f0e0] border border-[#999966] rounded focus:outline-none focus:ring-1 focus:ring-[#BB86FC]"
                    style={{ fontFamily: 'Fira Code, monospace' }}
                    aria-label="New snippet title"
                />
                <div className="relative">
                    <textarea
                        ref={newSnippetCodeRef}
                        placeholder="Code content..."
                        value={newSnippetCode}
                        onChange={(e) => setNewSnippetCode(e.target.value)}
                        className="w-full p-1 bg-[#22241e] text-transparent caret-white font-mono border border-[#999966] rounded focus:outline-none focus:ring-1 focus:ring-[#BB86FC] resize-none overflow-hidden min-h-[4em]"
                        style={{ fontFamily: 'Fira Code, monospace', fontSize: `${editorFontSize * 0.9}px`, lineHeight: '1.5em' }}
                        spellCheck="false"
                        aria-label="New snippet code content"
                    />
                     <pre
                        className="absolute top-0 left-0 w-full p-1 font-mono pointer-events-none text-[#f0f0e0] overflow-hidden whitespace-pre-wrap"
                        aria-hidden="true"
                        style={{ fontFamily: 'Fira Code, monospace', fontSize: `${editorFontSize * 0.9}px`, lineHeight: '1.5em', minHeight: '4em', maxHeight: `${newSnippetCodeRef.current?.scrollHeight || 0}px` }}
                    >
                        <code dangerouslySetInnerHTML={{ __html: highlightBasic(newSnippetCode, 'js') }} />
                    </pre>
                </div>
                <button
                    onClick={handleAdd}
                    disabled={!newSnippetTitle.trim() || !newSnippetCode.trim()}
                    className="bg-[#BB86FC] hover:bg-[#a082f0] text-white px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Add Snippet
                </button>
            </div>

            {/* Snippets List */}
            {snippets.length > 0 ? (
                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                    {snippets.map((snippet) => (
                        <div key={snippet.id} className="bg-black/20 p-2 rounded border border-white/10 flex flex-col gap-1">
                            {editingSnippetId === snippet.id ? (
                                <>
                                    <input
                                        type="text"
                                        value={editedSnippetTitle}
                                        onChange={(e) => setEditedSnippetTitle(e.target.value)}
                                        className="w-full p-1 bg-[#22241e] text-[#f0f0e0] border border-[#999966] rounded focus:outline-none focus:ring-1 focus:ring-[#BB86FC]"
                                        style={{ fontFamily: 'Fira Code, monospace' }}
                                        aria-label={`Edit title for ${snippet.title}`}
                                    />
                                    <div className="relative">
                                        <textarea
                                            ref={editedSnippetCodeRef}
                                            value={editedSnippetCode}
                                            onChange={(e) => setEditedSnippetCode(e.target.value)}
                                            className="w-full p-1 bg-[#22241e] text-transparent caret-white font-mono border border-[#999966] rounded focus:outline-none focus:ring-1 focus:ring-[#BB86FC] resize-none overflow-hidden min-h-[4em]"
                                            style={{ fontFamily: 'Fira Code, monospace', fontSize: `${editorFontSize * 0.9}px`, lineHeight: '1.5em' }}
                                            spellCheck="false"
                                            aria-label={`Edit code for ${snippet.title}`}
                                        />
                                        <pre
                                            className="absolute top-0 left-0 w-full p-1 font-mono pointer-events-none text-[#f0f0e0] overflow-hidden whitespace-pre-wrap"
                                            aria-hidden="true"
                                            style={{ fontFamily: 'Fira Code, monospace', fontSize: `${editorFontSize * 0.9}px`, lineHeight: '1.5em', minHeight: '4em', maxHeight: `${editedSnippetCodeRef.current?.scrollHeight || 0}px` }}
                                        >
                                            <code dangerouslySetInnerHTML={{ __html: highlightBasic(editedSnippetCode, 'js') }} />
                                        </pre>
                                    </div>
                                    <div className="flex gap-1 mt-1">
                                        <button
                                            onClick={handleSaveEdit}
                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded transition-colors"
                                            disabled={!editedSnippetTitle.trim() || !editedSnippetCode.trim()}
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={handleCancelEdit}
                                            className="flex-1 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="font-bold text-[#f0f0e0]">{snippet.title}</div>
                                    <div className="relative">
                                        <pre
                                            className="w-full p-1 bg-[#22241e] text-[#f0f0e0] font-mono border border-[#999966] rounded overflow-x-auto whitespace-pre-wrap text-ellipsis max-h-16"
                                            style={{ fontFamily: 'Fira Code, monospace', fontSize: `${editorFontSize * 0.8}px` }}
                                        >
                                            <code dangerouslySetInnerHTML={{ __html: highlightBasic(snippet.code, 'js') }} />
                                        </pre>
                                    </div>
                                    <div className="flex justify-end gap-1 mt-1">
                                        <button
                                            onClick={() => handleCopy(snippet.code)}
                                            className="bg-[#03DAC6] hover:bg-[#03a99e] text-black px-2 py-1 rounded transition-colors"
                                        >
                                            Copy
                                        </button>
                                        <button
                                            onClick={() => onInsertSnippet(snippet.code)}
                                            className="bg-[#4ac94a] hover:bg-green-400 text-white px-2 py-1 rounded transition-colors"
                                        >
                                            Insert
                                        </button>
                                        <button
                                            onClick={() => handleEdit(snippet)}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition-colors"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(snippet.id)}
                                            className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-gray-500 text-center mt-4">No snippets added yet.</p>
            )}
        </div>
    );
};