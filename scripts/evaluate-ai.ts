import { parseMessage } from "../lib/ai";
import cases from "../tests/fixtures/messages.json";
import { mkdirSync, writeFileSync } from "node:fs";
async function main() {
  const results = [];
  for (const c of cases) {
    try {
      const d = await parseMessage(c.text, c.hasPhoto);
      results.push({
        ...c,
        predicted: d.kind,
        correct: d.kind === c.expected,
        provider: d.provider,
        model: d.model,
      });
      console.log(
        `${d.kind === c.expected ? "PASS" : "FAIL"} ${c.expected} → ${d.kind}`,
      );
    } catch (e) {
      results.push({
        ...c,
        predicted: "ERROR",
        correct: false,
        error: e instanceof Error ? e.message : "AI failed",
      });
    }
  }
  const correct = results.filter((x) => x.correct).length;
  const report = {
    at: new Date().toISOString(),
    total: cases.length,
    correct,
    accuracy: correct / cases.length,
    method:
      "Single sequential run, temperature 0, fixed labelled set; errors count as incorrect. Small developer-authored set, not an independent benchmark.",
    results,
  };
  mkdirSync("reports", { recursive: true });
  writeFileSync(
    "reports/ai-evaluation.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({ correct, total: cases.length, accuracy: report.accuracy }),
  );
  if (results.every((x) => x.predicted === "ERROR")) process.exitCode = 1;
}
main();
