import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";
import { createDatabase, startServer, toolCall } from "../../integrations/codex-tdai-local/test-support.mjs";

if(process.env.AI_MEMORY_DOCKER_LAB!=="1")throw Error("Synthetic isolated Docker opt-in required");
const [mode,own,peer]=process.argv.slice(2);
if(!["--capture","--verify","--smoke","--run"].includes(mode)||![own,peer].every(v=>/^[A-Z0-9]{5,40}$/.test(v))||own===peer)throw Error("Usage: endurance.mjs --capture|--verify|--smoke|--run OWN_MARKER PEER_MARKER");
const root=process.env.OPENCLAW_STATE_DIR,workspace="/home/node/workspace",store=path.join(root,"memory-tdai");
assert.equal(root,"/home/node/.openclaw");
const out=path.join(root,"validation",mode==="--smoke"?"smoke":"endurance");fs.mkdirSync(out,{recursive:true});
const cfg=JSON.parse(fs.readFileSync(process.env.OPENCLAW_CONFIG_PATH)),scope="agent:tdai-poc:boundary-"+own;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const hash=b=>createHash("sha256").update(b).digest("hex");
const dbRows=()=>{const db=new DatabaseSync(path.join(store,"vectors.db"),{readOnly:true});try{return{l0:db.prepare("SELECT record_id,message_text FROM l0_conversations").all(),l1:db.prepare("SELECT record_id,content FROM l1_records").all()}}finally{db.close()}};
async function ready(){
 for(let n=0;n<120;n++){try{const r=await fetch("http://127.0.0.1:18789/healthz",{signal:AbortSignal.timeout(500)});if(r.ok)return}catch{}await sleep(500)}
 throw Error("Gateway readiness timeout");
}
async function native(tool,args){
 const r=await fetch("http://127.0.0.1:18789/tools/invoke",{method:"POST",headers:{authorization:"Bearer "+cfg.gateway.auth.token,"content-type":"application/json"},body:JSON.stringify({tool,sessionKey:scope,args}),signal:AbortSignal.timeout(15000)});
 assert.equal(r.status,200);const result=await r.json();assert.notEqual(result.ok,false);return JSON.stringify(result);
}
async function capture(label){
 const tag=own+label,before=fs.existsSync(path.join(store,"vectors.db"))?dbRows().l0.length:0;
 const result=await promisify(execFile)("openclaw",["agent","--agent","tdai-poc","--session-key",scope,"--session-id",randomUUID(),"--message","Confirmed stable reusable engineering decision for project "+own+": checkpoint "+tag+" uses telemetry port 8123. Reply ACK only.","--thinking","off","--timeout","120","--json"],{timeout:150000,maxBuffer:1048576});
 assert.ok(!/falling back to embedded/i.test(result.stderr),"Must use actual Gateway");
 const parsed=JSON.parse(result.stdout);
 fs.appendFileSync(path.join(out,"turns.jsonl"),JSON.stringify({label,response:parsed})+"\n");
 for(let n=0;n<150;n++){try{const rows=dbRows();if(rows.l0.length>=before+2&&rows.l1.some(r=>r.content.includes(tag)))return{tag,l0:rows.l0.length,l1:rows.l1.length}}catch{}await sleep(500)}
 throw Error("Actual L0/L1 capture did not persist "+tag);
}
async function verify(){
 const proof={own,peer,checks:[]};
 for(const tool of ["tdai_memory_search","tdai_conversation_search"]){
   assert.ok((await native(tool,{query:own,limit:3})).includes(own));assert.ok(!(await native(tool,{query:peer,limit:3})).includes(peer));proof.checks.push(tool+" own positive / peer negative");
 }
 for(const file of ["persona.md","scene_blocks/"+own+".md"]){const result=await native("tdai_read_cos",{path:file});assert.ok(result.includes(own));assert.ok(!result.includes(peer));proof.checks.push(file+" isolated")}
 const absent=await native("tdai_read_cos",{path:"scene_blocks/"+peer+".md"});assert.ok(!absent.includes("Fixture evidence "+peer));proof.checks.push("peer scene absent");
 proof.passed=true;return proof;
}
if(mode==="--capture"){
 for(const file of ["AGENTS","SOUL","IDENTITY","USER","TOOLS","BOOTSTRAP"])fs.writeFileSync(path.join(workspace,file+".md"),"# Purpose\nFictional isolated validation workspace. No onboarding, external actions or authority edits. Reply ACK only when requested.\n");
 fs.writeFileSync(path.join(workspace,"PROJECT.md"),"# Project\n\n## Purpose\nAuthoritative synthetic fixture only. Current port: 8999.\n");
 // Native read_cos uses cos-storage; pipeline/MCP files live at the data root.
 for(const objectRoot of [store,path.join(store,"cos-storage")]){
  fs.mkdirSync(path.join(objectRoot,"scene_blocks"),{recursive:true});
  fs.writeFileSync(path.join(objectRoot,"persona.md"),"Fixture evidence "+own+"; fictional, not actual user preferences.\n");
  fs.writeFileSync(path.join(objectRoot,"scene_blocks",own+".md"),"Fixture evidence "+own+".\n");
 }
 await ready();console.log(JSON.stringify(await capture("INITIAL")));process.exit(0);
}
if(mode==="--verify"){await ready();const proof=await verify();fs.writeFileSync(path.join(out,"isolation.json"),JSON.stringify(proof,null,2)+"\n");console.log(JSON.stringify(proof));process.exit(0)}
const seconds=mode==="--smoke"?120:72*3600,faultEvery=mode==="--smoke"?30:6*3600;
const stateFile=path.join(out,"progress.json");
let state=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile)):{schema:1,own,peer,mode,targetSeconds:seconds,started:new Date().toISOString(),observedSeconds:0,cycles:0,mcpRequests:0,nativeChecks:0,faults:0,paidCheckpoints:[],events:[],samples:[],complete:false,failed:false};
assert.equal(state.targetSeconds,seconds);assert.equal(state.own,own);
const sourceHash=hash(fs.readFileSync(new URL(import.meta.url)));
if(state.sourceSha256)assert.equal(state.sourceSha256,sourceHash,"Do not replace an active campaign's harness");
state.sourceSha256=sourceHash;
const save=()=>{state.updated=new Date().toISOString();fs.writeFileSync(stateFile+".tmp",JSON.stringify(state,null,2)+"\n");fs.renameSync(stateFile+".tmp",stateFile)};
const event=(type,extra={})=>{const row={time:new Date().toISOString(),type,...extra};state.events.push(row);fs.appendFileSync(path.join(out,"events.jsonl"),JSON.stringify(row)+"\n");save()};
if(state.complete||state.failed){console.log("Terminal checkpoint preserved; awaiting operator shutdown");setInterval(()=>{},3600000);await new Promise(()=>{})}
let gateway,log,clients=[],id=0,stopping=false;
const fixture=path.join(out,"mcp");
if(!fs.existsSync(fixture)){fs.mkdirSync(fixture);createDatabase(path.join(fixture,"vectors.db")).close()}
const startClients=()=>{clients=["scope-a","scope-b"].map(scope=>startServer(fixture,{TDAI_SESSION_KEY:scope}))};
const stopClients=async()=>{await Promise.all(clients.map(c=>c.close()));clients=[]};
async function startGateway(){log=fs.openSync(path.join(out,"gateway.log"),"a");gateway=spawn("openclaw",["gateway","run","--port","18789"],{stdio:["ignore",log,log],detached:true});fs.closeSync(log);await ready()}
async function stopGateway(signal="SIGTERM"){
 if(!gateway||gateway.exitCode!==null||gateway.signalCode!==null)return;
 const child=gateway,exited=new Promise(r=>child.once("exit",r));
 let timer;try{process.kill(-child.pid,signal)}catch{}
 await Promise.race([exited,new Promise(r=>{timer=setTimeout(()=>{try{process.kill(-child.pid,"SIGKILL")}catch{}r()},55000)})]);clearTimeout(timer);await exited;
}
async function shutdown(){stopping=true;await stopClients();await stopGateway();save()}
process.once("SIGTERM",()=>shutdown().then(()=>process.exit(0)));
const original=hash(fs.readFileSync(path.join(workspace,"PROJECT.md")));
if(state.authoritySha256)assert.equal(state.authoritySha256,original);else state.authoritySha256=original;
try{
 await startGateway();startClients();event("start-or-resume",{previousUpdated:state.updated,sourceSha256:sourceHash});
 let tick=performance.now(),lastFault=state.observedSeconds,lastPaid=Math.floor(state.observedSeconds/86400);
 while(state.observedSeconds<seconds&&!stopping){
  const cycleStart=performance.now();
  assert.equal(gateway.exitCode,null,"Unexpected Gateway exit");assert.equal(gateway.signalCode,null,"Unexpected Gateway signal");
  await ready();await verify();state.nativeChecks+=5;
  for(let n=0;n<clients.length;n++){
    const content="Synthetic endurance stable fixture "+state.cycles%40+" scoped "+n;
    const stored=await toolCall(clients[n],++id,"tdai_experience_store",{content,user_authorized:true,confirmed:true,stable:true,reusable:true});
    assert.ok(!stored.result.isError);
    const found=await toolCall(clients[n],++id,"tdai_memory_search",{query:"endurance stable fixture"});
    assert.ok(found.result.structuredContent.results.length);assert.ok(found.result.structuredContent.results.every(r=>r.session_key==="scope-"+(n?"b":"a")));state.mcpRequests+=2;
  }
  assert.equal(hash(fs.readFileSync(path.join(workspace,"PROJECT.md"))),original,"Authority changed");
  const delta=(performance.now()-tick)/1000;tick=performance.now();
  if(delta<=90)state.observedSeconds+=delta;else event("unobserved-gap",{seconds:delta});
  state.cycles++;
  if(state.observedSeconds-lastFault>=faultEvery){
    const recoveryStart=performance.now(),before=dbRows().l1.map(r=>r.record_id);await stopGateway("SIGKILL");await stopClients();await startGateway();startClients();
    const after=new Set(dbRows().l1.map(r=>r.record_id));assert.ok(before.every(id=>after.has(id)));await verify();state.faults++;lastFault=state.observedSeconds;event("forced-gateway-kill-and-mcp-restart",{retainedL1:before.length,recoverySeconds:(performance.now()-recoveryStart)/1000});
    tick=performance.now(); // Recovery is measured separately, not counted as healthy service time.
  }
  const paidDay=Math.floor(state.observedSeconds/86400);
  if(mode==="--run"&&paidDay>lastPaid&&paidDay<3){
    lastPaid=paidDay;
    if(!state.paidCheckpoints.some(p=>p.day===paidDay)){
      state.paidCheckpoints.push({day:paidDay,started:new Date().toISOString(),complete:false});save(); // No automatic paid retry after interruption.
      const result=await capture("DAY"+paidDay);Object.assign(state.paidCheckpoints.at(-1),{complete:true,...result});event("real-model-checkpoint",{day:paidDay});
    }
  }
  if(state.cycles%20===1){
    const db=new DatabaseSync(path.join(fixture,"vectors.db"));try{assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check,"ok");assert.equal(db.prepare("SELECT count(*) n FROM l1_fts LEFT JOIN l1_records USING(record_id) WHERE l1_records.record_id IS NULL").get().n,0)}finally{db.close()}
    const read=p=>{try{return fs.readFileSync("/sys/fs/cgroup/"+p,"utf8").trim()}catch{return null}};
    const memoryEvents=read("memory.events");assert.equal(Number(memoryEvents?.match(/oom_kill (\d+)/)?.[1]||0),0,"Container OOM kill detected");
    state.samples.push({time:new Date().toISOString(),observedSeconds:state.observedSeconds,memoryCurrent:read("memory.current"),memoryPeak:read("memory.peak"),memoryEvents:read("memory.events")});
  }
  save();await sleep(Math.max(0,10000-(performance.now()-cycleStart)));
 }
 if(!stopping){if(mode==="--run")assert.ok(state.paidCheckpoints.length===2&&state.paidCheckpoints.every(p=>p.complete),"Missing real model checkpoint");state.complete=state.observedSeconds>=seconds;state.passed=state.complete&&!state.failed;state.completed=new Date().toISOString();event("completed");await shutdown()}
}catch(error){state.failed=true;state.passed=false;state.error=error.message;event("failed");await shutdown();console.error(error.message)}
save();
console.log(JSON.stringify({progress:stateFile,complete:state.complete,failed:state.failed,observedSeconds:state.observedSeconds}));
setInterval(()=>{},3600000); // Operator monitor archives results and stops this container.
