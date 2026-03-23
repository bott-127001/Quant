
class LogService {
    private logs: string[] = [];
    private maxLogs: number = 50;

    public log(message: string) {
        const timestamp = new Date().toLocaleTimeString();
        const formatted = `[${timestamp}] ${message}`;
        this.logs.push(formatted);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
    }

    public getLogs(): string[] {
        return this.logs;
    }

    public clear() {
        this.logs = [];
    }
}

export default new LogService();
