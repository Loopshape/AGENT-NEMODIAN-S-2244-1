

import React, { useState, useRef, useEffect } from 'react';
// FIX: Import `FolderNode` and `CodeSnippet` to resolve type errors in FileExplorer components and for new snippet props.
import type { OrchestratorSettings, EditorStats, TerminalLine, FileSystemNode, FolderNode, GroundingChunk, CodeSnippet } from '../types';
import { typeToClassMap, tokenize, escapeHtml, highlightBasic } from '../utils/highlighter'; // Import shared highlighter utilities
import { CodeSnippetsPanel } from './CodeSnippetsPanel'; // Import new CodeSnippetsPanel component

interface HeaderProps {
    onToggleLeftPanel: () => void;
    onTogglePreview: () => void;
    isPreviewing: boolean;
    onRunAI: () => void;
    onRunOrchestrator: () => void;
    onLoadScript: () => void; // Renamed from onShowHtmlSingleFile
    onFixCode: () => void;
    onGenerateCode: () => void; // New prop for AI Generate Code
    onFindReplaceToggle: () => void; // New prop for Find/Replace
    onSaveFile: () => void; // New prop for saving the current file
}

/**
 * Renders the main application header.
 * Provides primary actions like file operations and invoking AI features.
 * @param {HeaderProps} props - The component props.
 * @param {() => void} props.onToggleLeftPanel - Toggles the visibility of the left sidebar.
 * @param {() => void} props.onTogglePreview - Toggles the live HTML preview panel.
 * @param {boolean} props.isPreviewing - Indicates if the live preview is active.
 * @param {() => void} props.onRunAI - Opens the prompt modal for a single Quantum AI run.
 * @param {() => void} props.onRunOrchestrator - Opens the prompt modal for a Multi-Agent Consensus run.
 * @param {() => void} props.onLoadScript - Triggers a file selection dialog to load a script.
 * @param {() => void} props.onFixCode - Initiates an AI-driven quick code fix.
 * @param {() => void} props.onGenerateCode - Opens the modal for AI code generation.
 * @param {() => void} props.onFindReplaceToggle - Toggles the Find/Replace widget.
 * @param {() => void} props.onSaveFile - Saves the current editor content to the active file.
 * @returns {React.ReactElement} The rendered header component.
 */
export const Header: React.FC<HeaderProps> = (props) => (
    <header className="bg-[#2e3026] border-b border-[#22241e] flex items-center justify-between px-3 py-1.5 relative overflow-hidden quantum-scan">
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
                onClick={props.onLoadScript} // Use new prop
                className="bg-[#f0ad4e] border-[#f0ad4e] text-[#3a3c31] hover:bg-yellow-400 text-xs px-2 py-1.5 rounded transition-colors"
            >
                Load Script
            </button>
            <button
                onClick={props.onSaveFile} // New button for saving the current file
                className="bg-[#60A5FA] hover:bg-[#3B82F6] text-white text-xs px-2 py-1.5 rounded transition-colors"
            >
                Save
            </button>
            <button
                onClick={props.onGenerateCode} // New button for AI Generate Code
                className="bg-[#BB86FC] hover:bg-[#a082f0] text-xs px-2 py-1.5 rounded transition-colors"
            >
                AI Generate Code
            </button>
            <button
                onClick={props.onFixCode}
                className="bg-[#673AB7] hover:bg-[#855CCB] text-xs px-2 py-1.5 rounded transition-colors"
            >
                AI Fix Code
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
            <button
                onClick={props.onFindReplaceToggle} // New button for Find/Replace
                className="bg-[#03DAC6] hover:bg-[#03a99e] text-xs px-2 py-1.5 rounded transition-colors"
            >
                Find/Replace
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
        className="bg-[#22241e] flex justify-between items-center px-3 text-xs h-[1.5em] relative"
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
        <div>{fileName || 'No File Open'}</div>
        <div>{`Cursor: ${stats.cursor} | Lines: ${stats.lines} | Chars: ${stats.chars} | History: ${stats.history}`}</div>
    </div>
);

// --- START: File Explorer Components ---

