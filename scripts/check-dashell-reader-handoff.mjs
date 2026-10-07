import fs from "node:fs";
import path from "node:path";
import { readSession, evaluate, diagnosticCommand } from "./dashell-host-session.mjs";

const [descriptor, stage] = process.argv.slice(2);
const session = readSession(descriptor);
const baselinePath = path.join(session.sessionRoot, "handoff-baseline.json");
const reportPath = path.join(session.sessionRoot, "handoff-report.json");
const run = code => evaluate(session, code);
const qaFolder = "Dashell QA Handoff 20261004";
const qaUrl = "https://dashell-handoff-qa.invalid/rss";
let result;
if (stage === "baseline") {
  if (fs.existsSync(baselinePath)) throw new Error("Existing baseline must be cleaned up first.");
  const baseline = run(`(()=>{const p=app.plugins.getPlugin('dashell-rss'),r=app.plugins.getPlugin('dashell-reader');return {settings:structuredClone(p.settings),learning:structuredClone(p.dashellLearning.store.state),readerSettings:structuredClone(r.settings),readerLastBook:r._lastBookPath,layout:app.workspace.getLayout(),theme:app.customCss.theme};})()`);
  fs.writeFileSync(baselinePath, JSON.stringify(baseline));
  result = { backedUp: true, feedCount: baseline.settings.feeds.length };
} else if (stage === "card") {
  result = run(`(async()=>{
    const p=app.plugins.getPlugin('dashell-rss'),c=p.dashellLearning;
    if(app.vault.getAbstractFileByPath('${qaFolder}'))throw new Error('QA folder already exists');
    await c.store.transact(s=>{s.preferences.folder='${qaFolder}';});
    const content=Array.from({length:35},(_,i)=>'<p>Reading practice '+(i+1)+'. Learning a language takes patience and curiosity. A little reading every day makes difficult ideas easier to understand.</p>').join('');
    const article={guid:'dashell-handoff-qa-20261004',title:'Dashell Reader 联动验证',link:'https://dashell-handoff-qa.invalid/article',feedUrl:'${qaUrl}',feedTitle:'Dashell Handoff QA 20261004',pubDate:'2026-10-04',coverImage:'',description:'QA article',content,dashell:{id:'dashell-handoff-qa-20261004',translation:'<p>每天阅读一点，逐渐理解复杂的内容。</p>',rewrite:'Read a little every day. Keep learning with curiosity.'}};
    const material=await c.ensure(article);const readerPlugin=app.plugins.getPlugin('dashell-reader');
    for(const name of [article.title,article.title+' - 译文',article.title+' - 改写'])(readerPlugin.settings.bookNotePrompted||={})['${qaFolder}/'+article.title+'-'+material.id.slice(0,10)+'/'+name+'.md']=true;
    p.settings.feeds.push({title:article.feedTitle,url:'${qaUrl}',folder:'',items:[article],lastUpdated:0});
    await p.activateView();const v=await p.getActiveDashboardView();v.currentFeed=null;v.currentFolder=null;v.render();await app.workspace.revealLeaf(v.leaf);
    const cards=Array.from(v.contentEl.querySelectorAll('.rss-dashboard-article-card'));
    const card=cards.find(el=>el.textContent.includes(article.title));if(!card)throw new Error('QA card not rendered');
    card.click();
    const deadline=Date.now()+10000;let record,reader;
    while(Date.now()<deadline){record=c.store.state.materials.find(m=>m.title===article.title);reader=app.workspace.getLeavesOfType('qiaomu-reader-english').find(l=>l.view.file?.path===record?.localPath)?.view;if(reader?.bookHtml&&!reader._openingBook&&reader.areaEl.textContent.includes('Learning a language'))break;await new Promise(r=>window.setTimeout(r,100));}
    if(!reader?.bookHtml)throw new Error('Reader did not open from card');
    if(!reader.areaEl.textContent.includes('Learning a language'))throw new Error('Reader text not rendered');
    if(v.contentEl.querySelector('.rss-workbench')||v.contentEl.querySelector('.rss-dashboard-layout').hidden)throw new Error('RSS opened a second reading interface');
    const select=reader.materialVersionSlot.querySelector('select');if(select?.options.length!==3)throw new Error('Reader version menu missing');
    const file=app.vault.getAbstractFileByPath(record.localPath);const markdown=await app.vault.read(file);
    await v.handleArticleClick(article);const repeated=c.store.state.materials.find(m=>m.id===record.id);
    if(repeated.localPath!==record.localPath||repeated.sessions.length!==1)throw new Error('Duplicate file/session on repeated card click');
    return {actualCardClick:true,readerRendered:true,rssHomeRetained:true,threeVersions:true,localFiles:record.localFiles.length,reusesFile:true,sourceMetadata:markdown.includes('source:'),path:record.localPath};
  })()`);
} else if (stage === "versions") {
  result = run(`(async()=>{
    const p=app.plugins.getPlugin('dashell-rss');const record=p.dashellLearning.store.state.materials.find(m=>m.title==='Dashell Reader 联动验证');
    const view=app.workspace.getLeavesOfType('qiaomu-reader-english').find(l=>l.view.file?.path===record.localPath).view;
    const select=view.materialVersionSlot.querySelector('select');const target=record.localPath.replace(/\\.md$/,' - 译文.md');
    select.value=target;select.dispatchEvent(new Event('change'));
    const deadline=Date.now()+10000;while(Date.now()<deadline){if(view.file?.path===target&&view.bookHtml&&!view._openingBook&&view.areaEl.textContent.includes('每天阅读一点'))break;await new Promise(r=>window.setTimeout(r,100));}
    if(view.file?.path!==target||!view.areaEl.textContent.includes('每天阅读一点'))throw new Error('Translation switch failed');
    await view.plugin.saveProgress(target,0,1,0);await p.getActiveDashboardView().then(v=>v.handleArticleClick(p.settings.feeds.find(f=>f.url==='${qaUrl}').items[0]));
    if(view.file?.path!==target)throw new Error('Card did not resume last language version');
    return {translationRendered:true,lastVersionResumed:true,lookupController:!!view.lookupController,theme:view.plugin.settings.theme};
  })()`);
} else if (stage === "reload") {
  result = run(`(async()=>{
    const p=app.plugins.getPlugin('dashell-rss'),before=JSON.stringify(p.dashellLearning.store.state);
    await app.plugins.unloadPlugin('dashell-rss');await app.plugins.loadPlugin('dashell-rss');
    const next=app.plugins.getPlugin('dashell-rss');if(!require('util').isDeepStrictEqual(JSON.parse(before),JSON.parse(JSON.stringify(next.dashellLearning.store.state))))throw new Error('Learning association lost on reload');
    await next.activateView();const v=await next.getActiveDashboardView();await v.handleArticleClick(next.settings.feeds.find(f=>f.url==='${qaUrl}').items[0]);
    const record=next.dashellLearning.store.state.materials.find(m=>m.title==='Dashell Reader 联动验证');
    if(!app.workspace.getLeavesOfType('qiaomu-reader-english').some(l=>l.view.file?.path===record.localPath.replace(/\\.md$/,' - 译文.md')))throw new Error('Reopened card did not resume translation');
    return {rssReloadKeepsFiles:true,cardResumesVersion:true,sessions:record.sessions.length};
  })()`);
} else if (stage === "reader-reload") {
  result = run(`(async()=>{
    const p=app.plugins.getPlugin('dashell-rss'),old=app.plugins.getPlugin('dashell-reader');
    const record=p.dashellLearning.store.state.materials.find(m=>m.title==='Dashell Reader 联动验证');
    const target=record.localPath.replace(/\\.md$/,' - 译文.md');
    const progress=JSON.parse(JSON.stringify(old.progress[target]));
    await app.plugins.unloadPlugin('dashell-reader');await old._progressQueue.drain();await old._localDataQueue.drain();await app.plugins.loadPlugin('dashell-reader');
    const reader=app.plugins.getPlugin('dashell-reader');
    const position=value=>JSON.parse(JSON.stringify({pct:value?.pct,percent:value?.percent,block:value?.block,cfi:value?.cfi}));
    if(!require('util').isDeepStrictEqual(position(progress),position(reader.progress[target]))||reader.progress[target].lastRead<progress.lastRead)throw new Error('Reader progress lost on reload');
    await p.activateView();await p.getActiveDashboardView().then(v=>v.handleArticleClick(p.settings.feeds.find(f=>f.url==='${qaUrl}').items[0]));
    let view;const deadline=Date.now()+10000;while(Date.now()<deadline){view=app.workspace.getLeavesOfType('qiaomu-reader-english').find(l=>l.view.file?.path===target)?.view;if(view?.materialVersionSlot.querySelector('select')&&view.areaEl.textContent.includes('每天阅读一点')&&!view._openingBook)break;await new Promise(r=>window.setTimeout(r,100));}
    if(!view||!view.areaEl.textContent.includes('每天阅读一点'))throw new Error('Reader did not resume after reload');
    if(view.getDisplayText()!==record.title||view.titleEl.textContent!==record.title)throw new Error('Material title not restored');
    const select=view.materialVersionSlot.querySelector('select');
    if(select.value!==target||select.options.length!==3)throw new Error('Version controls not restored');
    return {readerReloadKeepsProgress:true,lastVersionResumed:true,titleRetained:true,threeVersions:true};
  })()`);
} else if (stage === "settings") {
  result = run(`(()=>{
    const p=app.plugins.getPlugin('dashell-rss'),tab=p.settingTab,previous=tab.currentTab,before=JSON.stringify(p.settings);
    const names=()=>Array.from(tab.containerEl.querySelectorAll('.setting-item-name'),el=>el.textContent);
    try{
      tab.activateTab('General');for(const name of ['阅读器打开位置','已保存文章的打开位置','使用网页浏览器'])if(names().includes(name))throw new Error('Duplicate setting: '+name);
      tab.activateTab('Display');for(const name of ['字号','行高','重置阅读器排版'])if(names().includes(name))throw new Error('Duplicate reading appearance: '+name);
      if(!tab.containerEl.querySelector('[data-rss-settings-section="mobile-toolbar"]'))throw new Error('Dashboard display settings missing');
      if(JSON.stringify(p.settings)!==before)throw new Error('Rendering settings changed saved preferences');
      return {duplicateReadingSettingsHidden:true,dashboardSettingsRetained:true,preferencesUnchanged:true};
    }finally{tab.activateTab(previous);}
  })()`);
} else if (stage === "screenshot") {
  run(`(()=>{const view=app.workspace.getLeavesOfType('qiaomu-reader-english').find(l=>l.view.file?.path.startsWith('${qaFolder}/'))?.view;view?._armImmersive?.();return true;})()`);
  result = diagnosticCommand(session, "dev:screenshot", [`path=${path.join(session.sessionRoot, "reader-handoff.png")}`]);
} else if (stage === "cleanup") {
  const original = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const baseline = { prefs: original.learning.preferences, ids: original.learning.materials.map(m=>m.id), feeds: original.settings.feeds.map(f=>f.url), layout: original.layout, bookNotePrompted: original.readerSettings.bookNotePrompted, readerLastBook: original.readerLastBook, theme: original.theme };
  result = run(`(async()=>{
    const baseline=${JSON.stringify(baseline)};const p=app.plugins.getPlugin('dashell-rss'),c=p.dashellLearning,r=app.plugins.getPlugin('dashell-reader');
    for(const leaf of app.workspace.getLeavesOfType('qiaomu-reader-english'))if(leaf.view.file?.path.startsWith('${qaFolder}/'))await leaf.detach();
    await new Promise(resolve=>window.setTimeout(resolve,100));
    const created=c.store.state.materials.filter(m=>!baseline.ids.includes(m.id)&&m.title==='Dashell Reader 联动验证');
    for(const m of created)for(const path of m.localFiles||[]){if(!path.startsWith('${qaFolder}/'))throw new Error('Refusing cleanup outside named QA folder');const file=app.vault.getAbstractFileByPath(path);if(file)await app.fileManager.trashFile(file);delete r.progress[path];delete r.progressBackups[path];}
    const folder=app.vault.getAbstractFileByPath('${qaFolder}');if(folder){const removeEmpty=async f=>{for(const child of [...f.children])if(child.children)await removeEmpty(child);if(!f.children.length)await app.fileManager.trashFile(f);};await removeEmpty(folder);}
    await c.store.transact(s=>{s.preferences=baseline.prefs;s.materials=s.materials.filter(m=>!created.some(x=>x.id===m.id));});
    p.settings.feeds=p.settings.feeds.filter(f=>f.url!=='${qaUrl}');await p.saveSettings();
    r.settings.bookNotePrompted=baseline.bookNotePrompted;r._lastBookPath=baseline.readerLastBook;await r._commitProgressStore();await r.saveAll();
    await app.workspace.changeLayout(baseline.layout);
    if(p.settings.feeds.length!==baseline.feeds.length||app.customCss.theme!==baseline.theme)throw new Error('Original feeds/theme changed');
    return {qaFilesRemoved:!app.vault.getAbstractFileByPath('${qaFolder}'),qaRecordsRemoved:!c.store.state.materials.some(m=>m.title==='Dashell Reader 联动验证'),originalFeedsRetained:true,themeRetained:true};
  })()`);
} else if (stage === "verify-cleanup") {
  const original = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  const expected = { preferences: original.learning.preferences, feeds: original.settings.feeds.map(f => f.url).sort(), theme: original.theme };
  result = run(`(()=>{
    const expected=${JSON.stringify(expected)},p=app.plugins.getPlugin('dashell-rss'),r=app.plugins.getPlugin('dashell-reader');
    const same=(a,b)=>require('util').isDeepStrictEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)));
    if(!same(p.dashellLearning.store.state.preferences,expected.preferences))throw new Error('Download preferences not restored');
    if(!same(p.settings.feeds.map(f=>f.url).sort(),expected.feeds))throw new Error('Subscriptions not restored');
    if(app.customCss.theme!==expected.theme)throw new Error('Theme changed');
    if(app.vault.getAbstractFileByPath('${qaFolder}')||p.dashellLearning.store.state.materials.some(m=>m.title==='Dashell Reader 联动验证')||Object.keys(r.progress).some(path=>path.startsWith('${qaFolder}/')))throw new Error('QA residue remains');
    return {downloadPreferencesRestored:true,subscriptionsRestored:true,themeRetained:true,noQaFilesOrRecordsOrProgress:true};
  })()`);
} else throw new Error("Unknown stage");
const report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath)) : {};
report[stage] = result;
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(result, null, 2));
