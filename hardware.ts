export interface OscilloscopeData {
    status: 'success' | 'error';
    message?: string;
    voltageScale?: number;
    vpp?: number;
    freq?: number;
    timeScale?: number;
    voltageOffset?: number;
    waveform?: number[];
}

export interface MultimeterConfig {
    mode: string;
    range?: string;
}

export type HardwareConnectionStatus = 'connected' | 'disconnected' | 'error';