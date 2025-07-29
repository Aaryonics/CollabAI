import React from 'react';
import { FiTerminal, FiImage, FiBarChart } from 'react-icons/fi';

const OutputCell = ({ output, cellId }) => {
    if (!output) return null;

    const renderOutput = () => {
        switch (output.type) {
            case 'text':
                return (
                    <pre className="text-gray-300 whitespace-pre-wrap font-mono text-sm overflow-x-auto">
                        {output.data}
                    </pre>
                );
            
            case 'html':
                return (
                    <div 
                        className="prose prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: output.data }}
                    />
                );
            
            case 'image':
                return (
                    <div className="flex justify-center">
                        <img 
                            src={output.data} 
                            alt="Output" 
                            className="max-w-full h-auto rounded border border-gray-600"
                        />
                    </div>
                );
            
            case 'table':
                return (
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse">
                            <thead>
                                {output.data.headers && (
                                    <tr className="bg-gray-800">
                                        {output.data.headers.map((header, i) => (
                                            <th key={i} className="border border-gray-600 px-4 py-2 text-left">
                                                {header}
                                            </th>
                                        ))}
                                    </tr>
                                )}
                            </thead>
                            <tbody>
                                {output.data.rows && output.data.rows.map((row, i) => (
                                    <tr key={i} className={i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-800'}>
                                        {row.map((cell, j) => (
                                            <td key={j} className="border border-gray-600 px-4 py-2">
                                                {cell}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            
            case 'error':
                return (
                    <div className="bg-red-900/30 border border-red-600 rounded p-4">
                        <div className="flex items-center mb-2">
                            <FiTerminal className="text-red-400 mr-2" />
                            <span className="text-red-400 font-semibold">Error</span>
                        </div>
                        <pre className="text-red-300 whitespace-pre-wrap font-mono text-sm">
                            {output.data}
                        </pre>
                    </div>
                );
            
            case 'json':
                return (
                    <pre className="text-gray-300 whitespace-pre-wrap font-mono text-sm bg-gray-800 p-4 rounded overflow-x-auto">
                        {JSON.stringify(output.data, null, 2)}
                    </pre>
                );
            
            default:
                return (
                    <pre className="text-gray-300 whitespace-pre-wrap font-mono text-sm">
                        {String(output.data)}
                    </pre>
                );
        }
    };

    const getOutputIcon = () => {
        switch (output.type) {
            case 'image':
                return <FiImage className="text-blue-400" />;
            case 'table':
            case 'json':
                return <FiBarChart className="text-green-400" />;
            case 'error':
                return <FiTerminal className="text-red-400" />;
            default:
                return <FiTerminal className="text-gray-400" />;
        }
    };

    return (
        <div className="bg-gray-900 border-t border-gray-600">
            <div className="flex items-center justify-between p-2 bg-gray-800 text-xs text-gray-400 border-b border-gray-600">
                <div className="flex items-center space-x-2">
                    {getOutputIcon()}
                    <span>Output</span>
                    {output.type !== 'text' && (
                        <span className="bg-gray-700 px-2 py-1 rounded text-xs">
                            {output.type}
                        </span>
                    )}
                </div>
                {output.timestamp && (
                    <span className="text-gray-500">
                        {new Date(output.timestamp).toLocaleTimeString()}
                    </span>
                )}
            </div>
            <div className="p-4 max-h-96 overflow-auto">
                {renderOutput()}
            </div>
        </div>
    );
};

export default OutputCell;