interface FileExplorerProps {
    fileSystem: FolderNode;
    activePath: string | null;
    onOpenFile: (path: string) => void;
    onCreateFile: (path: string) => void;
    onCreateFolder: (path: string) => void;
    onRename: (path: string, newName: string) => void;
    onDelete: (path: string) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = (props) => {
    return (
        <div className="text-xs text-[#999966] font-mono">
            <FileTree {...props} node={props.fileSystem} path="" depth={0} />
        </div>
    );
};

const FileTree: React.FC<FileExplorerProps & { node: FolderNode; path: string; depth: number }> = ({
    node,
    path,
    depth,
    ...rest
}) => {
    // FIX: Explicitly type sort callback parameters to resolve type inference issue.
    const sortedChildren = Object.entries(node.children).sort(([aName, aNode]: [string, FileSystemNode], [bName, bNode]: [string, FileSystemNode]) => {
        if (aNode.type === 'folder' && bNode.type === 'file') return -1;
        if (aNode.type === 'file' && bNode.type === 'folder') return 1;
        return aName.localeCompare(bName);
    });

    return (
        <div>
            {sortedChildren.map(([name, childNode]) => (
                <FileTreeItem
                    key={name}
                    name={name}
                    node={childNode}
                    path={`${path}/${name}`}
                    depth={depth}
                    {...rest}
                />
            ))}
        </div>
    );
};

const FileTreeItem: React.FC<
    FileExplorerProps & { name: string; node: FileSystemNode; path: string; depth: number }
> = ({ name, node, path, depth, onOpenFile, activePath, ...rest }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [newName, setNewName] = useState(name);
    const renameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isRenaming) {
            renameInputRef.current?.focus();
            renameInputRef.current?.select();
        }
    }, [isRenaming]);

    const handleRenameSubmit = () => {
        if (newName.trim() && newName.trim() !== name) {
            rest.onRename(path, newName.trim());
        }
        setIsRenaming(false);
    };

    const isFolder = node.type === 'folder';
    const isActive = activePath === path;

    const ActionButton: React.FC<{ title: string; onClick: () => void; children: React.ReactNode }> = ({
        title,
        onClick,
        children,
    }) => (
        <button
            title={title}
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 text-gray-400 hover:text-white"
        >
            {children}
        </button>
    );

    return (
        <div>
            <div
                onClick={() => (isFolder ? setIsExpanded(!isExpanded) : onOpenFile(path))}
                className={`flex items-center justify-between group p-1 rounded cursor-pointer ${
                    isActive ? 'bg-[#4ac94a]/30' : 'hover:bg-white/10'
                }`}
                style={{ paddingLeft: `${depth * 12 + 4}px` }}
            >
                <div className="flex items-center gap-1.5 truncate">
                    {isFolder ? (
                        <span className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                    ) : (
                        <svg className="w-3 h-3 text-[#999966]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                    )}
                    {isRenaming ? (
                        <input
                            ref={renameInputRef}
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onBlur={handleRenameSubmit}
                            onKeyDown={(e) => e.key === 'Enter' && handleRenameSubmit()}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-[#22241e] text-white p-0 m-0 border border-[#999966] rounded h-5 text-xs w-full"
                            style={{ fontFamily: 'Fira Code, monospace' }} // Ensure font consistency
                        />
                    ) : (
                        <span className="truncate">{name}</span>
                    )}
                </div>

                {!isRenaming && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isFolder && ( // Show "Open" button only for files
                            <ActionButton title="Open File" onClick={() => onOpenFile(path)}>
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            </ActionButton>
                        )}
                        {isFolder && (
                            <>
                                <ActionButton title="New File" onClick={() => rest.onCreateFile(path)}>
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                        <polyline points="14 2 14 8 20 8"></polyline>
                                        <line x1="12" y1="18" x2="12" y2="12"></line>
                                        <line x1="9" y1="15" x2="15" y2="15"></line>
                                    </svg>
                                </ActionButton>
                                <ActionButton title="New Folder" onClick={() => rest.onCreateFolder(path)}>
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                                        <line x1="12" y1="10" x2="12" y2="16"></line>
                                        <line x1="9" y1="13" x2="15" y2="13"></line>
                                    </svg>
                                </ActionButton>
                            </>
                        )}
                        <ActionButton title="Rename" onClick={() => setIsRenaming(true)}>
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </ActionButton>
                        <ActionButton title="Delete" onClick={() => rest.onDelete(path)}>
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                        </ActionButton>
                    </div>
                )}
            </div>
            {/* FIX: Pass `activePath` and `onOpenFile` to the recursive `FileTree` call. */}
            {isFolder && isExpanded && <FileTree node={node as FolderNode} path={path} depth={depth + 1} {...rest} onOpenFile={onOpenFile} activePath={activePath} />}
        </div>
    );
};
// --- END: File Explorer Components ---

