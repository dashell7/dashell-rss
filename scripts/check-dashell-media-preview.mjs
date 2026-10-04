// Designated-vault checks. User settings and snapshots stay outside the repository.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { readSession, evaluate, diagnosticCommand } from "./dashell-host-session.mjs";
const [descriptor, stage] = process.argv.slice(2);
const session = readSession(descriptor);
const baselinePath = path.join(session.sessionRoot, "media-preview-baseline.json");
const reportPath = path.join(session.sessionRoot, "media-preview-report.json");
const run = code => evaluate(session, code);
let result;
if(stage === "baseline" || stage === "recover-baseline") {
  if(fs.existsSync(baselinePath)) throw new Error("Complete the existing media preview check first");
  const baseline = run(`(()=>{
    const p=app.plugins.getPlugin('dashell-rss');
    return {settings:structuredClone(p.settings),learning:structuredClone(p.dashellLearning.store.state),layout:app.workspace.getLayout(),theme:app.customCss.theme,files:app.vault.getFiles().map(f=>f.path).sort(),readerPaths:app.workspace.getLeavesOfType('qiaomu-reader-english').map(l=>l.view.file?.path)};
  })()`);
  if(stage === "recover-baseline") {
    // An uninitialized old candidate may prevent the pre-install live snapshot.
    // The guarded installer captured its settings, shards, state and workspace.
    const installBackup = process.argv[4];
    const pluginDir = path.join(installBackup,"plugin");
    const settings = JSON.parse(fs.readFileSync(path.join(pluginDir,"data.json")));
    if(settings.storageMode !== "vault-shards-v2") throw new Error("Recovery expects the designated v2 snapshot");
    const state = JSON.parse(fs.readFileSync(path.join(pluginDir,"data/user-state.json")));
    for(const feed of settings.feeds) {
      const shard = JSON.parse(fs.readFileSync(path.join(pluginDir,`data/feeds/${feed.feedId}.json`)));
      feed.items = shard.items.map(item => ({...item,read:false,starred:false,saved:false,tags:[],...state.states[`${feed.feedId}:${item.guid}`]}));
    }
    baseline.settings = settings;
    baseline.learning = JSON.parse(fs.readFileSync(path.join(pluginDir,"dashell-learning.json")));
    baseline.layout = JSON.parse(fs.readFileSync(path.join(installBackup,"workspace.json")));
  }
  fs.writeFileSync(baselinePath, JSON.stringify(baseline));
  result = {backedUp:true,subscriptions:baseline.settings.feeds.length};
} else if(stage === "native") {
  result = run(`(async()=>{
    const p=app.plugins.getPlugin('dashell-rss'),store=JSON.stringify(p.dashellLearning.store.state),fileCount=app.vault.getFiles().length;
    const readerBefore=app.workspace.getLeavesOfType('qiaomu-reader-english').map(l=>l.view.file?.path).sort();
    const playerBefore=app.workspace.getLeavesOfType('langplayer').length;
    const podcast=p.settings.feeds.flatMap(f=>f.items).find(i=>i.mediaType==='podcast'&&i.audioUrl);
    const video=p.settings.feeds.flatMap(f=>f.items).find(i=>i.mediaType==='video'&&i.videoId);
    if(!podcast||!video)throw new Error('Representative subscribed media missing');
    await p.activateView();const dashboard=await p.getActiveDashboardView();
    const checks=[];
    for(const item of [podcast,video]){
      await dashboard.handleFeedClick(p.settings.feeds.find(f=>f.url===item.feedUrl));
      const card=Array.from(dashboard.contentEl.querySelectorAll('.rss-dashboard-article-card')).find(c=>c.textContent.includes(item.title));
      if(!card)throw new Error('Media card not rendered');card.click();
      let view;const until=Date.now()+12000;
      while(Date.now()<until){view=app.workspace.getLeavesOfType('rss-reader-view').find(l=>l.view.currentItem?.guid===item.guid)?.view;
        if(view&&(item.mediaType==='podcast'?view.contentEl.querySelector('.rss-play-pause'):view.contentEl.querySelector('iframe')))break;
        await new Promise(resolve=>window.setTimeout(resolve,100));}
      if(!view)throw new Error('Native media reader did not open');
      if(view.contentEl.querySelector('.rss-dashell-learning-panel'))throw new Error('Learning controls leaked into media');
      if(item.mediaType==='podcast'){
        if(!view.podcastPlayer||view.podcastPlayer.audioElement?.src!==item.audioUrl)throw new Error('Native podcast player/source missing');
        if(view.podcastPlayer.playlist?.length<2)throw new Error('Podcast playlist missing');
      }else{
        if(!view.videoPlayer||!view.contentEl.querySelector('iframe')?.src.includes(item.videoId))throw new Error('Native video embed missing');
      }
      checks.push({mediaType:item.mediaType,nativePreview:true,learningPanelAbsent:true});
    }
    if(JSON.stringify(p.dashellLearning.store.state)!==store||app.vault.getFiles().length!==fileCount)throw new Error('Preview created learning records or files');
    if(JSON.stringify(app.workspace.getLeavesOfType('qiaomu-reader-english').map(l=>l.view.file?.path).sort())!==JSON.stringify(readerBefore)||app.workspace.getLeavesOfType('langplayer').length!==playerBefore)throw new Error('Learning plugin unexpectedly opened');
    return {checks,noDownload:true,noLearningPluginOpened:true};
  })()`);
} else if(stage === "settings") {
  result = run(`(async()=>{
    const p=app.plugins.getPlugin('dashell-rss'),tab=p.settingTab,previous=tab.currentTab,original=p.settings.readerViewLocation;
    try{
      tab.activateTab('General');
      const row=Array.from(tab.containerEl.querySelectorAll('.setting-item')).find(el=>el.querySelector('.setting-item-name')?.textContent==='媒体预览位置');
      const select=row?.querySelector('select');if(!select||select.value!==original)throw new Error('Media preview setting missing or reset');
      select.value='inline';select.dispatchEvent(new select.ownerDocument.defaultView.Event('change'));
      await new Promise(resolve=>window.setTimeout(resolve,150));
      if(p.settings.readerViewLocation!=='inline')throw new Error('Preview location did not change');
      return {mediaLocationVisible:true,existingChoiceRetained:true,canChangePreviewLocation:true};
    }finally{p.settings.readerViewLocation=original;await p.saveSettings();tab.activateTab(previous);}
  })()`);
} else if(stage === "cleanup") {
  const baseline = JSON.parse(fs.readFileSync(baselinePath));
  const keys = ['read','saved','savedFilePath','playbackProgress','audioUrl','videoId'];
  const media = [
    baseline.settings.feeds.flatMap(f=>f.items).find(i=>i.mediaType==='podcast'&&i.audioUrl),
    baseline.settings.feeds.flatMap(f=>f.items).find(i=>i.mediaType==='video'&&i.videoId),
  ].map(item=>({guid:item.guid,feedUrl:item.feedUrl,values:Object.fromEntries(keys.filter(k=>Object.hasOwn(item,k)).map(k=>[k,item[k]]))}));
  const leafIds=[];const gather=node=>{if(node.type==='leaf')leafIds.push(node.id);for(const child of node.children||[])gather(child);};
  for(const node of [baseline.layout.main,baseline.layout.left,baseline.layout.right])if(node)gather(node);
  const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
  const hash=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
  const expected={media,leafIds,location:baseline.settings.readerViewLocation,filters:baseline.settings.dashboardMultiFilters,filesHash:hash(baseline.files),learningHash:hash(baseline.learning),theme:baseline.theme,feedCount:baseline.settings.feeds.length};
  result = run(`(async()=>{
    const baseline=${JSON.stringify(expected)},p=app.plugins.getPlugin('dashell-rss');
    const originalLeaves=new Set(baseline.leafIds);
    for(const leaf of app.workspace.getLeavesOfType('rss-reader-view'))if(!originalLeaves.has(leaf.id))await leaf.detach();
    p.settings.readerViewLocation=baseline.location;
    for(const old of baseline.media){const item=p.settings.feeds.find(f=>f.url===old.feedUrl)?.items.find(i=>i.guid===old.guid);if(!item)throw new Error('Media item missing');for(const key of ['read','saved','savedFilePath','playbackProgress','audioUrl','videoId']){if(Object.hasOwn(old.values,key))item[key]=old.values[key];else delete item[key];}}
    p.settings.dashboardMultiFilters=baseline.filters;
    await p.saveSettings();
    const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
    const hash=value=>require('crypto').createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
    if(hash(app.vault.getFiles().map(f=>f.path).sort())!==baseline.filesHash)throw new Error('Unexpected files after preview tests');
    if(hash(p.dashellLearning.store.state)!==baseline.learningHash)throw new Error('Learning state changed during previews');
    if(app.customCss.theme!==baseline.theme||p.settings.feeds.length!==baseline.feedCount)throw new Error('Subscriptions or theme changed');
    return {originalMediaStatesRestored:true,learningStateUnchanged:true,noNewFiles:true,themeRestored:true};
  })()`);
  run(`(async()=>{await app.workspace.changeLayout(${JSON.stringify(baseline.layout)});return true;})()`);
  result.originalLayoutRestored=true;
} else if(stage === "screenshot") {
  result = diagnosticCommand(session, "dev:screenshot", [`path=${path.join(session.sessionRoot,"media-preview.png")}`]);
} else throw new Error("Unknown media-preview stage");
const report=fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath)):{};
report[stage]=result;fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
console.log(JSON.stringify(result,null,2));
