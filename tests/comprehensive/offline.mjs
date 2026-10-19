import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { spawn } from "node:child_process";
import { createDatabase, startServer, toolCall } from "../../integrations/codex-tdai-local/test-support.mjs";
import { initKey, prepare, signApproval, sha256 } from "../../integrations/promotion-gate/gate.mjs";

const output=path.resolve(process.argv[2] || "offline-results.json");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"memory-comprehensive-"));
const report={schema:1,started:new Date().toISOString(),node:process.version,platform:process.platform,records:10000,checks:[],retrieval:[],soak:null};
const checks=async(name,run)=>{try{const value=await run();report.checks.push({name,passed:true,...value})}catch(error){report.checks.push({name,passed:false,error:error.message});console.error(name+": "+error.message)}};
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))] || 0;
let sequence=0, soakDir;
function seed(dir){
  fs.mkdirSync(dir);const db=createDatabase(path.join(dir,"vectors.db"));
  const l1=db.prepare("INSERT INTO l1_records(record_id,content,scene_name,priority,session_key,updated_time) VALUES(?,?,?,?,?,?)");
  const f1=db.prepare("INSERT INTO l1_fts(content,record_id) VALUES(?,?)");
  const l0=db.prepare("INSERT INTO l0_conversations(record_id,session_key,role,message_text,timestamp) VALUES(?,?,?,?,?)");
  const f0=db.prepare("INSERT INTO l0_fts(message_text,record_id) VALUES(?,?)");
  db.exec("BEGIN");
  for(let i=0;i<10000;i++){
    const id="record-"+i,scope="scope-"+i%5,content="service"+i+"x uses telemetry port "+(10000+i);
    l1.run(id,content,"network fixture",50+i%50,scope,"2026-10-16");f1.run(content,id);
    l0.run(id,scope,"user",content,i);f0.run(content,id);
  }
  db.exec("COMMIT");db.close();
}
try{
  for(const mode of ["fts5","like"]){
    const dir=path.join(root,mode);seed(dir);if(mode==="fts5")soakDir=dir;
    if(mode==="like"){const db=createReadWrite(dir);db.exec("DROP TABLE l1_fts; DROP TABLE l0_fts");db.close()}
    const clients=Array.from({length:5},(_,i)=>startServer(dir,{TDAI_SESSION_KEY:"scope-"+i,TDAI_ALLOW_STORE:""}));
    const details=[];
    try{
      await checks(mode+" retrieval and isolation",async()=>{
        for(let n=0;n<400;n++){
          const i=(n*137)%10000,phrased=n>=200,query="service"+i+"x"+(phrased?" telemetry port":"");
          const name=n%2?"tdai_memory_search":"tdai_conversation_search";
          const started=performance.now(),response=await toolCall(clients[i%5],++sequence,name,{query,limit:99});
          assert.ok(!response.result.isError,JSON.stringify(response));
          const rows=response.result.structuredContent.results;assert.ok(rows.length<=3);
          for(const row of rows)assert.equal(row.session_key,"scope-"+i%5);
          details.push({index:i,query,tool:name,expected:"record-"+i,returned:rows.map(r=>r.id),correct:rows.some(r=>r.id==="record-"+i),elapsedMs:+(performance.now()-started).toFixed(3)});
        }
        return {requests:details.length,scopeLeaks:0};
      });
      report.retrieval.push({mode,requests:details.length,recallAt3:details.filter(r=>r.correct).length/details.length,
        identifierRecall:details.slice(0,200).filter(r=>r.correct).length/200,
        phraseRecall:details.slice(200).filter(r=>r.correct).length/200,
        latencyMs:{p50:percentile(details.map(r=>r.elapsedMs),.5),p95:percentile(details.map(r=>r.elapsedMs),.95),max:Math.max(...details.map(r=>r.elapsedMs))},details});
    }finally{await Promise.all(clients.map(c=>c.close()))}
  }
  await checks("concurrent SQLite writes and scope-specific deduplication",async()=>{
    const clients=Array.from({length:8},(_,i)=>startServer(soakDir,{TDAI_SESSION_KEY:"writer-"+i%2}));
    let stored=0,duplicates=0;
    const started=performance.now();
    try{await Promise.all(clients.map(async(client,index)=>{
      for(let n=0;n<100;n++){
        const response=await toolCall(client,++sequence,"tdai_experience_store",{content:"Concurrent fixture fact "+n%40+" is confirmed and reusable.",user_authorized:true,confirmed:true,stable:true,reusable:true});
        assert.ok(!response.result.isError,JSON.stringify(response));
        if(response.result.structuredContent.stored)stored++;else if(response.result.structuredContent.duplicate)duplicates++;
      }
    }))}finally{await Promise.all(clients.map(c=>c.close()))}
    assert.equal(stored,80);assert.equal(duplicates,720);
    const db=createReadWrite(soakDir);
    try{
      assert.equal(db.prepare("SELECT count(*) n FROM l1_records WHERE session_key LIKE 'writer-%'").get().n,80);
      assert.equal(db.prepare("SELECT count(*) n FROM l1_fts LEFT JOIN l1_records USING(record_id) WHERE l1_records.record_id IS NULL").get().n,0);
      assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check,"ok");
    }finally{db.close()}
    return {writers:8,attempts:800,stored,duplicates,elapsedMs:+(performance.now()-started).toFixed(2)};
  });
  await checks("database lock failure rolls back and the same process recovers",async()=>{
    const db=createReadWrite(soakDir),client=startServer(soakDir);
    const args={content:"Locked database fixture must eventually recover without partial FTS state.",user_authorized:true,confirmed:true,stable:true,reusable:true};
    try{
      db.exec("BEGIN IMMEDIATE");
      const failure=await toolCall(client,++sequence,"tdai_experience_store",args);
      assert.equal(failure.result.isError,true);assert.match(failure.result.content[0].text,/locked/i);
      db.exec("ROLLBACK");
      const success=await toolCall(client,++sequence,"tdai_experience_store",args);
      assert.equal(success.result.structuredContent.stored,true);
    }finally{try{db.exec("ROLLBACK")}catch{}db.close();await client.close()}
    return {recovered:true};
  });
  await checks("missing/corrupt store errors do not crash MCP and replacement recovers",async()=>{
    const dir=path.join(root,"corrupt");fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,"vectors.db"),"not a SQLite fixture");
    const client=startServer(dir);
    try{
      const failed=await toolCall(client,++sequence,"tdai_memory_search",{query:"fixture"});
      assert.equal(failed.result.isError,true);
      fs.unlinkSync(path.join(dir,"vectors.db"));createDatabase(path.join(dir,"vectors.db")).close();
      const recovered=await toolCall(client,++sequence,"tdai_memory_search",{query:"fixture"});
      assert.deepEqual(recovered.result.structuredContent.results,[]);
    }finally{await client.close()}
    return {recovered:true};
  });
  await checks("concurrent Promotion Gate permits exactly one signed commit",async()=>{
    const dir=path.join(root,"authority");fs.mkdirSync(dir);
    const original="# Lessons\n\n## Purpose\nSynthetic concurrency fixture only.\n";
    fs.writeFileSync(path.join(dir,"LESSONS.md"),original);
    const key=path.join(dir,"key"),policy={root:dir,scope:"fixture-concurrent",files:["LESSONS.md"]};initKey(key);
    const candidate={scope:policy.scope,target:"LESSONS.md",content:"## Verified fixture\nOne authorized append is allowed.",
      base_sha256:sha256(original),stable:true,reusable:true,evidence:{source:"concurrent fixture",summary:"Synthetic test only.",verified_at:new Date().toISOString()},expires_at:new Date(Date.now()+3600000).toISOString()};
    const p=prepare(policy,candidate),receipt=signApproval(p.plan,key,"APPROVE "+p.digest);
    for(const [name,value] of [["policy",policy],["candidate",candidate],["receipt",receipt]])fs.writeFileSync(path.join(dir,name+".json"),JSON.stringify(value));
    const run=()=>new Promise(resolve=>{
      const child=spawn(process.execPath,["integrations/promotion-gate/gate.mjs","apply",path.join(dir,"policy.json"),path.join(dir,"candidate.json"),key,path.join(dir,"receipt.json")],{stdio:["ignore","pipe","pipe"]});
      let out="",err="";child.stdout.on("data",v=>out+=v);child.stderr.on("data",v=>err+=v);child.once("exit",code=>resolve({code,out,err}));
    });
    const results=await Promise.all([run(),run()]);assert.equal(results.filter(r=>r.code===0).length,1);
    assert.equal(fs.readFileSync(path.join(dir,"LESSONS.md"),"utf8").split("<!-- ai-memory-promotion:").length-1,1);
    assert.equal(fs.existsSync(path.join(dir,".ai-memory-promotion.lock")),false);
    return {executors:2,committed:1,rejected:1};
  });
  const seconds=Number(process.env.SOAK_SECONDS || 0);
  if(seconds>0){
    const clients=Array.from({length:5},(_,i)=>startServer(soakDir,{TDAI_SESSION_KEY:"scope-"+i,TDAI_ALLOW_STORE:""}));
    const start=performance.now(),latencies=[],samples=[];let cycles=0,errors=0;
    console.log("Offline soak started for "+seconds+" seconds");
    try{
      while(performance.now()-start<seconds*1000){
        const tick=performance.now();
        for(let i=0;i<clients.length;i++){
          const n=(cycles*137+i)%10000,scope=n%5,at=performance.now();
          try{
            const response=await toolCall(clients[scope],++sequence,"tdai_memory_search",{query:"service"+n+"x"});
            const rows=response.result.structuredContent.results;assert.ok(rows.some(r=>r.id==="record-"+n));assert.ok(rows.every(r=>r.session_key==="scope-"+scope));latencies.push(performance.now()-at);
          }catch(error){errors++;report.checks.push({name:"soak request",passed:false,error:error.message});break}
        }
        cycles++;
        if(cycles%30===0){
          const sample={elapsedSeconds:+((performance.now()-start)/1000).toFixed(1),requests:latencies.length,errors,rssBytes:process.memoryUsage().rss};
          samples.push(sample);console.log(JSON.stringify(sample));
          fs.writeFileSync(output+".progress.json",JSON.stringify({...report,soak:{samples,requests:latencies.length,errors}},null,2));
        }
        if(errors)break;
        await new Promise(r=>setTimeout(r,Math.max(0,1000-(performance.now()-tick))));
      }
    }finally{await Promise.all(clients.map(c=>c.close()))}
    const elapsedSeconds=(performance.now()-start)/1000;
    report.soak={targetSeconds:seconds,elapsedSeconds:+elapsedSeconds.toFixed(2),requests:latencies.length,errors,
      latencyMs:{p50:percentile(latencies,.5),p95:percentile(latencies,.95),max:Math.max(0,...latencies)},samples,
      measurement:"RSS is the test runner only; no claim about aggregate Gateway/plugin memory."};
    report.checks.push({name:"bounded offline soak",passed:errors===0&&elapsedSeconds>=seconds,targetSeconds:seconds});
  }
}finally{
  report.completed=new Date().toISOString();report.passed=report.checks.every(c=>c.passed);
  fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
  fs.rmSync(root,{recursive:true,force:true});
  console.log(JSON.stringify({report:output,passed:report.passed,checks:report.checks.map(({name,passed})=>({name,passed})),retrieval:report.retrieval.map(({mode,recallAt3,identifierRecall,phraseRecall})=>({mode,recallAt3,identifierRecall,phraseRecall})),soak:report.soak&&{requests:report.soak.requests,errors:report.soak.errors,elapsedSeconds:report.soak.elapsedSeconds}}));
  if(!report.passed)process.exitCode=1;
}
function createReadWrite(dir){
  // Use the same built-in SQLite runtime as the production adapter.
  return new DatabaseSync(path.join(dir,"vectors.db"));
}
import { DatabaseSync } from "node:sqlite";
