import { testRestoreEncryptedBackupInIsolation } from "../server/backup-service.ts";

const fileKey = process.argv[2];
if (!fileKey) throw new Error("Usage: pnpm exec tsx scripts/test-isolated-restore.mjs <fileKey>");

const result = await testRestoreEncryptedBackupInIsolation(fileKey);
console.log(JSON.stringify(result));
