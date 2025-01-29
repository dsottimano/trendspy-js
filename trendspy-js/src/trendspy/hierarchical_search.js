/**
 * Recursively transforms a tree structure into a flat list.
 * @param {Object} node - Tree node with 'name', 'id' and optional 'children' keys
 * @param {string} parentId - Parent node ID
 * @param {Array} result - Accumulated result
 * @param {boolean} joinIds - Whether to join IDs with parent
 * @returns {Array} List of objects with name and id
 */
function flattenTree(node, parentId = '', result = null, joinIds = true) {
    if (!result) {
        result = [];
    }

    const currentId = node.id;
    // Join IDs only for geographical data
    const fullId = joinIds && parentId ? `${parentId}-${currentId}` : currentId;

    result.push({
        name: node.name,
        id: fullId
    });

    if (node.children) {
        for (const child of node.children) {
            flattenTree(child, joinIds ? fullId : '', result, joinIds);
        }
    }

    return result;
}

/**
 * An index for efficient searches in hierarchical Google Trends data structures.
 * Provides fast lookups for hierarchical data like locations and categories,
 * supporting both exact and partial matching of names.
 */
class HierarchicalIndex {
    /**
     * Initialize the search index.
     * @param {Array} items - List of objects with 'name' and 'id'
     * @param {boolean} partialIdSearch - Whether to allow partial ID matches
     */
    constructor(items, partialIdSearch = true) {
        // Main storage: Map with lowercase name as key
        this.nameToItem = new Map();
        
        // Inverted index for partial matching
        this.wordIndex = new Map();
        
        // Store search mode
        this.partialIdSearch = partialIdSearch;
        
        // Build indexes
        for (const item of items) {
            this.addItem(item);
        }
    }

    /**
     * Add a single item to the index.
     * @param {Object} item - Object with 'name' and 'id'
     */
    addItem(item) {
        const name = item.name.toLowerCase();
        
        // Add to main storage
        this.nameToItem.set(name, item);
        
        // Split name into words and add to inverted index
        const words = new Set(name.split(/\W+/));
        for (const word of words) {
            if (word) {
                if (!this.wordIndex.has(word)) {
                    this.wordIndex.set(word, []);
                }
                this.wordIndex.get(word).push(name);
            }
        }
    }

    /**
     * Perform exact name search (case-insensitive).
     * @param {string} name - Name to search for
     * @returns {Object|null} Item object if found, null otherwise
     */
    exactSearch(name) {
        return this.nameToItem.get(name.toLowerCase()) || null;
    }

    /**
     * Perform partial name search (case-insensitive).
     * @param {string} query - Search query string
     * @returns {Array} List of matching item objects
     */
    partialSearch(query) {
        query = query.toLowerCase();
        const results = new Set();
        
        // Search for partial matches in word index
        for (const [word, items] of this.wordIndex.entries()) {
            if (word.includes(query)) {
                items.forEach(name => results.add(name));
            }
        }
        
        // Also check if query matches any part of full names
        for (const name of this.nameToItem.keys()) {
            if (name.includes(query)) {
                results.add(name);
            }
        }
        
        // Return found items
        return Array.from(results).map(name => this.nameToItem.get(name));
    }

    /**
     * Search by ID.
     * @param {string} idQuery - ID or partial ID to search for
     * @returns {Array} List of matching item objects
     */
    idSearch(idQuery) {
        if (this.partialIdSearch) {
            // For geo data - allow partial matches
            return Array.from(this.nameToItem.values())
                .filter(item => item.id.includes(idQuery));
        } else {
            // For categories - only exact matches
            return Array.from(this.nameToItem.values())
                .filter(item => item.id === idQuery);
        }
    }
}

/**
 * Create a complete search system from a hierarchical tree structure.
 * @param {Object} treeData - Original tree structure
 * @param {boolean} joinIds - Whether to join IDs with parent
 * @returns {HierarchicalIndex} Initialized search system
 */
function createHierarchicalIndex(treeData, joinIds = true) {
    // First flatten the tree
    const flatItems = flattenTree(treeData, '', null, joinIds);
    // Then create and return the search index
    return new HierarchicalIndex(flatItems, joinIds);
}

module.exports = {
    flattenTree,
    HierarchicalIndex,
    createHierarchicalIndex
}; 