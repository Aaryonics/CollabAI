import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import { v4 as uuidV4 } from 'uuid';
import Cell from './Cell';
import ACTIONS from '../Actions';
import { 
    FiPlus, 
    FiCode, 
    FiFileText, 
    FiSave, 
    FiDownload, 
    FiUpload,
    FiPlay,
    FiSquare,
    FiRefreshCw
} from 'react-icons/fi';

const NotebookEditor = ({ socketRef, roomId }) => {
    const [cells, setCells] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExecutingAll, setIsExecutingAll] = useState(false);

    useEffect(() => {
        if (!socketRef.current) return;

        // Listen for notebook state
        socketRef.current.on(ACTIONS.NOTEBOOK_STATE, ({ notebook }) => {
            setCells(notebook.cells || []);
            setIsLoading(false);
        });

        // Listen for cell updates
        socketRef.current.on(ACTIONS.ADD_CELL, ({ cell, index }) => {
            setCells(prevCells => {
                const newCells = [...prevCells];
                if (index !== undefined) {
                    newCells.splice(index, 0, cell);
                } else {
                    newCells.push(cell);
                }
                return newCells;
            });
        });

        socketRef.current.on(ACTIONS.DELETE_CELL, ({ cellId }) => {
            setCells(prevCells => prevCells.filter(cell => cell.id !== cellId));
        });

        socketRef.current.on(ACTIONS.UPDATE_CELL, ({ cellId, content, cellType, language }) => {
            setCells(prevCells => 
                prevCells.map(cell => 
                    cell.id === cellId 
                        ? { ...cell, content, type: cellType || cell.type, language: language || cell.language }
                        : cell
                )
            );
        });

        socketRef.current.on(ACTIONS.REORDER_CELLS, ({ cellIds }) => {
            setCells(prevCells => {
                const newCells = [];
                cellIds.forEach(id => {
                    const cell = prevCells.find(c => c.id === id);
                    if (cell) newCells.push(cell);
                });
                return newCells;
            });
        });

        socketRef.current.on(ACTIONS.CELL_OUTPUT, ({ cellId, output }) => {
            setCells(prevCells =>
                prevCells.map(cell =>
                    cell.id === cellId ? { ...cell, output } : cell
                )
            );
        });

        return () => {
            socketRef.current.off(ACTIONS.NOTEBOOK_STATE);
            socketRef.current.off(ACTIONS.ADD_CELL);
            socketRef.current.off(ACTIONS.DELETE_CELL);
            socketRef.current.off(ACTIONS.UPDATE_CELL);
            socketRef.current.off(ACTIONS.REORDER_CELLS);
            socketRef.current.off(ACTIONS.CELL_OUTPUT);
        };
    }, [socketRef.current]);

    const handleAddCell = (index, type = 'code') => {
        const newCell = {
            id: uuidV4(),
            type,
            content: type === 'code' ? '' : '# New markdown cell',
            output: null,
            language: type === 'code' ? 'python' : undefined
        };

        setCells(prevCells => {
            const newCells = [...prevCells];
            if (index !== undefined) {
                newCells.splice(index, 0, newCell);
            } else {
                newCells.push(newCell);
            }
            return newCells;
        });

        socketRef.current.emit(ACTIONS.ADD_CELL, {
            roomId,
            cell: newCell,
            index
        });
    };

    const handleDeleteCell = (cellId) => {
        setCells(prevCells => prevCells.filter(cell => cell.id !== cellId));
        socketRef.current.emit(ACTIONS.DELETE_CELL, { roomId, cellId });
    };

    const handleUpdateCell = (cellId, content, cellType, language) => {
        setCells(prevCells =>
            prevCells.map(cell =>
                cell.id === cellId 
                    ? { ...cell, content, type: cellType || cell.type, language: language || cell.language }
                    : cell
            )
        );

        socketRef.current.emit(ACTIONS.UPDATE_CELL, {
            roomId,
            cellId,
            content,
            cellType,
            language
        });
    };

    const handleExecuteCell = (cellId) => {
        socketRef.current.emit(ACTIONS.EXECUTE_CELL, { roomId, cellId });
    };

    const handleDuplicateCell = (cellId, insertIndex) => {
        const cellToDuplicate = cells.find(cell => cell.id === cellId);
        if (!cellToDuplicate) return;

        const newCell = {
            ...cellToDuplicate,
            id: uuidV4(),
            output: null // Clear output for duplicated cell
        };

        setCells(prevCells => {
            const newCells = [...prevCells];
            newCells.splice(insertIndex, 0, newCell);
            return newCells;
        });

        socketRef.current.emit(ACTIONS.ADD_CELL, {
            roomId,
            cell: newCell,
            index: insertIndex
        });
    };

    const handleExecuteAllCells = async () => {
        setIsExecutingAll(true);
        const codeCells = cells.filter(cell => cell.type === 'code');
        
        for (const cell of codeCells) {
            await new Promise(resolve => {
                socketRef.current.emit(ACTIONS.EXECUTE_CELL, { roomId, cellId: cell.id });
                setTimeout(resolve, 500); // Wait 500ms between executions
            });
        }
        
        setIsExecutingAll(false);
    };

    const handleClearAllOutputs = () => {
        if (window.confirm('Clear all cell outputs?')) {
            setCells(prevCells =>
                prevCells.map(cell => ({ ...cell, output: null }))
            );
            
            // You could emit this to sync with other users
            cells.forEach(cell => {
                if (cell.output) {
                    socketRef.current.emit(ACTIONS.UPDATE_CELL, {
                        roomId,
                        cellId: cell.id,
                        content: cell.content,
                        cellType: cell.type,
                        language: cell.language
                    });
                }
            });
        }
    };

    const handleDragEnd = (result) => {
        if (!result.destination) return;

        const items = Array.from(cells);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        setCells(items);

        const cellIds = items.map(cell => cell.id);
        socketRef.current.emit(ACTIONS.REORDER_CELLS, { roomId, cellIds });
    };

    const handleMoveUp = (index) => {
        if (index === 0) return;
        
        const newCells = [...cells];
        [newCells[index - 1], newCells[index]] = [newCells[index], newCells[index - 1]];
        setCells(newCells);

        const cellIds = newCells.map(cell => cell.id);
        socketRef.current.emit(ACTIONS.REORDER_CELLS, { roomId, cellIds });
    };

    const handleMoveDown = (index) => {
        if (index === cells.length - 1) return;
        
        const newCells = [...cells];
        [newCells[index], newCells[index + 1]] = [newCells[index + 1], newCells[index]];
        setCells(newCells);

        const cellIds = newCells.map(cell => cell.id);
        socketRef.current.emit(ACTIONS.REORDER_CELLS, { roomId, cellIds });
    };

    const handleExportNotebook = () => {
        const notebookData = {
            cells: cells.map(cell => ({
                cell_type: cell.type,
                source: cell.content,
                metadata: { language: cell.language },
                outputs: cell.output ? [cell.output] : []
            })),
            metadata: {
                kernelspec: {
                    display_name: "Python 3",
                    language: "python",
                    name: "python3"
                }
            },
            nbformat: 4,
            nbformat_minor: 4
        };

        const blob = new Blob([JSON.stringify(notebookData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notebook-${roomId}.ipynb`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-white text-lg">Loading notebook...</div>
            </div>
        );
    }

    const codeCellCount = cells.filter(cell => cell.type === 'code').length;
    const markdownCellCount = cells.filter(cell => cell.type === 'markdown').length;

    return (
        <div className="h-full flex flex-col bg-gray-900">
            {/* Enhanced Notebook Toolbar */}
            <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-600">
                <div className="flex items-center space-x-6">
                    <h2 className="text-white font-semibold text-lg">Notebook</h2>
                    
                    {/* Cell Creation Buttons */}
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => handleAddCell(0, 'code')}
                            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                        >
                            <FiCode size={16} />
                            <span>Code</span>
                        </button>
                        <button
                            onClick={() => handleAddCell(0, 'markdown')}
                            className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-500 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                        >
                            <FiFileText size={16} />
                            <span>Markdown</span>
                        </button>
                    </div>

                    {/* Execution Controls */}
                    <div className="flex items-center space-x-2 border-l border-gray-600 pl-4">
                        <button
                            onClick={handleExecuteAllCells}
                            disabled={isExecutingAll || codeCellCount === 0}
                            className={`flex items-center space-x-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
                                isExecutingAll || codeCellCount === 0
                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-500 text-white'
                            }`}
                        >
                            <FiPlay size={16} className={isExecutingAll ? 'animate-spin' : ''} />
                            <span>{isExecutingAll ? 'Running...' : 'Run All'}</span>
                        </button>
                        
                        <button
                            onClick={handleClearAllOutputs}
                            className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                        >
                            <FiSquare size={16} />
                            <span>Clear</span>
                        </button>
                    </div>
                </div>
                
                <div className="flex items-center space-x-4">
                    {/* Cell Stats */}
                    <div className="text-gray-400 text-sm">
                        {codeCellCount} code • {markdownCellCount} markdown • {cells.length} total
                    </div>
                    
                    {/* Notebook Actions */}
                    <div className="flex items-center space-x-2">
                        <button 
                            onClick={handleExportNotebook}
                            className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
                        >
                            <FiDownload size={16} />
                            <span>Export</span>
                        </button>
                        
                        <button className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors">
                            <FiSave size={16} />
                            <span>Save</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Notebook Content */}
            <div className="flex-1 overflow-auto p-6">
                <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="notebook">
                        {(provided) => (
                            <div
                                {...provided.droppableProps}
                                ref={provided.innerRef}
                                className="space-y-0 max-w-full"
                            >
                                {cells.length === 0 ? (
                                    <div className="text-center py-16">
                                        <div className="text-gray-500 text-lg mb-6">Welcome to your new notebook!</div>
                                        <div className="text-gray-400 mb-8">Start by adding your first cell</div>
                                        <div className="flex justify-center space-x-3">
                                            <button
                                                onClick={() => handleAddCell(0, 'code')}
                                                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                                            >
                                                <FiCode size={20} />
                                                <span>Add Code Cell</span>
                                            </button>
                                            <button
                                                onClick={() => handleAddCell(0, 'markdown')}
                                                className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                                            >
                                                <FiFileText size={20} />
                                                <span>Add Markdown Cell</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    cells.map((cell, index) => (
                                        <Cell
                                            key={cell.id}
                                            cell={cell}
                                            index={index}
                                            onUpdateCell={handleUpdateCell}
                                            onDeleteCell={handleDeleteCell}
                                            onAddCell={handleAddCell}
                                            onExecuteCell={handleExecuteCell}
                                            onDuplicateCell={handleDuplicateCell}
                                            onMoveUp={handleMoveUp}
                                            onMoveDown={handleMoveDown}
                                            isFirst={index === 0}
                                            isLast={index === cells.length - 1}
                                        />
                                    ))
                                )}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>

                {/* Add Cell at Bottom */}
                {cells.length > 0 && (
                    <div className="flex justify-center mt-8">
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={() => handleAddCell(cells.length, 'code')}
                                className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors"
                            >
                                <FiPlus size={16} />
                                <FiCode size={16} />
                                <span>Code Cell</span>
                            </button>
                            <button
                                onClick={() => handleAddCell(cells.length, 'markdown')}
                                className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-lg transition-colors"
                            >
                                <FiPlus size={16} />
                                <FiFileText size={16} />
                                <span>Markdown Cell</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotebookEditor;