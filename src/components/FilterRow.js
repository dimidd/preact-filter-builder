import { h } from 'preact';

/**
 * Map of predicate symbols to display labels.
 */
const PREDICATE_LABELS = {
    '<': '<',
    '<=': '≤',
    '>': '>',
    '>=': '≥',
    '==': '=',
    '!=': '≠'
};

const ALLOWED_FILTER_VALUE_TYPES = new Set(['int', 'float', 'string', 'boolean']);

/**
 * Resolve schema-driven fields for a filter row and detect misconfiguration.
 *
 * Does not fall back to implicit default relations or value types when the
 * schema is missing, invalid, or disagrees with the current filter.
 *
 * :param schema: Array of filter type definitions (may be invalid)
 * :param filter: Filter with type, predicate, ref
 * :returns: Binding with optional user-facing warning, relations list, value editor kind, and UI flags
 */
function resolveFilterRowSchemaBinding(schema, filter) {
    const filterType = filter.type;
    const pred = filter.predicate;

    const lockedPredicateRelations = (p) => (p ? [p] : []);

    if (!Array.isArray(schema)) {
        return {
            warning: 'Filter schema must be an array. Check how FilterBuilder receives the schema prop.',
            schemaItem: null,
            availableRelations: lockedPredicateRelations(pred),
            valueTypeForInput: 'string',
            predicateSelectDisabled: true,
            useStringOptionsDropdown: false
        };
    }

    if (schema.length === 0) {
        return {
            warning: 'Filter schema is empty; define at least one filter type.',
            schemaItem: null,
            availableRelations: lockedPredicateRelations(pred),
            valueTypeForInput: 'string',
            predicateSelectDisabled: true,
            useStringOptionsDropdown: false
        };
    }

    const schemaItem = schema.find(
        (s) => s && typeof s === 'object' && typeof s.name === 'string' && s.name === filterType
    );

    if (!schemaItem) {
        return {
            warning: `Unknown filter type ${JSON.stringify(String(filterType))}. It is not listed in the schema.`,
            schemaItem: null,
            availableRelations: lockedPredicateRelations(pred),
            valueTypeForInput: 'string',
            predicateSelectDisabled: true,
            useStringOptionsDropdown: false
        };
    }

    const parts = [];

    let availableRelations;
    let predicateSelectDisabled = false;
    if (!Array.isArray(schemaItem.relations) || schemaItem.relations.length === 0) {
        parts.push(
            `Schema entry ${JSON.stringify(schemaItem.name)} has invalid or empty relations.`
        );
        availableRelations = lockedPredicateRelations(pred);
        predicateSelectDisabled = true;
    } else {
        availableRelations = schemaItem.relations;
        if (!availableRelations.includes(pred)) {
            parts.push(
                `Current operator ${JSON.stringify(pred)} is not allowed for type ${JSON.stringify(schemaItem.name)}.`
            );
        }
    }

    let valueTypeForInput;
    let useStringOptionsDropdown = true;
    if (schemaItem.valueType == null || schemaItem.valueType === '') {
        parts.push(`Schema entry ${JSON.stringify(schemaItem.name)} is missing valueType.`);
        valueTypeForInput = 'string';
        useStringOptionsDropdown = false;
    } else if (!ALLOWED_FILTER_VALUE_TYPES.has(schemaItem.valueType)) {
        parts.push(
            `Schema entry ${JSON.stringify(schemaItem.name)} has unsupported valueType ${JSON.stringify(schemaItem.valueType)}.`
        );
        valueTypeForInput = 'string';
        useStringOptionsDropdown = false;
    } else {
        valueTypeForInput = schemaItem.valueType;
    }

    return {
        warning: parts.length > 0 ? parts.join(' ') : null,
        schemaItem,
        availableRelations,
        valueTypeForInput,
        predicateSelectDisabled,
        useStringOptionsDropdown
    };
}

/**
 * Single filter row component.
 * 
 * Renders a row with type selector, predicate selector, value input, and remove button.
 * The available types and predicates are derived from the schema prop.
 * 
 * :param filter: Filter object with id, type, predicate, ref
 * :param schema: Array of filter definitions with name, relations, valueType, and optional options
 *   - For string types, if options array is provided, a select dropdown will be rendered
 *   - Options can be strings or objects with {value, label} format
 *   - If the schema is missing, invalid, or disagrees with this row, an alert banner is shown and defaults are not applied silently
 * :param store: Filter store object (not used directly, for compatibility)
 * :param showConnector: Whether to show the connector button
 * :param connector: Current connector ('AND' or 'OR')
 * :param onToggleConnector: Callback when connector is toggled
 * :param onUpdateFilter: Callback for filter updates (filterId, updates) => void
 * :param onRemoveFilter: Callback for filter removal (filterId) => void
 * :param groupId: ID of the group this filter belongs to
 * :param index: Index of this filter in the group
 */
