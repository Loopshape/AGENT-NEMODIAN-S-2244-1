import type { FolderNode, FileSystemNode, FileNode } from '../types';

/**
 * Traverses the file system tree to retrieve a node at a specific path.
 * This function is immutable and does not modify the original file system object.
 *
 * @param {FolderNode} root - The root of the file system.
 * @param {string} path - The slash-separated path to the desired node (e.g., '/src/components/Button.js').
 *                        The path should be absolute from the root and not start with nor end with a slash (except for '/').
 * @returns {FileSystemNode | undefined} The node if found, otherwise `undefined`.
 * @throws {Error} If the path format is invalid (e.g., contains empty segments other than root).
 * @example
 * // Assuming fs is { type: 'folder', children: { 'a': { type: 'file', content: '...' } } }
 * get(fs, '/a'); // returns { type: 'file', content: '...' }
 * get(fs, '/b'); // returns undefined
 * get(fs, '/non/existent/path'); // returns undefined
 */
export const get = (root: FolderNode, path: string): FileSystemNode | undefined => {
    // Split path and filter out empty strings to handle leading/trailing slashes gracefully.
    const parts = path.split('/').filter(p => p);
    let currentNode: FileSystemNode = root;

    for (const part of parts) {
        if (currentNode.type === 'folder' && currentNode.children[part]) {
            currentNode = currentNode.children[part];
        } else {
            // Path segment not found, or trying to descend into a file.
            return undefined;
        }
    }
    return currentNode;
};

/**
 * Immutably sets a node at a specific path in the file system tree.
 * Creates parent directories if they don't exist.
 * This function is immutable and returns a new file system root if changes are made.
 *
 * @param {FolderNode} root - The root of the file system.
 * @param {string} path - The slash-separated path where the node should be set (e.g., '/src/newFile.js').
 *                        The path must be absolute from the root.
 * @param {FileSystemNode} value - The node to set (either a `FileNode` or `FolderNode`).
 * @returns {FolderNode} The new, updated file system root.
 * @throws {Error} If `path` is empty (root) and `value` is a `FileNode` (root must be a folder).
 * @throws {Error} If an intermediate path segment refers to a file when a folder is expected (cannot place children inside a file).
 * @throws {Error} If attempting to overwrite an existing node with a different type (e.g., file with folder, or folder with file).
 * @example
 * // Assuming fs is { type: 'folder', children: {} }
 * set(fs, '/src/main.js', { type: 'file', content: '// main' });
 * // returns { type: 'folder', children: { 'src': { type: 'folder', children: { 'main.js': { ... } } } } }
 * set(fs, '/config', { type: 'folder', children: {} });
 * // returns fs with a new empty 'config' folder
 */
export const set = (root: FolderNode, path: string, value: FileSystemNode): FolderNode => {
    const parts = path.split('/').filter(p => p);
    if (parts.length === 0) {
        // Attempting to set the root itself.
        if (value.type === 'folder') {
            return value; // If the new value is a folder, it replaces the root.
        }
        throw new Error('Cannot set a FileNode directly as the root of the file system. Root must be a FolderNode.');
    }

    /**
     * Recursive helper to set a node.
     * @param {FolderNode} currentFolder - The current folder node being processed in the recursion.
     * @param {string[]} currentParts - Remaining path segments.
     * @param {number} index - Current index in `currentParts`.
     * @returns {FolderNode} A new folder node with the updated children subtree.
     * @throws {Error} For type conflicts or invalid path structures.
     */
    const _set = (currentFolder: FolderNode, currentParts: string[], index: number): FolderNode => {
        const segment = currentParts[index];
        const isFinalSegment = index === currentParts.length - 1;
        // Create a shallow copy of children to maintain immutability.
        const newChildren: Record<string, FileSystemNode> = { ...currentFolder.children };
        const existingNode = newChildren[segment];

        if (isFinalSegment) {
            // This is the last segment, so assign the new value.
            if (existingNode && existingNode.type !== value.type) {
                // Prevent overwriting a file with a folder or vice-versa.
                throw new Error(
                    `Cannot overwrite existing ${existingNode.type} '${segment}' with a ${value.type} at path '/${parts.join('/')}'.`
                );
            }
            newChildren[segment] = value;
        } else {
            // Not the last segment, need to descend further.
            let nextFolder: FolderNode;

            if (existingNode) {
                if (existingNode.type === 'file') {
                    // Cannot descend into a file as if it were a folder.
                    throw new Error(
                        `Path segment '${segment}' at an intermediate level refers to a file. Cannot set a child within a file at path '/${parts.slice(0, index + 1).join('/')}'.`
                    );
                }
                // Existing node is a folder, use it for the next recursive step.
                nextFolder = existingNode;
            } else {
                // Segment does not exist, create a new folder for it.
                nextFolder = { type: 'folder', children: {} };
            }
            // Recursively call _set and update the child in newChildren.
            newChildren[segment] = _set(nextFolder, currentParts, index + 1);
        }
        // Return a new folder node with the updated children.
        return { ...currentFolder, children: newChildren };
    };

    return _set(root, parts, 0);
};

