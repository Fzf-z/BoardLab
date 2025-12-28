import { useState, useEffect } from 'react';

export const useHardware = () => {
    const [isCapturing, setIsCapturing] = useState(false);
    const [configOpen, setConfigOpen] = useState(false);
    const [instrumentConfig, setInstrumentConfig] = useState({
        multimeter: {
            ip: "192.168.0.202",
            port: 9876,
            commands: {
                measure_voltage: "MEAS:VOLT:DC?",
                measure_resistance: "MEAS:RES?"
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
            window.electronAPI.loadConfig().then(config => {
                if (config) {
                    setInstrumentConfig(config);
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
                    const command = selectedPoint.type === 'voltage' ?
                        instrumentConfig.multimeter.commands.measure_voltage :
                        instrumentConfig.multimeter.commands.measure_resistance;

                    result = await window.electronAPI.measureMultimeter({
                        ip: instrumentConfig.multimeter.ip,
                        port: instrumentConfig.multimeter.port,
                        command: command,
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
