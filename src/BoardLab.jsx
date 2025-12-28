import React, { useState, useEffect } from 'react';

import { useBoard } from './hooks/useBoard';
import { useGemini } from './hooks/useGemini';
import { useHardware } from './hooks/useHardware';

import Toolbar from './components/Toolbar';
import StatusBar from './components/StatusBar';
import BoardView from './components/BoardView';
import AIPanel from './components/AIPanel';
import Settings from './components/Settings';
import { useNotifier } from './contexts/NotifierContext';
import PointsTableModal from './components/modals/PointsTableModal';
import AIModal from './components/modals/AIModal';

const BoardLab = () => {
    const [mode, setMode] = useState('view'); // 'view' or 'measure'
    const [apiKey, setApiKey] = useState('');
    const [pointsTableOpen, setPointsTableOpen] = useState(false);

    const board = useBoard();
    const hardware = useHardware();
    const gemini = useGemini(apiKey);
    const { showNotification } = useNotifier();

    useEffect(() => {
        if (hardware.isElectron) {
            window.electronAPI.loadApiKey().then(key => {
                if (key) setApiKey(key);
            });
        }
    }, [hardware.isElectron]);

    const handleSave = (newInstrumentConfig, newApiKey) => {
        hardware.handleSaveConfig(newInstrumentConfig);
        setApiKey(newApiKey);
        if (hardware.isElectron) {
            window.electronAPI.saveApiKey(newApiKey);
        }
        showNotification('Settings saved successfully!', 'success');
    };

    const handlePointsSave = (newPoints) => {
        board.setPoints(newPoints);
    };

    return (
        <div className="flex h-screen bg-gray-900 text-gray-100 font-sans">
            <Toolbar
                mode={mode}
                setMode={setMode}
                onUpload={() => board.fileInputRef.current.click()}
                onOpenSettings={() => hardware.setConfigOpen(true)}
                onOpenPointsTable={() => setPointsTableOpen(true)}
            />
            <input
                type="file"
                ref={board.fileInputRef}
                onChange={board.handleImageUpload}
                className="hidden"
                accept="image/*"
            />

            <div className="flex-1 flex flex-col relative">
                <StatusBar
                    scale={board.scale}
                    setScale={board.setScale}
                    isElectron={hardware.isElectron}
                />
                <BoardView
                    {...board}
                    mode={mode}
                />
            </div>

            <AIPanel
                selectedPoint={board.selectedPoint}
                points={board.points}
                setPoints={board.setPoints}
                setSelectedPointId={board.setSelectedPointId}
                askAboutPoint={gemini.askAboutPoint}
                captureValue={hardware.captureValue}
                isCapturing={hardware.isCapturing}
                analyzeBoard={gemini.analyzeBoard}
                instrumentConfig={hardware.instrumentConfig}
            />

            {/* Modals */}
            {hardware.configOpen && (
                <Settings
                    instruments={hardware.instrumentConfig}
                    apiKey={apiKey}
                    setApiKey={setApiKey}
                    onSave={handleSave}
                    onClose={() => hardware.setConfigOpen(false)}
                />
            )}

            {pointsTableOpen && (
                <PointsTableModal
                    points={board.points}
                    onSave={handlePointsSave}
                    onClose={() => setPointsTableOpen(false)}
                    selectedPointId={board.selectedPointId}
                    onSelectPoint={board.setSelectedPointId}
                />
            )}

            <AIModal
                isOpen={gemini.aiModalOpen}
                onClose={() => gemini.setAiModalOpen(false)}
                title={gemini.aiTitle}
                response={gemini.aiResponse}
                isLoading={gemini.isAiLoading}
            />
        </div>
    );
};

export default BoardLab;
