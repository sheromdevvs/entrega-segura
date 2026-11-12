export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.MAINTENANCE_ENABLED === "true" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { startMaintenance } = await import("./lib/maintenance");
    startMaintenance();
  }
}
