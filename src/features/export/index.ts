import type { Format } from "../../domain/library";

function stageNode(): SVGSVGElement {
  const node = document.querySelector<SVGSVGElement>("#stage");
  if (!node) throw new Error("сцена не найдена");
  return node;
}

export function buildSvg(format: Format): string {
  const clone = stageNode().cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll("[data-ui]").forEach((node) => node.remove());
  clone.querySelectorAll("[data-hit]").forEach((node) => node.remove());

  // в файл не должны попасть служебные атрибуты и классы
  clone.removeAttribute("class");
  clone.querySelectorAll("*").forEach((node) => {
    node.removeAttribute("class");
    node.removeAttribute("data-item");
    node.removeAttribute("data-selected");
    node.removeAttribute("data-bg");
    node.removeAttribute("pointer-events");
  });

  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(format.w));
  clone.setAttribute("height", String(format.h));
  clone.removeAttribute("style");
  clone.setAttribute("id", "illustration");
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function exportSvg(format: Format, tag: string) {
  download(`illustration-${format.id}-${tag}.svg`, new Blob([buildSvg(format)], { type: "image/svg+xml" }));
}

export async function exportPng(format: Format, tag: string) {
  const svg = buildSvg(format);
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  // без таймаута неудачная отрисовка подвешивает промис и кнопка остаётся занятой
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("кадр не отрисовался")), 5000);
    image.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error("не удалось отрисовать"));
    };
    image.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = format.w;
  canvas.height = format.h;
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  canvas.toBlob((blob) => {
    if (blob) download(`illustration-${format.id}-${tag}.png`, blob);
  }, "image/png");
}
