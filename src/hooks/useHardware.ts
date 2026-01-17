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
        },
        monitor: {
            enabled: false
        }
    });

    const isElectron = window.electronAPI?.isElectron || false;

    // Manage Multimeter Monitor based on config
    useEffect(() => {
        if (!isElectron || !window.electronAPI) return;

        if (instrumentConfig.monitor?.enabled) {
            window.electronAPI.startMonitor(instrumentConfig.multimeter.ip, instrumentConfig.multimeter.port)
                .then(() => console.log('Multimeter Monitor Started'))
                .catch(err => console.error('Failed to start monitor', err));
        }

        // Cleanup function: Stops monitor when component unmounts or config changes
        return () => {
            if (instrumentConfig.monitor?.enabled && window.electronAPI) {
                window.electronAPI.stopMonitor()
                    .catch(err => console.error('Failed to stop monitor during cleanup', err));
            }
        };
    }, [isElectron, instrumentConfig.monitor?.enabled, instrumentConfig.multimeter.ip, instrumentConfig.multimeter.port]);

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
                    if (loadedConfig.monitor) {
                        newConfig.monitor = { ...newConfig.monitor, ...loadedConfig.monitor };
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

    const captureValue = async (selectedPoint: Point | null, overrideValue?: string): Promise<MeasurementValue | null> => {
        if (!selectedPoint) return null;
        setIsCapturing(true);
        let result: any = { status: 'error', message: 'Not in Electron' };

        try {
            if (overrideValue) {
                 result = { status: 'success', value: overrideValue };
            } else if (isElectron && window.electronAPI) {
                if (selectedPoint.type === 'oscilloscope') {
                    // TODO: Migrate oscilloscope to Generic Driver with Binary Support
                    // For now, keep using legacy measureScope for waveform parsing
                    result = await window.electronAPI.measureScope({
                        ...instrumentConfig.oscilloscope,
                        timeout: instrumentConfig.timeout
                    });
                } else {
                    // Use new Generic Instrument API
                    // We assume 'READ_DC', 'READ_RESISTANCE', etc are mapped.
                    // For now, we default to a generic 'measure' action if type specific isn't found
                    // Or map based on point type?
                    let action = 'MEASURE'; // Default fallback
                    if (selectedPoint.type === 'voltage') action = 'READ_DC';
                    if (selectedPoint.type === 'resistance') action = 'READ_RESISTANCE';
                    if (selectedPoint.type === 'diode') action = 'READ_DIODE';

                    try {
                        result = await window.electronAPI.instrumentExecute('multimeter', action);
                    } catch (e: any) {
                        // Fallback to old method if new one fails (during migration period?)
                        // No, let's stick to the new one.
                        result = { status: 'error', message: e.message || 'Measurement failed' };
                    }
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
                    let finalValue = result.value;
                    const type = selectedPoint.type;

                    // Fix for known Overload/Open indicators
                    if (type === 'resistance' && finalValue.includes('Overload')) {
                        finalValue = 'OL';
                    }
                    if (type === 'diode' && finalValue.includes('open')) {
                        finalValue = 'OL';
                    }

                    return {
                        // FORCE the type to match the point we were intending to measure
                        // This effectively "locks" the type if the user sets a sequence of points
                        // even if the hardware sent a generic value without type info
                        type: type,
                        value: finalValue,
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
