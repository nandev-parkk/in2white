export function getHealthStatus() {
  return {
    status: "ok" as const,
    timestamp: new Date().toISOString(),
  };
}
