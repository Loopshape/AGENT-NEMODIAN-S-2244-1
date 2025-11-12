
import type { FolderNode, FileSystemNode, FileNode } from '../types';

/**
 * Traverses the file system tree to retrieve a node at a specific path.
 *
 * @param {FolderNode} root - The root of the file system.
 * @param {string} path - The slash-separated path to the desired node (e.g., '/src/components/Button.js').
 *                        The path should be absolute from the root.
 * @returns {FileSystemNode | undefined} The node if found, otherwise `undefined`.
 * @example
 * // Assuming fs is { type: 'folder', children: { 'a': { type: 'file', content: '...' } } }
 * get(fs, '/a'); // returns { type: 'file', content: '...' }
 * get(fs, '/b'); // returns undefined
 */
export const get = (root: FolderNode, path: string): FileSystemNode | undefined => {
    const parts = path.split('/').filter(p => p);
    let currentNode: FileSystemNode = root;

    for (const part of parts) {
        if (currentNode.type === 'folder' && currentNode.children[part]) {
            currentNode = currentNode.children[part];
        } else {
            return undefined; // Path segment not found or trying to descend into a file
        }
    }
    return currentNode;
};

/**
 * Helper function to ensure a path segment points to a folder, creating it if necessary.
 * Throws an error if a path segment that should be a folder actually points to a file,
 * unless it's the very last segment to be potentially overwritten.
 * @param {Record<string, FileSystemNode>} children - The children object of the current parent folder.
 * @param {string} segment - The current path segment name.
 * @param {boolean} isFinalSegment - True if this is the last segment in the path.
 * @returns {FolderNode} The existing or newly created folder node for the segment.
 * @throws {Error} If `segment` refers to a file when a folder is expected (i.e., trying to set a child inside a file).
 */
const getOrCreateFolder = (children: Record<string, FileSystemNode>, segment: string, isFinalSegment: boolean): FolderNode => {
    const existingNode = children[segment];

    if (existingNode) {
        if (existingNode.type === 'file' && !isFinalSegment) {
            // Cannot create a sub-item inside a file. If this is an intermediate segment, it must be a folder.
            throw new Error(`Path segment '${segment}' at an intermediate level refers to a file. Cannot set a child within a file.`);
        }
        if (existingNode.type === 'folder') {
            return existingNode;
        }
        // If it's a file and it's the final segment, it will be overwritten. Proceed by creating a new folder for the recursive step if value is a folder
    }
    // No existing node, or existing node was a file and it's the final segment (will be overwritten if new value is file).
    // Create a new folder for intermediate segments or if the new value for this segment is a folder.
    return { type: 'folder', children: {} };
};

/**
 * Immutably sets a node at a specific path in the file system tree.
 * Creates parent directories if they don't exist.
 *
 * @param {FolderNode} root - The root of the file system.
 * @param {string} path - The slash-separated path where the node should be set (e.g., '/src/newFile.js').
 * @param {FileSystemNode} value - The node to set (either a `FileNode` or `FolderNode`).
 * @returns {FolderNode} The new, updated file system root.
 * @throws {Error} If `path` is empty (root) and `value` is a `FileNode`.
 * @throws {Error} If an intermediate path segment refers to a file when a folder is expected.
 * @throws {Error} If attempting to overwrite a file with a folder, or a folder with a file, at the final segment.
 * @example
 * // Assuming fs is { type: 'folder', children: {} }
 * set(fs, '/src/main.js', { type: 'file', content: '// main' });
 * // returns { type: 'folder', children: { 'src': { type: 'folder', children: { 'main.js': { ... } } } } }
 */
export const set = (root: FolderNode, path: string, value: FileSystemNode): FolderNode => {
    const parts = path.split('/').filter(p => p);
    if (parts.length === 0) {
        if (value.type === 'folder') {
            return value; // Setting the root itself, if it's a folder
        }
        throw new Error('Cannot set a non-folder node to the root path.');
    }

    const _set = (currentFolder: FolderNode, currentParts: string[], index: number): FolderNode => {
        const segment = currentParts[index];
        const isFinalSegment = index === currentParts.length - 1;
        const newChildren: Record<string, FileSystemNode> = { ...currentFolder.children };

        if (isFinalSegment) {
            // This is the last segment, so assign the new value.
            // Check for type conflict if overwriting an existing node.
            const existingNode = newChildren[segment];
            if (existingNode && existingNode.type !== value.type) {
                if (existingNode.type === 'file' && value.type === 'folder') {
                    throw new Error(`Cannot overwrite existing file '${segment}' with a folder at path '${path}'.`);
                }
                if (existingNode.type === 'folder' && value.type === 'file') {
                    throw new Error(`Cannot overwrite existing folder '${segment}' with a file at path '${path}'.`);
                }
            }
            newChildren[segment] = value;
        } else {
            // Not the last segment, need to descend further. Ensure the segment is a folder.
            const nextFolder = getOrCreateFolder(newChildren, segment, isFinalSegment);
            newChildren[segment] = _set(nextFolder, currentParts, index + 1);
        }
        // Return a new folder node with updated children
        return { ...currentFolder, children: newChildren };
    };

    return _set(root, parts, 0);
};

