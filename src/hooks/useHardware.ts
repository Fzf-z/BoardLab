import { useState, useEffect, useRef, useCallback } from 'react';
import { useNotifier } from '../contexts/NotifierContext';
import { InstrumentConfig, MeasurementValue, Point, CaptureResult } from '../types';

// Default configuration - moved outside component to avoid recreation
const DEFAULT_INSTRUMENT_CONFIG: InstrumentConfig = {
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
};

export const useHardware = () => {
    const { showNotification } = useNotifier();
    const [isCapturing, setIsCapturing] = useState<boolean>(false);
    const [configOpen, setConfigOpen] = useState<boolean>(false);
    const [instrumentConfig, setInstrumentConfig] = useState<InstrumentConfig>(DEFAULT_INSTRUMENT_CONFIG);
    const configLoadedRef = useRef(false);

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

    // Load config from persistent storage on mount - runs only once
    useEffect(() => {
        if (!isElectron || !window.electronAPI || configLoadedRef.current) return;

        configLoadedRef.current = true;

        window.electronAPI.loadConfig().then((loadedConfig: Partial<InstrumentConfig>) => {
            if (loadedConfig) {
                // Use DEFAULT_INSTRUMENT_CONFIG as base to avoid closure issues
                const newConfig: InstrumentConfig = {
                    timeout: loadedConfig.timeout ?? DEFAULT_INSTRUMENT_CONFIG.timeout,
                    multimeter: {
                        ip: loadedConfig.multimeter?.ip ?? DEFAULT_INSTRUMENT_CONFIG.multimeter.ip,
                        port: loadedConfig.multimeter?.port ?? DEFAULT_INSTRUMENT_CONFIG.multimeter.port,
                        commands: {
                            ...DEFAULT_INSTRUMENT_CONFIG.multimeter.commands,
                            ...loadedConfig.multimeter?.commands
                        }
                    },
                    oscilloscope: {
                        ip: loadedConfig.oscilloscope?.ip ?? DEFAULT_INSTRUMENT_CONFIG.oscilloscope.ip,
                        port: loadedConfig.oscilloscope?.port ?? DEFAULT_INSTRUMENT_CONFIG.oscilloscope.port,
                        commands: {
                            ...DEFAULT_INSTRUMENT_CONFIG.oscilloscope.commands,
                            ...loadedConfig.oscilloscope?.commands
                        }
                    },
                    monitor: {
                        ...DEFAULT_INSTRUMENT_CONFIG.monitor,
                        ...loadedConfig.monitor
                    }
                };

                setInstrumentConfig(newConfig);
            }
        }).catch(err => {
            console.error('Failed to load instrument config:', err);
        });
    }, [isElectron]);

    const handleSaveConfig = useCallback((newConfig: InstrumentConfig) => {
        setInstrumentConfig(newConfig);
        if (isElectron && window.electronAPI) {
            window.electronAPI.saveConfig(newConfig);
        }
    }, [isElectron]);

    const captureValue = async (selectedPoint: Point | null, overrideValue?: string): Promise<MeasurementValue | null> => {
        if (!selectedPoint) return null;
        setIsCapturing(true);
        let result: CaptureResult = { status: 'error', message: 'Not in Electron' };

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
                    } catch (e) {
                        // Fallback to old method if new one fails (during migration period?)
                        // No, let's stick to the new one.
                        const message = e instanceof Error ? e.message : 'Measurement failed';
                        result = { status: 'error', message };
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
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown error';
            showNotification(`Communication error: ${message}`, 'error');
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
