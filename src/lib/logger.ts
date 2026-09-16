export interface LogContext {
  component?: string;
  boardId?: string;
  userId?: string;
  jobId?: string;
  ip?: string;
  [key: string]: unknown;
}

const isProduction = process.env.NODE_ENV === "production";

function formatLog(level: "INFO" | "WARN" | "ERROR" | "DEBUG", message: string, context?: LogContext) {
  const timestamp = new Date().toISOString();
  const componentTag = context?.component ? `[${context.component}] ` : "";

  if (isProduction) {
    return JSON.stringify({
      timestamp,
      level,
      message: `${componentTag}${message}`,
      ...context,
    });
  }

  const colorMap = {
    INFO: "\x1b[36m",   // Cyan
    WARN: "\x1b[33m",   // Yellow
    ERROR: "\x1b[31m",  // Red
    DEBUG: "\x1b[90m",  // Gray
  };
  const reset = "\x1b[0m";
  const levelStr = `${colorMap[level]}${level}${reset}`;

  return `${timestamp} ${levelStr} ${componentTag}${message}`;
}

export const logger = {
  info(message: string, context?: LogContext) {
    console.log(formatLog("INFO", message, context));
  },
  warn(message: string, context?: LogContext) {
    console.warn(formatLog("WARN", message, context));
  },
  error(message: string, context?: LogContext) {
    console.error(formatLog("ERROR", message, context));
  },
  debug(message: string, context?: LogContext) {
    if (!isProduction || process.env.DEBUG === "true") {
      console.log(formatLog("DEBUG", message, context));
    }
  },
};
