import type { Express } from "express";
import { ENV } from "./env";

/**
 * Serves webdev-managed assets through a short-lived Forge URL without exposing credentials to the browser.
 */
export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string | undefined>)["0"];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }

    try {
      const forgeUrl = new URL("v1/storage/presign/get", `${ENV.forgeApiUrl.replace(/\/+$/, "")}/`);
      forgeUrl.searchParams.set("path", key);
      const forgeResponse = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });
      if (!forgeResponse.ok) {
        console.error(`[StorageProxy] Forge returned ${forgeResponse.status}`);
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = await forgeResponse.json() as { url?: string };
      if (!url) {
        res.status(502).send("Storage backend returned an empty URL");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (error) {
      console.error("[StorageProxy] Failed to obtain asset URL", error);
      res.status(502).send("Storage proxy error");
    }
  });
}
