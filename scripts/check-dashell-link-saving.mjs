// One-article repair and designated-vault verification; never bundled into the plugin.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { marked } from "marked";
import { JSDOM } from "jsdom";
import { readSession, evaluate, diagnosticCommand } from "./dashell-host-session.mjs";

const [descriptor, stage] = process.argv.slice(2);
const session = readSession(descriptor);
const run = code => evaluate(session, code);
const backupDir = path.join(session.sessionRoot, "article-link-backup");
const reportPath = path.join(session.sessionRoot, "article-link-report.json");
const materialId = "54238631b06f1852e4b295b15e36385d5684cac1eb871e95a84105bee81c46d8";
const hash = value => createHash("sha256").update(value).digest("hex");
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
  ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])) : value;
const stateHash = value => hash(JSON.stringify(canonical(value)));
const baselinePath = path.join(backupDir, "baseline.json");
let result;

if (stage === "backup") {
  if (fs.existsSync(backupDir)) throw new Error("Article backup already exists");
  const baseline = run(`(async()=>{
    const rss=app.plugins.getPlugin('dashell-rss'),reader=app.plugins.getPlugin('qiaomu-reader-english');
    const material=rss.dashellLearning.store.state.materials.find(m=>m.id===${JSON.stringify(materialId)});
    const file=material&&app.vault.getFileByPath(material.localPath);
    if(!file)throw new Error('Reported article missing');
    const view=app.workspace.getLeavesOfType('qiaomu-reader-english').find(l=>l.view.file?.path===file.path)?.view;
    return {path:file.path,content:await app.vault.read(file),layout:app.workspace.getLayout(),
      learning:structuredClone(rss.dashellLearning.store.state),readerSettings:structuredClone(reader.settings),
      progress:structuredClone(reader.getProgress(file.path)),theme:app.customCss.theme,
      feeds:rss.settings.feeds.map(f=>f.url),beforeAnchors:view?.pager?.flow?.querySelectorAll('a').length,
      notes:await Promise.all(app.vault.getFiles().filter(f=>f.basename===file.basename&&f.path!==file.path).map(async f=>({path:f.path,content:await app.vault.read(f)})))};
  })()`);
  fs.mkdirSync(backupDir);
  fs.writeFileSync(baselinePath, JSON.stringify(baseline));
  fs.writeFileSync(path.join(backupDir, "article-original.md"), baseline.content);
  result = {backedUp:true,bodyAnchors:baseline.beforeAnchors};
} else if (stage === "repair") {
  const baseline = JSON.parse(fs.readFileSync(baselinePath));
  const header = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(baseline.content)?.[0];
  if (!header) throw new Error("Expected article frontmatter");
  const body = baseline.content.slice(header.length);
  const edits = [];
  const collect = (tokens, source, base) => {
    let cursor = 0;
    for (const token of tokens) {
      const at = source.indexOf(token.raw, cursor);
      if (at < 0) throw new Error("Markdown token could not be located");
      cursor = at + token.raw.length;
      if (token.type === "link") {
        if (!token.raw.startsWith("[") || !token.tokens) throw new Error("Unexpected link syntax");
        edits.push({start:base+at,end:base+cursor,text:token.tokens.map(t=>t.raw).join("")});
      } else if (token.tokens) collect(token.tokens, token.raw, base+at);
      else if (token.items || token.type === "table") throw new Error("Repair only supports this article's simple blocks");
    }
  };
  collect(marked.lexer(body), body, header.length);
  if (edits.length !== 9) throw new Error("Reported article no longer matches the nine-link baseline");
  const sorted = edits.toSorted((a,b)=>b.start-a.start);
  let candidate = baseline.content;
  for (const edit of sorted) candidate=candidate.slice(0,edit.start)+edit.text+candidate.slice(edit.end);
  const beforeDom = new JSDOM(marked.parse(body));
  const afterDom = new JSDOM(marked.parse(candidate.slice(header.length)));
  try {
    const before = beforeDom.window.document.body,after=afterDom.window.document.body;
    for(const anchor of before.querySelectorAll("a"))anchor.replaceWith(...anchor.childNodes);
    if(after.querySelector("a")||before.innerHTML!==after.innerHTML)throw new Error("Article text or formatting would change");
  } finally { beforeDom.window.close();afterDom.window.close(); }
  fs.writeFileSync(path.join(backupDir,"article-repaired.md"),candidate);
  result=run(`(async()=>{
    const file=app.vault.getFileByPath(${JSON.stringify(baseline.path)});if(!file)throw new Error('Article missing');
    await app.vault.process(file,content=>{
      if(require('crypto').createHash('sha256').update(content).digest('hex')!==${JSON.stringify(hash(baseline.content))})throw new Error('Article changed since backup');
      const edits=${JSON.stringify(sorted)};let next=content;
      for(const edit of edits)next=next.slice(0,edit.start)+edit.text+next.slice(edit.end);return next;
    });
    const current=await app.vault.read(file);
    if(require('crypto').createHash('sha256').update(current).digest('hex')!==${JSON.stringify(hash(candidate))})throw new Error('Repair readback differs');
    const view=app.workspace.getLeavesOfType('qiaomu-reader-english').find(l=>l.view.file?.path===file.path)?.view;
    if(view)await view.openFile(file);
    return {removedLinks:9,frontmatterPreserved:true,textFormattingPreserved:true,atomicReadback:true};
  })()`);
} else if (stage === "new-save") {
  result=run(`(async()=>{
    const live=app.plugins.getPlugin('dashell-rss').dashellLearning;
    const folder='Dashell/__QA_article-links-20261004';
    if(app.vault.getAbstractFileByPath(folder))throw new Error('QA folder already exists');
    const item={id:'QA_article-links-20261004',title:'QA article links',link:'https://example.com/article',
      content:'<p>Read <a href="/ref"><strong>linked words</strong></a>.</p><p><a href="/image"><img src="/photo.jpg" alt="QA photo"></a></p>',
      translation:'<p>Read <a href="/ref">translated words</a>.</p>',rewrite:'Read [simpler words](https://example.com/ref).',
      published:'',language:'en',level:'B1',kind:'article',assets:[],sessions:[],download:'idle'};
    const state={materials:[item],preferences:{...live.store.state.preferences,folder}};
    const store={state,changeMaterial:async(id,change)=>{if(id!==item.id)throw new Error('Wrong QA target');change(item);}};
    const importer=new live.importer.constructor(app,store,{},()=>activeDocument);
    try{
      await importer.enqueue(item.id);if(item.download!=='ready')throw new Error(item.error||'Save failed');
      const bodies=await Promise.all(item.localFiles.map(async p=>({path:p,text:await app.vault.read(app.vault.getFileByPath(p))})));
      const original=bodies.find(b=>b.path.endsWith('/QA article links.md'));
      if(bodies.length!==3||!original.text.includes('**linked words**')||!original.text.includes('![QA photo](https://example.com/photo.jpg)'))throw new Error('Saved formatting/image missing');
      for(const body of bodies)if(!body.text.includes('source: "https://example.com/article"')||body.text.includes('](https://example.com/ref)')||body.text.includes('](https://example.com/image)'))throw new Error('Saved links/source mismatch');
      // Actual original RSS preview still renders its source link.
      const preview=live.store.state.materials.find(m=>m.id===${JSON.stringify(materialId)});
      if(!preview?.content?.includes('<a'))throw new Error('Original fetched content links missing');
      return {versionsSaved:3,formattingAndImagePreserved:true,sourceRetained:true,fetchedContentLinksRetained:true};
    }finally{
      importer.dispose();
      const qa=app.vault.getAbstractFileByPath(folder);if(qa)await app.vault.delete(qa,true);
    }
  })()`);
} else if (stage === "hover") {
  const baseline=JSON.parse(fs.readFileSync(baselinePath));
  result=run(`(async()=>{
    const view=app.workspace.getLeavesOfType('qiaomu-reader-english').find(l=>l.view.file?.path===${JSON.stringify(baseline.path)})?.view;
    if(!view?.lookupController)throw new Error('Reader not ready');
    app.workspace.setActiveLeaf(view.leaf,{focus:true});
    await new Promise(resolve=>requestAnimationFrame(resolve));
    if(!view.pager?.flow)await view.openFile(view.file);
    const readyUntil=Date.now()+10000;
    while(!view.pager?.flow&&Date.now()<readyUntil)await new Promise(resolve=>window.setTimeout(resolve,100));
    if(!view.pager?.flow)throw new Error('Reader pagination not ready');
    const flow=view.pager.flow,doc=flow.ownerDocument,controller=view.lookupController;
    if(!controller.settings().englishLookupEnabled)throw new Error('Hover lookup disabled');
    if(flow.querySelector('a'))throw new Error('Body hyperlinks remain');
    const walker=doc.createTreeWalker(flow,4);let node;
    while(node=walker.nextNode())if(node.textContent.includes('evangelical'))break;
    if(!node)throw new Error('Formerly linked word missing');
    const range=doc.createRange(),start=node.textContent.indexOf('evangelical');
    range.setStart(node,start);range.setEnd(node,start+'evangelical'.length);
    range.startContainer.parentElement.scrollIntoView({block:'center',inline:'center'});
    await new Promise(resolve=>requestAnimationFrame(resolve));
    const rect=range.getBoundingClientRect();if(!rect.width||!rect.height)throw new Error('Word not measurable');
    const selection=doc.getSelection();selection?.removeAllRanges();
    const previous=controller.onHoverLookup;let hit;
    controller.hide();controller.onHoverLookup=(word,context)=>{hit={word,sentence:context.sentence};return previous(word,context);};
    try{
      node.parentElement.dispatchEvent(new doc.defaultView.MouseEvent('mousemove',{bubbles:true,clientX:rect.x+rect.width/2,clientY:rect.y+rect.height/2,buttons:0}));
      const until=Date.now()+10000;
      while(Date.now()<until){const popup=doc.querySelector('.langr-subtitle-popup');if(hit&&popup&&popup.getBoundingClientRect().height>0)break;await new Promise(resolve=>window.setTimeout(resolve,100));}
      const popup=doc.querySelector('.langr-subtitle-popup');
      if(hit?.word!=='evangelical'||!popup||popup.getBoundingClientRect().height===0)throw new Error('Hover dictionary did not display');
      return {bodyAnchors:0,formerlyLinkedWord:hit.word,hoverCallback:true,popupVisible:true,sentenceRetained:hit.sentence.includes('evangelical')};
    }finally{controller.onHoverLookup=previous;controller.hide();}
  })()`);
} else if (stage === "restore-progress") {
  const baseline=JSON.parse(fs.readFileSync(baselinePath));
  const began=fs.statSync(baselinePath).mtimeMs;
  result=run(`(async()=>{
    const reader=app.plugins.getPlugin('qiaomu-reader-english'),book=${JSON.stringify(baseline.path)};
    const current=reader.getProgress(book),original=${JSON.stringify(baseline.progress)};
    if(current&&(current.lastRead<${began}||current.pct!==0))throw new Error('Progress no longer matches this QA run');
    if(reader._fmTimers?.[book]){window.clearTimeout(reader._fmTimers[book]);delete reader._fmTimers[book];}
    if(original)reader.progress[book]=original;else delete reader.progress[book];
    const previous=(reader.progressBackups[book]||[]).filter(b=>b.ts<${began});
    if(previous.length)reader.progressBackups[book]=previous;else delete reader.progressBackups[book];
    await reader._commitProgressStore();
    return {testGeneratedProgressRemoved:true,originalPositionRetained:true};
  })()`);
} else if (stage === "preservation") {
  const baseline=JSON.parse(fs.readFileSync(baselinePath));
  result=run(`(async()=>{
    const rss=app.plugins.getPlugin('dashell-rss'),reader=app.plugins.getPlugin('qiaomu-reader-english');
    const material=rss.dashellLearning.store.state.materials.find(m=>m.id===${JSON.stringify(materialId)});
    const notes=${JSON.stringify(baseline.notes.map(n=>({path:n.path,hash:hash(n.content)})))};
    for(const note of notes)if(require('crypto').createHash('sha256').update(await app.vault.read(app.vault.getFileByPath(note.path))).digest('hex')!==note.hash)throw new Error('Reading note changed');
    const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
    const hash=value=>require('crypto').createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
    if(material.localPath!==${JSON.stringify(baseline.path)}||hash(rss.dashellLearning.store.state)!==${JSON.stringify(stateHash(baseline.learning))})throw new Error('Material association/session changed');
    if(hash(reader.settings)!==${JSON.stringify(stateHash(baseline.readerSettings))})throw new Error('Reader settings changed');
    if(hash(reader.getProgress(material.localPath))!==${JSON.stringify(stateHash(baseline.progress))})throw new Error('Reading position changed');
    if(app.customCss.theme!==${JSON.stringify(baseline.theme)}||hash(rss.settings.feeds.map(f=>f.url))!==${JSON.stringify(stateHash(baseline.feeds))})throw new Error('Theme or subscriptions changed');
    if(app.vault.getAbstractFileByPath('Dashell/__QA_article-links-20261004'))throw new Error('QA folder remains');
    return {associationsAndSessionsPreserved:true,readingNotesPreserved:true,readerSettingsPreserved:true,readingPositionPreserved:true,theme:app.customCss.theme,subscriptions:rss.settings.feeds.length,noQaFiles:true};
  })()`);
  run(`(async()=>{await app.workspace.changeLayout(${JSON.stringify(baseline.layout)});return true;})()`);
  result.layoutRestored=true;
} else if(stage === "errors") {
  result=diagnosticCommand(session,"dev:errors");
} else throw new Error("Unknown link-saving stage");
const report=fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath)):{};
report[stage]=result;fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
console.log(JSON.stringify(result,null,2));
