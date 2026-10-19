import fs from "node:fs";
const files={};
for(const [dest,src] of [["fixture.mjs","tests/comprehensive/authority-fixture.mjs"],["code/promotion-gate/gate.mjs","integrations/promotion-gate/gate.mjs"],["code/shared/secrets.mjs","integrations/shared/secrets.mjs"]])files[dest]=fs.readFileSync(src,"utf8");
console.log(JSON.stringify(files));
