const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { PythonShell } = require('python-shell');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const ACTIONS = require('./src/Actions');

const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('build'));
app.use((req, res, next) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const userSocketMap = {};
const roomNotebooks = {}; // Store notebook state for each room

// Create temp directory for code execution if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
fs.mkdir(tempDir, { recursive: true }).catch(console.error);

// Detect Python path based on operating system
function getPythonPath() {
    const platform = os.platform();
    
    if (platform === 'win32') {
        // Windows: try common Python paths
        const possiblePaths = [
            'python',           // If added to PATH
            'py',              // Python Launcher
            'python3',         // Sometimes works on Windows
            'C:\\Python39\\python.exe',
            'C:\\Python38\\python.exe',
            'C:\\Python37\\python.exe',
            'C:\\Users\\' + os.userInfo().username + '\\AppData\\Local\\Programs\\Python\\Python39\\python.exe',
            'C:\\Users\\' + os.userInfo().username + '\\AppData\\Local\\Programs\\Python\\Python38\\python.exe'
        ];
        
        // You can also check environment variable
        if (process.env.PYTHON_PATH) {
            possiblePaths.unshift(process.env.PYTHON_PATH);
        }
        
        return possiblePaths[0]; // Return first option, you might want to test which one works
    } else {
        // Linux/Mac
        return process.env.PYTHON_PATH || 'python3';
    }
}

function getAllConnectedClients(roomId) {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
        (socketId) => {
            return {
                socketId,
                username: userSocketMap[socketId],
            };
        }
    );
}

function initializeNotebook(roomId) {
    if (!roomNotebooks[roomId]) {
        roomNotebooks[roomId] = {
            cells: [
                {
                    id: 'initial-cell',
                    type: 'code',
                    content: '# Welcome to CollabAI Notebook\nprint("Hello, World!")\nprint("Python is working!")',
                    output: null,
                    language: 'python'
                }
            ]
        };
    }
}

// Execute Python code with Windows compatibility
async function executePythonCode(code, cellId) {
    return new Promise(async (resolve) => {
        try {
            const fileName = `temp_${cellId}_${uuidv4()}.py`;
            const filePath = path.join(tempDir, fileName);
            
            // Write code to temporary file
            await fs.writeFile(filePath, code);
            
            const pythonPath = getPythonPath();
            console.log(`Using Python path: ${pythonPath}`);
            
            const options = {
                mode: 'text',
                pythonPath: pythonPath,
                pythonOptions: ['-u'], // unbuffered stdout
                scriptPath: tempDir,
                args: []
            };

            let output = '';
            let errorOutput = '';

            // Test if Python is available before running
            const testShell = new PythonShell(fileName, options);
            
            testShell.on('message', (message) => {
                output += message + '\n';
            });

            testShell.on('stderr', (stderr) => {
                errorOutput += stderr + '\n';
            });

            testShell.on('error', (err) => {
                console.error('Python execution error:', err);
                // Clean up temp file
                fs.unlink(filePath).catch(console.error);
                
                if (err.message.includes('ENOENT') || err.message.includes('not found')) {
                    resolve({
                        type: 'error',
                        data: `Python not found. Please ensure Python is installed and added to PATH.\n\nWindows users:\n1. Install Python from python.org\n2. Check "Add Python to PATH" during installation\n3. Restart your terminal/IDE\n\nError: ${err.message}`,
                        timestamp: new Date().toISOString()
                    });
                } else {
                    resolve({
                        type: 'error',
                        data: `Python execution error: ${err.message}`,
                        timestamp: new Date().toISOString()
                    });
                }
            });

            testShell.end((err, code, signal) => {
                // Clean up temp file
                fs.unlink(filePath).catch(console.error);
                
                if (err) {
                    resolve({
                        type: 'error',
                        data: errorOutput || err.message || 'Python execution error',
                        timestamp: new Date().toISOString()
                    });
                } else {
                    resolve({
                        type: 'text',
                        data: output.trim() || '(no output)',
                        timestamp: new Date().toISOString()
                    });
                }
            });

        } catch (error) {
            console.error('Python setup error:', error);
            resolve({
                type: 'error',
                data: `Setup Error: ${error.message}\n\nPlease ensure Python is properly installed and accessible.`,
                timestamp: new Date().toISOString()
            });
        }
    });
}

