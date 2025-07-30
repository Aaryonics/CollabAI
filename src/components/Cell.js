import React, { useEffect, useRef, useState } from 'react';
import Codemirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/dracula.css';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/mode/python/python';
import 'codemirror/mode/markdown/markdown';
import 'codemirror/addon/edit/closetag';
import 'codemirror/addon/edit/closebrackets';
import { FiPlay, FiLoader, FiStopCircle } from 'react-icons/fi';
import { Draggable } from 'react-beautiful-dnd';
import CellToolbar from './CellToolbar';
import OutputCell from './OutputCell';

const Cell = ({ 
    cell, 
    index, 
    onUpdateCell, 
    onDeleteCell, 
    onAddCell, 
    onExecuteCell,
    onMoveUp,
    onMoveDown,
    onDuplicateCell,
    isFirst,
    isLast,
    isDragDisabled = false,
    isExecuting = false, // New prop for execution status
    executionQueue = [] // New prop for execution queue
}) => {
    const editorRef = useRef(null);
    const textareaRef = useRef(null);
    const [isHovered, setIsHovered] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [localIsExecuting, setLocalIsExecuting] = useState(false);

    // Sync execution status from parent
    useEffect(() => {
        setLocalIsExecuting(isExecuting);
    }, [isExecuting]);

    useEffect(() => {
        if (cell.type === 'code' && textareaRef.current && !editorRef.current) {
            const mode = cell.language === 'python' ? 'python' : 
                        cell.language === 'javascript' ? 'javascript' : 'python';
            
            editorRef.current = Codemirror.fromTextArea(textareaRef.current, {
                mode: mode,
                theme: 'dracula',
                autoCloseTags: true,
                autoCloseBrackets: true,
                lineNumbers: true,
                lineWrapping: true,
                viewportMargin: Infinity,
                extraKeys: {
                    'Shift-Enter': () => handleExecute(),
                    'Ctrl-Enter': () => handleExecute(),
                    'Cmd-Enter': () => handleExecute(),
                }
            });

            editorRef.current.setValue(cell.content || '');
            
            editorRef.current.on('change', (instance) => {
                const content = instance.getValue();
                onUpdateCell(cell.id, content, cell.type, cell.language);
            });

            // Focus on new cells
            if (!cell.content) {
                setTimeout(() => editorRef.current.focus(), 100);
            }
        }

        return () => {
            if (editorRef.current) {
                editorRef.current.toTextArea();
                editorRef.current = null;
            }
        };
    }, [cell.type]);

    useEffect(() => {
        if (editorRef.current && cell.content !== editorRef.current.getValue()) {
            const cursor = editorRef.current.getCursor();
            editorRef.current.setValue(cell.content || '');
            editorRef.current.setCursor(cursor);
        }
    }, [cell.content]);

    // Update CodeMirror mode when language changes
    useEffect(() => {
        if (editorRef.current && cell.language) {
            const mode = cell.language === 'python' ? 'python' : 
                        cell.language === 'javascript' ? 'javascript' : 'python';
            editorRef.current.setOption('mode', mode);
        }
    }, [cell.language]);

    const handleMarkdownChange = (e) => {
        onUpdateCell(cell.id, e.target.value, cell.type);
    };

    const handleExecute = async () => {
        if (cell.type === 'code' && !localIsExecuting && cell.content.trim()) {
            setLocalIsExecuting(true);
            await onExecuteCell(cell.id);
        }
    };

    const handleLanguageChange = (language) => {
        onUpdateCell(cell.id, cell.content, cell.type, language);
    };

    const handleKeyDown = (e) => {
        if (cell.type === 'markdown' && e.key === 'Escape') {
            setIsEditing(false);
        }
    };

    const getExecutionStatusText = () => {
        if (localIsExecuting) {
            const queuePosition = executionQueue.indexOf(cell.id);
            if (queuePosition > 0) {
                return `Queued (${queuePosition + 1})`;
            }
            return 'Running...';
        }
        return 'Run';
    };

    const getExecutionIcon = () => {
        if (localIsExecuting) {
            const queuePosition = executionQueue.indexOf(cell.id);
            if (queuePosition > 0) {
                return <FiStopCircle className="animate-pulse" />;
            }
            return <FiLoader className="animate-spin" />;
        }
        return <FiPlay />;
    };

    const renderCellContent = () => {
        if (cell.type === 'code') {
            return (
                <div className="relative">
                    <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-600">
                        <div className="flex items-center space-x-3">
                            <select 
                                value={cell.language || 'python'}
                                onChange={(e) => handleLanguageChange(e.target.value)}
                                disabled={localIsExecuting}
                                className="bg-gray-700 text-white text-sm rounded px-3 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="python">Python</option>
                                <option value="javascript">JavaScript</option>
                            </select>
                            
                            <div className="text-xs text-gray-400">
                                Press Shift+Enter to run
                            </div>

                            {/* Execution queue indicator */}
                            {executionQueue.length > 0 && (
                                <div className="text-xs text-yellow-400">
                                    {executionQueue.length} cell{executionQueue.length > 1 ? 's' : ''} in queue
                                </div>
                            )}
                        </div>
                        
                        <button
                            onClick={handleExecute}
                            disabled={localIsExecuting || !cell.content.trim()}
                            className={`flex items-center space-x-2 px-4 py-2 rounded text-sm font-medium transition-all duration-200 ${
                                localIsExecuting 
                                    ? 'bg-yellow-600 text-white cursor-not-allowed' 
                                    : !cell.content.trim()
                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-500 text-white hover:shadow-lg'
                            }`}
                        >
                            {getExecutionIcon()}
                            <span>{getExecutionStatusText()}</span>
                        </button>
                    </div>
                    
                    <div className="relative">
                        <textarea
                            ref={textareaRef}
                            defaultValue={cell.content || ''}
                            className="hidden"
                        />
                        {/* Execution indicator overlay */}
                        {localIsExecuting && (
                            <div className="absolute inset-0 bg-yellow-500/10 pointer-events-none z-10">
                                <div className="absolute top-2 right-2">
                                    <div className="bg-yellow-600 text-white px-3 py-1 rounded text-sm flex items-center space-x-2">
                                        <FiLoader className="animate-spin" size={14} />
                                        <span>Executing...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            );
        } else if (cell.type === 'markdown') {
            return (
                <div className="relative">
                    <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-600">
                        <div className="flex items-center space-x-2">
                            <span className="text-sm text-purple-400 font-medium">Markdown</span>
                        </div>
                        <div className="text-xs text-gray-400">
                            {isEditing ? 'Press Escape to stop editing' : 'Click to edit'}
                        </div>
                    </div>
                    
                    {isEditing ? (
                        <textarea
                            value={cell.content || ''}
                            onChange={handleMarkdownChange}
                            onBlur={() => setIsEditing(false)}
                            onKeyDown={handleKeyDown}
                            className="w-full min-h-[120px] p-4 bg-gray-900 text-white border-none outline-none resize-none font-mono text-sm focus:bg-gray-850"
                            placeholder="Enter markdown content..."
                            autoFocus
                        />
                    ) : (
                        <div 
                            onClick={() => setIsEditing(true)}
                            className="p-4 min-h-[120px] bg-gray-900 cursor-text hover:bg-gray-850 transition-colors"
                        >
                            {cell.content ? (
                                <div className="prose prose-invert max-w-none">
                                    {cell.content.split('\n').map((line, i) => {
                                        if (line.startsWith('# ')) {
                                            return <h1 key={i} className="text-2xl font-bold text-white mb-2">{line.slice(2)}</h1>;
                                        } else if (line.startsWith('## ')) {
                                            return <h2 key={i} className="text-xl font-bold text-white mb-2">{line.slice(3)}</h2>;
                                        } else if (line.startsWith('### ')) {
                                            return <h3 key={i} className="text-lg font-bold text-white mb-2">{line.slice(4)}</h3>;
                                        } else if (line.startsWith('- ')) {
                                            return <li key={i} className="text-gray-300 ml-4">{line.slice(2)}</li>;
                                        } else if (line.includes('**') && line.split('**').length > 2) {
                                            const parts = line.split('**');
                                            return (
                                                <p key={i} className="text-gray-300 mb-1">
                                                    {parts.map((part, j) => 
                                                        j % 2 === 1 ? <strong key={j} className="text-white">{part}</strong> : part
                                                    )}
                                                </p>
                                            );
                                        } else {
                                            return <p key={i} className="text-gray-300 mb-1">{line || '\u00A0'}</p>;
                                        }
                                    })}
                                </div>
                            ) : (
                                <p className="text-gray-500 italic">Click to edit markdown...</p>
                            )}
                        </div>
                    )}
                </div>
            );
        }
    };

    return (
        <Draggable draggableId={cell.id} index={index} isDragDisabled={isDragDisabled || localIsExecuting}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`mb-4 border border-gray-600 rounded-lg overflow-hidden transition-all duration-200 ${
                        snapshot.isDragging ? 'shadow-2xl rotate-1 z-50 ring-2 ring-purple-500' : ''
                    } ${isHovered ? 'border-purple-500 shadow-lg' : ''} ${
                        localIsExecuting ? 'ring-2 ring-yellow-500/50' : ''
                    }`}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    {/* Cell Toolbar */}
                    <CellToolbar
                        cellId={cell.id}
                        cellType={cell.type}
                        index={index}
                        isFirst={isFirst}
                        isLast={isLast}
                        isHovered={isHovered}
                        onAddCell={onAddCell}
                        onDeleteCell={onDeleteCell}
                        onMoveUp={onMoveUp}
                        onMoveDown={onMoveDown}
                        onDuplicateCell={onDuplicateCell}
                        dragHandleProps={provided.dragHandleProps}
                        isExecuting={localIsExecuting}
                    />

                    {/* Cell Content */}
                    <div className="bg-gray-800">
                        {renderCellContent()}
                        <OutputCell output={cell.output} cellId={cell.id} />
                    </div>
                </div>
            )}
        </Draggable>
    );
};

export default Cell;