import { html } from 'htm/preact';
import { exportFiltersAsJson, importFiltersFromJson } from '../lib/filterSerializer.js';
import { parseSequentialGroupNumericSuffix, SEQUENTIAL_GROUP_ID_PREFIX } from '../lib/groupIds.js';
import { FilterGroup } from './FilterGroup.js';

/**
 * Apply parsed import data to the reactive store: clone for new references,
 * advance ID counters past imported IDs, assign store values, and notify.
 *
 * @param {{ filters: object[], rootGroup: object, groups: Record<string, object> }} result - Parsed import from importFiltersFromJson
 * @param {object} store - Filter store from useFilterState
 * @param {(filters: object[], rootGroup: object, groups: Record<string, object>) => void} [onChange] - Optional change callback
 * @returns {void}
 * @throws {Error} When imported nested group keys are not canonical `group-<n>` ids or disagree with `group.id`
 */
function applyImportedFiltersToStore(result, store, onChange) {
    const clonedFilters = result.filters.map(f => ({ ...f }));
    const clonedRootGroup = {
        ...result.rootGroup,
        items: result.rootGroup.items.map(item => ({ ...item }))
    };
    const clonedGroups = {};
    for (const [key, group] of Object.entries(result.groups)) {
        clonedGroups[key] = {
            ...group,
            items: group.items.map(item => ({ ...item }))
        };
    }

    const invalidGroupKeys = [];
    const groupNumericSuffixes = [];
    for (const key of Object.keys(clonedGroups)) {
        const group = clonedGroups[key];
        if (group.id !== key) {
            throw new Error(
                `Imported groups map is inconsistent: key ${JSON.stringify(key)} does not match group.id ${JSON.stringify(group.id)}.`
            );
        }
        const n = parseSequentialGroupNumericSuffix(key);
        if (n === null) {
            invalidGroupKeys.push(key);
        } else {
            groupNumericSuffixes.push(n);
        }
    }
    if (invalidGroupKeys.length > 0) {
        throw new Error(
            `Cannot import nested groups: expected ids like "${SEQUENTIAL_GROUP_ID_PREFIX}0". ` +
                `Unrecognized id(s): ${invalidGroupKeys.map(k => JSON.stringify(k)).join(', ')}`
        );
    }

    if (clonedFilters.length > 0) {
        const maxFilterId = Math.max(...clonedFilters.map(f => f.id));
        if (maxFilterId >= store.filterCounter.value) {
            store.filterCounter.value = maxFilterId + 1;
        }
    }
    if (groupNumericSuffixes.length > 0) {
        const maxGroupSuffix = Math.max(...groupNumericSuffixes);
        if (maxGroupSuffix >= store.groupCounter.value) {
            store.groupCounter.value = maxGroupSuffix + 1;
        }
    }

    store.filters.value = clonedFilters;
    store.rootGroup.value = clonedRootGroup;
    store.groups.value = clonedGroups;

    if (onChange) {
        onChange(clonedFilters, clonedRootGroup, clonedGroups);
    }
}

/**
 * Filter builder container component.
 * 
 * Provides the main UI for building complex filter expressions with
 * AND/OR boolean connectors. Supports import/export of filter configurations.
 * 
 * :param schema: Array of filter definitions with name, relations, valueType
 * :param store: Filter store object from useFilterState
 * :param onAddFilter: Callback to add a filter to a group (groupId) => void
 * :param onCreateGroup: Callback to create a group (parentGroupId, connector) => void
 * :param onRemoveGroup: Callback to remove a group (groupId) => void
 * :param onToggleConnector: Callback to toggle connector (groupId) => void
 * :param onUpdateFilter: Callback to update a filter (filterId, updates) => void
 * :param onRemoveFilter: Callback to remove a filter (filterId) => void
 * :param onChange: Optional callback when filters change (filters, rootGroup, groups)
 * :param title: Optional title for the filter builder section
 * :param showImportExport: Whether to show import/export buttons (default: true)
 * :param helpText: Optional help text to display below the filter builder
 */
export function FilterBuilder({
    schema,
    store,
    onAddFilter,
    onCreateGroup,
    onRemoveGroup,
    onToggleConnector,
    onUpdateFilter,
    onRemoveFilter,
    onChange,
    title = 'Filter Builder',
    showImportExport = true,
    helpText
}) {
    const handleExport = () => {
        const jsonString = exportFiltersAsJson(
            store.filters.value,
            store.rootGroup.value,
            store.groups.value
        );
        if (!jsonString) {
            alert('No filters to export. Please add some filters first.');
            return;
        }

        // Create a blob and download it
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'filters.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const jsonString = event.target.result;
                    const result = importFiltersFromJson(
                        jsonString,
                        store.getNextFilterId,
                        store.getNextGroupId
                    );
                    applyImportedFiltersToStore(result, store, onChange);
                    alert('Filters imported successfully!');
                } catch (error) {
                    alert('Error importing filters: ' + error.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const handleCopyToClipboard = () => {
        const jsonString = exportFiltersAsJson(
            store.filters.value,
            store.rootGroup.value,
            store.groups.value
        );
        if (!jsonString) {
            alert('No filters to copy. Please add some filters first.');
            return;
        }

        navigator.clipboard.writeText(jsonString).then(() => {
            alert('Filters copied to clipboard!');
        }).catch(err => {
            alert('Failed to copy to clipboard: ' + err.message);
        });
    };

    const handlePasteFromClipboard = () => {
        navigator.clipboard.readText().then(text => {
            try {
                const result = importFiltersFromJson(
                    text,
                    store.getNextFilterId,
                    store.getNextGroupId
                );
                applyImportedFiltersToStore(result, store, onChange);
                alert('Filters imported from clipboard!');
            } catch (error) {
                alert('Error importing filters: ' + error.message);
            }
        }).catch(err => {
            alert('Failed to read from clipboard: ' + err.message);
        });
    };

    return html`
        <div class="fb-section">
            ${title ? html`<h2 class="fb-title">${title}</h2>` : null}
            ${showImportExport ? html`
                <div class="fb-import-export">
                    ${store.filters.value.length > 0 ? html`
                        <button
                            type="button"
                            class="fb-btn fb-btn-secondary"
                            onClick=${handleExport}
                            title="Export filters to a JSON file"
                        >
                            Export Filters
                        </button>
                    ` : null}
                    <button
                        type="button"
                        class="fb-btn fb-btn-secondary"
                        onClick=${handleImport}
                        title="Import filters from a JSON file"
                    >
                        Import Filters
                    </button>
                    ${store.filters.value.length > 0 ? html`
                        <button
                            type="button"
                            class="fb-btn fb-btn-secondary"
                            onClick=${handleCopyToClipboard}
                            title="Copy filters to clipboard"
                        >
                            Copy Filters
                        </button>
                    ` : null}
                    <button
                        type="button"
                        class="fb-btn fb-btn-secondary"
                        onClick=${handlePasteFromClipboard}
                        title="Paste filters from clipboard"
                    >
                        Paste Filters
                    </button>
                </div>
            ` : null}
            <div class="fb-filter-builder" id="filterBuilder">
                <${FilterGroup}
                    groupId="root"
                    parentGroupId="root"
                    index=${0}
                    schema=${schema}
                    store=${store}
                    onAddFilter=${onAddFilter}
                    onCreateGroup=${onCreateGroup}
                    onRemoveGroup=${onRemoveGroup}
                    onToggleConnector=${onToggleConnector}
                    onUpdateFilter=${onUpdateFilter}
                    onRemoveFilter=${onRemoveFilter}
                />
            </div>
            <button
                type="button"
                class="fb-btn fb-btn-secondary fb-add-filter-btn"
                onClick=${() => onAddFilter('root')}
            >
                + Add Filter
            </button>
            ${helpText ? html`
                <div class="fb-help-text">
                    <p>${helpText}</p>
                </div>
            ` : null}
        </div>
    `;
}
