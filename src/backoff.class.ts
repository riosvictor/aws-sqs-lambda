export class Backoff {
  constructor(private readonly base: number, private readonly limit: number) {}

  calculateExponentialDelay(attemptOrder: number): number {
      return Math.min(this.limit, Math.pow(2, attemptOrder) * this.base);
  }
}