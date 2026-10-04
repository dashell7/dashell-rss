import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { readSession, inspect, evaluate, VAULT, normalize, ASSETS } from "./dashell-host-session.mjs";

const [descriptor, source] = process.argv.slice(2);
const session = readSession(descriptor);
inspect(session);
const id = "qiaomu-reader-english";
const target = path.join(VAULT, session.configDir, "plugins", id);
if (normalize(fs.realpathSync(target)) !== normalize(target)) throw new Error("Reader directory must not redirect.");
if (JSON.parse(fs.readFileSync(path.join(source, "manifest.json"))).id !== id) throw new Error("Reader candidate ID mismatch.");
const backup = path.join(session.sessionRoot, `reader-backup-${Date.now()}`);
fs.cpSync(target, backup, { recursive: true, errorOnExist: true });
const hash = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
for (const asset of ASSETS) if (hash(path.join(target, asset)) !== hash(path.join(backup, asset))) throw new Error("Reader backup mismatch.");
evaluate(session, `(async()=>{await app.plugins.unloadPlugin('${id}');return true;})()`);
try {
  for (const asset of ASSETS) fs.copyFileSync(path.join(source, asset), path.join(target, asset));
  const result = evaluate(session, `(async()=>{await app.plugins.loadManifests();await app.plugins.loadPlugin('${id}');const p=app.plugins.getPlugin('${id}');if(typeof p?.openLearningMaterial!=='function')throw new Error('Reader integration API not loaded');return {version:p.manifest.version,learningAPI:true};})()`);
  fs.writeFileSync(path.join(session.sessionRoot, "reader-install.json"), JSON.stringify({ backup, target, result }, null, 2));
  console.log(JSON.stringify({ backup, ...result }));
} catch (error) {
  evaluate(session, `(async()=>{await app.plugins.unloadPlugin('${id}');return true;})()`);
  for (const asset of ASSETS) fs.copyFileSync(path.join(backup, asset), path.join(target, asset));
  evaluate(session, `(async()=>{await app.plugins.loadManifests();await app.plugins.loadPlugin('${id}');return true;})()`);
  throw error;
}
