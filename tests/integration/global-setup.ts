import "dotenv/config";

import { prepareTestDatabase } from "./database";

export async function setup() {
  await prepareTestDatabase();
}
