// scripts/generate-supabase-types.ts

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const PROJECT_ID = process.env.SUPABASE_PROJECT_ID;

if (!PROJECT_ID) {
  throw new Error("SUPABASE_PROJECT_ID is required");
}

const types = execSync(
  `npx -m supabase gen types typescript --project-id ${PROJECT_ID}`,
  {
    encoding: "utf8",
  }
);

writeFileSync("src/integrations/supabase/types.ts", types);

console.log("Generated src/integrations/supabase/types.ts");
