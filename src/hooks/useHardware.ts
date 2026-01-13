import { useState, useEffect } from 'react';
import { useNotifier } from '../contexts/NotifierContext';
import { InstrumentConfig, MeasurementValue, Point } from '../types';

export const useHardware = () => {
    const { showNotification } = useNotifier();
    const [isCapturing, setIsCapturing] = useState<boolean>(false);
    const [configOpen, setConfigOpen] = useState<boolean>(false);
    const [instrumentConfig, setInstrumentConfig] = useState<InstrumentConfig>({
        timeout: 2000,
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
        if (isElectron && window.electronAPI) {
            window.electronAPI.loadConfig().then((loadedConfig: Partial<InstrumentConfig>) => {
                if (loadedConfig) {
                    const newConfig = JSON.parse(JSON.stringify(instrumentConfig)) as InstrumentConfig; // Deep copy default

                    if (loadedConfig.timeout) {
                        newConfig.timeout = loadedConfig.timeout;
                    }

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
    }, [isElectron]); // Removed instrumentConfig from dep to avoid loop if object ref changes differently

    const handleSaveConfig = (newConfig: InstrumentConfig) => {
        setInstrumentConfig(newConfig);
        if (isElectron && window.electronAPI) {
            window.electronAPI.saveConfig(newConfig);
        }
    };

    const captureValue = async (selectedPoint: Point | null): Promise<MeasurementValue | null> => {
        if (!selectedPoint) return null;
        setIsCapturing(true);
        let result: any = { status: 'error', message: 'Not in Electron' };

        try {
            if (isElectron && window.electronAPI) {
                if (selectedPoint.type === 'oscilloscope') {
                    result = await window.electronAPI.measureScope({
                        ...instrumentConfig.oscilloscope,
                        timeout: instrumentConfig.timeout
                    });
                } else {
                    const measureCommand = instrumentConfig.multimeter.commands.measure;
                    if (!measureCommand) {
                        showNotification('"measure" command is missing in the settings.', 'error');
                        setIsCapturing(false);
                        return null;
                    }
                    result = await window.electronAPI.multimeterGetMeasurement({
                        ip: instrumentConfig.multimeter.ip,
                        port: instrumentConfig.multimeter.port,
                        measureCommand: measureCommand,
                        timeout: instrumentConfig.timeout
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
                showNotification('Measurement captured!', 'success');
                if (selectedPoint.type === 'oscilloscope') {
                    return {
                        type: 'oscilloscope',
                        value: `${(result.vpp || 0).toFixed(2)} Vpp / ${(result.freq || 0).toFixed(2)} Hz`,
                        ...result
                    };
                } else {
                    return {
                        type: selectedPoint.type,
                        value: result.value,
                    };
                }
            } else {
                showNotification(`Error capturing value: ${result.message}`, 'error');
                return null;
            }
        } catch (e: any) {
            showNotification(`Communication error: ${e.message}`, 'error');
            return null;
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
