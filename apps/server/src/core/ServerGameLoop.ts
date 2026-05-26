import { performance } from "node:perf_hooks";
import { TimeAccumulator } from "./TimeAccumulator";

export class ServerGameLoop {
  private readonly accumulator = new TimeAccumulator();
  private interval: NodeJS.Timeout | null = null;
  private lastTime = performance.now();

  constructor(private readonly update: () => void) {}

  start(): void {
    if (this.interval) {
      return;
    }

    this.lastTime = performance.now();
    this.interval = setInterval(() => {
      const now = performance.now();
      const deltaSeconds = (now - this.lastTime) / 1000;
      this.lastTime = now;
      this.accumulator.add(deltaSeconds, this.update);
    }, 8);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
