export class ApiError extends Error {
  status: number;
  code?: string;
  detail: unknown;
  constructor(status: number, message: string, detail: unknown = null, code?: string) {
    super(message);
    this.status = status;
    this.detail = detail;
    this.code = code;
  }
}
