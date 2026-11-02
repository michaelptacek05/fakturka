import { isIP } from "node:net";

import { getAuthFingerprint } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 8;

/** NPM X-Real-IP přepisuje. Jeho důvěra musí být výslovně zapnuta a přímý
 * přístup k aplikaci omezen na hostitele a důvěryhodnou proxy síť. */
export function getLoginSource(realIp: string | null) {
  if (process.env.AUTH_TRUST_PROXY !== "true") return "shared";
  if (!realIp || isIP(realIp) === 0) return null;
  return realIp.includes(":") ? new URL(`http://[${realIp}]/`).hostname : realIp;
}

/** Rezervace se provádí před ověřením hesla atomickým UPSERT, i mezi procesy. */
export async function reserveLoginAttempt(source: string) {
  const sourceHash = await getAuthFingerprint(`login-source:${source}`);
  const now = new Date();
  const cutoff = new Date(now.getTime() - WINDOW_MS);
  await prisma.loginThrottle.deleteMany({
    where: { windowStartedAt: { lt: new Date(now.getTime() - 86_400_000) } },
  });
  const rows = await prisma.$queryRaw<Array<{ attempts: number }>>`
    INSERT INTO "LoginThrottle" ("sourceHash", "attempts", "windowStartedAt")
    VALUES (${sourceHash}, 1, ${now})
    ON CONFLICT ("sourceHash") DO UPDATE SET
      "attempts" = CASE WHEN "LoginThrottle"."windowStartedAt" <= ${cutoff}
        THEN 1 ELSE LEAST("LoginThrottle"."attempts" + 1, ${MAX_ATTEMPTS + 1}) END,
      "windowStartedAt" = CASE WHEN "LoginThrottle"."windowStartedAt" <= ${cutoff}
        THEN ${now} ELSE "LoginThrottle"."windowStartedAt" END
    RETURNING "attempts"`;
  return rows[0].attempts <= MAX_ATTEMPTS;
}
