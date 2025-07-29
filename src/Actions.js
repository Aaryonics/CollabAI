const ACTIONS = {
    JOIN: 'join',
    JOINED: 'joined',
    DISCONNECTED: 'disconnected',
    CODE_CHANGE: 'code-change',
    SYNC_CODE: 'sync-code',
    LEAVE: 'leave',
    // New actions for notebook cells
    ADD_CELL: 'add-cell',
    DELETE_CELL: 'delete-cell',
    REORDER_CELLS: 'reorder-cells',
    UPDATE_CELL: 'update-cell',
    EXECUTE_CELL: 'execute-cell',
    CELL_OUTPUT: 'cell-output',
    SYNC_NOTEBOOK: 'sync-notebook',
    NOTEBOOK_STATE: 'notebook-state',
};

module.exports = ACTIONS;