import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { CodeGenerationModal } from './components/CodeGenerationModal'; // Import new modal
import { generateWithThinkingStream, runMultiAgentConsensus, personas, runCodeReview, quickFixCode } from './services/geminiService';
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
                    content: `body {
    font-family: sans-serif;
    background-color: #f0f0f0;
    color: #333;
    padding: 2rem;
}`,
                    type: 'file',
                },
            },
        },
        'js': {
            type: 'folder',
            children: {
                'main.js': {
                    content: `console.log('Quantum Fractal AI project loaded.');`,
                    type: 'file',
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
        svg: 'xml', // SVG is XML
        php: 'php',
        sql: 'sql',
        json: 'json',
        py: 'py',
        sh: 'bash',
        bash: 'bash',
        md: 'plaintext', // Markdown can be highlighted as plaintext or a custom markdown highlighter
        txt: 'plaintext',
    };
    return langMap[extension.toLowerCase()] || 'plaintext';
};

const HELP_TEXT = `Quantum Fractal AI Terminal Commands:
- run <prompt> [--search] [--maps]: Executes a Quantum AI task on the currently open file. Use quotes for multi-word prompts.
    --search: Enables Google Search grounding for up-to-date information.
    --maps: Enables Google Maps grounding for location-based queries (requires geolocation permission).
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
    const [isCodeGenerationModalOpen, setIsCodeGenerationModalOpen] = useState(false); // New state for code generation modal
    const [isTerminalOpen, setIsTerminalOpen] = useState(false);
    const [isFindReplaceVisible, setIsFindReplaceVisible] = useState(false); // New state for Find/Replace widget

    const [initialModalState, setInitialModalState] = useState<{
        prompt: string;
        mode: AiMode;
        snippet?: string;
    } | null>(null);

    // FIX: Rename the state setter for historyIndex to avoid redeclaration.
    const [history, setHistoryContent] = useState<string[]>([editorContent]);
    const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0); // Renamed to avoid collision with prop

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

    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    const [geolocationError, setGeolocationError] = useState<string | null>(null);

    // State to track selection in the editor
    const [selectionStart, setSelectionStart] = useState(0);
    const [selectionEnd, setSelectionEnd] = useState(0);

    // Ref for the hidden file input
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Request geolocation permission on component mount
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    });
                    setGeolocationError(null);
                },
                (error) => {
                    console.warn('Geolocation error:', error);
                    setGeolocationError(error.message);
                },
                {
                    enableHighAccuracy: false,
                    timeout: 5000,
                    maximumAge: 0,
                }
            );
        } else {
            setGeolocationError('Geolocation is not supported by this browser.');
        }
    }, []); // Run once on mount

    const updateAgent = (name: AgentName, newStatus: Partial<Agent>) => {
        setAiState((prev) => ({
            ...prev,
            agents: prev.agents.map((a) => (a.name === name ? { ...a, ...newStatus } : a)),
        }));
    };

    const runAgentFlow = async <T,>(task: () => Promise<T>): Promise<T> => {
        updateAgent('nexus', { status: 'working', content: 'Orchestrating quantum fractal reasoning.' });
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
            useMaps,
        }: {
            prompt: string;
            context: string;
            snippet: string;
            mode: AiMode;
            selectedAgents: string[];
            useSearch: boolean;
            useMaps: boolean;
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

            // Handle geolocation for Maps grounding
            let currentLatitude: number | null = null;
            let currentLongitude: number | null = null;
            if (useMaps && userLocation) {
                currentLatitude = userLocation.latitude;
                currentLongitude = userLocation.longitude;
                updateAgent('nexus', { status: 'working', content: 'Fetching geolocation data...' });
                await new Promise((r) => setTimeout(r, 200));
            }


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
                    if (useSearch || useMaps) {
                        updateAgent('nexus', { status: 'working', content: 'Initiating grounded quantum query...' });
                        await new Promise((r) => setTimeout(r, 200));
                        updateAgent('relay', { status: 'working', content: 'Connecting to real-time data streams...' });
                    }
                    await runAgentFlow(() =>
                        generateWithThinkingStream(
                            currentPrompt,
                            fullContext,
                            useSearch,
                            useMaps,
                            currentLatitude,
                            currentLongitude,
                            (update) => {
                                setAiState((prev) => ({
                                    ...prev,
                                    generatedCode: update.code,
                                    groundingChunks: update.groundingChunks || null,
                                }));
                            }
                        )
                    );

                    if (useSearch || useMaps) {
                        await new Promise((r) => setTimeout(r, 200));
                        updateAgent('relay', { status: 'done' });
                        updateAgent('cognito', { status: 'working', content: 'Analyzing grounded information...' });
                        await new Promise((r) => setTimeout(r, 200));
                        updateAgent('cognito', { status: 'done', content: 'Analysis complete.' });
                    }
                    updateAgent('echo', {
                        status: 'done',
                        content: (useSearch || useMaps) ? 'Grounded Quantum Solution Generated.' : 'Quantum Fractal Solution Generated.',
                    });
                }
            } catch (error) {
                console.error('Gemini API Error:', error);
                updateAgent('echo', { status: 'error', content: `Quantum Error: ${(error as Error).message}` });
            } finally {
                setAiState((prev) => ({ ...prev, isLoading: false }));
            }
        },
        [editorContent, aiState.isLoading, userLocation]
    );

    // New handler for AI Code Generation modal submission
    const handleCodeGenerationSubmit = useCallback(
        async ({ prompt, useSearch, useMaps }: { prompt: string; useSearch: boolean; useMaps: boolean }) => {
            setIsCodeGenerationModalOpen(false);
            if (aiState.isLoading) return;

            setOriginalCodeForDiff(''); // No original code for diff in generation mode
            const currentPrompt = prompt;
            const fullContext = ''; // No current editor context for generation

            setIsAiPanelOpen(true);
            setAiState({
                agents: initialAgentState,
                isLoading: true,
                consensus: null,
                generatedCode: null,
                groundingChunks: null,
                codeReviewFindings: null,
            });

            let currentLatitude: number | null = null;
            let currentLongitude: number | null = null;
            if (useMaps && userLocation) {
                currentLatitude = userLocation.latitude;
                currentLongitude = userLocation.longitude;
                updateAgent('nexus', { status: 'working', content: 'Fetching geolocation data...' });
                await new Promise((r) => setTimeout(r, 200));
            }

            try {
                if (useSearch || useMaps) {
                    updateAgent('nexus', { status: 'working', content: 'Initiating grounded quantum query for generation...' });
                    await new Promise((r) => setTimeout(r, 200));
                    updateAgent('relay', { status: 'working', content: 'Connecting to real-time data streams...' });
                }

                await runAgentFlow(() =>
                    generateWithThinkingStream(
                        currentPrompt,
                        fullContext,
                        useSearch,
                        useMaps,
                        currentLatitude,
                        currentLongitude,
                        (update) => {
                            setAiState((prev) => ({
                                ...prev,
                                generatedCode: update.code,
                                groundingChunks: update.groundingChunks || null,
                            }));
                        }
                    )
                );

                if (useSearch || useMaps) {
                    await new Promise((r) => setTimeout(r, 200));
                    updateAgent('relay', { status: 'done' });
                    updateAgent('cognito', { status: 'working', content: 'Analyzing grounded information...' });
                    await new Promise((r) => setTimeout(r, 200));
                    updateAgent('cognito', { status: 'done', content: 'Analysis complete.' });
                }
                updateAgent('echo', {
                    status: 'done',
                    content: (useSearch || useMaps) ? 'Grounded Code Generated.' : 'Code Generated.',
                });
            } catch (error) {
                console.error('Gemini API Error:', error);
                updateAgent('echo', { status: 'error', content: `Quantum Error: ${(error as Error).message}` });
            } finally {
                setAiState((prev) => ({ ...prev, isLoading: false }));
            }
        },
        [aiState.isLoading, userLocation]
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
            if (newContent === editorContent) return; // Only update if content actually changed
            const newHistory = [...history.slice(0, currentHistoryIndex + 1), newContent];
            setHistoryContent(newHistory);
            // FIX: Use setCurrentHistoryIndex to update the history index.
            setCurrentHistoryIndex(newHistory.length - 1);
            setEditorContent(newContent);
        },
        [activeFilePath, history, currentHistoryIndex, editorContent] // Added editorContent to dependencies
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
                const useMaps = args.includes('--maps');

                if (useMaps && !userLocation && !geolocationError) {
                    addToHistory('error', 'Geolocation access is required for --maps grounding. Please grant permission.');
                    if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                            () => addToHistory('system', 'Geolocation granted. Please retry command.'),
                            (error) => addToHistory('error', `Geolocation permission denied: ${error.message}`)
                        );
                    }
                    break;
                } else if (useMaps && geolocationError) {
                    addToHistory('error', `Maps grounding unavailable: ${geolocationError}`);
                    break;
                }

                addToHistory('system', 'Invoking Quantum AI...');
                try {
                    let result = '';
                    await generateWithThinkingStream(
                        prompt,
                        editorContent,
                        useSearch,
                        useMaps,
                        userLocation?.latitude ?? null,
                        userLocation?.longitude ?? null,
                        (update) => {
                            result = update.code;
                            // We don't display chunks in terminal, just get final code
                        }
                    );
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

    const handleUndo = useCallback(() => {
        if (currentHistoryIndex > 0) {
            const newIndex = currentHistoryIndex - 1;
            // FIX: Use setCurrentHistoryIndex to update the history index.
            setCurrentHistoryIndex(newIndex);
            setEditorContent(history[newIndex]); // Directly set content, handleSetContent will add to history if different
        }
    }, [currentHistoryIndex, history]);

    const handleRedo = useCallback(() => {
        if (currentHistoryIndex < history.length - 1) {
            const newIndex = currentHistoryIndex + 1;
            // FIX: Use setCurrentHistoryIndex to update the history index.
            setCurrentHistoryIndex(newIndex);
            setEditorContent(history[newIndex]); // Directly set content, handleSetContent will add to history if different
        }
    }, [currentHistoryIndex, history]);

    const handleRevertToState = useCallback((index: number) => {
        if (index >= 0 && index < history.length) {
            // FIX: Use setCurrentHistoryIndex to update the history index.
            setCurrentHistoryIndex(index);
            setEditorContent(history[index]); // Directly set content, handleSetContent will add to history if different
        }
    }, [history]);

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

    const openCodeGenerationModal = () => {
        setIsCodeGenerationModalOpen(true);
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
                    false, // no search
                    false, // no maps
                    null,
                    null,
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

    const handleFixCode = async () => {
        if (aiState.isLoading || !activeFilePath) return;

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
            updateAgent('nexus', { status: 'working', content: 'Initiating quantum code fix...' });
            await new Promise((r) => setTimeout(r, 400));
            updateAgent('cognito', { status: 'working', content: 'Analyzing code for issues...' });
            await new Promise((r) => setTimeout(r, 400));

            const fixedCode = await quickFixCode(editorContent);

            updateAgent('cognito', { status: 'done', content: 'Code analysis complete.' });
            updateAgent('echo', { status: 'working', content: 'Applying quantum fix...' });
            await new Promise((r) => setTimeout(r, 400));

            setAiState((prev) => ({ ...prev, generatedCode: fixedCode }));
            updateAgent('echo', { status: 'done', content: 'Quantum Code Fix Applied.' });
        } catch (error) {
            console.error('AI Fix Code Error:', error);
            updateAgent('echo', { status: 'error', content: `Fix Code Error: ${(error as Error).message}` });
        } finally {
            setAiState((prev) => ({ ...prev, isLoading: false }));
        }
    };


    const handleAnalyzeSelection = useCallback(() => {
        const selectedText = editorContent.substring(selectionStart, selectionEnd);
        if (selectedText) {
            openPromptModal('ai', 'Analyze and improve this code snippet:', selectedText);
        } else {
            // Optionally, provide feedback if nothing is selected
            alert('Please select some code in the editor first.');
        }
    }, [editorContent, selectionStart, selectionEnd]);

    const handleOpenFile = useCallback((path: string) => {
        const node = get(fileSystem, path);
        if (node && node.type === 'file') {
            setActiveFilePath(path);
            setEditorContent(node.content);
            setFileName(path.split('/').pop() || 'untitled');
            setFileType(getLanguageFromPath(path));
            setHistoryContent([node.content]);
            // FIX: Use setCurrentHistoryIndex to update the history index.
            setCurrentHistoryIndex(0);
        }
    }, [fileSystem]); // Removed setHistoryContent, setCurrentHistoryIndex from dependencies as they are setters

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

    // New handler for the "Load Script" button
    const handleLoadScript = useCallback(() => {
        fileInputRef.current?.click(); // Trigger the hidden file input click
    }, []);

    // Handler for when a file is selected via the file input dialog
    const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            const newFileName = file.name;
            const newFileType = getLanguageFromPath(newFileName);

            // For now, load into a temporary virtual path. A full FS integration would involve
            // adding it to the fileSystem state, but for 'Load Script' this suffices.
            // If the user wants to save, they can use 'Save Draft'.
            setActiveFilePath(`/temp/${newFileName}`); // Use a temporary path for loaded files
            setEditorContent(content);
            setFileName(newFileName);
            setFileType(newFileType);
            setHistoryContent([content]);
            // FIX: Use setCurrentHistoryIndex to update the history index.
            setCurrentHistoryIndex(0);

            // Reset file input to allow selecting the same file again
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        };
        reader.onerror = (e) => {
            console.error('Error reading file:', reader.error);
            alert(`Could not read file: ${reader.error?.message}`);
        };
        reader.readAsText(file, 'UTF-8'); // Explicitly read as UTF-8
    }, []); // Removed setHistoryContent, setCurrentHistoryIndex from dependencies as they are setters


    return (
        <div
            className="h-screen w-screen grid grid-rows-[max-content_max-content_1fr_max-content] grid-cols-1 relative overflow-hidden"
            style={{ gridTemplateAreas: '"header" "status" "main" "footer"' }}
        >
            {/* Hidden file input for "Load Script" functionality */}
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileSelect}
                aria-label="Load script from file system"
            />

            <Header
                onToggleLeftPanel={() => setIsLeftPanelOpen((p) => !p)}
                onTogglePreview={() => setIsPreviewOpen((p) => !p)}
                isPreviewing={isPreviewOpen}
                onRunAI={() => openPromptModal('ai')}
                onRunOrchestrator={() => openPromptModal('orchestrator')}
                onLoadScript={handleLoadScript} // Use new handler
                onFixCode={handleFixCode}
                onGenerateCode={openCodeGenerationModal} // Pass new handler to Header
                onFindReplaceToggle={() => setIsFindReplaceVisible((p) => !p)} // Pass toggle function
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
                    historyIndex={currentHistoryIndex} // Use currentHistoryIndex
                    onRevertToState={handleRevertToState}
                    editorFontSize={editorFontSize}
                    onFontSizeChange={setEditorFontSize}
                    onSaveDraft={handleSaveDraft}
                    onLoadDraft={handleLoadDraft}
                    onCodeReview={handleCodeReview}
                    onFixCode={handleFixCode}
                    onGenerateCode={openCodeGenerationModal} // Pass new handler to LeftPanel
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
                        onSelectionChange={(start, end) => { setSelectionStart(start); setSelectionEnd(end); }}
                        isFindReplaceOpen={isFindReplaceVisible} // Pass visibility state
                        onFindReplaceToggle={() => setIsFindReplaceVisible((p) => !p)} // Pass toggle function
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
                userLocation={userLocation}
                geolocationError={geolocationError}
            />
            <CodeGenerationModal // New CodeGenerationModal
                isOpen={isCodeGenerationModalOpen}
                onClose={() => setIsCodeGenerationModalOpen(false)}
                onSubmit={handleCodeGenerationSubmit}
                userLocation={userLocation}
                geolocationError={geolocationError}
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