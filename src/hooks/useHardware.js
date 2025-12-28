import { useState, useEffect } from 'react';
import { useNotifier } from '../contexts/NotifierContext';

export const useHardware = () => {
    const { showNotification } = useNotifier();
    const [isCapturing, setIsCapturing] = useState(false);
    const [configOpen, setConfigOpen] = useState(false);
    const [instrumentConfig, setInstrumentConfig] = useState({
        multimeter: {
            ip: "192.168.0.202",
            port: 9876,
            commands: {
                configure_voltage: ":VOLT:DC:AUTO ON",
                configure_resistance: ":RES:AUTO ON",
                configure_diode: "CONF:DIOD",
                measure: "READ?"
            }
        },
        oscilloscope: {
            ip: "192.168.0.200",
            port: 5555,
            commands: {
                prepare_waveform: ":WAV:SOUR CHAN1",
                request_waveform: ":WAV:DATA?"
            }
        }
    });

    const isElectron = window.electronAPI?.isElectron || false;

    useEffect(() => {
        if (isElectron) {
            window.electronAPI.loadConfig().then(loadedConfig => {
                if (loadedConfig) {
                    const newConfig = JSON.parse(JSON.stringify(instrumentConfig)); // Deep copy default

                    if (loadedConfig.multimeter) {
                        newConfig.multimeter.ip = loadedConfig.multimeter.ip || newConfig.multimeter.ip;
                        newConfig.multimeter.port = loadedConfig.multimeter.port || newConfig.multimeter.port;
                        if (loadedConfig.multimeter.commands) {
                            newConfig.multimeter.commands = { ...newConfig.multimeter.commands, ...loadedConfig.multimeter.commands };
                        }
                    }
                    if (loadedConfig.oscilloscope) {
                        newConfig.oscilloscope.ip = loadedConfig.oscilloscope.ip || newConfig.oscilloscope.ip;
                        newConfig.oscilloscope.port = loadedConfig.oscilloscope.port || newConfig.oscilloscope.port;
                        if (loadedConfig.oscilloscope.commands) {
                            newConfig.oscilloscope.commands = { ...newConfig.oscilloscope.commands, ...loadedConfig.oscilloscope.commands };
                        }
                    }
                    
                    setInstrumentConfig(newConfig);
                }
            });
        }
    }, [isElectron, instrumentConfig]);

    const handleSaveConfig = (newConfig) => {
        setInstrumentConfig(newConfig);
        if (isElectron) {
            window.electronAPI.saveConfig(newConfig);
        }
    };

    const captureValue = async (selectedPoint, points, setPoints) => {
        if (!selectedPoint) return;
        setIsCapturing(true);
        let result = { status: 'error', message: 'Not in Electron' };

        try {
            if (isElectron) {
                if (selectedPoint.type === 'oscilloscope') {
                    result = await window.electronAPI.measureScope(instrumentConfig.oscilloscope);
                } else {
                    const measureCommand = instrumentConfig.multimeter.commands.measure;
                    if (!measureCommand) {
                        showNotification('"measure" command is missing in the settings.', 'error');
                        setIsCapturing(false);
                        return;
                    }
                    result = await window.electronAPI.multimeterGetMeasurement({
                        ip: instrumentConfig.multimeter.ip,
                        port: instrumentConfig.multimeter.port,
                        measureCommand: measureCommand,
                    });
                }
            } else {
                // Web simulation
                await new Promise(r => setTimeout(r, 500));
                if (selectedPoint.type === 'oscilloscope') {
                    result = {
                        status: 'success',
                        waveform: Array.from({length: 1000}, () => Math.random() * 2 - 1),
                        timeScale: 0.001,
                        voltageScale: 0.5,
                        voltageOffset: 0,
                        vpp: 2.5,
                        freq: 1000,
                    };
                } else {
                    const val = (Math.random() * 5).toFixed(3) + " V";
                    result = { status: 'success', value: val };
                }
            }

            if (result.status === 'success') {
                const updatedPoints = points.map(p => {
                    if (p.id === selectedPoint.id) {
                        const newMeasurements = { ...p.measurements };
                        if (selectedPoint.type === 'oscilloscope') {
                            newMeasurements.oscilloscope = {
                                value: 'Waveform Captured',
                                waveform: result.waveform,
                                timeScale: result.timeScale,
                                voltageScale: result.voltageScale,
                                voltageOffset: result.voltageOffset,
                                vpp: result.vpp,
                                freq: result.freq,
                                capturedAt: new Date().toISOString(),
                            };
                        } else {
                            newMeasurements[selectedPoint.type] = {
                                value: result.value,
                                capturedAt: new Date().toISOString(),
                            };
                        }
                        return { ...p, measurements: newMeasurements };
                    }
                    return p;
                });
                setPoints(updatedPoints);
                showNotification('Measurement captured!', 'success');
            } else {
                showNotification(`Error capturing value: ${result.message}`, 'error');
            }
        } catch (e) {
            showNotification(`Communication error: ${e.message}`, 'error');
        } finally {
            setIsCapturing(false);
        }
    };

    return {
        isCapturing,
        configOpen,
        setConfigOpen,
        instrumentConfig,
        handleSaveConfig,
        captureValue,
        isElectron,
    };
};
