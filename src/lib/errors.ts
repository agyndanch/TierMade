/** Error with an HTTP status, thrown by services and mapped by route handlers. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const notFound = (what = "Not found") => new HttpError(404, what);
export const forbidden = (why = "You don't have access to this") => new HttpError(403, why);
export const conflict = (why: string) => new HttpError(409, why);
export const badRequest = (why: string) => new HttpError(400, why);
