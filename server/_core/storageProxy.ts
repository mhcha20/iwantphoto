import type { Express } from "express";
import { storageGetSignedUrl } from "../storage";

function isSafeKey(key: string) {
  return key.length > 0 && !key.includes("..") && !key.includes("\\") && !key.startsWith("/");
}

/** Redirects `/manus-storage/<key>` (the URL form stored in the database) to a short-lived signed object URL. */
export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    // Express has already percent-decoded the wildcard; decoding again would corrupt keys containing "%".
    const key = (req.params as Record<string, string>)[0] ?? "";
    if (!isSafeKey(key)) {
      res.status(400).send("Invalid storage key");
      return;
    }

    try {
      const url = await storageGetSignedUrl(key);
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
