export class JobNotFoundError extends Error {
  static readonly MESSAGE = "The call did not run: no job has this job_id. "
    + "It may have expired: jobs are kept for 10 minutes after they finish. "
    + "What to do: start the call again.";

  constructor() {
    super(JobNotFoundError.MESSAGE);
    this.name = "JobNotFoundError";
  }
}
