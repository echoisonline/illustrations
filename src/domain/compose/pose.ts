import type { FormatId } from "../library";
import { PATTERN_CATALOG } from "./layout";

export type Pose = { pattern: string; mirror: boolean; why?: string };

const ENDPOINT = "/api/deepseek/chat/completions";
// спиннер не должен висеть долго: не ответили — собираем по правилам
const TIMEOUT = 7000;

const FORMAT_HINT: Record<FormatId, string> = {
  square: "квадрат 1000×1000",
  wide: "горизонталь 1200×630 — кадр низкий, крупный предмет режется сверху и снизу",
  tall: "вертикаль 800×1200 — кадр высокий, есть место для связки сверху вниз",
};

function buildPrompt(theme: string, format: FormatId): string {
  const list = PATTERN_CATALOG.map((entry) => `- ${entry.id}: ${entry.about}`).join("\n");
  return `Ты арт-директор иллюстраций. Выбери композиционную позу для сцены по теме.

Кадр: ${FORMAT_HINT[format]}.

Доступные позы (выбирать можно только из этого списка):
${list}

Правила выбора:
- поза должна выражать смысл темы, а не просто быть удобной;
- в горизонтальном кадре не выбирай позы, которым нужна высота;
- если тема про одно и то же действие с предметом — выбирай «взаимодействие»;
- не выбирай «стопку» или «крупный план», если тема про два равноправных предмета.

Тема: «${theme}».

Ответ строго JSON:
{"pattern":"взаимодействие","mirror":false,"why":"одна короткая фраза"}`;
}

/** Проверяем, что модель не выдумала позу. */
function parse(raw: string): Pose | null {
  let data: { pattern?: unknown; mirror?: unknown; why?: unknown };
  try {
    // модель иногда оборачивает ответ в ```json — снимаем обёртку
    const clean = raw.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim();
    data = JSON.parse(clean) as typeof data;
  } catch {
    return null;
  }
  const pattern = typeof data.pattern === "string" ? data.pattern.trim() : "";
  if (!PATTERN_CATALOG.some((entry) => entry.id === pattern)) return null;
  return {
    pattern,
    mirror: data.mirror === true,
    why: typeof data.why === "string" ? data.why.slice(0, 120) : undefined,
  };
}

/**
 * Выбор позы моделью. Она выбирает только из закрытого списка паттернов —
 * координат не касается. Любая ошибка означает «остаёмся на правилах».
 */
export async function askPose(theme: string, format: FormatId): Promise<Pose | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: "deepseek-flash",
        temperature: 0,
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Отвечаешь только JSON, без пояснений и markdown." },
          { role: "user", content: buildPrompt(theme, format) },
        ],
      }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = payload.choices?.[0]?.message?.content;
    return text ? parse(text) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
