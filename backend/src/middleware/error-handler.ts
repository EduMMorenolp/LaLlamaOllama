import type { Request, Response, NextFunction } from "express";

export function sendError(res: Response, status: number, message: string, type = "server_error") {
  res.status(status).json({ error: { message, type } });
}

export function createErrorHandler() {
  return (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    const message = err.message || "Internal server error";
    res.status(500).json({ error: { message, type: "server_error" } });
  };
}
