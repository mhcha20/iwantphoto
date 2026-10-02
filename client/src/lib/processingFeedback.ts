export function getProcessingErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message.trim()) {
    const message = error.message.trim();
    // Last-resort protection for a browser/server URL parser exception. Server
    // routes should already return task-specific recovery copy, but customers
    // should never see a low-level pattern-matching error if an upstream layer
    // fails before it can be translated.
    if (/string did not match the expected pattern|failed to parse url|invalid (?:upload|download) url/i.test(message)) {
      return "相片準備服務暫時未能連線，請重新上載後再試；未完成圖片不會扣除額度。";
    }
    return message;
  }
  return "AI 修圖暫時未能完成，請手動重新嘗試。";
}

export function shouldResetBatchFeedback(remainingImageCount: number) {
  return remainingImageCount === 0;
}
