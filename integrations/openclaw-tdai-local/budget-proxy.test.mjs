import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createBudgetProxy } from "./budget-proxy.mjs";
test("proxy keeps upstream, model, output and total calls bounded without exposing the key", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),"budget-test-"));
  let seen = 0;
  const server = createBudgetProxy({ ledgerFile: path.join(dir,"ledger.json"), readKey: () => "fake-test-key",
    forward: async (payload,key) => {
      assert.equal(key,"fake-test-key"); assert.equal(payload.model,"deepseek-flash");
      assert.equal(payload.max_tokens,2048); assert.equal(payload.stream,false);
      assert.deepEqual(payload.thinking,{type:"disabled"}); seen++;
      return {id:"fixture",model:payload.model,choices:[{message:{role:"assistant",content:"ok"},finish_reason:"stop"}],usage:{total_tokens:2}};
    }});
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true})});
  const url="http://127.0.0.1:"+server.address().port;
  const send=(data)=>fetch(url+"/v1/chat/completions",{method:"POST",body:JSON.stringify(data)});
  assert.equal((await send({model:"other",messages:[{}]})).status,400);
  for(let i=0;i<12;i++){
    const response=await send({model:"deepseek-flash",messages:[{role:"user",content:"hello"}],max_tokens:999999,stream:i===0});
    assert.equal(response.status,200);
    const text=await response.text();assert.ok(!text.includes("fake-test-key"));
    if(i===0) assert.match(text,/data: \[DONE\]/);
  }
  assert.equal((await send({model:"deepseek-flash",messages:[{}]})).status,429);
  assert.equal(seen,12);
  const health=await(await fetch(url+"/health")).json();
  assert.equal(health.calls,12);assert.ok(health.reservedRmb<4);
});

test("budget state survives restart, rejects concurrent owners, and fails closed", async(t)=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"budget-state-"));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,"ledger.json");
  fs.writeFileSync(file,JSON.stringify({calls:4,reservedRmb:3.99,expiresAt:Date.now()+60000,usage:[]}));
  let forwarded=0;
  const options={ledgerFile:file,readKey:()=> "fake",forward:async()=>{forwarded++;throw Error("fake credential must be hidden")}};
  const server=createBudgetProxy(options);
  assert.throws(()=>createBudgetProxy(options),/EEXIST/);
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  const url="http://127.0.0.1:"+server.address().port;
  const response=await fetch(url+"/v1/chat/completions",{method:"POST",body:JSON.stringify({model:"deepseek-flash",messages:[{role:"user",content:"测试"}]})});
  assert.equal(response.status,429);assert.equal(forwarded,0);
  assert.equal((await(await fetch(url+"/health")).json()).calls,4);
  await new Promise(r=>server.close(r));
  fs.writeFileSync(file,"invalid");
  assert.throws(()=>createBudgetProxy(options));
});

test("expanded budget policy cannot exceed the hard ceiling or accept negative state", async(t)=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"budget-policy-"));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,"ledger.json"), base={ledgerFile:file,readKey:()=> "fake",forward:async()=>({choices:[{message:{content:"ok"}}],usage:{prompt_tokens:1,completion_tokens:1}})};
  for(const limits of [{maxCalls:350,maxReservedRmb:100},{maxCalls:0,maxReservedRmb:90},{maxCalls:1001,maxReservedRmb:90}])assert.throws(()=>createBudgetProxy({...base,limits}),/policy/);
  fs.writeFileSync(file,JSON.stringify({calls:-1,reservedRmb:0,expiresAt:Date.now()+60000,usage:[]}));
  assert.throws(()=>createBudgetProxy(base),/ledger/);
  fs.writeFileSync(file,JSON.stringify({calls:12,reservedRmb:4,expiresAt:Date.now()+60000,usage:[]}));
  const server=createBudgetProxy({...base,limits:{maxCalls:350,maxReservedRmb:90}});
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  try{
    const response=await fetch("http://127.0.0.1:"+server.address().port+"/v1/chat/completions",{method:"POST",body:JSON.stringify({model:"deepseek-flash",messages:[{role:"user",content:"fixture"}]})});
    assert.equal(response.status,200);assert.equal(JSON.parse(fs.readFileSync(file)).calls,13);
  }finally{await new Promise(r=>server.close(r))}
});

test("reservation cannot be bypassed by remote media or hosted paid tools",async(t)=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"budget-media-"));let calls=0;
  const server=createBudgetProxy({ledgerFile:path.join(dir,"ledger.json"),readKey:()=> "fake",forward:async()=>{calls++;return{choices:[{message:{content:"ok"}}],usage:{prompt_tokens:1,completion_tokens:1}}}});
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  t.after(async()=>{await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true})});
  const send=body=>fetch("http://127.0.0.1:"+server.address().port+"/v1/chat/completions",{method:"POST",body:JSON.stringify({model:"deepseek-flash",...body})});
  for(const type of ["image_url","input_audio","file"]){
    const response=await send({messages:[{role:"user",content:[{type,image_url:{url:"https://example.invalid/huge-image"},file:{file_id:"fixture"},input_audio:{data:"fixture"}}]}]});
    assert.equal(response.status,400);
  }
  assert.equal((await send({messages:[{role:"user",content:"fixture"}],tools:[{type:"web_search"}]})).status,400);
  assert.equal(calls,0);
  assert.equal((await send({messages:[{role:"user",content:[{type:"text",text:"fixture"}]}],tools:[{type:"function",function:{name:"fixture_tool",parameters:{type:"object",properties:{}}}}]})).status,200);
  assert.equal(calls,1);
});
