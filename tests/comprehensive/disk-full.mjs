import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createDatabase, startServer, toolCall } from "../../integrations/codex-tdai-local/test-support.mjs";
if(process.env.AI_MEMORY_DOCKER_LAB!=="1")throw Error("Opt-in required");
const root="/probe";
assert.equal(fs.statfsSync(root).type,0x01021994,"Only a dedicated bounded tmpfs may be filled");
const dir=path.join(root,"sqlite");fs.mkdirSync(dir);createDatabase(path.join(dir,"vectors.db")).close();
const fill=path.join(root,"synthetic-fill"),fd=fs.openSync(fill,"wx");
let bytes=0,error=null,client;
const args={content:"Synthetic full disk recovery remains a confirmed reusable test fixture.",user_authorized:true,confirmed:true,stable:true,reusable:true};
try{
 const chunk=Buffer.alloc(1024*1024,1);
 try{for(let n=0;n<80;n++)bytes+=fs.writeSync(fd,chunk)}catch(e){error=e.code}
 assert.equal(error,"ENOSPC");fs.closeSync(fd);
 client=startServer(dir);
 const blocked=await toolCall(client,1,"tdai_experience_store",args);assert.equal(blocked.result.isError,true);
 fs.unlinkSync(fill);
 const recovered=await toolCall(client,2,"tdai_experience_store",args);assert.equal(recovered.result.structuredContent.stored,true);
 const report={passed:true,filesystem:"dedicated tmpfs",fillBytes:bytes,error,writeWhileFull:blocked.result,writeAfterSpaceRecovered:recovered.result};
 console.log(JSON.stringify(report,null,2));
}finally{try{fs.closeSync(fd)}catch{}if(fs.existsSync(fill))fs.unlinkSync(fill);if(client)await client.close()}
