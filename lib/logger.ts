/**
 * Structured logger for consistent, parseable log output.
 * JSON in production, human-readable in development.
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

function formatLog(level: LogLevel, message: string, context?: LogContext): string {
  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    });
  }

  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  return `[${new Date().toISOString()}] ${level.toUpperCase()}: ${message}${contextStr}`;
}

export const logger = {
  info(message: string, context?: LogContext) {
    console.log(formatLog('info', message, context));
  },
  warn(message: string, context?: LogContext) {
    console.warn(formatLog('warn', message, context));
  },
  error(message: string, context?: LogContext) {
    console.error(formatLog('error', message, context));
  },
};
