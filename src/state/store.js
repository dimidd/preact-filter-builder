import { signal, computed } from '@preact/signals';
import { formatSequentialGroupId } from '../lib/groupIds.js';

/**
 * Create a new filter store with Preact Signals.
 * 
 * :param schema: Array of filter definitions with name, relations, and valueType
 * :returns: Object containing signals and utility functions for filter state management
 * 
 * Example schema:
 *   [
 *     { name: 'count', relations: ['<', '<=', '>', '>='], valueType: 'int' },
 *     { name: 'ratio', relations: ['<', '<=', '>', '>=', '==', '!='], valueType: 'float' }
 *   ]
 */
export function createFilterStore(schema = []) {
    // Filter state signals
    const filters = signal([]);
    const groups = signal({});
    const rootGroup = signal({
        id: 'root',
        connector: 'AND',
        items: []
    });

    // Counters for generating unique IDs
    const filterCounter = signal(0);
    const groupCounter = signal(0);

    // Store the schema
    const filterSchema = signal(schema);

    /**
     * Get next filter ID.
     * 
     * :returns: Next available filter ID
     */
    function getNextFilterId() {
        const id = filterCounter.value;
        filterCounter.value++;
        return id;
    }

    /**
     * Get next group ID.
     * 
     * :returns: Next available group ID string
     */
    function getNextGroupId() {
        const id = formatSequentialGroupId(groupCounter.value);
        groupCounter.value++;
        return id;
    }

    /**
     * Reset filter state to initial values.
     */
    function resetFilters() {
        filters.value = [];
        groups.value = {};
        rootGroup.value = {
            id: 'root',
            connector: 'AND',
            items: []
        };
        filterCounter.value = 0;
        groupCounter.value = 0;
    }

    /**
     * Get the default filter type from schema.
     * 
     * :returns: First filter name from schema or empty string
     */
    function getDefaultFilterType() {
        return filterSchema.value.length > 0 ? filterSchema.value[0].name : '';
    }

    /**
     * Get the default predicate for a filter type.
     * 
     * :param filterType: The filter type name
     * :returns: First relation from the filter's schema or '<'
     */
    function getDefaultPredicate(filterType) {
        const schemaItem = filterSchema.value.find(s => s.name === filterType);
        return schemaItem && schemaItem.relations.length > 0 ? schemaItem.relations[0] : '<';
    }

    /**
     * Get available relations for a filter type.
     * 
     * :param filterType: The filter type name
     * :returns: Array of available relations
     */
    function getRelationsForType(filterType) {
        const schemaItem = filterSchema.value.find(s => s.name === filterType);
        return schemaItem ? schemaItem.relations : [];
    }

    /**
     * Get the value type for a filter type.
     * 
     * :param filterType: The filter type name
     * :returns: Value type ('int', 'float', etc.) or 'float' as default
     */
    function getValueTypeForType(filterType) {
        const schemaItem = filterSchema.value.find(s => s.name === filterType);
        return schemaItem ? schemaItem.valueType : 'float';
    }

    return {
        // Signals
        filters,
        groups,
        rootGroup,
        filterCounter,
        groupCounter,
        filterSchema,

        // ID generators
        getNextFilterId,
        getNextGroupId,

        // Utilities
        resetFilters,
        getDefaultFilterType,
        getDefaultPredicate,
        getRelationsForType,
        getValueTypeForType
    };
}

// Default store instance (for simple usage)
let defaultStore = null;

/**
 * Hook to get or create filter state.
 * 
 * :param schema: Array of filter definitions (only used on first call or when schema changes)
 * :returns: Filter store object with signals and utilities
 * 
 * Example:
 *   const { filters, rootGroup, groups, getNextFilterId } = useFilterState(schema);
 */
export function useFilterState(schema = []) {
    if (!defaultStore || (schema.length > 0 && defaultStore.filterSchema.value.length === 0)) {
        defaultStore = createFilterStore(schema);
    } else if (schema.length > 0) {
        // Update schema if provided
        defaultStore.filterSchema.value = schema;
    }
    return defaultStore;
}

/**
 * Reset the default store (useful for testing).
 */
export function resetDefaultStore() {
    defaultStore = null;
}
