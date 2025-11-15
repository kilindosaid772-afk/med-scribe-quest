/**
 * Production-safe logging utility
 * Only logs in development mode, suppresses in production
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  warn: (...args: any[]) => {
    // Always log warnings
    console.warn(...args);
  },
  
  error: (...args: any[]) => {
    // Always log errors
    console.error(...args);
  },
  
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
  
  table: (data: any) => {
    if (isDevelopment) {
      console.table(data);
    }
  }
};

// Export individual functions for convenience
export const { log, info, warn, error, debug } = logger;
