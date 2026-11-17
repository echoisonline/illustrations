import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportPng, exportSvg } from "./index";

const format = { id: "square" as const, name: "квадрат", w: 1000, h: 1000 };

class TestImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";
}

let image: TestImage;
const revoke = vi.fn();
const drawImage = vi.fn();
const click = vi.fn();
const toBlob = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  image = new TestImage();
  vi.stubGlobal("Image", class { constructor() { return image; } });
  let urls = 0;
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => `blob:test-${++urls}`),
    revokeObjectURL: revoke,
  });
  const clone = { querySelectorAll: () => [], removeAttribute: vi.fn(), setAttribute: vi.fn() };
  toBlob.mockImplementation((callback: (blob: Blob | null) => void) => callback(new Blob(["png"])));
  drawImage.mockImplementation(() => undefined);
  click.mockImplementation(() => undefined);
  vi.stubGlobal("document", {
    querySelector: () => ({ cloneNode: () => clone }),
    createElement: (tag: string) => tag === "canvas"
      ? { getContext: () => ({ drawImage }), toBlob, width: 0, height: 0 }
      : { click },
  });
  vi.stubGlobal("XMLSerializer", class { serializeToString() { return "<svg/>"; } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function expectCleanImage() {
  expect(revoke).toHaveBeenCalledWith("blob:test-1");
  expect(image.onload).toBeNull();
  expect(image.onerror).toBeNull();
  expect(image.src).toBe("");
  expect(vi.getTimerCount()).toBe(0);
}

describe("export resource cleanup", () => {
  it("releases both URLs after successful PNG export", async () => {
    const pending = exportPng(format, "aL");
    image.onload!();
    await pending;
    expect(revoke).toHaveBeenCalledWith("blob:test-1");
    await vi.runAllTimersAsync();
    expect(revoke).toHaveBeenCalledWith("blob:test-2");
    expect(revoke).toHaveBeenCalledTimes(2);
    expectCleanImage();
  });

  it("releases the source URL after image errors", async () => {
    const pending = exportPng(format, "aL");
    const rejected = expect(pending).rejects.toThrow("не удалось отрисовать");
    image.onerror!();
    await rejected;
    expectCleanImage();
  });

  it("cancels the image and releases the URL on timeout", async () => {
    const pending = exportPng(format, "aL");
    const rejected = expect(pending).rejects.toThrow("кадр не отрисовался");
    await vi.advanceTimersByTimeAsync(5000);
    await rejected;
    expectCleanImage();
  });

  it("releases the URL when drawing throws", async () => {
    drawImage.mockImplementation(() => { throw new Error("draw failed"); });
    const pending = exportPng(format, "aL");
    const rejected = expect(pending).rejects.toThrow("draw failed");
    image.onload!();
    await rejected;
    expectCleanImage();
  });

  it("releases the URL when PNG encoding fails", async () => {
    toBlob.mockImplementation((callback: (blob: Blob | null) => void) => callback(null));
    const pending = exportPng(format, "aL");
    const rejected = expect(pending).rejects.toThrow("не удалось создать PNG");
    image.onload!();
    await rejected;
    expectCleanImage();
  });

  it("releases download URLs even when clicking throws", async () => {
    click.mockImplementation(() => { throw new Error("download failed"); });
    expect(() => exportSvg(format, "aL")).toThrow("download failed");
    await vi.runAllTimersAsync();
    expect(revoke).toHaveBeenCalledWith("blob:test-1");
  });
});
