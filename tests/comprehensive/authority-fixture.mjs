import assert from "node:assert/strict";
import fs from "node:fs";
import { initKey, prepare, signApproval, applyApproval, sha256 } from "./code/promotion-gate/gate.mjs";

const stage=process.argv[2],root="/authority",key=root+"/operator/promotion.key",policy={root:root+"/docs",scope:"fixture:isolated-authority",files:["LESSONS.md"]};
const reportFile=root+"/docs/proof.json";
if(stage==="operator-init"){
  assert.equal(process.getuid(),1001);initKey(key);console.log("Operator key initialized without output");
}else if(stage==="agent"){
  assert.equal(process.getuid(),1000);const denials=[];
  for(const [name,fn] of [
    ["read approval key",()=>fs.readFileSync(key)],
    ["write authoritative document",()=>fs.appendFileSync(root+"/docs/LESSONS.md","UNAUTHORIZED")],
    ["replace protected executor",()=>fs.writeFileSync(root+"/code/promotion-gate/gate.mjs","UNAUTHORIZED")],
    ["replace operator directory",()=>fs.renameSync(root+"/operator",root+"/stolen-operator")]
  ]){
    try{fn();throw Error("Unexpected access: "+name)}catch(error){assert.ok(["EACCES","EPERM","EROFS"].includes(error.code),name+": "+error.message);denials.push({action:name,denied:true,code:error.code})}
  }
  const original=fs.readFileSync(root+"/docs/LESSONS.md");
  const candidate={scope:policy.scope,target:"LESSONS.md",content:"## Isolated fixture\nOnly the independent trusted executor may append this synthetic lesson.",
    base_sha256:sha256(original),stable:true,reusable:true,
    evidence:{source:"Docker UID separation fixture",summary:"Agent UID 1000 cannot read the key, modify authority, or replace the executor.",verified_at:new Date().toISOString()},expires_at:new Date(Date.now()+3600000).toISOString()};
  const plan=prepare(policy,candidate);
  assert.throws(()=>applyApproval(policy,candidate,{version:1,digest:plan.digest,expires_at:plan.plan.expires_at,signature:"00".repeat(32)},key));
  denials.push({action:"forge approval using caller flags",denied:true});
  fs.writeFileSync(root+"/inbox/candidate.json",JSON.stringify(candidate,null,2)+"\n");
  fs.writeFileSync(root+"/inbox/agent-proof.json",JSON.stringify(denials,null,2)+"\n");
  console.log(JSON.stringify({uid:process.getuid(),denials}));
}else if(stage==="operator-apply"){
  assert.equal(process.getuid(),1001);
  const candidate=JSON.parse(fs.readFileSync(root+"/inbox/candidate.json","utf8")),p=prepare(policy,candidate),receipt=signApproval(p.plan,key,"APPROVE "+p.digest);
  assert.throws(()=>applyApproval(policy,{...candidate,content:"A substituted unauthorized fact"},receipt,key));
  assert.throws(()=>applyApproval(policy,candidate,{...receipt,signature:"00".repeat(32)},key));
  const result=applyApproval(policy,candidate,receipt,key);
  assert.throws(()=>applyApproval(policy,candidate,receipt,key));
  const proof={schema:1,syntheticOnly:true,automatedApprovalIsSimulation:true,agentUid:1000,operatorUid:1001,agentDenials:JSON.parse(fs.readFileSync(root+"/inbox/agent-proof.json","utf8")),applied:result,tamperedRejected:true,forgedRejected:true,replayRejected:true};
  fs.writeFileSync(reportFile,JSON.stringify(proof,null,2)+"\n");
  console.log(JSON.stringify(proof));
}else if(stage==="agent-after"){
  assert.equal(process.getuid(),1000);
  assert.throws(()=>fs.appendFileSync(root+"/docs/LESSONS.md","UNAUTHORIZED"));
  assert.throws(()=>fs.readFileSync(key));
  assert.equal(fs.readFileSync(root+"/docs/LESSONS.md","utf8").includes("UNAUTHORIZED"),false);
  console.log("Agent remains unable to alter promoted authority or read the key");
}else throw Error("Unknown fixture stage");
