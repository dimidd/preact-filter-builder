/**
 * Canonical format for auto-generated nested group IDs (`group-0`, `group-1`, ...).
 */
export const SEQUENTIAL_GROUP_ID_PREFIX = 'group-';

/**
 * Build a sequential group id for the given counter value.
 *
 * @param {number} n - Non-negative integer index
 * @returns {string} Id string in the form `group-<n>`
 */
export function formatSequentialGroupId(n) {
    return `${SEQUENTIAL_GROUP_ID_PREFIX}${n}`;
}

/**
 * Parse the numeric suffix from a sequential group id string.
 *
 * Only accepts non-negative decimal integer suffixes with no leading sign,
 * e.g. `group-0`, `group-42`. Rejects other shapes so imports do not
 * silently ignore unknown id formats.
 *
 * @param {string} id - Candidate group id
 * @returns {number | null} Parsed non-negative integer, or null if not canonical
 */
export function parseSequentialGroupNumericSuffix(id) {
    if (typeof id !== 'string') {
        return null;
    }
    if (!id.startsWith(SEQUENTIAL_GROUP_ID_PREFIX)) {
        return null;
    }
    const rest = id.slice(SEQUENTIAL_GROUP_ID_PREFIX.length);
    if (rest === '' || !/^\d+$/.test(rest)) {
        return null;
    }
    return parseInt(rest, 10);
}
