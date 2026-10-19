import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { performance } from "node:perf_hooks";
import { startServer, toolCall } from "../../integrations/codex-tdai-local/test-support.mjs";

if(process.env.AI_MEMORY_DOCKER_LAB!=="1")throw Error("Isolated Docker opt-in required");
const outDir=path.resolve(process.argv[2]||"/lab/reports/comprehensive-openclaw");fs.mkdirSync(outDir,{recursive:true});
const root="/lab/comprehensive/openclaw-"+randomUUID();
const cli="/lab/tools/bin/openclaw";
const plugin="/lab/home/.openclaw/npm/projects/tencentdb-agent-memory-memory-tencentdb-4a22fcb51a/node_modules/@tencentdb-agent-memory/memory-tencentdb";
const report={schema:1,started:new Date().toISOString(),root,checks:[],turns:[],nativeTools:[],sourceCommit:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()};
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),instances=[];
const check=async(name,fn)=>{try{const extra=await fn();report.checks.push({name,passed:true,...extra})}catch(error){report.checks.push({name,passed:false,error:error.message});console.error(name+": "+error.message)}fs.writeFileSync(path.join(outDir,"progress.json"),JSON.stringify(report,null,2)+"\n")};
function make(name,port){
  const dir=path.join(root,name),state=path.join(dir,"state"),workspace=path.join(dir,"workspace"),config=path.join(dir,"openclaw.json");
  fs.mkdirSync(state,{recursive:true});fs.mkdirSync(workspace,{recursive:true});
  const cfg=JSON.parse(fs.readFileSync("integrations/openclaw-tdai-local/openclaw.test.fragment.json","utf8"));
  cfg.gateway.port=port;cfg.gateway.auth={mode:"token",token:randomBytes(32).toString("hex")};
  cfg.agents.defaults.workspace=workspace;cfg.agents.entries["tdai-poc"].workspace=workspace;
  cfg.agents.entries["tdai-poc"].tools.alsoAllow.push("read");
  cfg.tools={fs:{workspaceOnly:true}};
  cfg.plugins.load={paths:[plugin]};
  cfg.plugins.entries["memory-tencentdb"].config.extraction.maxMemoriesPerSession=6;
  cfg.plugins.entries["memory-tencentdb"].config.pipeline.l2DelayAfterL1Seconds=86400;
  cfg.plugins.entries["memory-tencentdb"].config.pipeline.l2MinIntervalSeconds=86400;
  fs.writeFileSync(config,JSON.stringify(cfg,null,2),{mode:0o600});
  fs.writeFileSync(path.join(workspace,"AGENTS.md"),"# Purpose\nSynthetic integration fixture only.\nFor current project questions read PROJECT.md once. Current authoritative Markdown wins over historical TDAI evidence. Capture is not promotion approval. Never write authority or execute commands. For ACK requests, reply only ACK.\n");
  fs.writeFileSync(path.join(workspace,"PROJECT.md"),"# Project\n\n## Purpose\nCurrent verified configuration of this synthetic fixture only.\n\nCurrent telemetry port: 4699.\n");
  for(const name of ["SOUL","IDENTITY","USER","TOOLS","BOOTSTRAP"])fs.writeFileSync(path.join(workspace,name+".md"),"# Purpose\nPreconfigured synthetic test fixture. No onboarding or external actions. Follow AGENTS.md.\n");
  const instance={name,dir,state,workspace,config,cfg,port,env:{...process.env,OPENCLAW_STATE_DIR:state,OPENCLAW_CONFIG_PATH:config},child:null};
  instances.push(instance);return instance;
}
async function start(instance){
  execFileSync(cli,["config","validate"],{env:instance.env,encoding:"utf8",timeout:30000,stdio:["ignore","pipe","pipe"]});
  const log=fs.openSync(path.join(outDir,instance.name+"-gateway.log"),"a");
  instance.child=spawn(cli,["gateway","run","--port",String(instance.port)],{env:instance.env,stdio:["ignore",log,log]});fs.closeSync(log);
  fs.writeFileSync(path.join(outDir,"pids.json"),JSON.stringify(instances.map(i=>({name:i.name,pid:i.child?.pid}))));
  for(let n=0;n<120;n++){
    if(instance.child.exitCode!==null)throw Error("Gateway exited during startup");
    try{const response=await fetch("http://127.0.0.1:"+instance.port+"/healthz",{signal:AbortSignal.timeout(500)});if(response.ok){await sleep(1000);return}}catch{}
    await sleep(500);
  }
  throw Error("Gateway readiness timed out");
}
async function stop(instance){
  if(!instance.child||instance.child.exitCode!==null)return;
  const child=instance.child,done=new Promise(r=>child.once("exit",r));child.kill("SIGTERM");
  await Promise.race([done,sleep(55000).then(()=>{if(child.exitCode===null){child.kill("SIGKILL");report.checks.push({name:instance.name+" graceful drain",passed:false,error:"55 second shutdown deadline"})}})]);
  await done;
}
async function turn(instance,scope,id,message,label){
  const started=performance.now();
  return new Promise((resolve,reject)=>{
    const child=spawn(cli,["agent","--agent","tdai-poc","--session-key",scope,"--session-id",id,"--message",message,"--thinking","off","--timeout","120","--json"],{env:instance.env,stdio:["ignore","pipe","pipe"]});
    let stdout="",stderr="";child.stdout.on("data",v=>stdout+=v);child.stderr.on("data",v=>stderr+=v);
    const timer=setTimeout(()=>child.kill("SIGTERM"),150000);
    child.once("exit",code=>{
      clearTimeout(timer);
      try{
        if(code!==0)throw Error("Agent CLI failed: "+stderr.slice(-700));
        assert.ok(!/falling back to embedded/i.test(stderr),"Gateway failed and CLI fell back to local execution");
        const parsed=JSON.parse(stdout),result=parsed.result||parsed,text=(result.payloads||parsed.payloads||[]).map(p=>p.text||"").join("\n");
        const row={label,instance:instance.name,scope,id,message,elapsedMs:+(performance.now()-started).toFixed(2),text,response:parsed,stderr};
        report.turns.push(row);fs.appendFileSync(path.join(outDir,"turns.jsonl"),JSON.stringify(row)+"\n");
        console.log(JSON.stringify({turn:label,instance:instance.name,elapsedMs:row.elapsedMs}));
        resolve(row);
      }catch(error){reject(error)}
    });
  });
}
function rows(instance,scope){
  const file=path.join(instance.state,"memory-tdai","vectors.db");if(!fs.existsSync(file))return{l0:[],l1:[]};
  const db=new DatabaseSync(file,{readOnly:true});
  try{return{l0:db.prepare("SELECT record_id,session_key,role,message_text FROM l0_conversations WHERE session_key=?").all(scope),
    l1:db.prepare("SELECT record_id,session_key,content FROM l1_records WHERE session_key=?").all(scope)}}finally{db.close()}
}
async function waitFact(instance,scope,fragments,seconds=75){
  let current;
  for(let n=0;n<seconds*2;n++){
    try{current=rows(instance,scope);if(current.l1.some(r=>fragments.every(f=>r.content.includes(f))))return current}catch{}
    await sleep(500);
  }
  fs.writeFileSync(path.join(outDir,"extraction-failure-"+instance.name+".json"),JSON.stringify({scope,fragments,rows:current},null,2));
  throw Error("L1 did not persist expected fragments "+JSON.stringify(fragments));
}
async function native(instance,scope,tool,args,label){
  const response=await fetch("http://127.0.0.1:"+instance.port+"/tools/invoke",{method:"POST",headers:{authorization:"Bearer "+instance.cfg.gateway.auth.token,"content-type":"application/json"},body:JSON.stringify({tool,sessionKey:scope,args}),signal:AbortSignal.timeout(20000)});
  const result=await response.json();const row={label,instance:instance.name,scope,tool,args,status:response.status,result};report.nativeTools.push(row);return row;
}
const a=make("store-a",18791),b=make("store-b",18792),tag=randomUUID().replaceAll("-","").slice(0,10);
const mainScope="agent:tdai-poc:long-"+tag,mainId=randomUUID(),marker="ORION"+tag;
const peerScope="agent:tdai-poc:peer-"+tag;
let persisted;
try{
  const budget=await(await fetch("http://ai-memory-p2-budget:8080/health")).json();report.budgetBefore=budget;assert.ok(budget.calls<300&&budget.reservedRmb<75,"Insufficient budget for actual Gateway tests");
  await check("two independent Gateway configs validate and become healthy",async()=>{await start(a);await start(b);return{ports:[18791,18792],hostPortsPublished:false}});
  if(!a.child||!b.child)throw Error("Gateway startup failed");
  await check("English capture reaches real L0 and L1",async()=>{
    const result=await turn(a,mainScope,mainId,"Synthetic confirmed stable reusable fixture: project "+marker+" uses telemetry port 4601. Reply ACK only.","capture-english");assert.match(result.text,/ACK/);
    persisted=await waitFact(a,mainScope,[marker,"4601"]);assert.ok(persisted.l0.length>=2);return{l0:persisted.l0.length,l1:persisted.l1.length};
  });
  await check("Chinese capture reaches real L1",async()=>{
    const scope="agent:tdai-poc:chinese-"+tag;
    await turn(a,scope,randomUUID(),"仅为合成测试：项目 "+marker+"ZH 的传感器采样周期确认为 250 毫秒。这是稳定可复用的工程决定。只回复 ACK。","capture-chinese");
    const saved=await waitFact(a,scope,["250"]);return{l0:saved.l0.length,l1:saved.l1.length};
  });
  await check("long session survives repeated turns and explicit correction",async()=>{
    for(let n=0;n<6;n++){
      const padding=n<2?Array.from({length:450},(_,i)=>"Neutral fixture log "+n+" line "+i+". This line changes no project setting.").join("\n"):"";
      await turn(a,mainScope,mainId,(n===5?"Correction within historical fixture "+marker+": telemetry port is now 4602, superseding the earlier 4601 value. This does not edit authoritative PROJECT.md. Reply ACK.":"Synthetic continuation "+n+". Reply ACK only.")+"\n"+padding,"long-turn-"+n);
    }
    const saved=await waitFact(a,mainScope,["4602"]);return{turns:7,l0:saved.l0.length,l1:saved.l1.length,transcriptInputChars:report.turns.filter(t=>t.scope===mainScope).reduce((n,t)=>n+t.message.length,0)};
  });
  await check("actual Agent reads authoritative Markdown instead of historical ports",async()=>{
    const result=await turn(a,mainScope,mainId,"What is the CURRENT authoritative telemetry port in PROJECT.md? Read the file; answer with only its port number. Historical conversation values are not current project truth.","authority-over-history");
    assert.match(result.text,/\b4699\b/);assert.ok(!/\b460[12]\b/.test(result.text));
    return{answer:result.text};
  });
  await check("independent concurrent sessions persist without scope mixing",async()=>{
    const tasks=[0,1,2].map(n=>({scope:"agent:tdai-poc:parallel-"+n+"-"+tag,id:randomUUID(),marker:"PARALLEL"+n+tag,port:6200+n}));
    await Promise.all(tasks.map(t=>turn(a,t.scope,t.id,"Synthetic stable reusable project "+t.marker+" uses port "+t.port+". Reply ACK only.","parallel-"+t.port)));
    for(const t of tasks){const saved=await waitFact(a,t.scope,[t.marker,String(t.port)]);assert.ok(saved.l1.every(r=>r.session_key===t.scope))}
    return{sessions:3};
  });
  await check("framework MCP recalls persisted L1 and rejects another scope",async()=>{
    const dir=path.join(a.state,"memory-tdai");
    const current=startServer(dir,{TDAI_SESSION_KEY:mainScope,TDAI_ALLOW_STORE:""}),other=startServer(dir,{TDAI_SESSION_KEY:peerScope,TDAI_ALLOW_STORE:""});
    try{
      const yes=await toolCall(current,1,"tdai_memory_search",{query:marker});assert.ok(yes.result.structuredContent.results.length);
      const no=await toolCall(other,2,"tdai_memory_search",{query:marker});assert.deepEqual(no.result.structuredContent.results,[]);
    }finally{await current.close();await other.close()}
    return{crossScopeLeakage:0};
  });
  await check("measure native tool shared-store behavior separately",async()=>{
    const result=await native(a,peerScope,"tdai_memory_search",{query:marker,limit:3},"shared-store-other-session");
    assert.equal(result.status,200);
    return{crossSessionContentVisible:JSON.stringify(result.result).includes(marker),note:"Native plugin search lacks the framework MCP's host-owned scope filter; shared stores are not a security boundary."};
  });
  await check("native tool cannot see another Gateway's independent data directory",async()=>{
    await turn(b,"agent:tdai-poc:storeb-"+tag,randomUUID(),"Synthetic stable reusable fixture: project BOREAL"+tag+" uses port 7300. Reply ACK only.","independent-store-b");
    await waitFact(b,"agent:tdai-poc:storeb-"+tag,["BOREAL"+tag,"7300"]);
    const result=await native(b,"agent:tdai-poc:storeb-"+tag,"tdai_memory_search",{query:marker,limit:3},"separate-store-negative-control");
    assert.equal(result.status,200);assert.ok(!JSON.stringify(result.result).includes(marker));return{crossStoreContentVisible:false};
  });
  await check("Gateway restart preserves extracted records and session continuity",async()=>{
    const before=rows(a,mainScope);assert.ok(before.l1.length);
    await stop(a);await start(a);
    const after=rows(a,mainScope);assert.ok(before.l1.every(r=>after.l1.some(v=>v.record_id===r.record_id)));
    const result=await turn(a,mainScope,mainId,"After this Gateway restart, read PROJECT.md and answer only the CURRENT authoritative telemetry port.","restart-authority");assert.match(result.text,/\b4699\b/);
    return{retainedL1:before.l1.length,answer:result.text};
  });
  await check("bounded real Gateway soak continues across idle and repeated turns",async()=>{
    const started=performance.now();
    for(let n=0;n<3;n++){
      await sleep(20000);
      const result=await turn(a,"agent:tdai-poc:soak-"+tag,randomUUID(),"Synthetic stable reusable project SOAK"+tag+" uses telemetry port 7444. Reply ACK only.","gateway-soak-"+n);
      assert.match(result.text,/ACK/);
    }
    return{elapsedSeconds:+((performance.now()-started)/1000).toFixed(2),turns:3};
  });
}finally{
  // Drain the Gateway while the proxy still runs so shutdown extraction is budgeted.
  for(const instance of instances){try{await stop(instance)}catch(error){report.checks.push({name:instance.name+" shutdown",passed:false,error:error.message})}}
  report.completed=new Date().toISOString();report.passed=report.checks.every(c=>c.passed);
  report.budgetAfter=await(await fetch("http://ai-memory-p2-budget:8080/health")).json();
  report.limitations=["Native shared-store searches are measured separately and do not inherit framework MCP filters.","This is a bounded synthetic single-host test, not multi-day production endurance.","Automated model decisions and extraction are evidence, not authorization to modify authoritative files."];
  fs.writeFileSync(path.join(outDir,"results.json"),JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({report:path.join(outDir,"results.json"),passed:report.passed,checks:report.checks,turns:report.turns.length,budget:report.budgetAfter}));
  if(!report.passed)process.exitCode=1;
}
