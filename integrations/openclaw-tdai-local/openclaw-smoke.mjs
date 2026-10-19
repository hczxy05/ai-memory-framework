#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { startServer, toolCall } from "../codex-tdai-local/test-support.mjs";

if (process.env.AI_MEMORY_DOCKER_LAB !== "1") throw new Error("Run only in the isolated Docker lab with AI_MEMORY_DOCKER_LAB=1");
const dataDir=path.join(os.homedir(),".openclaw","memory-tdai");
const proxy="http://ai-memory-p2-budget:8080";
const before=await(await fetch(proxy+"/health")).json();
assert.equal(before.ready,true,"Configure the key inside the private proxy container first");
assert.ok(before.calls<=8,"Leave room for the agent and extraction calls");
const id=randomUUID(), scope="agent:tdai-poc:fixture-"+id;
const turn=execFileSync("openclaw",["agent","--agent","tdai-poc","--session-key",scope,"--session-id",id,
  "--message","Synthetic integration fixture: project ORION uses telemetry port 4317. This is a confirmed stable reusable engineering decision within this fixture only. Reply FIXTURE_ACK only.",
  "--thinking","off","--timeout","60","--json"],{encoding:"utf8",timeout:90000,maxBuffer:2*1024*1024});
assert.match(turn,/FIXTURE_ACK/);
let rows=[];
const deadline=Date.now()+60000;
while(Date.now()<deadline){
  const db=new DatabaseSync(path.join(dataDir,"vectors.db"),{readOnly:true});
  try{rows=db.prepare("SELECT record_id,content,session_key FROM l1_records WHERE session_key=?").all(scope)}finally{db.close()}
  if(rows.some(r=>r.content.includes("ORION")&&r.content.includes("4317")))break;
  await new Promise(resolve=>setTimeout(resolve,500));
}
assert.ok(rows.some(r=>r.content.includes("ORION")&&r.content.includes("4317")),"L1 extraction did not persist the expected fact");
const db=new DatabaseSync(path.join(dataDir,"vectors.db"),{readOnly:true});
const l0=db.prepare("SELECT count(*) n FROM l0_conversations WHERE session_key=?").get(scope).n;db.close();
assert.ok(l0>=2);
const client=startServer(dataDir,{TDAI_SESSION_KEY:scope,TDAI_ALLOW_STORE:""});
let found;
try{const response=await toolCall(client,1,"tdai_memory_search",{query:"ORION telemetry port"});assert.ok(!response.result.isError);found=response.result.structuredContent.results;assert.ok(found.some(r=>r.content.includes("4317")))}
finally{await client.close()}
const other=startServer(dataDir,{TDAI_SESSION_KEY:"agent:other:unrelated-project",TDAI_ALLOW_STORE:""});
try{const response=await toolCall(other,1,"tdai_memory_search",{query:"ORION telemetry port"});assert.deepEqual(response.result.structuredContent.results,[])}
finally{await other.close()}
const original="# Fixture Lessons\n\n## Purpose\nConfirmed engineering lessons for the synthetic ORION fixture only.\n";
const candidate={scope:"fixture:ORION",target:"LESSONS.md",content:"## Synthetic ORION telemetry\nProject ORION in this integration fixture uses telemetry port 4317.",
  base_sha256:createHash("sha256").update(original).digest("hex"),stable:true,reusable:true,
  evidence:{source:"OpenClaw/TDAI L1 "+rows[0].record_id,summary:"Real DeepSeek turn, L0 capture, L1 persistence and scoped MCP recall verified in a synthetic fixture.",verified_at:new Date().toISOString()},
  expires_at:new Date(Date.now()+3600_000).toISOString()};
fs.mkdirSync("/lab/promotion-inbox",{recursive:true,mode:0o755});
fs.writeFileSync("/lab/promotion-inbox/candidate.json",JSON.stringify(candidate,null,2)+"\n",{mode:0o644});
fs.writeFileSync("/lab/promotion-inbox/original.md",original,{mode:0o644});
const after=await(await fetch(proxy+"/health")).json();
const report={scope,model:"deepseek-flash",l0,l1:rows.length,scopedRecall:true,crossScopeRecallDenied:true,callsUsed:after.calls-before.calls,totalCalls:after.calls,reservedRmb:after.reservedRmb,unsignedCandidate:"/lab/promotion-inbox/candidate.json"};
fs.writeFileSync("/lab/reports/openclaw-e2e.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report));
