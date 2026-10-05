import { describe, expect, it } from "vitest";
import { hasTransparency, strokeBounds, touchUpSourceUrl } from "./cutoutTouchUp";

describe("cutout touch-up helpers", () => {
  it("asks for stored results inline so the canvas is not tainted", () => {
    expect(touchUpSourceUrl("/manus-storage/generated/a.png")).toBe("/manus-storage/generated/a.png?inline=1");
    expect(touchUpSourceUrl("/manus-storage/generated/a.png?v=2")).toBe("/manus-storage/generated/a.png?v=2&inline=1");
    expect(touchUpSourceUrl("blob:https://iwantphoto.com/1234")).toBe("blob:https://iwantphoto.com/1234");
    expect(touchUpSourceUrl("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
  });

  it("covers the whole stroke and stays inside the canvas", () => {
    expect(strokeBounds({ x: 50, y: 50 }, { x: 80, y: 60 }, 10, 200, 100)).toEqual({ x: 39, y: 39, width: 52, height: 32 });
    expect(strokeBounds({ x: 2, y: 3 }, { x: 2, y: 3 }, 10, 200, 100)).toEqual({ x: 0, y: 0, width: 13, height: 14 });
    expect(strokeBounds({ x: 195, y: 95 }, { x: 199, y: 99 }, 10, 200, 100)).toEqual({ x: 184, y: 84, width: 16, height: 16 });
  });

  it("detects whether a result is transparent or flattened onto white", () => {
    expect(hasTransparency([255, 255, 255, 255, 1, 2, 3, 0])).toBe(true);
    expect(hasTransparency([255, 255, 255, 255, 1, 2, 3, 255])).toBe(false);
  });
});
