/**
 * Centralized Logging Framework for BoardLab
 *
 * Provides structured logging with:
 * - Log levels (DEBUG, INFO, WARN, ERROR)
 * - Module-based namespacing
 * - Configurable output (console, future: file/remote)
 * - Development vs Production modes
 * - Timestamp formatting
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    module: string;
    message: string;
    data?: unknown;
}

interface LoggerConfig {
    minLevel: LogLevel;
    enableConsole: boolean;
    enableTimestamp: boolean;
    isDevelopment: boolean;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
};

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
    DEBUG: '#9CA3AF', // gray
    INFO: '#3B82F6',  // blue
    WARN: '#F59E0B',  // amber
    ERROR: '#EF4444', // red
};

const LOG_LEVEL_EMOJI: Record<LogLevel, string> = {
    DEBUG: '🔍',
    INFO: 'ℹ️',
    WARN: '⚠️',
    ERROR: '❌',
};

// Default configuration
const defaultConfig: LoggerConfig = {
    minLevel: 'DEBUG',
    enableConsole: true,
    enableTimestamp: true,
    isDevelopment: typeof window !== 'undefined' &&
        (window.location?.hostname === 'localhost' ||
         window.location?.protocol === 'file:' ||
         import.meta.env?.DEV === true),
};

let globalConfig: LoggerConfig = { ...defaultConfig };

/**
 * Configure the global logger settings
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
    globalConfig = { ...globalConfig, ...config };
}

/**
 * Get current logger configuration
 */
export function getLoggerConfig(): Readonly<LoggerConfig> {
    return { ...globalConfig };
}

/**
 * Format timestamp for logging
 */
function formatTimestamp(date: Date): string {
    return date.toISOString().replace('T', ' ').substring(0, 23);
}

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[globalConfig.minLevel];
}

/**
 * Format and output a log entry
 */
function outputLog(entry: LogEntry): void {
    if (!globalConfig.enableConsole) return;

    const { level, module, message, data, timestamp } = entry;

    const timestampStr = globalConfig.enableTimestamp
        ? `[${formatTimestamp(timestamp)}] `
        : '';

    const prefix = `${timestampStr}${LOG_LEVEL_EMOJI[level]} [${module}]`;

    // Use appropriate console method
    const consoleFn = level === 'ERROR' ? console.error
        : level === 'WARN' ? console.warn
        : level === 'DEBUG' ? console.debug
        : console.log;

    // Style for browser console
    if (typeof window !== 'undefined' && globalConfig.isDevelopment) {
        const style = `color: ${LOG_LEVEL_COLORS[level]}; font-weight: ${level === 'ERROR' ? 'bold' : 'normal'}`;

        if (data !== undefined) {
            consoleFn(`%c${prefix} ${message}`, style, data);
        } else {
            consoleFn(`%c${prefix} ${message}`, style);
        }
    } else {
        // Plain output for Node.js or production
        if (data !== undefined) {
            consoleFn(`${prefix} ${message}`, data);
        } else {
            consoleFn(`${prefix} ${message}`);
        }
    }
}

/**
 * Creates a logger instance for a specific module
 */
export function createLogger(moduleName: string) {
    const log = (level: LogLevel, message: string, data?: unknown): void => {
        if (!shouldLog(level)) return;

        const entry: LogEntry = {
            timestamp: new Date(),
            level,
            module: moduleName,
            message,
            data,
        };

        outputLog(entry);
    };

    return {
        /**
         * Log debug information (development only typically)
         */
        debug: (message: string, data?: unknown) => log('DEBUG', message, data),

        /**
         * Log general information
         */
        info: (message: string, data?: unknown) => log('INFO', message, data),

        /**
         * Log warnings
         */
        warn: (message: string, data?: unknown) => log('WARN', message, data),

        /**
         * Log errors
         */
        error: (message: string, data?: unknown) => log('ERROR', message, data),

        /**
         * Create a child logger with a sub-module name
         */
        child: (subModule: string) => createLogger(`${moduleName}:${subModule}`),
    };
}

/**
 * Pre-configured loggers for common modules
 */
export const Logger = {
    // API and IPC communication
    SafeAPI: createLogger('SafeAPI'),
    IPC: createLogger('IPC'),

    // UI Components
    Components: createLogger('Components'),
    Board: createLogger('Board'),

    // Core functionality
    Project: createLogger('Project'),
    Instruments: createLogger('Instruments'),
    Measurements: createLogger('Measurements'),

    // System
    App: createLogger('App'),
    Config: createLogger('Config'),
    Export: createLogger('Export'),
};

export default Logger;