// --- START: Accordion Component ---
const Accordion: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({
    title,
    children,
    defaultOpen = false,
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="text-xs text-[#999966] border-b border-[#22241e]">
            <button
                onClick={() => setIsOpen((prev) => !prev)}
                className="font-bold w-full text-left flex justify-between items-center p-2 rounded hover:bg-white/5"
            >
                <span>{title}</span>
                <span className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
                    ▶
                </span>
            </button>
            {isOpen && <div className="p-2 pt-0">{children}</div>}
        </div>
    );
};
// --- END: Accordion Component ---

interface LeftPanelProps extends FileExplorerProps {
    isOpen: boolean;
    settings: OrchestratorSettings;
    onSettingsChange: (newSettings: OrchestratorSettings) => void;
    onUndo: () => void;
    onRedo: () => void;
    onQuickAction: (action: 'optimize' | 'document' | 'refactor' | 'beautify') => void; // Added 'beautify'
    onAnalyzeSelection: () => void; // New prop for Analyze Selection
    onRunOrchestrator: () => void;
    history: string[];
    historyIndex: number;
    onRevertToState: (index: number) => void;
    editorFontSize: number;
    onFontSizeChange: (size: number) => void;
    onSaveDraft: () => void;
    onLoadDraft: () => void;
    onCodeReview: () => void;
    onFixCode: () => void;
    onGenerateCode: () => void; // New prop for AI Generate Code
    // FIX: Add props related to code snippets.
    codeSnippets: CodeSnippet[];
    onAddSnippet: (title: string, code: string) => void;
    onUpdateSnippet: (id: string, newTitle: string, newCode: string) => void;
    onDeleteSnippet: (id: string) => void;
    onInsertSnippet: (code: string) => void;
}

/**
 * Renders the collapsible left panel containing quick actions, settings, and editor history.
 * @param {LeftPanelProps} props - The component props.
 * @returns {React.ReactElement} The rendered left panel component.
 */
