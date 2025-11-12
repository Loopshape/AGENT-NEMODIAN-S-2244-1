// This script provides the main application logic, wiring up the UI from index.html.
// It handles showing/hiding the prompt modal, capturing user input, and
// starting the AI orchestration process. It also manages the Three.js background.

// Note: This file uses vanilla TypeScript for direct DOM manipulation based on the
// structure of index.html. If you are using a framework like React, you would
// adapt this logic into your components.

// Type declaration for Three.js, since it's loaded from a CDN.
declare const THREE: any;

/**
 * Initializes the Three.js background animation.
 */
function initThreeJS() {
    const canvas = document.getElementById('bg-canvas') as HTMLCanvasElement;
    if (!canvas) {
        console.error("Background canvas element not found.");
        return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true
    });

    renderer.setSize(window.innerWidth, window.innerHeight);

    // A rotating icosahedron for the quantum feel
    const geometry = new THREE.IcosahedronGeometry(1.5, 0);
    const material = new THREE.MeshStandardMaterial({
        color: 0xBB86FC, // Matches --agent-nexus color
        roughness: 0.4,
        metalness: 0.7,
        emissive: 0xBB86FC,
        emissiveIntensity: 0.2,
        wireframe: true
    });
    const shape = new THREE.Mesh(geometry, material);
    scene.add(shape);

    // Lighting
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5).normalize();
    scene.add(directionalLight);
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);

    camera.position.z = 5;

    const animate = function () {
        requestAnimationFrame(animate);
        shape.rotation.x += 0.001;
        shape.rotation.y += 0.0015;
        renderer.render(scene, camera);
    };

    animate();

    // Handle window resizing
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

/**
 * Manages the UI logic for the prompt modal.
 */
function initPromptModal() {
    const promptBtn = document.getElementById('prompt-btn');
    const promptModal = document.getElementById('prompt-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const submitPromptBtn = document.getElementById('submit-prompt-btn');
    const promptTextarea = document.getElementById('prompt-textarea') as HTMLTextAreaElement;

    if (!promptBtn || !promptModal || !closeModalBtn || !submitPromptBtn || !promptTextarea) {
        console.error('One or more prompt modal UI elements are missing.');
        return;
    }

    const showModal = () => promptModal.classList.remove('hidden');
    const hideModal = () => promptModal.classList.add('hidden');

    promptBtn.addEventListener('click', showModal);
    closeModalBtn.addEventListener('click', hideModal);
    promptModal.addEventListener('click', (event) => {
        if (event.target === promptModal) hideModal();
    });

    submitPromptBtn.addEventListener('click', () => {
        const userPrompt = promptTextarea.value.trim();
        if (userPrompt) {
            hideModal();
            startOrchestration(userPrompt);
        } else {
            // Simple validation feedback
            promptTextarea.style.border = '1px solid var(--err)';
            setTimeout(() => promptTextarea.style.border = '1px solid var(--header-bg)', 2000);
        }
    });

    // Keyboard shortcut for opening the prompt modal
    document.addEventListener('keydown', (event) => {
        const target = event.target as HTMLElement;
        // Open modal with 'P' key if not typing in an input/textarea
        if (event.key.toLowerCase() === 'p' && !['TEXTAREA', 'INPUT'].includes(target.tagName)) {
            event.preventDefault();
            showModal();
            promptTextarea.focus();
        }
        // Close with 'Escape' key
        if (event.key === 'Escape' && !promptModal.classList.contains('hidden')) {
            hideModal();
        }
    });
}

/**
 * Placeholder for the main AI orchestration logic.
 * This is where you would start the process with the agents.
 * @param prompt The user-provided prompt from the text area.
 */
function startOrchestration(prompt: string) {
    console.log(`Starting orchestration with user prompt: "${prompt}"`);

    // Update the UI to reflect the new state
    const nexusMindset = document.getElementById('nexus-mindset');
    const agentStatus = document.getElementById('agent-status');

    if (nexusMindset) {
        nexusMindset.textContent = `Received prompt. Generating Genesis Hash for: "${prompt}"`;
    }
    if (agentStatus) {
        agentStatus.textContent = 'ORCHESTRATION ACTIVE';
        agentStatus.style.color = 'var(--accent)';
    }

    // --- YOUR CORE AI LOGIC WOULD GO HERE ---
    // 1. Generate genesis hash (update Nexus panel)
    // 2. Create origin hashes for each agent (update Cognito panel)
    // 3. Begin the reasoning process...
}

// Initialize the application once the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', () => {
    initThreeJS();
    initPromptModal();
});
