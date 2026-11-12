import { Suspense } from "react";
import Judge from "./Judge";
export default function Page() {
  return (
    <Suspense fallback={<main className="workspace">Loading demo…</main>}>
      <Judge />
    </Suspense>
  );
}