export const LeftPanel: React.FC<LeftPanelProps> = (props) => {
    const {
        isOpen,
        settings,
        onSettingsChange,
        onUndo,
        onRedo,
        onQuickAction,
        onAnalyzeSelection, // Destructure new prop
        onRunOrchestrator,
        history,
        historyIndex,
        onRevertToState,
        editorFontSize,
        onFontSizeChange,
        onSaveDraft,
        onLoadDraft,
        onCodeReview,
        onFixCode,
        onGenerateCode, // Destructure new prop
        fileSystem,
        activePath,
        onOpenFile,
        onCreateFile,
        onCreateFolder,
        onRename,
        onDelete,
        codeSnippets, // Destructure new prop
        onAddSnippet, // Destructure new prop
        onUpdateSnippet, // Destructure new prop
        onDeleteSnippet, // Destructure new prop
        onInsertSnippet, // Destructure new prop
    } = props;

    // Determine if undo/redo buttons should be disabled
    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;

    return (
        <aside
            className={`bg-[#313328] border-r border-[#22241e] flex flex-col w-60 transition-all duration-300 overflow-y-auto ${
                isOpen ? 'ml-0' : '-ml-60'
            }`}
        >
            <Accordion title="File Explorer" defaultOpen>
                <FileExplorer
                    fileSystem={fileSystem}
                    activePath={activePath}
                    onOpenFile={onOpenFile}
                    onCreateFile={onCreateFile}
                    onCreateFolder={onCreateFolder}
                    onRename={onRename}
                    onDelete={onDelete}
                />
            </Accordion>

            <Accordion title="Quantum Actions">
                <div className="flex flex-col gap-1 pt-1">
                    <button
                        onClick={onUndo}
                        disabled={!canUndo}
                        className={`bg-[#a03333] text-white text-xs w-full text-left p-1.5 rounded transition-colors ${
                            canUndo ? 'hover:bg-[#3366a0]' : 'opacity-50 cursor-not-allowed'
                        }`}
                    >
                        UNDO
                    </button>
                    <button
                        onClick={onRedo}
                        disabled={!canRedo}
                        className={`bg-[#a03333] text-white text-xs w-full text-left p-1.5 rounded transition-colors ${
                            canRedo ? 'hover:bg-[#3366a0]' : 'opacity-50 cursor-not-allowed'
                        }`}
                    >
                        REDO
                    </button>
                    <button
                        onClick={() => onQuickAction('beautify')} // Beautify button
                        className="bg-[#2196F3] hover:bg-blue-600 text-white text-xs w-full text-left mt-2 p-1.5 rounded"
                    >
                        Beautify Code
                    </button>
                    <button
                        onClick={onGenerateCode} // New button for AI Generate Code
                        className="bg-[#BB86FC] hover:bg-[#a082f0] text-white text-xs w-full text-left p-1.5 rounded"
                    >
                        AI Generate Code
                    </button>
                    <button
                        onClick={onFixCode}
                        className="bg-[#673AB7] hover:bg-[#855CCB] text-white text-xs w-full text-left p-1.5 rounded"
                    >
                        AI Fix Code
                    </button>
                    <button
                        onClick={() => onQuickAction('optimize')}
                        className="bg-[#a03333] hover:bg-[#3366a0] text-white text-xs w-full text-left p-1.5 rounded"
                    >
                        Quantum Optimize
                    </button>
                    <button
                        onClick={() => onQuickAction('document')}
                        className="bg-[#a03333] hover:bg-[#3366a0] text-white text-xs w-full text-left p-1.5 rounded"
                    >
                        Fractal Document
                    </button>
                    <button
                        onClick={() => onQuickAction('refactor')}
                        className="bg-[#a03333] hover:bg-[#3366a0] text-white text-xs w-full text-left p-1.5 rounded"
                    >
                        Hyper Refactor
                    </button>
                    <button
                        onClick={onCodeReview}
                        className="bg-[#a033a0] hover:bg-[#6c236c] text-white text-xs w-full text-left p-1.5 rounded"
                    >
                        AI Code Review
                    </button>
                    <button
                        onClick={onAnalyzeSelection} // New button for Analyze Selection
                        className="bg-[#5bc0de] hover:bg-cyan-400 text-white text-xs w-full text-left p-1.5 rounded"
                    >
                        Analyze Selection
                    </button>
                    <button
                        onClick={onRunOrchestrator}
                        className="bg-[#4ac94a] hover:bg-green-400 text-white text-xs w-full text-left p-1.5 rounded"
                    >
                        Multi-Agent Consensus
                    </button>
                </div>
            </Accordion>

            <Accordion title="Local Drafts">
                <div className="flex flex-col gap-1 pt-1">
                    <button
                        onClick={onSaveDraft}
                        className="bg-[#f0ad4e] hover:bg-yellow-400 text-white text-xs w-full text-left p-1.5 rounded"
                    >
                        Save Draft
                    </button>
                    <button
                        onClick={onLoadDraft}
                        className="bg-[#f0ad4e] hover:bg-yellow-400 text-white text-xs w-full text-left p-1.5 rounded"
                    >
                        Load Draft
                    </button>
                </div>
            </Accordion>

            <Accordion title="Code Snippets">
                <CodeSnippetsPanel
                    snippets={codeSnippets}
                    onAddSnippet={onAddSnippet}
                    onUpdateSnippet={onUpdateSnippet}
                    onDeleteSnippet={onDeleteSnippet}
                    onInsertSnippet={onInsertSnippet}
                    editorFontSize={editorFontSize} // Pass font size for consistent snippet display
                />
            </Accordion>

            <Accordion title="Orchestrator Settings">
                <div className="pt-1">
                    <div className="mt-1">
                        <label htmlFor="agent-count">Agent Count:</label>
                        <input
                            type="number"
                            id="agent-count"
                            min="2"
                            max="8"
                            value={settings.agentCount}
                            onChange={(e) =>
                                onSettingsChange({ ...settings, agentCount: parseInt(e.target.value) })
                            }
                            className="w-16 ml-2 bg-[#22241e] text-white border border-[#999966] p-0.5 rounded"
                            style={{ fontFamily: 'Fira Code, monospace' }} // Ensure font consistency
                        />
                    </div>
                    <div className="mt-1">
                        <label htmlFor="max-rounds">Max Rounds:</label>
                        <input
                            type="number"
                            id="max-rounds"
                            min="1"
                            max="10"
                            value={settings.maxRounds}
                            onChange={(e) =>
                                onSettingsChange({ ...settings, maxRounds: parseInt(e.target.value) })
                            }
                            className="w-16 ml-2 bg-[#22241e] text-white border border-[#999966] p-0.5 rounded"
                            style={{ fontFamily: 'Fira Code, monospace' }} // Ensure font consistency
                        />
                    </div>
                </div>
            </Accordion>

            <Accordion title="Editor Settings">
                <div className="pt-1">
                    <div className="mt-1 flex items-center justify-between">
                        <label htmlFor="font-size">Font Size (px):</label>
                        <input
                            type="number"
                            id="font-size"
                            min="8"
                            max="24"
                            value={editorFontSize}
                            onChange={(e) => onFontSizeChange(parseInt(e.target.value, 10))}
                            className="w-16 ml-2 bg-[#22241e] text-white border border-[#999966] p-0.5 rounded"
                            style={{ fontFamily: 'Fira Code, monospace' }} // Ensure font consistency
                        />
                    </div>
                </div>
            </Accordion>

            <Accordion title="Editor History">
                <div className="max-h-48 overflow-y-auto pr-1 border-l-2 border-gray-700 pl-2">
                    {history
                        .map((content, index) => (
                            <button
                                key={index}
                                onClick={() => onRevertToState(index)}
                                title={content}
                                className={`w-full text-left p-1 rounded text-xs mt-1 truncate transition-colors ${
                                    historyIndex === index
                                        ? 'bg-[#4ac94a]/30 text-white font-semibold'
                                        : 'bg-[#22241e]/50 hover:bg-[#a03333]'
                                }`}
                                style={{ fontFamily: 'Fira Code, monospace' }} // Ensure font consistency
                            >
                                State {index + 1}: {content.substring(0, 30).replace(/\s+/g, ' ')}...
                            </button>
                        ))
                        .reverse()}
                </div>
            </Accordion>
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
    <footer className="flex items-center justify-between px-3 py-1.5 bg-[#2e3026] border-t border-[#22241e]">
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
 * Renders a floating, draggable, and resizable panel to show a live preview of HTML content.
 * The content is sandboxed and loaded via the `srcDoc` attribute for security and live updates.
 * @param {PreviewPanelProps} props - The component props.
 * @param {string} props.htmlContent - The HTML string to be rendered in the iframe.
 * @param {() => void} props.onClose - Callback to close the preview panel.
 * @returns {React.ReactElement} The rendered preview panel.
 */
export const PreviewPanel: React.FC<PreviewPanelProps> = ({ htmlContent, onClose }) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Center panel on initial render
        const initialWidth = window.innerWidth * 0.92;
        const initialHeight = window.innerHeight * 0.88;
        setSize({ width: initialWidth, height: initialHeight });
        setPosition({
            x: (window.innerWidth - initialWidth) / 2,
            y: (window.innerHeight - initialHeight) / 2,
        });
    }, []);

    const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isResizing) return;
        setIsDragging(true);
        const panel = panelRef.current;
        if (panel) {
            const initialX = e.clientX - panel.offsetLeft;
            const initialY = e.clientY - panel.offsetTop;

            const handleDragMove = (moveEvent: MouseEvent) => {
                setPosition({
                    x: moveEvent.clientX - initialX,
                    y: moveEvent.clientY - initialY,
                });
            };

            const handleDragEnd = () => {
                window.removeEventListener('mousemove', handleDragMove);
                window.removeEventListener('mouseup', handleDragEnd);
                setIsDragging(false);
            };

            window.addEventListener('mousemove', handleDragMove);
            window.addEventListener('mouseup', handleDragEnd); // FIX: Ensure handleDragEnd is only added once.
        }
    };

    const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        setIsResizing(true);
        const panel = panelRef.current;
        if (panel) {
            const initialWidth = panel.offsetWidth;
            const initialHeight = panel.offsetHeight;
            const initialMouseX = e.clientX;
            const initialMouseY = e.clientY;

            const handleResizeMove = (moveEvent: MouseEvent) => {
                const dx = moveEvent.clientX - initialMouseX;
                const dy = moveEvent.clientY - initialMouseY;
                setSize({
                    width: Math.max(300, initialWidth + dx), // min width
                    height: Math.max(200, initialHeight + dy), // min height
                });
            };

            // FIX: Define handleResizeEnd locally to correctly manage resize events.
            const handleResizeEnd = () => {
                window.removeEventListener('mousemove', handleResizeMove);
                window.removeEventListener('mouseup', handleResizeEnd);
                setIsResizing(false);
            };

            window.addEventListener('mousemove', handleResizeMove);
            window.addEventListener('mouseup', handleResizeEnd); // FIX: Ensure handleResizeEnd is only added once.
        }
    };

    return (
        <div
            ref={panelRef}
            style={{
                position: 'fixed',
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: `${size.width}px`,
                height: `${size.height}px`,
                zIndex: 100,
            }}
            className="flex flex-col bg-white border-2 border-[#4ac94a] shadow-2xl rounded-lg overflow-hidden"
        >
            <div
                onMouseDown={handleDragStart}
                className="bg-[#2e3026] text-[#f0f0e0] p-2 flex justify-between items-center border-b border-[#4ac94a] flex-shrink-0 cursor-move"
            >
                <span className="font-bold">Live Preview</span>
                <button
                    onClick={onClose}
                    className="text-xl leading-none text-gray-400 hover:text-white transition-colors cursor-pointer"
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
            <div
                onMouseDown={handleResizeStart}
                className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
                style={{ zIndex: 101 }}
            />
        </div>
    );
};

