
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
    const newRoot = JSON.parse(JSON.stringify(root)); // Deep clone for immutability
    const parts = path.split('/').filter(p => p);
    const fileName = parts.pop();

    if (!fileName) return newRoot; // Cannot set the root itself

    let currentNode = newRoot;
    for (const part of parts) {
        if (!currentNode.children[part] || currentNode.children[part].type !== 'folder') {
            currentNode.children[part] = { type: 'folder', children: {} };
        }
        currentNode = currentNode.children[part] as FolderNode;
    }
    
    currentNode.children[fileName] = value;
    return newRoot;
};

/**
 * Immutably unsets (deletes) a node at a specific path in the file system tree.
 * @param {FolderNode} root The root of the file system.
 * @param {string} path The path of the node to delete.
 * @returns {FolderNode} The new, updated file system root.
 */
export const unset = (root: FolderNode, path: string): FolderNode => {
    const newRoot = JSON.parse(JSON.stringify(root)); // Deep clone for immutability
    const parts = path.split('/').filter(p => p);
    const fileName = parts.pop();

    if (!fileName) return newRoot; // Cannot unset the root itself

    let currentNode = newRoot;
    for (const part of parts) {
        if (currentNode.children[part] && currentNode.children[part].type === 'folder') {
            currentNode = currentNode.children[part] as FolderNode;
        } else {
            return newRoot; // Parent path doesn't exist, so nothing to delete
        }
    }

    delete currentNode.children[fileName];
    return newRoot;
};
