import React, { useState, useCallback } from 'react';
import type {
    Agent,
    AgentName,
    AiState,
    EditorStats,
    OrchestratorSettings,
    Consensus,
    Persona,
    GroundingChunk,
    TerminalLine,
    CodeReviewFinding,
    FolderNode,
    FileSystemNode,
    // FIX: Import FileNode type for use in type assertion.
    FileNode,
} from './types';
import { Header, StatusBar, LeftPanel, Footer, PreviewPanel, Terminal } from './components/ui';
import { Editor } from './components/Editor';
import { AiResponsePanel } from './components/AiPanels';
import { PromptModal } from './components/PromptModal';
import { generateWithThinkingStream, runMultiAgentConsensus, personas, runCodeReview } from './services/geminiService';
import { get, set, unset } from './utils/fsHelpers';

const INITIAL_FILES: FolderNode = {
    type: 'folder',
    children: {
        'index.html': {
            type: 'file',
            content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quantum Fractal AI Project</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <h1>Welcome to Quantum Fractal AI</h1>
    <p>Edit this project and see the live preview.</p>
    <script src="js/main.js"></script>
</body>
</html>`,
        },
        'css': {
            type: 'folder',
            children: {
                'style.css': {
                    type: 'file',
                    content: `body {
    font-family: sans-serif;
    background-color: #f0f0f0;
    color: #333;
    padding: 2rem;
}`,
                },
            },
        },
        'js': {
            type: 'folder',
            children: {
                'main.js': {
                    type: 'file',
                    content: `console.log('Quantum Fractal AI project loaded.');`,
                },
            },
        },
    },
};

const initialAgentState: Agent[] = [
    {
        name: 'nexus',
        title: 'Nexus',
        subtitle: 'Quantum Orchestrator',
        content: 'Idle. Awaiting quantum command.',
        status: 'idle',
        color: '#BB86FC',
    },
    { name: 'cognito', title: 'Cognito', subtitle: 'Fractal Analyzer', content: 'Ready', status: 'idle', color: '#03DAC6' },
    {
        name: 'oracle',
        title: 'Oracle',
        subtitle: 'Specialist Collective',
        content: 'Standing by.',
        status: 'idle',
        color: '#F39C12',
    },
    {
        name: 'relay',
        title: 'Relay',
        subtitle: 'Quantum Communicator',
        content: 'Ready',
        status: 'idle',
        color: '#FFD54F',
    },
    {
        name: 'sentinel',
        title: 'Sentinel',
        subtitle: 'Quantum Monitor',
        content: 'Ready',
        status: 'idle',
        color: '#CF6679',
    },
    {
        name: 'echo',
        title: 'Echo',
        subtitle: 'Quantum Reporter',
        content: 'Awaiting quantum report...',
        status: 'idle',
        color: '#4ac94a',
    },
];

export type AiMode = 'ai' | 'orchestrator';

/**
 * Determines the syntax highlighting language based on a file extension.
 * Maps common extensions to language identifiers supported by the editor's tokenizer.
 * Defaults to 'plaintext' if the extension is not recognized.
 * @param {string} path - The file path (e.g., '/src/index.js').
 * @returns {string} The corresponding language identifier.
 */
const getLanguageFromPath = (path: string): string => {
    const extension = path.split('.').pop() || '';
    const langMap: Record<string, string> = {
        js: 'js',
        jsx: 'js',
        ts: 'js',
        tsx: 'js',
        css: 'css',
        scss: 'css',
        less: 'css',
        html: 'html',
        htm: 'html',
        xml: 'xml',
        php: 'php',
        sql: 'sql',
        json: 'json',
        py: 'py',
        sh: 'bash',
        bash: 'bash',
    };
    return langMap[extension.toLowerCase()] || 'plaintext';
};

const HELP_TEXT = `Quantum Fractal AI Terminal Commands:
- run <prompt> [--search]: Executes a Quantum AI task on the currently open file. Use quotes for multi-word prompts.
    --search: Enables Google Search grounding for up-to-date information.
- orch <prompt> --agents <agent1>,<agent2>,...: Runs a Multi-Agent Consensus task on the open file.
    --agents: A comma-separated list of agent personas to use (e.g., "Performance Optimizer,Code Readability Advocate").
- apply: Applies the last generated code from the terminal to the editor.
- clear: Clears the terminal history.
- help: Displays this help message.
`;

/**
 * The main application component. It orchestrates the entire UI and state management,
 * including the editor, panels, modals, and communication with the Gemini API service.
 * @returns {React.ReactElement} The rendered application.
 */
const App: React.FC = () => {
    const [fileSystem, setFileSystem] = useState<FolderNode>(INITIAL_FILES);
    const [activeFilePath, setActiveFilePath] = useState<string | null>('/index.html');

    // FIX: Use a type assertion to safely access the `.content` property on the initial file node.
    const [editorContent, setEditorContent] = useState<string>((INITIAL_FILES.children['index.html'] as FileNode).content);
    const [fileName, setFileName] = useState<string>('index.html');
    const [fileType, setFileType] = useState<string>('html');

    const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
    const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
    const [isTerminalOpen, setIsTerminalOpen] = useState(false);

    const [initialModalState, setInitialModalState] = useState<{
        prompt: string;
        mode: AiMode;
        snippet?: string;
    } | null>(null);

    const [history, setHistory] = useState<string[]>([editorContent]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const [stats, setStats] = useState<EditorStats>({ cursor: '1:0', lines: 0, chars: 0, history: 1 });
    const [aiState, setAiState] = useState<AiState>({
        agents: initialAgentState,
        isLoading: false,
        consensus: null,
        generatedCode: null,
        groundingChunks: null,
        codeReviewFindings: null,
    });
    const [orchestratorSettings, setOrchestratorSettings] = useState<OrchestratorSettings>({
        agentCount: 4,
        maxRounds: 3,
    });
    const [editorFontSize, setEditorFontSize] = useState<number>(11);
    const [originalCodeForDiff, setOriginalCodeForDiff] = useState<string>('');
    const [terminalHistory, setTerminalHistory] = useState<TerminalLine[]>([
        { type: 'system', content: 'Quantum Fractal AI Terminal Initialized. Type "help" for commands.' },
    ]);
    const [lastTerminalResult, setLastTerminalResult] = useState<string | null>(null);

    const updateAgent = (name: AgentName, newStatus: Partial<Agent>) => {
        setAiState((prev) => ({
            ...prev,
            agents: prev.agents.map((a) => (a.name === name ? { ...a, ...newStatus } : a)),
        }));
    };

    const runAgentFlow = async <T,>(task: () => Promise<T>): Promise<T> => {
        updateAgent('nexus', { status: 'working', content: 'Orchestrating quantum fractal reasoning...' });
        await new Promise((r) => setTimeout(r, 400));
        updateAgent('nexus', { status: 'done' });
        updateAgent('cognito', { status: 'working', content: 'Executing hyperthreaded fractal analysis...' });
        await new Promise((r) => setTimeout(r, 400));
        updateAgent('oracle', { status: 'working', content: 'Consulting specialized agent personas...' });
        await new Promise((r) => setTimeout(r, 400));

        const result = await task();

        updateAgent('oracle', { status: 'done', content: 'Specialist insights acquired.' });
        updateAgent('cognito', { status: 'done', content: 'Fractal analysis complete.' });
        updateAgent('relay', { status: 'working', content: 'Transmitting quantum data streams...' });
        await new Promise((r) => setTimeout(r, 400));
        updateAgent('relay', { status: 'done' });
        updateAgent('sentinel', { status: 'working', content: 'Validating quantum consensus...' });
        await new Promise((r) => setTimeout(r, 400));
        updateAgent('sentinel', { status: 'done' });
        updateAgent('echo', { status: 'working', content: 'Generating quantum fractal report...' });
        await new Promise((r) => setTimeout(r, 400));
        return result;
    };

    const handleModalSubmit = useCallback(
        async ({
            prompt,
            context,
            snippet,
            mode,
            selectedAgents,
            useSearch,
        }: {
            prompt: string;
            context: string;
            snippet: string;
            mode: AiMode;
            selectedAgents: string[];
            useSearch: boolean;
        }) => {
            setIsPromptModalOpen(false);
            if (aiState.isLoading) return;

            setOriginalCodeForDiff(editorContent);
            const currentPrompt = prompt || 'Optimize this code with quantum fractal patterns';
            const fullContext = `EDITOR CONTENT:\n\`\`\`\n${editorContent}\n\`\`\`\n\nPASTED SNIPPET:\n\`\`\`\n${snippet}\n\`\`\`\n\nADDITIONAL CONTEXT:\n\`\`\`\n${context}\n\`\`\``;

            setIsAiPanelOpen(true);
            setAiState({
                agents: initialAgentState,
                isLoading: true,
                consensus: null,
                generatedCode: null,
                groundingChunks: null,
                codeReviewFindings: null,
            });

            try {
                if (mode === 'orchestrator') {
                    const candidates = await runAgentFlow(() =>
                        runMultiAgentConsensus(currentPrompt, fullContext, selectedAgents)
                    );
                    if (candidates.length > 0) {
                        const consensusResult: Consensus = {
                            selectedCandidate: candidates[0].content,
                            score: candidates[0].score.toFixed(2),
                            count: candidates[0].count,
                            avgEntropy: candidates[0].avgEntropy.toFixed(2),
                            rootAgent: candidates[0].agents[0],
                            allCandidates: candidates,
                        };
                        setAiState((prev) => ({ ...prev, consensus: consensusResult }));
                        updateAgent('echo', { status: 'done', content: 'Multi-Agent Consensus Complete.' });
                    } else {
                        updateAgent('echo', { status: 'error', content: 'Consensus failed. No candidates generated.' });
                    }
                } else {
                    // single AI mode
                    if (useSearch) {
                        updateAgent('nexus', { status: 'working', content: 'Initiating grounded quantum query...' });
                        await new Promise((r) => setTimeout(r, 200));
                        updateAgent('relay', { status: 'working', content: 'Connecting to real-time data streams...' });
                    }
                    await runAgentFlow(() =>
                        generateWithThinkingStream(
                            currentPrompt,
                            fullContext,
                            useSearch,
                            (update) => {
                                setAiState((prev) => ({
                                    ...prev,
                                    generatedCode: update.code,
                                    groundingChunks: update.groundingChunks || null,
                                }));
                            }
                        )
                    );

                    if (useSearch) {
                        await new Promise((r) => setTimeout(r, 200));
                        updateAgent('relay', { status: 'done' });
                        updateAgent('cognito', { status: 'working', content: 'Analyzing grounded information...' });
                        await new Promise((r) => setTimeout(r, 200));
                        updateAgent('cognito', { status: 'done', content: 'Analysis complete.' });
                    }
                    updateAgent('echo', {
                        status: 'done',
                        content: useSearch ? 'Grounded Quantum Solution Generated.' : 'Quantum Fractal Solution Generated.',
                    });
                }
            } catch (error) {
                console.error('Gemini API Error:', error);
                updateAgent('echo', { status: 'error', content: `Quantum Error: ${(error as Error).message}` });
            } finally {
                setAiState((prev) => ({ ...prev, isLoading: false }));
            }
        },
        [editorContent, aiState.isLoading]
    );

    const handleSetContent = useCallback(
        (newContent: string) => {
            // Update file system state
            if (activeFilePath) {
                setFileSystem((prevFs) => {
                    const newFs = { ...prevFs };
                    const node = get(newFs, activeFilePath);
                    if (node && node.type === 'file') {
                        return set(newFs, activeFilePath, { ...node, content: newContent });
                    }
                    return prevFs;
                });
            }

            // Update editor state and history
            if (newContent === history[historyIndex]) return;
            const newHistory = [...history.slice(0, historyIndex + 1), newContent];
            setHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
            setEditorContent(newContent);
        },
        [activeFilePath, history, historyIndex]
    );

    const handleCommandSubmit = async (command: string) => {
        const addToHistory = (type: TerminalLine['type'], content: string) => {
            setTerminalHistory((prev) => [...prev, { type, content }]);
        };

        addToHistory('input', command);

        const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
        const [cmd, ...args] = parts;

        const getArgValue = (flag: string): string | undefined => {
            const index = args.findIndex((arg) => arg === flag);
            if (index !== -1 && args[index + 1]) {
                return args[index + 1].replace(/"/g, '');
            }
            return undefined;
        };

        switch (cmd) {
            case 'help':
                addToHistory('help', HELP_TEXT);
                break;
            case 'clear':
                setTerminalHistory([]);
                break;
            case 'apply':
                if (lastTerminalResult) {
                    handleSetContent(lastTerminalResult);
                    addToHistory('system', 'Applied last AI result to the editor.');
                    setLastTerminalResult(null);
                } else {
                    addToHistory('error', 'No previous AI result to apply.');
                }
                break;
            case 'run': {
                const prompt = args.find((arg) => !arg.startsWith('--'))?.replace(/"/g, '') || 'Analyze the code.';
                const useSearch = args.includes('--search');
                addToHistory('system', 'Invoking Quantum AI...');
                try {
                    let result = '';
                    await generateWithThinkingStream(prompt, editorContent, useSearch, (update) => {
                        result = update.code;
                        // We don't display chunks in terminal, just get final code
                    });
                    setLastTerminalResult(result);
                    addToHistory('output', result);
                } catch (e) {
                    addToHistory('error', `Error: ${(e as Error).message}`);
                }
                break;
            }
            case 'orch': {
                const prompt = args.find((arg) => !arg.startsWith('--'))?.replace(/"/g, '') || 'Refactor the code.';
                const agentsStr = getArgValue('--agents');
                if (!agentsStr) {
                    addToHistory('error', 'The --agents flag is required for "orch" command.');
                    break;
                }
                const selectedAgents = agentsStr.split(',').map((s) => s.trim());
                if (selectedAgents.length < 2) {
                    addToHistory('error', 'Please provide at least two agents for consensus.');
                    break;
                }
                addToHistory('system', `Invoking Multi-Agent Consensus with: ${selectedAgents.join(', ')}`);
                try {
                    const candidates = await runMultiAgentConsensus(prompt, editorContent, selectedAgents);
                    if (candidates.length > 0) {
                        const topCandidate = candidates[0];
                        setLastTerminalResult(topCandidate.content);
                        const resultText = `Consensus complete. Top candidate score: ${topCandidate.score.toFixed(
                            2
                        )}\n\n${topCandidate.content}`;
                        addToHistory('output', resultText);
                    } else {
                        addToHistory('error', 'Consensus failed to produce any candidates.');
                    }
                } catch (e) {
                    addToHistory('error', `Error: ${(e as Error).message}`);
                }
                break;
            }
            default:
                addToHistory('error', `Command not found: "${cmd}". Type "help" for a list of commands.`);
        }
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            handleSetContent(history[newIndex]);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            handleSetContent(history[newIndex]);
        }
    };

    const handleRevertToState = (index: number) => {
        if (index >= 0 && index < history.length) {
            setHistoryIndex(index);
            handleSetContent(history[index]);
        }
    };

    const handleStatsChange = useCallback(
        (newStats: { cursor: string; lines: number; chars: number }) => {
            setStats((prev) => ({ ...prev, ...newStats, history: history.length }));
        },
        [history.length]
    );

    const openPromptModal = (mode: AiMode, prompt = '', snippet = '') => {
        setInitialModalState({ mode, prompt, snippet });
        setIsPromptModalOpen(true);
    };

    const handleQuickAction = async (action: 'optimize' | 'document' | 'refactor') => {
        if (aiState.isLoading || !activeFilePath) return;

        const prompts = {
            optimize: 'Apply quantum fractal optimization to this code. Return only the complete, updated code block.',
            document:
                'Add fractal documentation with quantum clarity to this code. Return only the complete, updated code block.',
            refactor:
                'Refactor this code using quantum fractal patterns and hyperthreaded efficiency. Return only the complete, updated code block.',
        };

        const currentPrompt = prompts[action];
        const fullContext = editorContent;

        setOriginalCodeForDiff(editorContent);
        setIsAiPanelOpen(true);
        setAiState({
            agents: initialAgentState,
            isLoading: true,
            consensus: null,
            generatedCode: null,
            groundingChunks: null,
            codeReviewFindings: null,
        });

        try {
            await runAgentFlow(() =>
                generateWithThinkingStream(
                    currentPrompt,
                    fullContext,
                    false,
                    (update) => {
                        setAiState((prev) => ({ ...prev, generatedCode: update.code }));
                    }
                )
            );
            updateAgent('echo', { status: 'done', content: `Quick Action '${action}' complete.` });
        } catch (error) {
            console.error('Gemini API Error:', error);
            updateAgent('echo', { status: 'error', content: `Quantum Error: ${(error as Error).message}` });
        } finally {
            setAiState((prev) => ({ ...prev, isLoading: false }));
        }
    };

    const handleCodeReview = async () => {
        if (aiState.isLoading || !activeFilePath) return;

        setIsAiPanelOpen(true);
        setAiState({
            agents: initialAgentState,
            isLoading: true,
            consensus: null,
            generatedCode: null,
            groundingChunks: null,
            codeReviewFindings: [],
        });

        try {
            updateAgent('nexus', { status: 'working', content: 'Initiating quantum code review...' });
            await new Promise((r) => setTimeout(r, 400));
            updateAgent('cognito', { status: 'working', content: 'Analyzing code structure...' });
            await new Promise((r) => setTimeout(r, 400));

            const findings = await runCodeReview(editorContent);

            updateAgent('cognito', { status: 'done', content: 'Analysis complete.' });
            updateAgent('echo', { status: 'working', content: 'Compiling review...' });
            await new Promise((r) => setTimeout(r, 400));

            setAiState((prev) => ({ ...prev, codeReviewFindings: findings }));
            updateAgent('echo', {
                status: 'done',
                content: `Code review complete. Found ${findings.length} issue(s).`,
            });
        } catch (error) {
            console.error('Code Review Error:', error);
            updateAgent('echo', { status: 'error', content: `Review Error: ${(error as Error).message}` });
        } finally {
            setAiState((prev) => ({ ...prev, isLoading: false }));
        }
    };

    const handleAnalyzeSelection = () => {
        const selection = window.getSelection()?.toString() || '';
        if (selection) {
            openPromptModal('ai', 'Analyze and improve this code snippet:', selection);
        } else {
            // Optionally, provide feedback if nothing is selected
            alert('Please select some code in the editor first.');
        }
    };

    const handleOpenFile = useCallback((path: string) => {
        const node = get(fileSystem, path);
        if (node && node.type === 'file') {
            setActiveFilePath(path);
            setEditorContent(node.content);
            setFileName(path.split('/').pop() || 'untitled');
            setFileType(getLanguageFromPath(path));
            setHistory([node.content]);
            setHistoryIndex(0);
        }
    }, [fileSystem]);

    const handleCreateFile = useCallback((path: string) => {
        const fileName = prompt('Enter new file name:');
        if (!fileName) return;
        const newPath = `${path}/${fileName}`;
        setFileSystem(fs => set(fs, newPath, { type: 'file', content: '' }));
    }, []);
    
    const handleCreateFolder = useCallback((path: string) => {
        const folderName = prompt('Enter new folder name:');
        if (!folderName) return;
        const newPath = `${path}/${folderName}`;
        setFileSystem(fs => set(fs, newPath, { type: 'folder', children: {} }));
    }, []);

    const handleRename = useCallback((path: string, newName: string) => {
        const parts = path.split('/');
        const oldName = parts.pop();
        const parentPath = parts.join('/');
        const newPath = `${parentPath}/${newName}`;

        setFileSystem(fs => {
            const nodeToMove = get(fs, path);
            if (!nodeToMove) return fs;
            const fsWithoutOld = unset(fs, path);
            const fsWithNew = set(fsWithoutOld, newPath, nodeToMove);
            return fsWithNew;
        });

        if (activeFilePath === path) {
            setActiveFilePath(newPath);
            setFileName(newName);
            setFileType(getLanguageFromPath(newPath));
        }
    }, [activeFilePath]);

    const handleDelete = useCallback((path: string) => {
        if (!confirm(`Are you sure you want to delete "${path}"?`)) return;

        setFileSystem(fs => unset(fs, path));

        if (activeFilePath === path) {
            setActiveFilePath(null);
            setEditorContent('');
            setFileName('No File Open');
            setFileType('plaintext');
        }
    }, [activeFilePath]);

    const handleSaveDraft = () => {
        try {
            localStorage.setItem('quantum-editor-draft', editorContent);
        } catch (error) {
            console.error('Failed to save draft:', error);
            alert('Could not save draft. Local storage may be full or disabled.');
        }
    };

    const handleLoadDraft = () => {
        try {
            const draft = localStorage.getItem('quantum-editor-draft');
            if (draft !== null) {
                handleSetContent(draft);
            } else {
                alert('No draft found.');
            }
        } catch (error) {
            console.error('Failed to load draft:', error);
            alert('Could not load draft. Local storage may be inaccessible.');
        }
    };

    return (
        <div
            className="h-screen w-screen grid grid-rows-[max-content_max-content_1fr_max-content] grid-cols-1 relative overflow-hidden"
            style={{ gridTemplateAreas: '"header" "status" "main" "footer"' }}
        >
            <Header
                onToggleLeftPanel={() => setIsLeftPanelOpen((p) => !p)}
                onTogglePreview={() => setIsPreviewOpen((p) => !p)}
                isPreviewing={isPreviewOpen}
                onRunAI={() => openPromptModal('ai')}
                onRunOrchestrator={() => openPromptModal('orchestrator')}
            />
            <StatusBar fileName={fileName} stats={stats} />
            <main className="grid-in-main flex overflow-hidden">
                <LeftPanel
                    isOpen={isLeftPanelOpen}
                    settings={orchestratorSettings}
                    onSettingsChange={setOrchestratorSettings}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    onQuickAction={handleQuickAction}
                    onAnalyzeSelection={handleAnalyzeSelection}
                    onRunOrchestrator={() => openPromptModal('orchestrator')}
                    history={history}
                    historyIndex={historyIndex}
                    onRevertToState={handleRevertToState}
                    editorFontSize={editorFontSize}
                    onFontSizeChange={setEditorFontSize}
                    onSaveDraft={handleSaveDraft}
                    onLoadDraft={handleLoadDraft}
                    onCodeReview={handleCodeReview}
                    fileSystem={fileSystem}
                    activePath={activeFilePath}
                    onOpenFile={handleOpenFile}
                    onCreateFile={handleCreateFile}
                    onCreateFolder={handleCreateFolder}
                    onRename={handleRename}
                    onDelete={handleDelete}
                />
                <div className="flex flex-1 min-w-0">
                    <Editor
                        content={editorContent}
                        setContent={handleSetContent}
                        fileType={fileType}
                        onStatsChange={handleStatsChange}
                        fontSize={editorFontSize}
                    />
                </div>
            </main>
            <Footer
                onInvoke={() => openPromptModal('ai')}
                isLoading={aiState.isLoading}
                onToggleTerminal={() => setIsTerminalOpen((p) => !p)}
            />
            {isPreviewOpen && <PreviewPanel htmlContent={editorContent} onClose={() => setIsPreviewOpen(false)} />}
            <AiResponsePanel
                isOpen={isAiPanelOpen}
                aiState={aiState}
                onClose={() => setIsAiPanelOpen(false)}
                onApplyCode={(code) => handleSetContent(code)}
                onCopyCode={(code) => navigator.clipboard.writeText(code)}
                originalCode={originalCodeForDiff}
            />
            <PromptModal
                isOpen={isPromptModalOpen}
                onClose={() => setIsPromptModalOpen(false)}
                onSubmit={handleModalSubmit}
                personas={personas as Persona[]}
                initialState={initialModalState}
            />
            <Terminal
                isOpen={isTerminalOpen}
                onClose={() => setIsTerminalOpen(false)}
                history={terminalHistory}
                onSubmit={handleCommandSubmit}
            />
        </div>
    );
};

export default App;