interface TerminalProps {
    isOpen: boolean;
    onClose: () => void;
    history: TerminalLine[];
    onSubmit: (command: string) => void;
}

// --- START: Terminal Syntax Highlighter Logic (Refactored) ---
const FormattedTerminalOutput: React.FC<{ content: string }> = ({ content }) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]+?)```/g;
    const parts: { type: 'text' | 'code'; content: string; language?: string }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
        if (match.index > lastIndex) {
            // Text before the code block
            parts.push({ type: 'text', content: content.substring(lastIndex, match.index) });
        }
        const language = match[1] || 'plaintext'; // Default to plaintext if language not specified
        const code = match[2];
        parts.push({ type: 'code', language, content: code });
        lastIndex = codeBlockRegex.lastIndex;
    }

    if (lastIndex < content.length) {
        // Remaining text after the last code block
        parts.push({ type: 'text', content: content.substring(lastIndex) });
    }

    if (parts.length === 0) {
        // If no code blocks found, treat entire content as text
        parts.push({ type: 'text', content });
    }

    return (
        <>
            {parts.map((part, index) => {
                if (part.type === 'code') {
                    return (
                        <pre key={index} className="bg-black/30 rounded p-2 my-1 overflow-x-auto text-xs">
                            <code dangerouslySetInnerHTML={{ __html: highlightBasic(part.content, part.language!) }} />
                        </pre>
                    );
                }
                // For regular text, use a basic span and ensure newlines are respected
                return <span key={index} dangerouslySetInnerHTML={{ __html: escapeHtml(part.content).replace(/\n/g, '<br/>') }} />;
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
                            style={{ fontFamily: 'Fira Code, monospace' }} // Ensure font consistency
                        />
                    </div>
                </form>
            </div>
        </div>
    );
};