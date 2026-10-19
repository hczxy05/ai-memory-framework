import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

// One Compose project is one trust boundary, including L0-L3 and session state.
export function projectBundle(base, project) {
  if (typeof project !== "string" || !/^[a-z][a-z0-9-]{0,39}$/.test(project)) throw Error("Use a lowercase project id, at most 40 characters");
  const config = structuredClone(base);
  config.gateway = { ...config.gateway, mode: "local", bind: "lan", port: 18789, auth: { mode: "token", token: randomBytes(32).toString("hex") } };
  config.agents ??= {};
  config.agents.defaults = { ...config.agents.defaults, workspace: "/home/node/workspace", heartbeat: { every: "0m" } };
  for (const agent of Object.values(config.agents.entries ?? {})) agent.workspace = "/home/node/workspace";
  config.tools = { ...config.tools, fs: { ...config.tools?.fs, workspaceOnly: true } };
  config.plugins ??= {};
  config.plugins.load = { paths: ["/opt/runtime/node_modules/@tencentdb-agent-memory/memory-tencentdb"] };
  const memory = config.plugins.entries?.["memory-tencentdb"]?.config;
  if (!memory || memory.mode !== "local" || memory.storeBackend !== "sqlite") throw Error("Local SQLite memory config is required");
  memory.recall = { ...memory.recall, enabled: false };
  const compose = {
    name: "ai-memory-" + project,
    services: {
      bootstrap: {image:"ai-memory-openclaw:2026.10.4-tdai1.0.3",user:"1000:1000",read_only:true,network_mode:"none",cap_drop:["ALL"],security_opt:["no-new-privileges:true"],volumes:["config:/home/node/config"],environment:{CONFIG_BASE64:Buffer.from(JSON.stringify(config)).toString("base64")},command:["node","-e","const fs=require('node:fs');const file='/home/node/config/openclaw.json',value=Buffer.from(process.env.CONFIG_BASE64,'base64');if(fs.existsSync(file)){if(!fs.readFileSync(file).equals(value))throw Error('Existing project config differs; review changes before replacing')}else fs.writeFileSync(file,value,{mode:384})"]},
      gateway: {
      build: ".", image: "ai-memory-openclaw:2026.10.4-tdai1.0.3",
      user: "1000:1000", read_only: true, init: true, restart: "unless-stopped",
      cap_drop: ["ALL"], security_opt: ["no-new-privileges:true"],
      cpus: 1, mem_limit: "2g", pids_limit: 128,
      tmpfs: ["/tmp:size=256m,mode=1777", "/home/node/.cache:size=128m,mode=700,uid=1000,gid=1000"],
      volumes: ["state:/home/node/.openclaw", "workspace:/home/node/workspace", "config:/home/node/config:ro"],
      depends_on: {bootstrap:{condition:"service_completed_successfully"}},
      environment:{OPENCLAW_CONFIG_PATH:"/home/node/config/openclaw.json"},
      healthcheck: { test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:18789/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"], interval: "30s", timeout: "5s", start_period: "90s", retries: 3 },
      stop_grace_period: "60s"
    }},
    volumes: { state: {}, workspace: {}, config: {} }, networks: { default: { internal: true } }
  };
  return { config, compose };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [baseFile, project, output] = process.argv.slice(2);
  if (!baseFile || !output) throw Error("Usage: node project-config.mjs BASE_JSON PROJECT_ID NEW_PRIVATE_DIRECTORY");
  const bundle = projectBundle(JSON.parse(fs.readFileSync(baseFile, "utf8")), project);
  fs.mkdirSync(output, { mode: 0o700 }); // Never overwrite an existing configuration or its token.
  for (const [name, value] of [["openclaw.json", bundle.config], ["compose.json", bundle.compose]]) fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  fs.copyFileSync(new URL("./Dockerfile", import.meta.url), path.join(output, "Dockerfile"));
  console.log("Private project bundle created: " + path.resolve(output));
}
