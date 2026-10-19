import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { score } from "./holdout.mjs";
test("free-response scoring rejects guessed facts, invented evidence and duplicate citations",()=>{
 const expected={answer:"r19",status:"confirmed",evidence:["doc"]};
 assert.equal(score(expected,{...expected},["doc"]).passed,true);
 assert.equal(score(expected,{...expected,answer:"r12"},["doc"]).passed,false);
 assert.equal(score(expected,{...expected,evidence:["invented"]},["doc"]).grounded,false);
 assert.equal(score(expected,{...expected,evidence:["doc","doc"]},["doc"]).passed,false);
 assert.equal(score(expected,null,["doc"]).passed,false);
 assert.equal(score({answer:null,status:"uncertain",evidence:[]},{answer:null,status:"uncertain",evidence:[]},[]).passed,true);
});
test("holdout corpus has distinct questions and only valid expected source ids",()=>{
 const cases=JSON.parse(fs.readFileSync(new URL("./holdout-cases.json",import.meta.url))).cases;
 assert.equal(cases.length,24);assert.equal(new Set(cases.map(c=>c.question)).size,24);
 for(const c of cases){const ids=[...c.docs.map(d=>d.id),...c.memories.filter(m=>m[1]===c.scope).map(m=>m[0]),...(c.instruction?["current-instruction"]:[])];assert.ok(c.expected.evidence.every(id=>ids.includes(id)))}
});
