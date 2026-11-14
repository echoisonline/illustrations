/**
 * Прокси к DeepSeek для продакшена: на Vercel нет Vite-прокси, поэтому запрос
 * к модели идёт через эту функцию. Ключ живёт в переменных окружения проекта
 * и в браузер не попадает.
 *
 * Без ключа функция сразу отвечает 503 — клиент не ждёт таймаут и собирает
 * сцену по правилам.
 */
export default async function handler(request: any, response: any) {
  const key = process.env.DEEPSEEK_KEY;
  if (!key) {
    response.status(503).json({ error: "ключ не настроен" });
    return;
  }

  if (request.method !== "POST") {
    response.status(405).json({ error: "только POST" });
    return;
  }

  const body = typeof request.body === "string" ? request.body : JSON.stringify(request.body ?? {});

  try {
    const upstream = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body,
    });

    const text = await upstream.text();
    response.status(upstream.status);
    response.setHeader("Content-Type", "application/json");
    response.send(text);
  } catch (error) {
    response.status(502).json({ error: "модель недоступна" });
  }
}
