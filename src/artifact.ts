import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { NEWSLETTER_ARTIFACT_PATH } from "./config.js";

export async function writeNewsletterArtifact(body: string): Promise<void> {
  if (!NEWSLETTER_ARTIFACT_PATH) return;
  const dir = dirname(NEWSLETTER_ARTIFACT_PATH);
  if (dir !== ".") await mkdir(dir, { recursive: true });
  await writeFile(NEWSLETTER_ARTIFACT_PATH, body, "utf8");
  console.log(`Wrote artifact: ${NEWSLETTER_ARTIFACT_PATH}`);
}
