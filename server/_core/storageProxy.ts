import type { Express } from "express";
import { storageGetBytes, storageGetSignedUrl } from "../storage";

function isSafeKey(key: string) {
  return key.length > 0 && !key.includes("..") && !key.includes("\\") && !key.startsWith("/");
}

/** Redirects `/manus-storage/<key>` (the URL form stored in the database) to a short-lived signed object URL, or serves it inline. */
export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    // Express has already percent-decoded the wildcard; decoding again would corrupt keys containing "%".
    const key = (req.params as Record<string, string>)[0] ?? "";
    if (!isSafeKey(key)) {
      res.status(400).send("Invalid storage key");
      return;
    }

    try {
      // `?inline=1` serves the bytes from this origin so the browser can edit the pixels on a canvas
      // (a cross-origin redirect would taint it).
      if (req.query.inline === "1") {
        const { bytes, contentType } = await storageGetBytes(key);
        res.set("Cache-Control", "private, no-store");
        res.set("Content-Type", contentType);
        res.send(Buffer.from(bytes));
        return;
      }
      const url = await storageGetSignedUrl(key);
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
