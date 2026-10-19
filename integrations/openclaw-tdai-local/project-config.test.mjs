import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { projectBundle } from "./project-config.mjs";
const base = JSON.parse(fs.readFileSync(new URL("./openclaw.test.fragment.json", import.meta.url)));
test("project bundles isolate all persistent state, disable auto recall and expose no host port", () => {
  const a = projectBundle(base, "alpha"), b = projectBundle(base, "beta");
  assert.notEqual(a.compose.name, b.compose.name);
  assert.notEqual(a.config.gateway.auth.token, b.config.gateway.auth.token);
  assert.deepEqual(a.compose.volumes, {state:{},workspace:{},config:{}});
  for (const bundle of [a,b]) {
    const gateway = bundle.compose.services.gateway;
    assert.equal(gateway.ports, undefined); assert.equal(gateway.privileged, undefined);
    assert.equal(gateway.mem_limit, "2g");assert.equal(gateway.read_only, true); assert.equal(gateway.user, "1000:1000");
    assert.equal(bundle.compose.networks.default.internal, true);
    assert.equal(bundle.config.plugins.entries["memory-tencentdb"].config.recall.enabled, false);
    assert.ok(Object.values(bundle.config.agents.entries).every(a=>a.workspace==="/home/node/workspace"));
    assert.ok(!gateway.volumes.some(v=>v.includes("docker.sock") || v.includes("external")));
  }
  for(const bad of [undefined,null,0,"../other"])assert.throws(()=>projectBundle(base,bad),/project id/);
  assert.throws(()=>projectBundle({}, "alpha"), /SQLite/);
  assert.equal(base.agents.defaults.workspace, "/lab/e2e/workspace");
});

test("CLI refuses to overwrite an existing private project bundle", async(t)=>{
 const os=await import("node:os"),path=await import("node:path"),{execFileSync}=await import("node:child_process");
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"project-bundle-"));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const input=path.join(dir,"base.json"),output=path.join(dir,"alpha");fs.writeFileSync(input,JSON.stringify(base));
 const {fileURLToPath}=await import("node:url");const cli=fileURLToPath(new URL("./project-config.mjs",import.meta.url));
 execFileSync(process.execPath,[cli,input,"alpha",output],{stdio:"pipe"});
 const original=fs.readFileSync(path.join(output,"compose.json"));
 assert.throws(()=>execFileSync(process.execPath,[cli,input,"alpha",output],{stdio:"pipe"}));
 assert.ok(fs.readFileSync(path.join(output,"compose.json")).equals(original));
});
