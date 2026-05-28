import { getStorageProviderStatus } from "@/lib/providers/storage-provider";

async function main() {
  const status = getStorageProviderStatus();
  console.log(JSON.stringify({
    pass: status.configured,
    provider: status.providerName,
    configured: status.configured,
    missing: status.missingEnv,
    notes: status.notes
  }, null, 2));
  if (!status.configured) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
