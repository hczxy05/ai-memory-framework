import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
assert.equal(process.getuid(),0,"Bootstrap needs only CHOWN capability in the dedicated container");
const root="/authority";assert.equal(fs.readdirSync(root).length,0,"Use a fresh empty Docker volume");
const files=JSON.parse(fs.readFileSync(0,"utf8"));
assert.deepEqual(Object.keys(files).sort(),["code/promotion-gate/gate.mjs","code/shared/secrets.mjs","fixture.mjs"]);
for(const [dest,source] of Object.entries(files)){
  const target=path.join(root,dest);fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,source,{flag:"wx",mode:0o444});
}
for(const name of ["docs","operator","inbox"])fs.mkdirSync(path.join(root,name));
fs.writeFileSync(root+"/docs/LESSONS.md","# Fixture Lessons\n\n## Purpose\nSynthetic authority-isolation fixture only.\n",{flag:"wx",mode:0o644});
fs.chownSync(root+"/docs/LESSONS.md",1001,1001);
for(const [name,uid,mode] of [["docs",1001,0o755],["operator",1001,0o700],["inbox",1000,0o755]]){
  fs.chmodSync(root+"/"+name,mode);fs.chownSync(root+"/"+name,uid,uid);
}
console.log("Fresh synthetic authority fixture bootstrapped");
