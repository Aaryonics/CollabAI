import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import ACTIONS from '../Actions';
import Client from '../components/Client';
import NotebookEditor from '../components/NotebookEditor';
import { initSocket } from '../socket';
import {
    useLocation,
    useNavigate,
    Navigate,
    useParams,
} from 'react-router-dom';

const EditorPage = () => {
    const socketRef = useRef(null);
    const location = useLocation();
    const { roomId } = useParams();
    const reactNavigator = useNavigate();
    const [clients, setClients] = useState([]);

    useEffect(() => {
        const init = async () => {
            socketRef.current = await initSocket();
            socketRef.current.on('connect_error', handleErrors);
            socketRef.current.on('connect_failed', handleErrors);

            function handleErrors(e) {
                console.log('socket error', e);
                toast.error('Socket connection failed, try again later.');
                reactNavigator('/');
            }

            socketRef.current.emit(ACTIONS.JOIN, {
                roomId,
                username: location.state?.username,
            });

            socketRef.current.on(ACTIONS.JOINED, ({ clients, username, socketId }) => {
                if (username !== location.state?.username) {
                    toast.success(`${username} joined the room.`);
                }
                setClients(clients);
                // Sync notebook state for new user
                socketRef.current.emit(ACTIONS.SYNC_NOTEBOOK, {
                    socketId,
                    roomId,
                });
            });

            socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
                toast.success(`${username} left the room.`);
                setClients((prev) =>
                    prev.filter((client) => client.socketId !== socketId)
                );
            });
        };
        init();

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current.off(ACTIONS.JOINED);
                socketRef.current.off(ACTIONS.DISCONNECTED);
            }
        };
    }, []);

    const copyRoomId = async () => {
        try {
            await navigator.clipboard.writeText(roomId);
            toast.success('Room ID copied to clipboard');
        } catch (err) {
            toast.error('Failed to copy Room ID');
            console.error(err);
        }
    };

    const leaveRoom = () => {
        reactNavigator('/');
    };

    if (!location.state) {
        return <Navigate to="/" />;
    }

    return (
        <div className="flex h-screen w-full bg-gradient-to-br from-black via-gray-900 to-purple-900 text-white">
            {/* Sidebar */}
            <div className="w-60 bg-gray-950 border-r border-purple-700 flex flex-col justify-between py-6 px-4">
                <div>
                    <div className="flex items-center justify-center mb-6">
                        <div className="text-2xl font-bold text-purple-400">⚡ CollabAI</div>
                    </div>
                    <h3 className="text-purple-300 font-semibold text-sm mb-3">Connected Users</h3>
                    <div className="space-y-3">
                        {clients.map((client) => (
                            <Client key={client.socketId} username={client.username} />
                        ))}
                    </div>
                </div>

                <div className="flex flex-col space-y-3">
                    <button
                        onClick={copyRoomId}
                        className="bg-purple-700 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded transition"
                    >
                        📋 Copy Room ID
                    </button>
                    <button
                        onClick={leaveRoom}
                        className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded transition"
                    >
                        ❌ Leave Room
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col">
                {/* Top Bar */}
                <div className="h-14 px-6 flex items-center justify-between bg-gray-900 border-b border-purple-700">
                    <span className="text-sm text-purple-300">
                        Room ID: <span className="font-mono">{roomId}</span>
                    </span>
                    <span className="text-sm text-purple-300">
                        User: <span className="font-semibold">{location.state.username}</span>
                    </span>
                </div>

                {/* Notebook Editor */}
                <div className="flex-1 overflow-hidden">
                    <NotebookEditor
                        socketRef={socketRef}
                        roomId={roomId}
                    />
                </div>
            </div>
        </div>
    );
};

export default EditorPage;