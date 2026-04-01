import { writeNewsletterArtifact } from "./artifact.js";
import { DISCORD_WEBHOOK_URL, DRY_RUN } from "./config.js";
import { curateBiweeklyNewsletter } from "./curate.js";
import { postNewsletter } from "./discordPost.js";
import { gatherAll } from "./fetchers.js";

async function main(): Promise<void> {
  const stories = await gatherAll();
  const { body, mode, candidateCount } = await curateBiweeklyNewsletter(stories);
  await writeNewsletterArtifact(body);
  if (DRY_RUN) {
    console.log(body);
    console.log(
      `\n[DRY_RUN] mode=${mode} candidates=${candidateCount} — not posted.`,
    );
    return;
  }
  if (DISCORD_WEBHOOK_URL) {
    await postNewsletter(body);
    console.log(
      `Posted digest to Discord (${mode}, ${candidateCount} candidates).`,
    );
  } else {
    console.log(
      `Skipped Discord (no DISCORD_WEBHOOK_URL). Digest ready for release (${mode}, ${candidateCount} candidates).`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
