export class MaxAttemptsError extends Error {
  constructor(
    private readonly replay: number, 
    private readonly max: number, 
    message: string = ''
  ) {
      message = message || `An error occurred: Number of retries(${replay}) is above max attempts(${max})`;
      super(message);
      this.name = 'MaxAttemptsError';
      this.replay = replay;
      this.max = max;
  }
}