// Private UI acceptance data is backed up outside the designated vault.
import fs from "node:fs";
import path from "node:path";
import { readSession, evaluate, diagnosticCommand } from "./dashell-host-session.mjs";
const [descriptor, stage] = process.argv.slice(2);
const session = readSession(descriptor);
const baselinePath = path.join(session.sessionRoot, "workbench-baseline.json");
const run = (code) => evaluate(session, code);
let result;
if (stage === "baseline") {
  if (fs.existsSync(baselinePath)) throw new Error("Finish existing UI test cleanup first.");
  const baseline = run(`(()=>{const p=app.plugins.getPlugin('dashell-rss');return {settings:structuredClone(p.settings),learning:structuredClone(p.dashellLearning.store.state),layout:app.workspace.getLayout(),dark:activeDocument.body.classList.contains('theme-dark')};})()`);
  fs.writeFileSync(baselinePath, JSON.stringify(baseline));
  result = { backedUp: true, feedCount: baseline.settings.feeds.length };
} else if (stage === "preview") {
  result = run(`(async()=>{const p=app.plugins.getPlugin('dashell-rss');await p.activateView();const v=await p.getActiveDashboardView();await app.workspace.revealLeaf(v.leaf);const items=p.settings.feeds.flatMap(f=>f.items);const item=items.find(i=>i.read&&i.content)||items[0];if(!item)throw new Error('No articles');await v.showReadingWorkbench(item.feedUrl).open(item);const root=v.contentEl.querySelector('.rss-workbench');return {rows:root.querySelectorAll('.rss-workbench-entry').length,titlePresent:!!root.querySelector('.rss-reader-item-title'),learningMenu:!!root.querySelector('.rss-dashell-learning-menu'),bodyWidth:root.querySelector('.rss-workbench-body').clientWidth,listWidth:root.querySelector('.rss-workbench-sidebar').clientWidth,images:Array.from(root.querySelectorAll('img')).map(i=>({loaded:i.complete&&i.naturalWidth>0})),toolbarButtons:root.querySelectorAll('.rss-reader-actions > button').length};})()`);
} else if (stage === "navigation") {
  result = run(`(async()=>{const p=app.plugins.getPlugin('dashell-rss');await p.activateView();const v=await p.getActiveDashboardView();await app.workspace.revealLeaf(v.leaf);v.returnToDashboard();
    const home=v.contentEl.querySelector('.rss-dashboard-layout'),feed=p.settings.feeds[0];
    if(home.hidden||v.contentEl.querySelector('.rss-workbench'))throw new Error('Home replaced');
    const content=home.firstElementChild,folder=v.currentFolder,page=v.allArticlesPage;
    const scrollEl=home.querySelector('.rss-dashboard-content');const top=scrollEl?.scrollTop;
    v.handleFeedClick(feed);if(!home.hidden||!v.contentEl.querySelector('.rss-workbench'))throw new Error('Feed entry missing');
    v.contentEl.querySelector('[aria-label="返回订阅首页"]').click();
    if(home.hidden||home.firstElementChild!==content||v.currentFolder!==folder||v.allArticlesPage!==page||scrollEl?.scrollTop!==top)throw new Error('Home state lost');
    await v.handleArticleClick(feed.items[0]);if(!v.contentEl.querySelector('.rss-workbench-body'))throw new Error('Card entry missing');
    v.returnToDashboard();return {originalHome:true,feedEntry:true,cardEntry:true,returnPreservesHome:true};})()`);
} else if (stage === "fixture") {
  result = run(`(async()=>{
    const p=app.plugins.getPlugin('dashell-rss');const v=await p.getActiveDashboardView();await app.workspace.revealLeaf(v.leaf);await new Promise(r=>window.setTimeout(r,120));
    const paragraph='<p>Reading a little every day builds a lasting habit. Choose material that interests you, and return to it with curiosity.</p>';
    const feed={title:'Dashell UI QA 20261002',url:'https://dashell-ui-qa.example/rss',folder:'',lastUpdated:0,items:Array.from({length:18},(_,n)=>({guid:'dashell-ui-qa-'+n,feedTitle:'Dashell UI QA 20261002',feedUrl:'https://dashell-ui-qa.example/rss',title:'Reading practice '+(n+1),link:'https://substack.com/dashell-ui-qa-'+n,pubDate:'2026-10-02',description:'A short reading exercise for interface checks.',coverImage:'',content:'<h2>Learning through reading</h2>'+paragraph.repeat(18),dashell:{translation:'<h2>通过阅读学习</h2><p>每天读一点，逐渐养成习惯。</p>',rewrite:'<h2>A reading habit</h2><p>Read something you enjoy every day.</p>'}}))};
    p.settings.feeds=p.settings.feeds.filter(f=>f.url!==feed.url);p.settings.feeds.push(feed);await v.showReadingWorkbench(feed.url).open(feed.items[0]);
    const root=v.contentEl.querySelector('.rss-workbench');const version=root.querySelector('.rss-dashell-reader-mode');
    version.value='translation';version.dispatchEvent(new Event('change'));
    if(!root.querySelector('.rss-reader-article-content').textContent.includes('每天读一点'))throw new Error('Translation missing');
    root.querySelector('[aria-label="收藏"]').click();
    await new Promise(r=>window.setTimeout(r,300));
    if(root.querySelector('.rss-dashell-reader-mode').value!=='translation')throw new Error('Version reset by status update');
    version.value='original';version.dispatchEvent(new Event('change'));
    const body=root.querySelector('.rss-workbench-body');body.scrollTop=320;
    const list=root.querySelector('.rss-workbench-list');list.scrollTop=180;
    v.readingWorkbench.setChannel('@all');v.readingWorkbench.setChannel(feed.url);
    await new Promise(r=>window.setTimeout(r,150));
    if(root.querySelector('.rss-workbench-body').scrollTop!==320||list.scrollTop!==180)throw new Error('Scroll not restored');
    const handle=root.querySelector('[role="separator"]');handle.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}));handle.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    if(p.settings.dashellWorkspace.listWidth!==240)throw new Error('Resize missing');
    root.querySelector('[aria-label="收起文章列表"]').click();
    if(getComputedStyle(root.querySelector('.rss-workbench-sidebar')).display!=='none')throw new Error('Folding missing');
    root.querySelector('[aria-label="展开文章列表"]').click();
    root.querySelector('.rss-dashell-learning-menu').open=true;
    if(!root.querySelector('.rss-dashell-learning-panel').textContent.includes('下载到本地学习'))throw new Error('Learning missing');
    root.querySelector('.rss-dashell-learning-menu').open=false;
    await p.saveSettings();
    return {versions:true,versionSurvivesStatus:true,scrollRestored:true,resize:true,fold:true,learning:true,rows:root.querySelectorAll('.rss-workbench-entry').length};
  })()`);
} else if (stage === "restart") {
  result = run(`(async()=>{
    const old=app.plugins.getPlugin('dashell-rss').settings.dashellWorkspace;
    await app.plugins.unloadPlugin('dashell-rss');await app.plugins.loadPlugin('dashell-rss');const p=app.plugins.getPlugin('dashell-rss');await p.activateView();
    const v=await p.getActiveDashboardView();await new Promise(r=>window.setTimeout(r,250));
    if(p.settings.dashellWorkspace.channel!==old.channel||p.settings.dashellWorkspace.listWidth!==old.listWidth)throw new Error('Preferences lost');
    if(v.contentEl.querySelector('.rss-workbench')||v.contentEl.querySelector('.rss-dashboard-layout').hidden)throw new Error('Restart bypassed home');
    v.showReadingWorkbench(old.channel);await new Promise(r=>window.setTimeout(r,200));
    if(!v.contentEl.querySelector('.rss-reader-item-title'))throw new Error('Selection lost');
    return {reload:true,homeOnRestart:true,channelRestored:true,widthRestored:true,selectedArticleRestored:true};
  })()`);
} else if (stage === "layout") {
  result = run(`(async()=>{
    const p=app.plugins.getPlugin('dashell-rss');const v=await p.getActiveDashboardView();await app.workspace.revealLeaf(v.leaf);
    const root=v.contentEl.querySelector('.rss-workbench');const original={width:root.style.width,height:root.style.height,dark:activeDocument.body.classList.contains('theme-dark')};const results=[];
    const frame=()=>new Promise(r=>window.setTimeout(r,120));
    try{for(const dark of [false,true]){activeDocument.body.toggleClass('theme-dark',dark);activeDocument.body.toggleClass('theme-light',!dark);
      for(const width of [1200,700,390,320]){root.style.width=width+'px';root.style.height='900px';root.classList.add('rss-workbench-mobile-reading');await frame();
        const toolbar=root.querySelector('.rss-reader-header'),body=root.querySelector('.rss-workbench-body');
        const menu=root.querySelector('.rss-dashell-learning-menu');menu.open=true;await frame();const panel=menu.querySelector('.rss-dashell-learning-panel').getBoundingClientRect(),bounds=root.getBoundingClientRect();
        const record={dark,width,rootFits:root.scrollWidth<=root.clientWidth+1,toolbarFits:toolbar.scrollWidth<=toolbar.clientWidth+1,bodyFits:body.scrollWidth<=body.clientWidth+1,learningFits:panel.left>=bounds.left-1&&panel.right<=bounds.right+1};results.push(record);menu.open=false;
        if(!record.rootFits||!record.toolbarFits||!record.bodyFits||!record.learningFits)throw new Error(JSON.stringify(record));
      }}
      root.style.width='390px';root.style.height='900px';await frame();root.querySelector('[aria-label="收起文章列表"],[aria-label="展开文章列表"]').click();await frame();
      if(getComputedStyle(root.querySelector('.rss-workbench-sidebar')).display==='none')throw new Error('Mobile back failed');
      const item=p.settings.feeds.find(f=>f.url==='https://dashell-ui-qa.example/rss').items[0];await v.readingWorkbench.open(item);await frame();
      return {viewHeaderHidden:getComputedStyle(v.containerEl.querySelector('.view-header')).display==='none',mobileBack:true,viewports:results};
    }finally{root.style.width=original.width;root.style.height=original.height;activeDocument.body.toggleClass('theme-dark',original.dark);activeDocument.body.toggleClass('theme-light',!original.dark);}
  })()`);
} else if (stage === "menus") {
  result = run(`(async()=>{
    const p=app.plugins.getPlugin('dashell-rss');const v=await p.getActiveDashboardView();await app.workspace.revealLeaf(v.leaf);const root=v.contentEl.querySelector('.rss-workbench');
    root.querySelector('[aria-label="更多操作"]').click();
    const item=Array.from(activeDocument.querySelectorAll('.menu-item')).find(el=>el.textContent.includes('阅读设置'));if(!item)throw new Error('Reading settings menu missing');item.click();
    await new Promise(r=>window.setTimeout(r,100));if(!activeDocument.querySelector('.rss-reader-format-dropdown-portal'))throw new Error('Format popup missing');
    v.readingWorkbench.formatPortal.close(true);root.querySelector('.rss-workbench-channel').click();
    await new Promise(r=>window.setTimeout(r,100));const input=activeDocument.querySelector('input[placeholder="搜索频道或分组"]');if(!input)throw new Error('Channel picker missing');
    input.value='Dashell UI QA';input.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>window.setTimeout(r,100));
    const suggestion=Array.from(activeDocument.querySelectorAll('.suggestion-item')).find(el=>el.textContent.includes('Dashell UI QA'));if(!suggestion)throw new Error('Channel search failed');suggestion.click();
    return {moreMenu:true,formatPopup:true,channelPicker:true,channelSearch:true};
  })()`);
} else if (stage === "screenshots") {
  const original = run(`(()=>{const v=app.workspace.getLeavesOfType('rss-dashboard-view')[0].view;const root=v.contentEl.querySelector('.rss-workbench');return {width:root.style.width,height:root.style.height,dark:activeDocument.body.classList.contains('theme-dark')};})()`);
  const paths = [];
  try {
    for (const dark of [false, true]) {
      run(`(async()=>{const v=app.workspace.getLeavesOfType('rss-dashboard-view')[0].view;await app.workspace.revealLeaf(v.leaf);const root=v.contentEl.querySelector('.rss-workbench');root.style.width='320px';root.style.height='850px';root.classList.add('rss-workbench-mobile-reading');root.querySelector('.rss-dashell-learning-menu').open=true;activeDocument.body.toggleClass('theme-dark',${dark});activeDocument.body.toggleClass('theme-light',${!dark});await new Promise(r=>window.setTimeout(r,180));if(activeDocument.visibilityState!=='visible')throw new Error('Obsidian window must be visible for screenshots');return true;})()`);
      const file = path.join(session.sessionRoot, `reader-320-${dark ? "dark" : "light"}.png`);
      diagnosticCommand(session, "dev:screenshot", [`path=${file}`]);
      paths.push(file);
    }
    result = { paths };
  } finally {
    run(`(()=>{const original=${JSON.stringify(original)};const v=app.workspace.getLeavesOfType('rss-dashboard-view')[0].view;const root=v.contentEl.querySelector('.rss-workbench');root.style.width=original.width;root.style.height=original.height;root.querySelector('.rss-dashell-learning-menu').open=false;activeDocument.body.toggleClass('theme-dark',original.dark);activeDocument.body.toggleClass('theme-light',!original.dark);return true;})()`);
  }
} else if (stage === "cleanup") {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  // Keep command arguments small; restore only the fields changed by these checks.
  const restore = { feeds: baseline.settings.feeds.map(f => ({url:f.url,items:f.items.map(i=>({guid:i.guid,read:i.read,starred:i.starred}))})), workspace:baseline.settings.dashellWorkspace };
  result = run(`(async()=>{const restore=${JSON.stringify(restore)};const p=app.plugins.getPlugin('dashell-rss');
    for(const leaf of app.workspace.getLeavesOfType('rss-dashboard-view'))leaf.detach();
    await new Promise(r=>window.setTimeout(r,600));await p.saveSettings();
    p.settings.feeds=p.settings.feeds.filter(f=>f.url!=='https://dashell-ui-qa.example/rss');
    for(const original of restore.feeds){const feed=p.settings.feeds.find(f=>f.url===original.url);if(!feed)throw new Error('Original feed missing');for(const state of original.items){const item=feed.items.find(i=>i.guid===state.guid);if(item){item.read=state.read;item.starred=state.starred;}}}
    if(restore.workspace)p.settings.dashellWorkspace=restore.workspace;else delete p.settings.dashellWorkspace;
    await p.saveSettings();await p.activateView();
    return {feedCount:p.settings.feeds.length,qaFeeds:p.settings.feeds.filter(f=>f.url.includes('dashell-ui-qa')).length};})()`);
  fs.renameSync(baselinePath, baselinePath.replace(".json", ".restored.json"));
} else if (stage === "verify-clean") {
  const baseline = JSON.parse(fs.readFileSync(baselinePath.replace(".json", ".restored.json"), "utf8"));
  const restore = {
    feeds: baseline.settings.feeds.map(f => ({ url:f.url, items:f.items.map(i => ({ guid:i.guid, read:i.read, starred:i.starred })) })),
    workspace: baseline.settings.dashellWorkspace, learning: baseline.learning, dark: baseline.dark,
  };
  result = run(`(async()=>{const original=${JSON.stringify(restore)};const p=app.plugins.getPlugin('dashell-rss');const metadata=await p.loadData();const v=await p.getActiveDashboardView();
    const flags={feedsRestored:p.settings.feeds.length===original.feeds.length,articleStatusRestored:original.feeds.every(f=>{const feed=p.settings.feeds.find(i=>i.url===f.url);return feed&&f.items.every(state=>{const item=feed.items.find(i=>i.guid===state.guid);return item&&!!item.read===!!state.read&&!!item.starred===!!state.starred;});}),preferencesRestored:JSON.stringify(p.settings.dashellWorkspace)===JSON.stringify(original.workspace),learningRestored:JSON.stringify(p.dashellLearning.store.state)===JSON.stringify(original.learning),metadataRestored:metadata.feeds.length===original.feeds.length&&JSON.stringify(metadata.dashellWorkspace)===JSON.stringify(original.workspace),themeRestored:activeDocument.body.classList.contains('theme-dark')===original.dark,homeVisible:!v.contentEl.querySelector('.rss-dashboard-layout').hidden&&!v.contentEl.querySelector('.rss-workbench')};
    if(Object.values(flags).some(value=>!value))throw new Error(JSON.stringify(flags));return flags;})()`);
} else if (stage === "screenshot") {
  result = diagnosticCommand(session, "dev:screenshot", [`path=${path.join(session.sessionRoot, "workbench-desktop.png")}`]);
} else throw new Error("Unknown stage");
console.log(JSON.stringify(result, null, 2));
