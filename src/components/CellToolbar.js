import React, { useState } from 'react';
import { 
    FiPlus, 
    FiTrash2, 
    FiMove, 
    FiCode, 
    FiFileText, 
    FiChevronUp, 
    FiChevronDown,
    FiCopy,
    FiMoreVertical
} from 'react-icons/fi';

const CellToolbar = ({ 
    cellId,
    cellType,
    index,
    isFirst,
    isLast,
    isHovered,
    onAddCell,
    onDeleteCell,
    onMoveUp,
    onMoveDown,
    onDuplicateCell,
    dragHandleProps
}) => {
    const [showMoreOptions, setShowMoreOptions] = useState(false);

    const handleAddCodeCell = () => {
        onAddCell(index + 1, 'code');
        setShowMoreOptions(false);
    };

    const handleAddMarkdownCell = () => {
        onAddCell(index + 1, 'markdown');
        setShowMoreOptions(false);
    };

    const handleDuplicate = () => {
        onDuplicateCell(cellId, index + 1);
        setShowMoreOptions(false);
    };

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete this cell?')) {
            onDeleteCell(cellId);
        }
        setShowMoreOptions(false);
    };

    return (
        <div 
            className={`flex items-center justify-between bg-gray-700 px-3 py-2 transition-all duration-200 ${
                isHovered ? 'opacity-100' : 'opacity-0'
            }`}
        >
            {/* Left side - Cell info and drag handle */}
            <div className="flex items-center space-x-3">
                <div {...dragHandleProps} className="cursor-move p-1 hover:bg-gray-600 rounded">
                    <FiMove className="text-gray-400 hover:text-white" size={14} />
                </div>
                
                <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1">
                        {cellType === 'code' ? (
                            <FiCode className="text-blue-400" size={12} />
                        ) : (
                            <FiFileText className="text-purple-400" size={12} />
                        )}
                        <span className="text-xs text-gray-400">
                            {cellType} • {index + 1}
                        </span>
                    </div>
                </div>
            </div>
            
            {/* Right side - Actions */}
            <div className="flex items-center space-x-1">
                {/* Move buttons */}
                <button
                    onClick={() => !isFirst && onMoveUp(index)}
                    disabled={isFirst}
                    className={`p-1 rounded transition-colors ${
                        isFirst 
                            ? 'text-gray-600 cursor-not-allowed' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-600'
                    }`}
                    title="Move up"
                >
                    <FiChevronUp size={14} />
                </button>
                
                <button
                    onClick={() => !isLast && onMoveDown(index)}
                    disabled={isLast}
                    className={`p-1 rounded transition-colors ${
                        isLast 
                            ? 'text-gray-600 cursor-not-allowed' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-600'
                    }`}
                    title="Move down"
                >
                    <FiChevronDown size={14} />
                </button>

                {/* Quick add code cell */}
                <button
                    onClick={handleAddCodeCell}
                    className="p-1 text-gray-400 hover:text-blue-400 hover:bg-gray-600 rounded transition-colors"
                    title="Add code cell below"
                >
                    <FiCode size={14} />
                </button>

                {/* More options dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setShowMoreOptions(!showMoreOptions)}
                        className="p-1 text-gray-400 hover:text-white hover:bg-gray-600 rounded transition-colors"
                        title="More options"
                    >
                        <FiMoreVertical size={14} />
                    </button>

                    {showMoreOptions && (
                        <>
                            {/* Backdrop */}
                            <div 
                                className="fixed inset-0 z-10" 
                                onClick={() => setShowMoreOptions(false)}
                            />
                            
                            {/* Dropdown menu */}
                            <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-600 rounded-md shadow-lg z-20 w-48">
                                <div className="py-1">
                                    <button
                                        onClick={handleAddCodeCell}
                                        className="flex items-center space-x-2 w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700"
                                    >
                                        <FiCode size={14} />
                                        <span>Add Code Cell</span>
                                    </button>
                                    
                                    <button
                                        onClick={handleAddMarkdownCell}
                                        className="flex items-center space-x-2 w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700"
                                    >
                                        <FiFileText size={14} />
                                        <span>Add Markdown Cell</span>
                                    </button>
                                    
                                    <hr className="border-gray-600 my-1" />
                                    
                                    <button
                                        onClick={handleDuplicate}
                                        className="flex items-center space-x-2 w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700"
                                    >
                                        <FiCopy size={14} />
                                        <span>Duplicate Cell</span>
                                    </button>
                                    
                                    <hr className="border-gray-600 my-1" />
                                    
                                    <button
                                        onClick={handleDelete}
                                        className="flex items-center space-x-2 w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-900/20"
                                    >
                                        <FiTrash2 size={14} />
                                        <span>Delete Cell</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CellToolbar;