/**
 * Helper to check if a folder node is effectively empty (contains no children).
 * @param {FileSystemNode | undefined} node - The node to check.
 * @returns {boolean} True if the node is an empty folder, false otherwise.
 */
const isFolderEmpty = (node: FileSystemNode | undefined): boolean => {
    return node?.type === 'folder' && Object.keys(node.children).length === 0;
};

/**
 * Immutably unsets (deletes) a node at a specific path in the file system tree.
 * If deleting a folder makes its parent folder empty, the parent is also deleted recursively.
 *
 * @param {FolderNode} root - The root of the file system.
 * @param {string} path - The slash-separated path of the node to delete (e.g., '/src/oldFile.js').
 * @returns {FolderNode} The new, updated file system root. If the root itself becomes empty, returns an empty root folder.
 * @throws {Error} If trying to unset a child within a file (e.g., '/file/child').
 * @example
 * // Assuming fs is { type: 'folder', children: { 'a': { type: 'file', content: '...' } } }
 * unset(fs, '/a'); // returns { type: 'folder', children: {} }
 * // If deleting a subfolder makes a parent folder empty, the parent is also deleted:
 * // fs: { type: 'folder', children: { 'src': { type: 'folder', children: { 'components': { ... }, 'utils': { ... } } } } }
 * // unset(fs, '/src/components') might remove 'components' and if 'utils' is also gone, then 'src' too.
 */
export const unset = (root: FolderNode, path: string): FolderNode => {
    const parts = path.split('/').filter(p => p);
    if (parts.length === 0) {
        // Attempting to unset the root itself means making it empty
        return { type: 'folder', children: {} };
    }

    // _unset returns the updatedFolderNode, or undefined if the currentFolder (at 'segment' in parent) should be removed.
    const _unset = (currentFolder: FolderNode, currentParts: string[], index: number): FolderNode | undefined => {
        const segment = currentParts[index];
        const newChildren: Record<string, FileSystemNode> = { ...currentFolder.children };
        const existingNode = newChildren[segment];

        if (!existingNode) {
            // Segment does not exist, no changes needed in this branch.
            // Return currentFolder (unchanged) to signal no deletion/modification needed here.
            return currentFolder;
        }

        if (index === currentParts.length - 1) {
            // This is the target item to delete.
            delete newChildren[segment];
        } else {
            // Not the last segment, recurse deeper.
            if (existingNode.type === 'file') {
                // Cannot descend into a file to delete a child.
                throw new Error(`Path segment '${segment}' refers to a file. Cannot unset a child within a file.`);
            }

            const updatedChildFolder: FolderNode | undefined = _unset(existingNode, currentParts, index + 1) as FolderNode | undefined;

            if (updatedChildFolder === existingNode) {
                // No change in the child subtree, so currentFolder also remains unchanged.
                return currentFolder;
            }

            if (updatedChildFolder === undefined || isFolderEmpty(updatedChildFolder)) {
                // Child node was deleted or became empty, remove it from this folder's children.
                delete newChildren[segment];
            } else {
                // Child folder was modified, update it.
                newChildren[segment] = updatedChildFolder;
            }
        }

        // If this folder (currentFolder) is now empty and it's not the initial call (root),
        // signal to the parent that this folder should also be removed.
        if (Object.keys(newChildren).length === 0 && index > 0) {
            return undefined; // Signal parent to remove this folder.
        }

        // Return a new folder node with updated children.
        return { ...currentFolder, children: newChildren };
    };

    const updatedRoot: FolderNode | undefined = _unset(root, parts, 0);

    // If updatedRoot is undefined, it means the entire path (starting from root) was deleted,
    // resulting in an effectively empty root folder.
    return updatedRoot === undefined ? { type: 'folder', children: {} } : updatedRoot;
};