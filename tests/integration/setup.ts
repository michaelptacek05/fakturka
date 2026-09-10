import "dotenv/config";

import { getTestDatabaseUrl } from "./database";

// Musí se nastavit dřív, než si `@/lib/prisma` přečte connection string.
process.env.DATABASE_URL = getTestDatabaseUrl();
