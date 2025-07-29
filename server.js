const express = require('express');
const app = express();
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const ACTIONS = require('./src/Actions');

const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('build'));
app.use((req, res, next) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const userSocketMap = {};
const roomNotebooks = {}; // Store notebook state for each room

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
                    content: '# Welcome to CollabAI Notebook\nprint("Hello, World!")',
                    output: null,
                    language: 'python'
                }
            ]
        };
    }
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

    socket.on(ACTIONS.EXECUTE_CELL, ({ roomId, cellId }) => {
        if (roomNotebooks[roomId]) {
            const cell = roomNotebooks[roomId].cells.find(c => c.id === cellId);
            if (cell && cell.type === 'code') {
                // Simulate code execution (in real implementation, you'd use a code execution service)
                let output;
                try {
                    if (cell.language === 'javascript') {
                        // Simple eval for demo (unsafe in production)
                        output = eval(cell.content);
                    } else {
                        // For Python and other languages, you'd need a proper execution environment
                        output = `Executed: ${cell.content.split('\n')[0]}...`;
                    }
                } catch (error) {
                    output = `Error: ${error.message}`;
                }
                
                cell.output = {
                    type: 'text',
                    data: String(output),
                    timestamp: new Date().toISOString()
                };

                // Broadcast execution result to all clients
                io.in(roomId).emit(ACTIONS.CELL_OUTPUT, {
                    cellId,
                    output: cell.output
                });
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
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));