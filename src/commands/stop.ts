import { ConnectionManager } from "../connection/ConnectionManager.js";

export async function stopAllJobs(
  connectionManager: ConnectionManager
): Promise<void> {
  await connectionManager.transport!.send("/stop-all-jobs");
}
