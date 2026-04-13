export type LogLevel = "info" | "success" | "error" | "ai";

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
}

type Listener = (entries: LogEntry[]) => void;

class ActivityLogger {
  private entries: LogEntry[] = [];
  private listeners: Listener[] = [];
  private maxEntries = 100;

  log(level: LogLevel, message: string) {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date(),
      level,
      message,
    };
    this.entries = [entry, ...this.entries].slice(0, this.maxEntries);
    this.listeners.forEach(fn => fn([...this.entries]));
  }

  subscribe(fn: Listener) {
    this.listeners.push(fn);
    fn([...this.entries]);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  getEntries() {
    return [...this.entries];
  }

  clear() {
    this.entries = [];
    this.listeners.forEach(fn => fn([]));
  }
}

export const activityLog = new ActivityLogger();
