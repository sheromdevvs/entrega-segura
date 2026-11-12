import { Suspense } from "react";
import type { Metadata } from "next";
import Judge from "./Judge";
export const metadata: Metadata = { title: "Explore la demo" };
export default function Page() {
  return (
    <Suspense
      fallback={
        <main id="content" className="workspace">
          <div className="loading-state">
            <span className="spinner" /> Preparando su recorrido…
          </div>
        </main>
      }
    >
      <Judge />
    </Suspense>
  );
}
