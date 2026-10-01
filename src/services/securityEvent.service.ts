import { prisma } from "../config/prisma";
import type { SecurityEventType } from "@prisma/client";

interface LogSecurityEventInput {
  type: SecurityEventType;
  userId?: string;
  email?: string;
  ip?: string;
}

export async function logSecurityEvent(input: LogSecurityEventInput): Promise<void> {
  await prisma.securityEvent.create({
    data: {
      type: input.type,
      userId: input.userId,
      email: input.email,
      ip: input.ip,
    },
  });
}
