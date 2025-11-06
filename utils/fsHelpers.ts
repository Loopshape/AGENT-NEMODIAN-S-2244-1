

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
 * Creates parent directories if they don't exist, or overwrites file nodes with folders
 * if attempting to set a child inside a file.
 * @param {FolderNode} root The root of the file system.
 * @param {string} path The path where the node should be set.
 * @param {FileSystemNode} value The node to set.
 * @returns {FolderNode} The new, updated file system root.
 */
export const set = (root: FolderNode, path: string, value: FileSystemNode): FolderNode => {
    const parts = path.split('/').filter(p => p);
    if (parts.length === 0) {
        // If path is empty, we are effectively setting the root itself.
        // Only a folder node can be the root.
        if (value.type === 'folder') {
            return value;
        }
        throw new Error('Cannot set non-folder value to root path.');
    }

    const _set = (currentFolder: FolderNode, currentParts: string[], index: number): FolderNode => {
        const part = currentParts[index];
        const newChildren = { ...currentFolder.children };

        if (index === currentParts.length - 1) {
            // This is the last part, so assign the new value
            newChildren[part] = value;
        } else {
            // Not the last part, need to descend further
            const nextNode = currentFolder.children[part];
            if (nextNode && nextNode.type === 'folder') {
                newChildren[part] = _set(nextNode, currentParts, index + 1);
            } else if (nextNode && nextNode.type === 'file') {
                // If it's a file but we need to create a folder inside it, replace the file with a folder
                console.warn(`Attempted to create a child inside a file at path segment: "${part}". Overwriting with new folder.`);
                newChildren[part] = _set({ type: 'folder', children: {} }, currentParts, index + 1);
            } else {
                // Node does not exist, create a new folder to descend into
                newChildren[part] = _set({ type: 'folder', children: {} }, currentParts, index + 1);
            }
        }
        // Return a new folder node with updated children
        return { ...currentFolder, children: newChildren };
    };

    return _set(root, parts, 0);
};

/**
 * Immutably unsets (deletes) a node at a specific path in the file system tree.
 * If deleting a folder makes its parent folder empty, the parent is also deleted recursively.
 * @param {FolderNode} root The root of the file system.
 * @param {string} path The path of the node to delete.
 * @returns {FolderNode} The new, updated file system root.
 */
export const unset = (root: FolderNode, path: string): FolderNode => {
    const parts = path.split('/').filter(p => p);
    if (parts.length === 0) {
        // Trying to unset the root path itself, resulting in an empty root.
        return { type: 'folder', children: {} };
    }

    // _unset returns the updatedFolderNode, or undefined if the currentFolder (at 'part' in parent) should be removed.
    const _unset = (currentFolder: FolderNode, currentParts: string[], index: number): FolderNode | undefined => {
        const part = currentParts[index];
        
        // If the 'part' doesn't exist in the current folder, no change needed.
        if (!(part in currentFolder.children)) {
            return currentFolder;
        }

        const newChildren = { ...currentFolder.children };

        if (index === currentParts.length - 1) {
            // This is the item to delete
            delete newChildren[part];
        } else {
            // Descend into a subfolder
            const nextNode = currentFolder.children[part];
            if (nextNode?.type !== 'folder') {
                // Cannot descend into a file or non-existent node (already checked by 'part in currentFolder.children')
                return currentFolder;
            }
            
            const updatedChild = _unset(nextNode, currentParts, index + 1);

            if (updatedChild === nextNode) {
                return currentFolder; // No change in child subtree, so currentFolder also unchanged
            }

            if (updatedChild === undefined || (updatedChild.type === 'folder' && Object.keys(updatedChild.children).length === 0)) {
                // Child node was deleted or became empty, remove it from this folder's children
                delete newChildren[part];
            } else {
                newChildren[part] = updatedChild;
            }
        }
        
        // After modification, if this folder is now empty and it's not the initial call (root),
        // signal to parent that this folder should be removed.
        if (Object.keys(newChildren).length === 0 && index > 0) {
            return undefined; // Signal parent to remove this folder
        }
        // Return a new folder node with updated children, or undefined if this folder itself is empty and should be removed.
        return { ...currentFolder, children: newChildren };
    };

    // FIX: Provide the initial index (0) to the _unset function call.
    const updatedRoot = _unset(root, parts, 0);
    
    // If updatedRoot is undefined, it means the entire path (starting from root) was deleted,
    // resulting in an effectively empty root folder.
    // If updatedRoot is the original root, it means no changes occurred.
    // Otherwise, it's the new, updated root object.
    return updatedRoot === undefined ? { type: 'folder', children: {} } : updatedRoot;
};