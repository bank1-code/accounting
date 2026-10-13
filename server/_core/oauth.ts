import type { Express, Request, Response } from "express";

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", (_req: Request, res: Response) => {
    res.status(410).json({ error: "OAuth authentication is disabled. Use local username and password authentication." });
  });
}
