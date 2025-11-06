

import type { FolderNode, FileSystemNode } from '../types';

/**
 * Traverses the file system tree to get a node at a specific path.
 * @param {FolderNode} root The root of the file system.
 * @param {string} path The path to the desired node (e.g., '/src/components/Button.js').
 * @returns {FileSystemNode | undefined} The node if found, otherwise undefined.
 */
export const get = (root: FolderNode, path: string): FileSystemNode | undefined => {
    const parts = path.split('/').filter(p => p);
    let currentNode: FileSystemNode = root;
    for (const part of parts) {
        if (currentNode.type === 'folder' && currentNode.children[part]) {
            currentNode = currentNode.children[part];
        } else {
            return undefined;
        }
    }
    return currentNode;
};

/**
 * Immutably sets a node at a specific path in the file system tree.
 * Creates parent directories if they don't exist.
 * @param {FolderNode} root The root of the file system.
 * @param {string} path The path where the node should be set.
 * @param {FileSystemNode} value The node to set.
 * @returns {FolderNode} The new, updated file system root.
 */
export const set = (root: FolderNode, path: string, value: FileSystemNode): FolderNode => {
    const parts = path.split('/').filter(p => p);
    
    // Recursive helper to rebuild the path immutably
    const setNodeRecursive = (currentFolder: FolderNode, currentParts: string[], newValue: FileSystemNode): FolderNode => {
        if (currentParts.length === 0) {
            // This should not happen if path is valid and has a fileName
            return { ...currentFolder }; 
        }

        const [part, ...remainingParts] = currentParts;
        const newChildren = { ...currentFolder.children };

        if (remainingParts.length === 0) {
            // We're at the final part (the file/folder to be set)
            newChildren[part] = newValue;
        } else {
            // We need to go deeper into a subfolder
            const nextNode = currentFolder.children[part] || { type: 'folder', children: {} };
            if (nextNode.type === 'folder') {
                newChildren[part] = setNodeRecursive(nextNode, remainingParts, newValue);
            } else {
                // Cannot set a child inside a file node, error or overwrite with folder
                console.warn(`Attempted to set a child inside a file at path segment: ${part}. Overwriting with new folder.`);
                newChildren[part] = setNodeRecursive({ type: 'folder', children: {} }, remainingParts, newValue);
            }
        }
        return { ...currentFolder, children: newChildren };
    };

    return setNodeRecursive(root, parts, value);
};

/**
 * Immutably unsets (deletes) a node at a specific path in the file system tree.
 * @param {FolderNode} root The root of the file system.
 * @param {string} path The path of the node to delete.
 * @returns {FolderNode} The new, updated file system root.
 */
export const unset = (root: FolderNode, path: string): FolderNode => {
    const parts = path.split('/').filter(p => p);
    
    // Recursive helper to rebuild the path immutably for deletion
    const unsetNodeRecursive = (currentFolder: FolderNode, currentParts: string[]): FolderNode | undefined => {
        if (currentParts.length === 0) {
            // This means we tried to delete the root or an invalid path
            return currentFolder;
        }

        const [part, ...remainingParts] = currentParts;
        const newChildren = { ...currentFolder.children };

        if (remainingParts.length === 0) {
            // We're at the final part (the file/folder to be deleted)
            if (!(part in newChildren)) {
                // Item not found, return current folder without changes
                return currentFolder;
            }
            delete newChildren[part];
            return { ...currentFolder, children: newChildren };
        } else {
            // We need to go deeper into a subfolder
            const nextNode = currentFolder.children[part];
            if (nextNode && nextNode.type === 'folder') {
                const updatedChild = unsetNodeRecursive(nextNode, remainingParts);
                if (updatedChild === nextNode) {
                    // No change in child, so no change in currentFolder
                    return currentFolder;
                }
                if (updatedChild) {
                    newChildren[part] = updatedChild;
                } else {
                    delete newChildren[part]; // Child folder became empty or was fully deleted
                }
                return { ...currentFolder, children: newChildren };
            } else {
                // Parent path doesn't exist or is a file, nothing to delete further down this path
                return currentFolder;
            }
        }
    };

    const newRoot = unsetNodeRecursive(root, parts);
    return newRoot || root; // Return the new root, or original if nothing changed/deleted root
};
