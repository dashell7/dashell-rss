// Update the installed Dashell metadata/builds in the designated vault only.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { readSession, inspect, evaluate, VAULT, normalize } from "./dashell-host-session.mjs";
const session=readSession(process.argv[2]);
inspect(session);
const backup=path.join(session.sessionRoot,`dashell-maintainers-backup-${Date.now()}`);
const readerSource=process.env.DASHELL_READER_SOURCE;
const playerSource=process.env.DASHELL_PLAYER_SOURCE;
if(!readerSource||!playerSource)throw new Error('Set DASHELL_READER_SOURCE and DASHELL_PLAYER_SOURCE to the local plugin source directories.');
const targets=[
  {id:'dashell-rss',source:process.cwd(),assets:['manifest.json','main.js','styles.css']},
  {id:'qiaomu-reader-english',source:readerSource,assets:['manifest.json','main.js','styles.css']},
  {id:'langplayer',source:playerSource,assets:['manifest.json']},
];
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
for(const target of targets){
  target.destination=path.join(VAULT,session.configDir,'plugins',target.id);
  if(normalize(fs.realpathSync(target.destination))!==normalize(target.destination))throw new Error('Redirected plugin directory');
  const manifest=JSON.parse(fs.readFileSync(path.join(target.source,'manifest.json'),'utf8'));
  const installed=JSON.parse(fs.readFileSync(path.join(target.destination,'manifest.json'),'utf8'));
  if(manifest.id!==target.id||manifest.version!==installed.version||manifest.author!=='dashell')throw new Error('Unexpected metadata or version');
}
const baseline=evaluate(session,`(()=>{
  const ids=${JSON.stringify(targets.map(t=>t.id))};
  const plugins=Object.fromEntries(ids.map(id=>{const p=app.plugins.getPlugin(id);if(!p)throw new Error('Plugin not loaded: '+id);return [id,{settings:structuredClone(p.settings),name:p.manifest.name,version:p.manifest.version}];}));
  const reader=app.plugins.getPlugin('qiaomu-reader-english');
  return {plugins,layout:app.workspace.getLayout(),progress:structuredClone(reader.progress),backups:structuredClone(reader.progressBackups),theme:app.customCss.theme};
})()`);
fs.mkdirSync(backup);
fs.writeFileSync(path.join(backup,'baseline.json'),JSON.stringify(baseline));
for(const target of targets){
  const folder=path.join(backup,target.id);fs.mkdirSync(folder);
  for(const asset of target.assets)fs.copyFileSync(path.join(target.destination,asset),path.join(folder,asset));
  const data=path.join(target.destination,'data.json');if(fs.existsSync(data))fs.copyFileSync(data,path.join(folder,'data.json'));
}
const reload=()=>evaluate(session,`(async()=>{
  await app.plugins.loadManifests();
  for(const id of ${JSON.stringify(targets.map(t=>t.id))})await app.plugins.loadPlugin(id);
  return ${JSON.stringify(targets.map(t=>t.id))}.map(id=>{const p=app.plugins.getPlugin(id);if(!p)throw new Error('Plugin failed to load: '+id);return {id,name:p.manifest.name,author:p.manifest.author,authorUrl:p.manifest.authorUrl,version:p.manifest.version};});
})()`);
let changed=false;
try{
  evaluate(session,`(async()=>{for(const id of ${JSON.stringify(targets.map(t=>t.id))})await app.plugins.unloadPlugin(id);return true;})()`);
  changed=true;
  for(const target of targets)for(const asset of target.assets)fs.copyFileSync(path.join(target.source,asset),path.join(target.destination,asset));
  const installed=reload();
  if(installed.some(p=>p.author!=='dashell'||p.authorUrl!=='https://github.com/dashell7'))throw new Error('Installed authors mismatch');
  evaluate(session,`(async()=>{await app.workspace.changeLayout(${JSON.stringify(baseline.layout)});return true;})()`);
  const preserved=evaluate(session,`(()=>{
    const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
    const hash=v=>require('crypto').createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
    const checks=${JSON.stringify(targets.map(t=>({id:t.id,hash:hash(baseline.plugins[t.id].settings)})))};
    for(const check of checks)if(hash(app.plugins.getPlugin(check.id).settings)!==check.hash)throw new Error('Settings changed: '+check.id);
    if(app.customCss.theme!==${JSON.stringify(baseline.theme)})throw new Error('Host theme changed');
    return {settingsPreserved:true,themePreserved:true};
  })()`);
  const result={backup,installed,...preserved,workspaceRestored:true};
  fs.writeFileSync(path.join(session.sessionRoot,'dashell-maintainers-install.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result,null,2));
}catch(error){
  if(changed){
    evaluate(session,`(async()=>{for(const id of ${JSON.stringify(targets.map(t=>t.id))})await app.plugins.unloadPlugin(id);return true;})()`);
    for(const target of targets)for(const asset of target.assets)fs.copyFileSync(path.join(backup,target.id,asset),path.join(target.destination,asset));
    reload();
    evaluate(session,`(async()=>{await app.workspace.changeLayout(${JSON.stringify(baseline.layout)});return true;})()`);
  }
  throw error;
}
