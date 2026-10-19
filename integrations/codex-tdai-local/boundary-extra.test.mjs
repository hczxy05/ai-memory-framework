import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createDatabase, startServer, toolCall } from "./test-support.mjs";

function fixture(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"memory-extra-"));
  createDatabase(path.join(dir,"vectors.db")).close();
  fs.mkdirSync(path.join(dir,"scene_blocks"));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  return dir;
}
test("COS refuses an allowed filename that hardlinks a non-allowlisted file",async(t)=>{
  const dir=fixture(t), external=path.join(dir,"private.txt");
  fs.writeFileSync(external,"PRIVATE_FIXTURE_MUST_NOT_ESCAPE");
  fs.linkSync(external,path.join(dir,"scene_blocks","alias.md"));
  const client=startServer(dir);
  try{
    const response=await toolCall(client,11,"tdai_read_cos",{path:"scene_blocks/alias.md"});
    assert.equal(response.result.isError,true);
    assert.ok(!JSON.stringify(response).includes("PRIVATE_FIXTURE_MUST_NOT_ESCAPE"));
  }finally{await client.close()}
});
test("oversized MCP input is rejected and the following request still works",async(t)=>{
  const dir=fixture(t), client=startServer(dir);
  try{
    const response=await client.request({jsonrpc:"2.0",id:12,method:"tools/call",params:{name:"tdai_memory_search",arguments:{query:"x".repeat(300*1024)}}});
    assert.equal(response.error?.code,-32600);
    const ping=await client.request({jsonrpc:"2.0",id:13,method:"ping"});
    assert.equal(ping.id,13);assert.deepEqual(ping.result,{});
  }finally{await client.close()}
});
test("test client correlates asynchronous MCP replies by id",async(t)=>{
  const dir=fixture(t);fs.writeFileSync(path.join(dir,"persona.md"),"fixture experience");
  const client=startServer(dir);
  try{
    const [read,ping]=await Promise.all([
      toolCall(client,21,"tdai_read_cos",{path:"persona.md"}),
      client.request({jsonrpc:"2.0",id:22,method:"ping"})
    ]);
    assert.equal(read.id,21);assert.equal(ping.id,22);
    assert.match(read.result.content[0].text,/fixture experience/);
  }finally{await client.close()}
});

test("fallback ranks lexical coverage before its bounded candidate cutoff",async(t)=>{
  const dir=fixture(t),db=new (await import("node:sqlite")).DatabaseSync(path.join(dir,"vectors.db"));
  const put1=db.prepare("INSERT INTO l1_records(record_id,content,session_key,priority,updated_time) VALUES(?,?,?,?,?)");
  const put0=db.prepare("INSERT INTO l0_conversations(record_id,session_key,message_text,timestamp) VALUES(?,?,?,?)");
  put1.run("target","uniqueidentifier uses telemetry port 4321","fixture",1,"2020");
  put0.run("target","fixture","uniqueidentifier uses telemetry port 4321",1);
  for(let n=0;n<200;n++){put1.run("noise"+n,"telemetry port keepalive","fixture",100,"2026");put0.run("noise"+n,"fixture","telemetry port keepalive",100+n)}
  db.exec("DROP TABLE l1_fts; DROP TABLE l0_fts");db.close();
  const client=startServer(dir);
  try{for(const tool of ["tdai_memory_search","tdai_conversation_search"]){
    const response=await toolCall(client,31,tool,{query:"uniqueidentifier telemetry port"});
    assert.ok(response.result.structuredContent.results.some(r=>r.id==="target"));
  }}finally{await client.close()}
});
test("scene candidate cutoff retains the best term coverage when FTS also matches",async(t)=>{
  const dir=fixture(t),db=new (await import("node:sqlite")).DatabaseSync(path.join(dir,"vectors.db"));
  const put=db.prepare("INSERT INTO l1_records(record_id,content,scene_name,session_key,priority) VALUES(?,?,?,?,?)"),fts=db.prepare("INSERT INTO l1_fts(content,record_id) VALUES(?,?)");
  put.run("target","The confirmed fixture decision","uniqueidentifier telemetry port","fixture",1);
  fts.run("The confirmed fixture decision","target");
  for(let n=0;n<200;n++){put.run("noise"+n,"telemetry port keepalive","telemetry port","fixture",100);fts.run("telemetry port keepalive","noise"+n)}
  db.close();const client=startServer(dir);
  try{const response=await toolCall(client,32,"tdai_memory_search",{query:"uniqueidentifier telemetry port"});assert.ok(response.result.structuredContent.results.some(r=>r.id==="target"))}
  finally{await client.close()}
});

test("abrupt writer exit leaves recoverable SQLite and FTS state",async(t)=>{
  const dir=fixture(t),{spawn}=await import("node:child_process"),{DatabaseSync}=await import("node:sqlite");
  const child=spawn(process.execPath,["--disable-warning=ExperimentalWarning",path.join(import.meta.dirname,"server.mjs")],{
    env:{...process.env,TDAI_DATA_DIR:dir,TDAI_SESSION_KEY:"fixture",TDAI_ALLOW_STORE:"true"},stdio:["pipe","pipe","pipe"]});
  t.after(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill("SIGKILL")});
  child.stdin.on("error",()=>{});child.stdout.resume();let stderr="";child.stderr.on("data",b=>stderr+=b);
  for(let n=0;n<100;n++)child.stdin.write(JSON.stringify({jsonrpc:"2.0",id:n,method:"tools/call",params:{name:"tdai_experience_store",arguments:{content:"Crash recovery fixture fact "+n+" is confirmed and reusable.",user_authorized:true,confirmed:true,stable:true,reusable:true}}})+"\n");
  let observed=0;
  const deadline=Date.now()+5000;
  while(!observed&&Date.now()<deadline){
    let db;try{db=new DatabaseSync(path.join(dir,"vectors.db"),{readOnly:true});observed=db.prepare("SELECT count(*) n FROM l1_records").get().n}catch{}finally{db?.close()}
    if(!observed)await new Promise(r=>setTimeout(r,5));
  }
  assert.ok(observed>0,"writer should commit before the crash test");
  const exited=new Promise(r=>child.once("exit",r));child.kill("SIGKILL");await exited;
  assert.equal(stderr.trim(),"");
  // A trusted writer/operator may recover a hot rollback journal; read-only MCP must not silently write.
  const db=new DatabaseSync(path.join(dir,"vectors.db"));
  try{
    assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check,"ok");
    const records=db.prepare("SELECT count(*) n FROM l1_records").get().n,fts=db.prepare("SELECT count(*) n FROM l1_fts").get().n;
    assert.equal(records,fts);assert.ok(records>=observed&&records<=100);
  }finally{db.close()}
  const recovered=startServer(dir);
  try{const response=await toolCall(recovered,99,"tdai_memory_search",{query:"Crash recovery fixture"});assert.ok(!response.result.isError);assert.ok(response.result.structuredContent.results.length)}
  finally{await recovered.close()}
});
