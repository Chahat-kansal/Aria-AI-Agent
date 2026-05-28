import { getProviderStatuses } from "@/lib/services/provider-status";

async function main() {
  const statuses = await getProviderStatuses();
  const blocking = statuses.filter((status) => status.key === "storage" && !status.configured);
  console.log(JSON.stringify({
    pass: blocking.length === 0,
    providers: statuses,
    blocking: blocking.map((item) => item.key),
    notes: [
      "Unconfigured optional providers remain honest disabled states, not fake-ready states.",
      "Storage is treated as the only blocker in this generic readiness check."
    ]
  }, null, 2));
  if (blocking.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
