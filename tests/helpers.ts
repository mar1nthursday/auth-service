import { randomUUID } from "node:crypto";
import type { Response } from "supertest";

export const TEST_PASSWORD = "SuperSecret123!";

export function uniqueEmail(): string {
  return `test-${randomUUID()}@example.com`;
}

export function extractCookie(res: Response, name: string): string {
  const raw = res.headers["set-cookie"] as unknown as string[] | undefined;
  const line = raw?.find((c) => c.startsWith(`${name}=`));
  if (!line) throw new Error(`cookie ${name} not found in response`);
  return line.split(";")[0]!;
}