export function FilterRow({ 
    filter, 
    schema, 
    store, 
    showConnector, 
    connector, 
    onToggleConnector, 
    onUpdateFilter,
    onRemoveFilter,
    groupId, 
    index 
}) {
    const handleChange = (field, value) => {
        const updates = { [field]: value };

        if (field === 'type') {
            const schemaItem = Array.isArray(schema)
                ? schema.find((s) => s && typeof s === 'object' && s.name === value)
                : null;
            if (
                schemaItem &&
                Array.isArray(schemaItem.relations) &&
                schemaItem.relations.length > 0 &&
                !schemaItem.relations.includes(filter.predicate)
            ) {
                updates.predicate = schemaItem.relations[0];
            }
        }

        onUpdateFilter(filter.id, updates);
    };

    const binding = resolveFilterRowSchemaBinding(schema, filter);
    const {
        warning,
        schemaItem: currentSchemaItem,
        availableRelations,
        valueTypeForInput,
        predicateSelectDisabled,
        useStringOptionsDropdown
    } = binding;
    const options = currentSchemaItem ? currentSchemaItem.options : null;

    const connectorRow = showConnector && index > 0 ? h('div', { class: 'fb-connector-row' },
        h('div', { class: 'fb-connector-line' }),
        h('button', {
            class: `fb-connector-btn ${connector === 'AND' ? 'fb-connector-and' : 'fb-connector-or'}`,
            onClick: onToggleConnector,
            type: 'button'
        }, h('span', { class: 'fb-connector-label' }, connector)),
        h('div', { class: 'fb-connector-line' })
    ) : null;

    const hasTypeInSchema =
        Array.isArray(schema) &&
        schema.some(
            (s) => s && typeof s === 'object' && typeof s.name === 'string' && s.name === filter.type
        );
    const typeOptions = [];
    if (Array.isArray(schema) && !hasTypeInSchema && filter.type !== undefined && filter.type !== '') {
        typeOptions.push(
            h(
                'option',
                { value: String(filter.type), selected: true },
                `${String(filter.type)} (not in schema)`
            )
        );
    }
    if (Array.isArray(schema)) {
        for (const t of schema) {
            if (!t || typeof t !== 'object' || typeof t.name !== 'string') {
                continue;
            }
            typeOptions.push(
                h('option', { value: t.name, selected: hasTypeInSchema && filter.type === t.name }, t.name)
            );
        }
    }

    let predicateOptions;
    if (availableRelations.length === 0) {
        predicateOptions = [
            h('option', { value: '', disabled: true, selected: true }, 'No operators defined')
        ];
    } else {
        const opts = [];
        const pred = filter.predicate;
        if (
            !predicateSelectDisabled &&
            pred !== undefined &&
            pred !== '' &&
            !availableRelations.includes(pred)
        ) {
            opts.push(
                h(
                    'option',
                    { value: String(pred), selected: true },
                    `${String(pred)} (not allowed for this type)`
                )
            );
        }
        for (const p of availableRelations) {
            opts.push(h('option', { value: p, selected: pred === p }, PREDICATE_LABELS[p] || p));
        }
        predicateOptions = opts;
    }

    // Render appropriate input based on value type
    let valueInput;
    if (valueTypeForInput === 'boolean') {
        // Boolean: use select dropdown
        const booleanValue = filter.ref === 'true' || filter.ref === true || filter.ref === '1';
        valueInput = h('select', {
            class: 'fb-filter-ref',
            value: booleanValue ? 'true' : 'false',
            onChange: (e) => handleChange('ref', e.target.value)
        }, [
            h('option', { value: 'true' }, 'True'),
            h('option', { value: 'false' }, 'False')
        ]);
    } else if (valueTypeForInput === 'string') {
        // String: use select dropdown if options provided, otherwise text input
        if (useStringOptionsDropdown && options && Array.isArray(options) && options.length > 0) {
            const optionElements = options.map(opt => {
                const optionValue = typeof opt === 'string' ? opt : opt.value;
                const optionLabel = typeof opt === 'string' ? opt : (opt.label || opt.value);
                return h('option', { value: optionValue, selected: filter.ref === optionValue }, optionLabel);
            });
            valueInput = h('select', {
                class: 'fb-filter-ref',
                value: filter.ref || '',
                onChange: (e) => handleChange('ref', e.target.value)
            }, optionElements);
        } else {
            valueInput = h('input', {
                type: 'text',
                class: 'fb-filter-ref',
                placeholder: 'Reference value',
                value: filter.ref || '',
                onInput: (e) => handleChange('ref', e.target.value)
            });
        }
    } else {
        // Number (int or float): use number input
        const inputStep = valueTypeForInput === 'int' ? '1' : 'any';
        valueInput = h('input', {
            type: 'number',
            class: 'fb-filter-ref',
            placeholder: 'Reference value',
            step: inputStep,
            value: filter.ref || '',
            onInput: (e) => handleChange('ref', e.target.value.trim())
        });
    }

    const schemaWarning = warning
        ? h('p', { class: 'fb-schema-warning', role: 'alert' }, warning)
        : null;

    return h('div', { class: 'fb-filter-row-wrapper' },
        connectorRow,
        schemaWarning,
        h('div', { class: 'fb-filter-row', id: `filter-${filter.id}` },
            h('label', { class: 'fb-label' }, 'Type:'),
            h('select', {
                class: 'fb-filter-type',
                value: filter.type,
                disabled: !Array.isArray(schema) || schema.length === 0,
                onChange: (e) => handleChange('type', e.target.value)
            }, typeOptions),
            h('label', { class: 'fb-label' }, 'Operator:'),
            h('select', {
                class: 'fb-filter-predicate',
                value: filter.predicate,
                disabled: predicateSelectDisabled || availableRelations.length === 0,
                onChange: (e) => handleChange('predicate', e.target.value)
            }, predicateOptions),
            h('label', { class: 'fb-label' }, 'Value:'),
            valueInput,
            h('button', {
                class: 'fb-remove-filter',
                onClick: () => onRemoveFilter(filter.id),
                type: 'button'
            }, 'Remove')
        )
    );
}
