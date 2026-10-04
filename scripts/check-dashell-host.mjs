// Developer-only acceptance runner. Private snapshots stay outside the vault.
import fs from "node:fs";
import path from "node:path";
import {
  readSession,
  evaluate,
  diagnosticCommand,
} from "./dashell-host-session.mjs";
const [descriptor, stage] = process.argv.slice(2);
const session = readSession(descriptor);
const backupPath = path.join(session.sessionRoot, "native-test-baseline.json");
const reportPath = path.join(session.sessionRoot, "native-test-results.json");
const report = fs.existsSync(reportPath)
  ? JSON.parse(fs.readFileSync(reportPath, "utf8"))
  : {};
const run = (code) => evaluate(session, code);
let result;
if (stage === "setup") {
  if (fs.existsSync(backupPath))
    throw new Error(
      "Existing test baseline; complete cleanup before another run.",
    );
  const baseline = run(
    `(()=>{const p=app.plugins.getPlugin('dashell-rss');return {settings:structuredClone(p.settings),learning:structuredClone(p.dashellLearning.store.state),layout:app.workspace.getLayout(),theme:app.customCss.theme};})()`,
  );
  fs.writeFileSync(backupPath, JSON.stringify(baseline));
  result = run(`(async()=>{
    const p=app.plugins.getPlugin('dashell-rss');
    await p.dashellLearning.store.transact(s=>{s.preferences.folder='Dashell QA 20261002';});
    for(const [name,url] of [['Dashell QA source','http://127.0.0.1:18793/rss.xml'],['Dashell QA duplicate source','http://127.0.0.1:18793/rss2.xml']]){
      if(p.settings.feeds.some(f=>f.url===url))throw new Error('QA subscription already exists');
      if(!await p.addFeed(name,url,'',undefined,undefined,undefined,undefined,undefined,true,undefined,{showNotice:false}))throw new Error('QA subscription failed');
    }
    const feed=p.settings.feeds.find(f=>f.url==='http://127.0.0.1:18793/rss.xml');
    const copy=p.settings.feeds.find(f=>f.url==='http://127.0.0.1:18793/rss2.xml');
    if(feed.items.length!==2||copy.items.length!==2)throw new Error('Fixture items missing');
    const article=feed.items.find(i=>i.dashell?.id==='dashell-qa-original-article');
    if(!article?.dashell?.translation||!article.dashell.rewrite)throw new Error('Metadata was lost');
    p.settings.readerViewLocation='main';await p.saveSettings();
    const view=await p.getActiveDashboardView();await view.selectArticle(article,{open:true});
    const panels=activeDocument.querySelectorAll('.rss-dashell-learning-panel');
    return {fixtureItems:feed.items.length,panels:panels.length,theme:app.customCss.theme,version:p.manifest.version};
  })()`);
} else if (stage === "refresh-fixture") {
  result = run(`(async()=>{
    const p=app.plugins.getPlugin('dashell-rss');
    for(const feed of p.settings.feeds.filter(f=>f.url.startsWith('http://127.0.0.1:18793/'))){
      const parsed=await p.feedParser.parseFeed(feed.url,feed,{allowEmpty:true});feed.items=parsed.items;
      if(feed.items.length!==2)throw new Error('Fixture items missing after refresh');
    }
    p.settings.readerViewLocation='main';await p.saveSettings();
    const feed=p.settings.feeds.find(f=>f.url==='http://127.0.0.1:18793/rss.xml');
    const view=await p.getActiveDashboardView();await view.selectArticle(feed.items.find(i=>i.dashell?.id==='dashell-qa-original-article'),{open:true});
    return {fixtureFeeds:2,fixtureItems:4};
  })()`);
} else if (stage === "download") {
  result = run(`(async()=>{
    const p=app.plugins.getPlugin('dashell-rss'),c=p.dashellLearning;
    const feed=p.settings.feeds.find(f=>f.url==='http://127.0.0.1:18793/rss.xml');
    const copy=p.settings.feeds.find(f=>f.url==='http://127.0.0.1:18793/rss2.xml');
    const results=[];
    for(const item of feed.items){
      const m=await c.ensure(item);await c.importer.enqueue(m.id);
      const ready=c.store.state.materials.find(v=>v.id===m.id);
      if(ready.download!=='ready'||!c.importer.localReady(ready))throw new Error('Download not ready: '+ready.error);
      const files=ready.localFiles.map(v=>app.vault.getAbstractFileByPath(v));
      if(ready.kind==='audio'&&!files.some(f=>f?.extension==='srt'))throw new Error('Subtitle missing');
      if(ready.kind==='article'){
        const text=await app.vault.read(app.vault.getAbstractFileByPath(ready.localPath));
        if(!text.includes('original sentence')||text.includes('DASHELL_UNSAFE'))throw new Error('Unsafe or empty markdown');
      }
      const duplicate=await c.ensure(copy.items.find(v=>v.dashell.id===item.dashell.id));
      if(duplicate.id!==m.id)throw new Error('Cross-channel identity mismatch');
      await c.importer.enqueue(m.id);
      if(c.store.state.materials.find(v=>v.id===m.id).localPath!==ready.localPath)throw new Error('Duplicate download');
      results.push({kind:ready.kind,fileCount:files.length,ready:true,duplicate:true});
    }
    return results;
  })()`);
} else if (stage === "failure") {
  result = run(`(async()=>{
    const p=app.plugins.getPlugin('dashell-rss'),c=p.dashellLearning;
    const audio=p.settings.feeds.find(f=>f.url==='http://127.0.0.1:18793/rss.xml').items.find(v=>v.dashell?.id==='dashell-qa-original-audio');
    const item={...audio,title:'Dashell RSS 验证必要文件失败',dashell:{...audio.dashell,id:'dashell-qa-original-failure',assets:audio.dashell.assets.map(a=>a.role==='subtitle'?{...a,url:'http://127.0.0.1:18793/fail.srt'}:a)}};
    const record=await c.ensure(item);await c.importer.enqueue(record.id);
    const failed=c.store.state.materials.find(v=>v.id===record.id);
    if(failed.download!=='failed'||failed.localPath)throw new Error('Required-file failure was marked complete');
    const leftovers=app.vault.getFiles().filter(f=>f.path.startsWith('Dashell QA 20261002/Dashell RSS 验证必要文件失败'));
    if(leftovers.length)throw new Error('Partial files were not cleaned');
    return {requiredFileFailure:true,notReady:true,partialFilesCleaned:true,diagnosticIncludesStatus:failed.error.includes('503')};
  })()`);
} else if (stage === "reader") {
  result = run(`(async()=>{
    const p=app.plugins.getPlugin('dashell-rss'),c=p.dashellLearning;
    const article=c.store.state.materials.find(v=>v.kind==='article'&&v.title.includes('验证'));
    await c.learning.open(article.id);
    const leaves=[];app.workspace.iterateAllLeaves(l=>{if(l.view.getState?.().file===article.localPath)leaves.push(l);});
    if(!leaves.some(l=>l.view.getViewType().includes('qiaomu')))throw new Error('Reader did not open the downloaded MD');
    await c.learning.finish(article.id);await c.learning.open(article.id);
    const m=c.store.state.materials.find(v=>v.id===article.id);
    if(m.sessions.length!==2||!m.sessions[0].completed||m.sessions[1].completed)throw new Error('Learning rounds not retained');
    return {openedInReader:true,viewType:leaves[0].view.getViewType(),rounds:m.sessions.length};
  })()`);
} else if (stage === "player") {
  result = run(`(async()=>{
    const c=app.plugins.getPlugin('dashell-rss').dashellLearning;
    const audio=c.store.state.materials.find(v=>v.kind==='audio'&&v.title.includes('验证'));
    await c.learning.open(audio.id);
    const leaves=app.workspace.getLeavesOfType('langplayer-view');
    if(!leaves.some(l=>l.view.getState().file===audio.localPath))throw new Error('Player file differs');
    return {openedInPlayer:true,fileStateMatches:true};
  })()`);
} else if (stage === "ui") {
  result = run(`(async()=>{
    const p=app.plugins.getPlugin('dashell-rss');
    const feed=p.settings.feeds.find(f=>f.url==='http://127.0.0.1:18793/rss.xml');
    const item=feed.items.find(v=>v.dashell.id==='dashell-qa-original-article');
    const view=await p.getActiveDashboardView();await view.selectArticle(item,{open:true});
    const leaf=app.workspace.getLeavesOfType('rss-reader-view').find(l=>l.view.currentItem?.guid===item.guid);
    await app.workspace.revealLeaf(leaf);
    const root=leaf.view.contentEl;
    const select=root.querySelector('.rss-dashell-reader-mode');
    if(!select||select.options.length!==3)throw new Error('Qiaomu version selector missing');
    select.value='translation';select.dispatchEvent(new Event('change'));
    const body=root.querySelector('.rss-reader-article-content');
    if(!body.textContent.includes('原创测试文字')||body.querySelector('script'))throw new Error('Translation rendering failed');
    select.value='rewrite';select.dispatchEvent(new Event('change'));
    if(!body.querySelector('strong'))throw new Error('Rewrite rendering failed');
    select.value='original';select.dispatchEvent(new Event('change'));
    if(!body.textContent.includes('original sentence'))throw new Error('Original restoration failed');
    if(window.DASHELL_UNSAFE)throw new Error('Unsafe source script executed');
    const cs=root.win.getComputedStyle(root), toolbar=root.querySelector('.rss-dashell-reader-toolbar');
    return {qiaomuToolbar:true,versions:3,safe:true,width:root.clientWidth,toolbarHeight:toolbar.getBoundingClientRect().height,background:cs.backgroundColor,overflow:root.scrollWidth>root.clientWidth+1};
  })()`);
  diagnosticCommand(session, "dev:screenshot", [
    `path=${path.join(session.sessionRoot, "reader-velocity.png")}`,
  ]);
} else if (stage === "appearance") {
  const screenshot = path.join(
    session.sessionRoot,
    "reader-velocity-narrow-dark.png",
  );
  const previous = run(`(async()=>{
    const leaf=app.workspace.getLeavesOfType('rss-reader-view')[0],root=leaf.view.contentEl;
    const originalCss=root.style.cssText,originalTheme=app.getTheme();
    app.changeTheme('obsidian');app.updateTheme();root.style.width='390px';
    return {originalCss,originalTheme};
  })()`);
  try {
    result = run(`(async()=>{
      const root=app.workspace.getLeavesOfType('rss-reader-view')[0].view.contentEl;
      await new Promise(r=>window.setTimeout(r,300));
      const cs=root.win.getComputedStyle(root),toolbar=root.querySelector('.rss-dashell-reader-toolbar');
      if(root.scrollWidth>root.clientWidth+1)throw new Error('Narrow reader overflows');
      const buttons=[...toolbar.querySelectorAll('button')];
      if(buttons.some(b=>b.getBoundingClientRect().right>root.getBoundingClientRect().right+1))throw new Error('Toolbar controls are clipped');
      const rect=root.getBoundingClientRect();
      const image=await require('@electron/remote').getCurrentWebContents().capturePage({x:Math.round(rect.x),y:Math.round(rect.y),width:Math.round(rect.width),height:Math.round(rect.height)});
      require('fs').writeFileSync(${JSON.stringify(screenshot)},image.toPNG());
      return {narrowWidth:root.clientWidth,overflow:false,theme:app.customCss.theme,dark:activeDocument.body.classList.contains('theme-dark'),background:cs.backgroundColor};
    })()`);
  } finally {
    run(
      `(()=>{const root=app.workspace.getLeavesOfType('rss-reader-view')[0].view.contentEl;root.style.cssText=${JSON.stringify(previous.originalCss)};app.changeTheme(${JSON.stringify(previous.originalTheme)});app.updateTheme();return true;})()`,
    );
  }
} else if (stage === "settings") {
  result = run(`(async()=>{
    const p=app.plugins.getPlugin('dashell-rss'),c=p.dashellLearning;
    const tab=app.setting.pluginTabs.find(t=>t.id==='dashell-rss');
    const previous=c.store.state.preferences.maxFileMB;
    app.setting.open();app.setting.openTabById('dashell-rss');tab.activateTab('英语学习');
    const field=tab.containerEl.querySelector('input[type=number]');
    if(!field)throw new Error('Learning settings are missing');
    field.value='65';field.dispatchEvent(new Event('input'));await c.store.transact(()=>{});
    if(c.store.state.preferences.maxFileMB!==65)throw new Error('Settings did not save');
    tab.activateTab('General');tab.activateTab('英语学习');
    if(tab.containerEl.querySelector('input[type=number]').value!=='65')throw new Error('Setting value was lost');
    await c.store.transact(s=>{s.preferences.maxFileMB=previous;});app.setting.close();
    return {learningTab:true,immediateSave:true,reopenRetainsValue:true};
  })()`);
} else if (stage === "reload") {
  result = run(`(async()=>{
    const p=app.plugins.getPlugin('dashell-rss');const before=JSON.stringify(p.dashellLearning.store.state);
    await app.plugins.unloadPlugin('dashell-rss');await app.plugins.loadPlugin('dashell-rss');
    const fresh=app.plugins.getPlugin('dashell-rss');
    if(!require('util').isDeepStrictEqual(JSON.parse(before),JSON.parse(JSON.stringify(fresh.dashellLearning.store.state))))throw new Error('Learning data did not survive reload');
    await fresh.activateView();
    return {reloadPersistence:true,fixtureFeeds:fresh.settings.feeds.filter(f=>f.url.startsWith('http://127.0.0.1:18793/')).length,theme:app.customCss.theme};
  })()`);
} else if (stage === "cleanup") {
  const saved = JSON.parse(fs.readFileSync(backupPath, "utf8"));
  const baseline = {
    settings: { readerViewLocation: saved.settings.readerViewLocation, feeds: saved.settings.feeds.map(feed => ({ url: feed.url })) },
    learning: { preferences: saved.learning.preferences, materials: saved.learning.materials.map(item => ({ id: item.id })) },
    layout: saved.layout,
    theme: saved.theme,
  };
  const expression = `(async()=>{
    const baseline=${JSON.stringify(baseline)};
    const p=app.plugins.getPlugin('dashell-rss'),c=p.dashellLearning;
    const ids=new Set(baseline.learning.materials.map(v=>v.id));
    const created=c.store.state.materials.filter(v=>!ids.has(v.id)&&v.title.includes('验证'));
    for(const m of created)for(const path of m.localFiles??[]){
      if(!path.startsWith('Dashell QA 20261002/'))throw new Error('Refusing to trash outside QA folder');
      const file=app.vault.getAbstractFileByPath(path);if(file)await app.fileManager.trashFile(file);
    }
    const qa=app.vault.getAbstractFileByPath('Dashell QA 20261002');
    if(qa){
      const empty=async folder=>{for(const child of [...(folder.children??[])])if(child.children)await empty(child);if(folder.children?.length===0)await app.fileManager.trashFile(folder);};
      await empty(qa);
    }
    await c.store.transact(s=>{s.preferences=baseline.learning.preferences;s.materials=s.materials.filter(v=>!created.some(m=>m.id===v.id));});
    p.settings.feeds=p.settings.feeds.filter(f=>!['http://127.0.0.1:18793/rss.xml','http://127.0.0.1:18793/rss2.xml'].includes(f.url));
    p.settings.readerViewLocation=baseline.settings.readerViewLocation;
    await p.saveSettings();
    app.setting.close();
    await app.workspace.changeLayout(baseline.layout);
    const retained=baseline.settings.feeds.every(f=>p.settings.feeds.some(v=>v.url===f.url));
    if(!retained||app.customCss.theme!==baseline.theme)throw new Error('Baseline subscriptions or theme lost');
    return {qaRecordsRemoved:true,qaFilesRemoved:!app.vault.getAbstractFileByPath('Dashell QA 20261002'),originalFeedsRetained:true,theme:app.customCss.theme};
  })()`;
  result = run(expression);
} else throw new Error("Unknown stage");
report[stage] = result;
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(result, null, 2));
