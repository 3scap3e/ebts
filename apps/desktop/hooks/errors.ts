export const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error);
