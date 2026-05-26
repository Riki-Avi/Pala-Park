import { FIXED_DELTA } from "@game/shared";

export class TimeAccumulator {
  private accumulator = 0;

  add(deltaSeconds: number, fixedStep: () => void): void {
    this.accumulator += Math.min(deltaSeconds, 0.25);

    while (this.accumulator >= FIXED_DELTA) {
      fixedStep();
      this.accumulator -= FIXED_DELTA;
    }
  }
}