// Execute JavaScript code (Node.js environment)
async function executeJavaScriptCode(code) {
    return new Promise((resolve) => {
        try {
            // Create a sandbox environment
            const originalConsoleLog = console.log;
            const originalConsoleError = console.error;
            let output = '';
            let errorOutput = '';

            // Override console methods to capture output
            console.log = (...args) => {
                output += args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' ') + '\n';
            };

            console.error = (...args) => {
                errorOutput += args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' ') + '\n';
            };

            // Execute the code with timeout
            const timeoutId = setTimeout(() => {
                console.log = originalConsoleLog;
                console.error = originalConsoleError;
                resolve({
                    type: 'error',
                    data: 'Execution timeout (5 seconds)',
                    timestamp: new Date().toISOString()
                });
            }, 5000);

            try {
                // Use eval in a controlled way
                const result = eval(code);
                
                clearTimeout(timeoutId);
                
                // Restore console methods
                console.log = originalConsoleLog;
                console.error = originalConsoleError;

                if (errorOutput) {
                    resolve({
                        type: 'error',
                        data: errorOutput.trim(),
                        timestamp: new Date().toISOString()
                    });
                } else {
                    let finalOutput = output.trim();
                    
                    // If there's a return value and no console output, show the return value
                    if (!finalOutput && result !== undefined) {
                        finalOutput = typeof result === 'object' ? 
                            JSON.stringify(result, null, 2) : String(result);
                    }
                    
                    resolve({
                        type: 'text',
                        data: finalOutput || '(no output)',
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (error) {
                clearTimeout(timeoutId);
                console.log = originalConsoleLog;
                console.error = originalConsoleError;
                
                resolve({
                    type: 'error',
                    data: `Error: ${error.message}`,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            resolve({
                type: 'error',
                data: `Execution Error: ${error.message}`,
                timestamp: new Date().toISOString()
            });
        }
    });
}

io.on('connection', (socket) => {
    console.log('socket connected', socket.id);

    socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
        userSocketMap[socket.id] = username;
        socket.join(roomId);
        
        // Initialize notebook for room if it doesn't exist
        initializeNotebook(roomId);
        
        const clients = getAllConnectedClients(roomId);
        clients.forEach(({ socketId }) => {
            io.to(socketId).emit(ACTIONS.JOINED, {
                clients,
                username,
                socketId: socket.id,
            });
        });

        // Send current notebook state to new user
        socket.emit(ACTIONS.NOTEBOOK_STATE, {
            notebook: roomNotebooks[roomId]
        });
    });

    // Legacy code change handler (keep for backwards compatibility)
    socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
    });

    // New notebook cell handlers
    socket.on(ACTIONS.ADD_CELL, ({ roomId, cell, index }) => {
        if (roomNotebooks[roomId]) {
            if (index !== undefined) {
                roomNotebooks[roomId].cells.splice(index, 0, cell);
            } else {
                roomNotebooks[roomId].cells.push(cell);
            }
            socket.in(roomId).emit(ACTIONS.ADD_CELL, { cell, index });
        }
    });

    socket.on(ACTIONS.DELETE_CELL, ({ roomId, cellId }) => {
        if (roomNotebooks[roomId]) {
            roomNotebooks[roomId].cells = roomNotebooks[roomId].cells.filter(
                cell => cell.id !== cellId
            );
            socket.in(roomId).emit(ACTIONS.DELETE_CELL, { cellId });
        }
    });

    socket.on(ACTIONS.UPDATE_CELL, ({ roomId, cellId, content, cellType, language }) => {
        if (roomNotebooks[roomId]) {
            const cell = roomNotebooks[roomId].cells.find(c => c.id === cellId);
            if (cell) {
                cell.content = content;
                if (cellType) cell.type = cellType;
                if (language) cell.language = language;
            }
            socket.in(roomId).emit(ACTIONS.UPDATE_CELL, { 
                cellId, 
                content, 
                cellType, 
                language 
            });
        }
    });

    socket.on(ACTIONS.REORDER_CELLS, ({ roomId, cellIds }) => {
        if (roomNotebooks[roomId]) {
            const newCells = [];
            cellIds.forEach(id => {
                const cell = roomNotebooks[roomId].cells.find(c => c.id === id);
                if (cell) newCells.push(cell);
            });
            roomNotebooks[roomId].cells = newCells;
            socket.in(roomId).emit(ACTIONS.REORDER_CELLS, { cellIds });
        }
    });

    // Enhanced code execution handler
    socket.on(ACTIONS.EXECUTE_CELL, async ({ roomId, cellId }) => {
        if (roomNotebooks[roomId]) {
            const cell = roomNotebooks[roomId].cells.find(c => c.id === cellId);
            if (cell && cell.type === 'code' && cell.content.trim()) {
                
                // Emit execution start status
                io.in(roomId).emit(ACTIONS.CELL_EXECUTION_START, { cellId });
                
                let output;
                
                try {
                    if (cell.language === 'python') {
                        output = await executePythonCode(cell.content, cellId);
                    } else if (cell.language === 'javascript') {
                        output = await executeJavaScriptCode(cell.content);
                    } else {
                        output = {
                            type: 'error',
                            data: `Unsupported language: ${cell.language}`,
                            timestamp: new Date().toISOString()
                        };
                    }
                } catch (error) {
                    output = {
                        type: 'error',
                        data: `Execution error: ${error.message}`,
                        timestamp: new Date().toISOString()
                    };
                }
                
                // Update cell output
                cell.output = output;

                // Broadcast execution result to all clients
                io.in(roomId).emit(ACTIONS.CELL_OUTPUT, {
                    cellId,
                    output: cell.output
                });
                
                // Emit execution end status
                io.in(roomId).emit(ACTIONS.CELL_EXECUTION_END, { cellId });
            }
        }
    });

    socket.on(ACTIONS.SYNC_NOTEBOOK, ({ socketId, roomId }) => {
        if (roomNotebooks[roomId]) {
            io.to(socketId).emit(ACTIONS.NOTEBOOK_STATE, {
                notebook: roomNotebooks[roomId]
            });
        }
    });

    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: userSocketMap[socket.id],
            });
        });
        delete userSocketMap[socket.id];
        socket.leave();
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
    console.log(`Operating System: ${os.platform()}`);
    console.log(`Python path being used: ${getPythonPath()}`);
    console.log('Make sure Python is installed and accessible');
});