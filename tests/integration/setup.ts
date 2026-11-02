import "dotenv/config";

import { getTestDatabaseUrl } from "./database";

// Musí se nastavit dřív, než si `@/lib/prisma` přečte connection string.
process.env.DATABASE_URL = getTestDatabaseUrl();
// Doménové testy běží v dokumentovaném lokálním režimu. Auth má vlastní testy.
process.env.AUTH_PASSWORD = "";
process.env.AUTH_REQUIRED = "false";
