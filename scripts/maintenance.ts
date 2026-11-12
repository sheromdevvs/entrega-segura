import { runMaintenance } from "../lib/maintenance";
runMaintenance()
  .then((report) => console.log(JSON.stringify(report, null, 2)))
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Maintenance failed",
    );
    process.exitCode = 1;
  });
