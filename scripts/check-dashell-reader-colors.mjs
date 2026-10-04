// Desktop regression checks in the designated existing vault.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { readSession, evaluate, diagnosticCommand } from "./dashell-host-session.mjs";
const [descriptor,stage] = process.argv.slice(2);
const session = readSession(descriptor);
const run = code => evaluate(session,code);
const baselinePath=path.join(session.sessionRoot,"reader-color-baseline.json");
const reportPath=path.join(session.sessionRoot,"reader-color-report.json");
const hash=value=>createHash("sha256").update(value).digest("hex");
let result;
if(stage==="baseline"){
  if(fs.existsSync(baselinePath))throw new Error("Color baseline already exists");
  const baseline=run(`(async()=>{
    const v=app.workspace.getLeavesOfType('qiaomu-reader-english').find(l=>l.view.file?.basename.includes('Australia'))?.view;
    if(!v?.pager?.flow)throw new Error('Reported article not ready');
    const p=v.plugin,strong=v.pager.flow.querySelector('strong'),paragraph=v.pager.flow.querySelector('p');
    return {path:v.file.path,content:await app.vault.read(v.file),settings:structuredClone(p.settings),
      layout:app.workspace.getLayout(),progress:structuredClone(p.getProgress(v.file.path)),backups:structuredClone(p.getBackups(v.file.path)),
      before:{strong:getComputedStyle(strong).color,normal:getComputedStyle(paragraph).color},
      hostBold:getComputedStyle(document.body).getPropertyValue('--bold-color'),theme:app.customCss.theme};
  })()`);
  fs.writeFileSync(baselinePath,JSON.stringify(baseline));
  result={backedUp:true,before:baseline.before};
}else if(stage==="themes"){
  const baseline=JSON.parse(fs.readFileSync(baselinePath));
  result=run(`(async()=>{
    const p=app.plugins.getPlugin('qiaomu-reader-english'),file=app.vault.getFileByPath(${JSON.stringify(baseline.path)});
    let v=app.workspace.getLeavesOfType('qiaomu-reader-english').find(l=>l.view.file?.path===file.path)?.view;
    if(!v)v=await p.openFile(file);
    if(!v)throw new Error('Reader missing after reload');
    app.workspace.setActiveLeaf(v.leaf,{focus:true});
    await new Promise(resolve=>requestAnimationFrame(resolve));
    if(!v.pager?.flow)await v.openFile(file);
    v.buildSettPanel();const checks=[];
    for(const theme of ['paper','warm','night']){
      const button=v.settPan.querySelector('.qiaomu-reader-theme-'+theme);if(!button)throw new Error('Theme control missing');button.click();
      const until=Date.now()+12000;
      while(Date.now()<until){if(p.settings.theme===theme&&button.classList.contains('active')&&!v.contentEl.classList.contains('qiaomu-reader-relayouting'))break;await new Promise(resolve=>window.setTimeout(resolve,50));}
      const flow=v.pager.flow,paragraph=flow.querySelector('p'),strong=paragraph?.querySelector('strong');
      if(!strong)throw new Error('Reported bold paragraph missing');
      const normal=getComputedStyle(paragraph).color,bold=getComputedStyle(strong).color;
      if(normal!==bold)throw new Error('Bold text differs from '+theme+' text: '+bold);
      const fixture=flow.createSpan();fixture.hidden=true;
      try{for(const tag of ['b','em','i']){const e=fixture.createEl(tag,{text:'QA emphasis'});if(getComputedStyle(e).color!==normal)throw new Error(tag+' retains host color');}}
      finally{fixture.remove();}
      checks.push({theme,bold,normal,fontWeight:getComputedStyle(strong).fontWeight});
    }
    if(getComputedStyle(document.body).getPropertyValue('--bold-color')!==${JSON.stringify(baseline.hostBold)})throw new Error('Host colors changed');
    return {checks,hostThemeUnchanged:true,emphasisFormattingPreserved:true};
  })()`);
}else if(stage==="restore"){
  const b=JSON.parse(fs.readFileSync(baselinePath));
  const settingsHash=hash(JSON.stringify(b.settings));
  result=run(`(async()=>{
    const p=app.plugins.getPlugin('qiaomu-reader-english'),book=${JSON.stringify(b.path)};
    p.settings.theme=${JSON.stringify(b.settings.theme)};await p.saveAll();
    for(const l of app.workspace.getLeavesOfType('qiaomu-reader-english'))l.view.applyVars();
    await app.workspace.changeLayout(${JSON.stringify(b.layout)});
    if(p._fmTimers?.[book]){window.clearTimeout(p._fmTimers[book]);delete p._fmTimers[book];}
    const progress=${JSON.stringify(b.progress)},backups=${JSON.stringify(b.backups)};
    if(progress)p.progress[book]=progress;else delete p.progress[book];
    if(backups.length)p.progressBackups[book]=backups;else delete p.progressBackups[book];
    await p._commitProgressStore();
    const hash=value=>require('crypto').createHash('sha256').update(value).digest('hex');
    if(hash(JSON.stringify(p.settings))!==${JSON.stringify(settingsHash)})throw new Error('Settings not restored');
    if(hash(await app.vault.read(app.vault.getFileByPath(book)))!==${JSON.stringify(hash(b.content))})throw new Error('Saved article changed');
    if(app.customCss.theme!==${JSON.stringify(b.theme)})throw new Error('Host theme changed');
    return {settingsRestored:true,progressRestored:true,articleUnchanged:true,layoutRestored:true};
  })()`);
}else if(stage==="screenshot"){
  result=diagnosticCommand(session,"dev:screenshot",[`path=${path.join(session.sessionRoot,"reader-night-color-fixed.png")}`]);
}else if(stage==="errors"){
  result=diagnosticCommand(session,"dev:errors");
}else throw new Error("Unknown color-check stage");
const report=fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath)):{};
report[stage]=result;fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
console.log(JSON.stringify(result,null,2));
