import { describe, expect, it } from "vitest";
import { MAX_BATCH_FILES, queueEligible, queueFailed, selectBatchFiles } from "./batchQueue";

describe("batch queue helpers", () => {
  it("limits an upload selection to the available batch slots", () => {
    expect(selectBatchFiles(["a", "b", "c"], 8)).toEqual(["a", "b"]);
    expect(selectBatchFiles(["a"], MAX_BATCH_FILES)).toEqual([]);
  });

  it("keeps ready and failed entries available for batch retry", () => {
    const entries = [
      { id: "1", status: "ready" },
      { id: "2", status: "processing" },
      { id: "3", status: "done" },
      { id: "4", status: "error" },
    ];

   expect(queueEligible(entries).map((entry) => entry.id)).toEqual(["1", "4"]);
  });

  it("selects only failed entries for a batch retry", () => {
    const entries = [
      { id: "1", status: "ready" },
      { id: "2", status: "error" },
      { id: "3", status: "done" },
      { id: "4", status: "error" },
    ];

    expect(queueFailed(entries).map((entry) => entry.id)).toEqual(["2", "4"]);
  });
});
