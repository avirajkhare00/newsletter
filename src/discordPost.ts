import { DISCORD_WEBHOOK_URL, MAX_MESSAGE_CHARS } from "./config.js";

export function splitContent(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length) {
    let chunk = rest.slice(0, maxChars);
    if (rest.length > maxChars) {
      const br = chunk.lastIndexOf("\n");
      if (br > maxChars / 2) chunk = rest.slice(0, br + 1);
    }
    const trimmed = chunk.trim();
    if (trimmed) parts.push(trimmed);
    rest = rest.slice(chunk.length).trimStart();
  }
  return parts;
}

export async function postNewsletter(content: string): Promise<void> {
  if (!DISCORD_WEBHOOK_URL)
    throw new Error(
      "DISCORD_WEBHOOK_URL is not set. Copy .env.example to .env and add your webhook URL.",
    );
  const chunks = splitContent(content, MAX_MESSAGE_CHARS);
  for (let i = 0; i < chunks.length; i++) {
    let body = chunks[i]!;
    if (i > 0)
      body = `_(continued ${i + 1}/${chunks.length})_\n\n${body}`;
    const r = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: body }),
    });
    if (!r.ok) {
      const errText = await r.text();
      throw new Error(`Discord webhook ${r.status}: ${errText}`);
    }
  }
}