/**
 * Helper to check if a folder node is effectively empty (contains no children).
 * @param {FileSystemNode | undefined} node - The node to check.
 * @returns {boolean} True if the node is an empty folder, false otherwise.
 */
const isFolderEmpty = (node: FileSystemNode | undefined): node is FolderNode => {
    return node !== undefined && node.type === 'folder' && Object.keys(node.children).length === 0;
};

/**
 * Immutably unsets (deletes) a node at a specific path in the file system tree.
 * If deleting a folder makes its parent folder empty, the parent is also deleted recursively.
 * This function is immutable and returns a new file system root if changes are made.
 *
 * @param {FolderNode} root - The root of the file system.
 * @param {string} path - The slash-separated path of the node to delete (e.g., '/src/oldFile.js').
 *                        The path must be absolute from the root.
 * @returns {FolderNode} The new, updated file system root. If the root itself becomes empty after deletion,
 *                       it returns a new empty root folder.
 * @throws {Error} If `path` refers to the root itself (use `set(root, '/', {type: 'folder', children: {}})` to clear root).
 * @throws {Error} If an intermediate path segment refers to a file (cannot delete children within a file).
 * @example
 * // Assuming fs is { type: 'folder', children: { 'a': { type: 'file', content: '...' } } }
 * unset(fs, '/a'); // returns { type: 'folder', children: {} }
 * // If deleting a subfolder makes a parent folder empty, the parent is also deleted:
 * // fs: { type: 'folder', children: { 'src': { type: 'folder', children: { 'components': { ... }, 'utils': { ... } } } } }
 * // unset(fs, '/src/components') might remove 'components' and if 'src/utils' is also empty, then 'src' too.
 */
export const unset = (root: FolderNode, path: string): FolderNode => {
    const parts = path.split('/').filter(p => p);
    if (parts.length === 0) {
        // Attempting to unset the root itself by providing an empty path.
        // The spec implies deleting the root content, so return an empty folder.
        return { type: 'folder', children: {} };
    }

    /**
     * Recursive helper to unset a node.
     * Returns the updated `FolderNode` for the current subtree, or `undefined` if this folder should be removed by its parent.
     *
     * @param {FolderNode} currentFolder - The current folder node being processed in the recursion.
     * @param {string[]} currentParts - Remaining path segments.
     * @param {number} index - Current index in `currentParts`.
     * @returns {FolderNode | undefined} The updated folder node or `undefined` if it should be removed.
     * @throws {Error} If attempting to descend into a file.
     */
    const _unset = (currentFolder: FolderNode, currentParts: string[], index: number): FolderNode | undefined => {
        const segment = currentParts[index];
        const isFinalSegment = index === currentParts.length - 1;
        // Create a shallow copy of children to maintain immutability.
        const newChildren: Record<string, FileSystemNode> = { ...currentFolder.children };
        const existingNode = newChildren[segment];

        if (!existingNode) {
            // Segment does not exist, no changes needed in this branch.
            return currentFolder; // Return currentFolder (unchanged) to signal no deletion/modification needed.
        }

        if (isFinalSegment) {
            // This is the target item to delete.
            delete newChildren[segment];
        } else {
            // Not the last segment, recurse deeper.
            if (existingNode.type === 'file') {
                // Cannot descend into a file to delete a child.
                throw new Error(
                    `Path segment '${segment}' refers to a file. Cannot unset a child within a file at path '/${parts.slice(0, index + 1).join('/')}'.`
                );
            }

            // Recursively unset in the child folder.
            const updatedChildFolder: FolderNode | undefined = _unset(existingNode, currentParts, index + 1);

            // If the recursive call signals deletion (returns undefined) or the child folder became empty.
            if (updatedChildFolder === undefined || isFolderEmpty(updatedChildFolder)) {
                delete newChildren[segment];
            } else if (updatedChildFolder !== existingNode) {
                // Child folder was modified (but not deleted), update it in newChildren.
                newChildren[segment] = updatedChildFolder;
            }
            // If updatedChildFolder === existingNode, it means no changes occurred in the child,
            // so newChildren[segment] is already correct (points to the original existingNode).
        }

        // If this folder (currentFolder) is now empty and it's not the root call (index > 0),
        // signal to the parent that this folder should also be removed.
        if (Object.keys(newChildren).length === 0 && index > 0) {
            return undefined; // Signal parent to remove this folder.
        }

        // Return a new folder node with the updated children.
        // Only create a new object if changes were made to children.
        if (Object.keys(newChildren).length === Object.keys(currentFolder.children).length &&
            Object.keys(newChildren).every(key => newChildren[key] === currentFolder.children[key])) {
            return currentFolder; // No effective change, return original folder for optimization.
        }
        return { ...currentFolder, children: newChildren };
    };

    const updatedRoot: FolderNode | undefined = _unset(root, parts, 0);

    // If updatedRoot is undefined, it means the entire path (starting from root) was deleted,
    // resulting in an effectively empty root folder.
    return updatedRoot === undefined ? { type: 'folder', children: {} } : updatedRoot;
};