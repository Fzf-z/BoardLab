import { useState, useEffect } from 'react';

export const useHardware = () => {
    const [isCapturing, setIsCapturing] = useState(false);
    const [configOpen, setConfigOpen] = useState(false);
    const [instrumentConfig, setInstrumentConfig] = useState({
        multimeter: {
            ip: "192.168.0.202",
            port: 9876,
            commands: {
                configure_voltage: "CONF:VOLT:DC AUTO",
                configure_resistance: "CONF:RES AUTO",
                configure_diode: "CONF:DIOD",
                measure: "MEAS:SHOW?"
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
    }, [isElectron]);

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
                        alert(`Error: "measure" command is missing in the settings.`);
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
                const val = (Math.random() * 5).toFixed(3) + " V";
                result = { status: 'success', value: val };
            }

            if (result.status === 'success') {
                const updatedPoints = points.map(p => p.id === selectedPoint.id ? {
                    ...p,
                    value: result.value || 'Waveform Captured',
                    waveform: result.waveform,
                    timeScale: result.timeScale,
                    voltageScale: result.voltageScale,
                    voltageOffset: result.voltageOffset,
                    vpp: result.vpp,
                    freq: result.freq,
                } : p);
                setPoints(updatedPoints);
            } else {
                alert(`Error capturing value: ${result.message}`);
            }
        } catch (e) {
            alert(`Communication error: ${e.message}`);
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
