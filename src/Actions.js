const ACTIONS = {
    JOIN: 'join',
    JOINED: 'joined',
    DISCONNECTED: 'disconnected',
    CODE_CHANGE: 'code-change',
    SYNC_CODE: 'sync-code',
    LEAVE: 'leave',
    ADD_CELL: 'add-cell',
    DELETE_CELL: 'delete-cell',
    REORDER_CELLS: 'reorder-cells',
    UPDATE_CELL: 'update-cell',
    EXECUTE_CELL: 'execute-cell',
    CELL_OUTPUT: 'cell-output',
    SYNC_NOTEBOOK: 'sync-notebook',
    NOTEBOOK_STATE: 'notebook-state',
    CELL_EXECUTION_START: 'cell-execution-start',
    CELL_EXECUTION_END: 'cell-execution-end',
};

module.exports = ACTIONS;