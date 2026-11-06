export class ProgressError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "conflict"
      | "invalid"
      | "forbidden_stage",
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ProgressError";
  }
}
