const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const KEY='owl2_state_v1';
const old=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}};
const uid=()=>window.crypto?.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
const today=()=>new Date().toISOString().slice(0,10);
const addDays=(d,n)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
const base={
profile:{name:'Mohammed Obaidul Hoque'},
settings:{dailyMinutes:90,theme:'dark',webhook:''},
subjects:[
{id:uid(),name:'Web Development',weight:5,color:'#6aa9ff'},
{id:uid(),name:'Data Analytics',weight:3,color:'#53ddb0'},
{id:uid(),name:'Digital Marketing',weight:2,color:'#9b84ff'},
{id:uid(),name:'HSC Study',weight:4,color:'#f4c66e'}
],
tasks:[
{id:uid(),title:'Build the next Web Lab feature',category:'web',priority:'high',due:today(),done:false,source:'seed'},
{id:uid(),title:'Complete one focused study session',category:'study',priority:'medium',due:today(),done:false,source:'seed'},
{id:uid(),title:'Review one analytics concept',category:'study',priority:'medium',due:today(),done:false,source:'seed'}
],
deadlines:[],
notes:[],
sessions:[],
projects:[
{id:uid(),title:'Obaid Web Lab',description:'Source-first educational web IDE and student workspace.',status:'Active',progress:86,tags:['Web','Education']},
{id:uid(),title:'Analytics Toolkit',description:'Reusable KPI, cleaning and reporting templates.',status:'Planned',progress:32,tags:['Data','Templates']},
{id:uid(),title:'Growth Console',description:'Content experiments, SEO workflows and performance tracking.',status:'Idea',progress:12,tags:['Marketing','Growth']}
],
content:[
['Teach','Educational content that solves one clear problem','2× / week'],
['Build in public','Show experiments, progress and lessons','2× / week'],
['Proof','Case studies, outcomes and screenshots','1× / week'],
['Community','Questions, replies and useful conversations','1× / week']
],
web:{files:{
'index.html':'<main class="demo">\n  <span>OBAID WEB LAB</span>\n  <h1>Build something useful.</h1>\n  <p>Edit the files on the left and run the preview.</p>\n  <button id="hello">Test JavaScript</button>\n</main>',
'styles.css':'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1220;color:#f5f7fb;font:16px system-ui}.demo{width:min(560px,82vw);padding:42px;border:1px solid #33435f;border-radius:24px;background:#111d30;box-shadow:0 30px 80px #0005}.demo span{font-size:10px;letter-spacing:.18em;color:#8ebcff}.demo h1{font-size:42px;letter-spacing:-.05em;margin:12px 0}.demo p{color:#96a4ba}.demo button{padding:10px 14px;border:0;border-radius:9px;background:#edf4ff;color:#0b1220;font-weight:800}',
'app.js':"document.querySelector('#hello').addEventListener('click',()=>alert('JavaScript is running inside Obaid Web Lab.'));"
},active:'index.html',runs:0,snapshots:[]},
automations:{planner:true,deadlines:true,studyLog:true,capture:true,backup:false,notifications:false,runs:0,history:[],lastDailyRun:null},
check:{},
lastPlan:[],
installPrompt:null
};
let state=loadState();
function loadState(){
 try{
  const saved=JSON.parse(localStorage.getItem(KEY));
  if(saved)return {...base,...saved,profile:{...base.profile,...saved.profile},settings:{...base.settings,...saved.settings},automations:{...base.automations,...saved.automations},web:{...base.web,...saved.web,files:{...base.web.files,...(saved.web?.files||{})}}};
 }catch{}
 const migrated={...base,tasks:old('owl_tasks',base.tasks),notes:old('owl_notes',base.notes)};
 ['html','css','js'].forEach(k=>{const v=old('owl_lab_'+k,null);if(v)migrated.web.files[k==='html'?'index.html':k==='css'?'styles.css':'app.js']=v});
 migrated.web.runs=old('owl_labRuns',0);
 return migrated;
}
function save(){localStorage.setItem(KEY,JSON.stringify(state));renderAll()}
function logAutomation(type,detail){
 state.automations.runs++;
 state.automations.history.unshift({id:uid(),type,detail,date:new Date().toISOString()});
 state.automations.history=state.automations.history.slice(0,60);
}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),1800)}
const views={home:'Command Center',study:'Study System',lab:'Web Lab',assignments:'Assignments & Tasks',analytics:'Analytics',notes:'Notes & Knowledge',classes:'Class Files',portfolio:'My Portfolio',projects:'Projects',marketing:'Marketing Console',resources:'Resources',automation:'Automation Center'};
function go(id){$$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+id));$$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===id));$('#crumb').textContent=views[id]||'Command Center';history.replaceState(null,'','#'+id);window.scrollTo({top:0,behavior:'smooth'});closeSidebar();renderAll()}
function closeSidebar(){$('#sidebar').classList.remove('open');$('#sidebarOverlay').classList.remove('show')}
$$('.nav-item').forEach(b=>b.onclick=()=>go(b.dataset.view));$$('[data-view-jump]').forEach(b=>b.onclick=()=>go(b.dataset.viewJump));
$('#openSidebar').onclick=()=>{$('#sidebar').classList.add('open');$('#sidebarOverlay').classList.add('show')};$('#closeSidebar').onclick=closeSidebar;$('#sidebarOverlay').onclick=closeSidebar;
function formatDate(v){if(!v)return 'No date';return new Date(v+'T12:00:00').toLocaleDateString([], {month:'short',day:'numeric'})}
function daysAway(v){return Math.ceil((new Date(v+'T23:59:59')-new Date())/86400000)}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function taskStats(){const open=state.tasks.filter(x=>!x.done),done=state.tasks.filter(x=>x.done);return {open,done,rate:state.tasks.length?Math.round(done.length/state.tasks.length*100):0}}
function completedDays(){const set=new Set(state.sessions.map(s=>s.date));return [...set].sort()}
function streak(){const days=completedDays();if(!days.length)return 0;let n=0,d=today();while(days.includes(d)){n++;d=addDays(d,-1)}return n}
function dayPercent(){const total=state.tasks.length+state.deadlines.length;const done=state.tasks.filter(t=>t.done&&t.due===today()).length;const due=state.tasks.filter(t=>t.due===today()).length;return due?Math.min(100,Math.round(done/due*100)):Math.min(100,Math.round((state.tasks.filter(t=>t.done).length/Math.max(1,state.tasks.length))*100))}
function renderHome(){
 const {open,rate}=taskStats();$('#openTasksStat').textContent=open.length;$('#taskStatNote').textContent=open.length?open.length+' next actions':'Clear queue';$('#studyMinutesStat').textContent=state.sessions.reduce((a,s)=>a+s.minutes,0);$('#automationStat').textContent=state.automations.runs;$('#automationStatNote').textContent=state.automations.history.length?state.automations.history[0].type:'Ready';$('#labStat').textContent=state.web.runs;$('#dayPercent').textContent=dayPercent()+'%';$('#systemState').textContent='System ready';
 const q=$('#todayQueue');const tq=state.tasks.filter(t=>t.due===today()).slice(0,6);q.innerHTML=tq.length?tq.map(t=>'<label class="queue-row"><input type="checkbox" data-q="'+t.id+'" '+(t.done?'checked':'')+'><div><b>'+escapeHtml(t.title)+'</b><small>'+escapeHtml(t.category)+' · '+escapeHtml(t.priority)+' priority</small></div><small>'+formatDate(t.due)+'</small></label>').join(''):'<div class="muted">Nothing scheduled for today. Run Auto-plan.</div>';
 $$('[data-q]').forEach(x=>x.onchange=()=>{const t=state.tasks.find(t=>t.id===x.dataset.q);if(t){t.done=x.checked;save()}});
 const ds=state.deadlines.slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5);$('#deadlineList').innerHTML=ds.length?ds.map(deadlineMarkup).join(''):'<div class="muted">No deadlines yet. Add one and let Deadline Watch handle it.</div>';
 $('#automationFeed').innerHTML=state.automations.history.slice(0,4).map(h=>'<div class="feed-row"><span class="green-dot"></span><span>'+escapeHtml(h.type)+': '+escapeHtml(h.detail)+'</span><time>'+new Date(h.date).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+'</time></div>').join('')||'<div class="muted">No automation activity yet.</div>';
}
function deadlineMarkup(d){const days=daysAway(d.date);const urgent=days<=2;const label=days<0?'Overdue':days===0?'Today':days===1?'Tomorrow':formatDate(d.date);return '<div class="deadline '+(urgent?'urgent':'')+'"><div class="dicon">⌁</div><div><b>'+escapeHtml(d.title)+'</b><small>'+escapeHtml(d.kind)+'</small></div><strong>'+label+'</strong></div>'}
function renderSubjects(){
 $('#subjectList').innerHTML=state.subjects.length?state.subjects.map(s=>'<div class="subject"><span class="subject-dot" style="background:'+escapeHtml(s.color||'#6aa9ff')+'"></span><div><b>'+escapeHtml(s.name)+'</b><small>Priority '+s.weight+'</small></div><span class="weight">x'+s.weight+'</span></div>').join(''):'<div class="muted">Add your first subject.</div>';
 const sel=$('#focusSubject');sel.innerHTML=state.subjects.map(s=>'<option value="'+s.id+'">'+escapeHtml(s.name)+'</option>').join('');if(state.lastFocusSubject)sel.value=state.lastFocusSubject;
}
function generatePlan(){
 const mins=Math.max(15,+state.settings.dailyMinutes||90),subjects=[...state.subjects].sort((a,b)=>b.weight-a.weight);if(!subjects.length)return;
 state.tasks=state.tasks.filter(t=>!(t.source==='autoplan'&&t.due===today()));
 const urgent=state.deadlines.filter(d=>daysAway(d.date)<=3).map(d=>d.title);let remaining=mins;const plan=[];
 subjects.forEach((s,i)=>{if(remaining<=0)return;const slots=Math.max(15,Math.round((mins*(s.weight)/(subjects.reduce((a,x)=>a+x.weight,0)))/5)*5);const use=Math.min(remaining,slots);if(use>0){plan.push({id:uid(),subject:s.name,minutes:use,reason:i===0?'Priority block':urgent.length?'Deadline-aware':'Scheduled study'});remaining-=use}});
 state.lastPlan=plan;plan.forEach(p=>{state.tasks.push({id:uid(),title:p.subject+' · '+p.reason,category:'study',priority:'high',due:today(),done:false,source:'autoplan'})});logAutomation('Daily planner','Generated '+plan.length+' study blocks for '+mins+' minutes');save();toast('Today’s study plan generated')}
function renderStudy(){
 const completed=state.sessions.reduce((a,s)=>a+s.minutes,0),st=streak();$('#streakNumber').textContent=st;$('#streakText').textContent=st?'Keep the chain alive by finishing one focused block today.':'Complete a focus session to start your streak.';
 const plan=state.lastPlan||[];$('#studyPlan').innerHTML=plan.length?plan.map(p=>'<div class="plan-row"><span class="time">'+p.minutes+'m</span><div><b>'+escapeHtml(p.subject)+'</b><small>'+escapeHtml(p.reason)+'</small></div><button data-plan-start="'+escapeHtml(p.subject)+'">Start</button></div>').join(''):'<div class="muted">No generated plan yet. Run Generate study plan.</div>';$$('[data-plan-start]').forEach(b=>b.onclick=()=>{const s=state.subjects.find(x=>x.name===b.dataset.planStart);if(s){$('#focusSubject').value=s.id;go('study');}});
 const last7=[...Array(7)].map((_,i)=>addDays(today(),i-6));const vals=last7.map(d=>state.sessions.filter(s=>s.date===d).reduce((a,s)=>a+s.minutes,0));const max=Math.max(30,...vals);$('#weeklyBars').innerHTML=vals.map((v,i)=>'<div class="bar"><i style="height:'+Math.max(3,Math.round(v/max*100))+'%"></i><small>'+new Date(last7[i]+'T12:00:00').toLocaleDateString([], {weekday:'narrow'})+'</small></div>').join('');
}
let timerSeconds=1500,timerInterval=null,timerRunning=false,timerTotal=1500;
function paintTimer(){const m=Math.floor(timerSeconds/60),s=timerSeconds%60;$('#timer').textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');$('#timerBar').style.width=Math.max(0,Math.min(100,(1-timerSeconds/timerTotal)*100))+'%'}
function startTimer(){if(timerRunning)return;timerRunning=true;$('#timerToggle').textContent='Pause';$('#focusStatus').textContent='RUNNING';timerInterval=setInterval(()=>{timerSeconds--;paintTimer();if(timerSeconds<=0){finishSession()}},1000)}
function pauseTimer(){timerRunning=false;clearInterval(timerInterval);timerInterval=null;$('#timerToggle').textContent='Start';$('#focusStatus').textContent='PAUSED'}
function resetTimer(){pauseTimer();timerSeconds=timerTotal;$('#focusStatus').textContent='READY';paintTimer()}
function finishSession(){clearInterval(timerInterval);timerInterval=null;timerRunning=false;const s=state.subjects.find(x=>x.id===$('#focusSubject').value);const minutes=Math.round(timerTotal/60);state.sessions.push({id:uid(),subject:s?s.name:'General',minutes,date:today()});state.lastFocusSubject=s?s.id:null;logAutomation('Study logging','Logged '+minutes+' minutes for '+(s?s.name:'General'));if(state.automations.notifications)notify('Focus block complete','Your focused study session has been logged.');save();toast('Focus session complete — progress logged');timerTotal=1500;timerSeconds=1500;$('#focusStatus').textContent='DONE';paintTimer()}
$('#timerToggle').onclick=()=>timerRunning?pauseTimer():startTimer();$('#timerReset').onclick=resetTimer;$('#focusMode').onchange=e=>{timerTotal=(+e.target.value)*60;timerSeconds=timerTotal;resetTimer()};$('#focusSubject').onchange=e=>state.lastFocusSubject=e.target.value;

let activeFile='index.html';
function renderFileTree(){$('#fileTree').innerHTML=Object.keys(state.web.files).map(f=>'<button class="file-item '+(f===activeFile?'active':'')+'" data-file="'+escapeHtml(f)+'"><span>'+({ 'index.html':'🌐','styles.css':'◉','app.js':'JS','README.md':'#' }[f]||'•')+'</span>'+escapeHtml(f)+'</button>').join('');$$('[data-file]').forEach(b=>b.onclick=()=>openFile(b.dataset.file))}
function openFile(name){activeFile=name;$('#activeFileLabel').textContent=name;$('#codeEditor').value=state.web.files[name]||'';renderFileTree();paintCursor()}
function autosaveEditor(){state.web.files[activeFile]=$('#codeEditor').value;$('#editorSaved').textContent='Saving…';clearTimeout(window.__saveEditor);window.__saveEditor=setTimeout(()=>{localStorage.setItem(KEY,JSON.stringify(state));$('#editorSaved').textContent='Saved'},350)}
function paintCursor(){const pos=$('#codeEditor').selectionStart||0,text=$('#codeEditor').value.slice(0,pos);const lines=text.split('\n');$('#cursorInfo').textContent='Ln '+lines.length+' · Col '+(lines[lines.length-1].length+1)}
function runLab(){state.web.files[activeFile]=$('#codeEditor').value;const h=state.web.files['index.html']||'',c=state.web.files['styles.css']||'',j=state.web.files['app.js']||'';const doc='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+c+'</style></head><body>'+h+'<script>'+j.replaceAll('</script>','<\\/script>')+'<\\/script></body></html>';$('#previewFrame').srcdoc=doc;state.web.runs++;localStorage.setItem(KEY,JSON.stringify(state));$('#editorSaved').textContent='Saved';$('#labStat').textContent=state.web.runs;toast('Preview updated')}
$('#codeEditor').addEventListener('input',autosaveEditor);$('#codeEditor').addEventListener('click',paintCursor);$('#codeEditor').addEventListener('keyup',paintCursor);$('#codeEditor').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();runLab()}});
$('#runLabBtn').onclick=runLab;$('#refreshPreviewBtn').onclick=runLab;$('#openPreviewBtn').onclick=()=>window.open($('#previewFrame').srcdoc,'_blank');openFile(activeFile);
$('#newFileBtn').onclick=()=>{const name=prompt('New file name (example: about.html)');if(name&&!state.web.files[name]){state.web.files[name]='';activeFile=name;save();openFile(name);toast('File created')}};
$('#importFilesBtn').onclick=()=>$('#fileInput').click();$('#fileInput').onchange=async e=>{for(const f of e.target.files){state.web.files[f.name]=await f.text()}save();openFile(Object.keys(state.web.files)[0]);toast('Files imported')};
$('#downloadProjectBtn').onclick=()=>{const h=state.web.files['index.html']||'',c=state.web.files['styles.css']||'',j=state.web.files['app.js']||'';const doc='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Web Lab Project</title><style>'+c+'</style></head><body>'+h+'<script>'+j.replaceAll('</script>','<\\/script>')+'<\\/script></body></html>';downloadBlob(doc,'obaid-web-lab-project.html','text/html');logAutomation('Backup routine','Downloaded a standalone project build');save();toast('Project downloaded')};
$('#saveSnapshotBtn').onclick=()=>{state.web.snapshots.push({id:uid(),date:new Date().toISOString(),files:JSON.parse(JSON.stringify(state.web.files))});state.web.snapshots=state.web.snapshots.slice(-10);logAutomation('Backup routine','Saved Web Lab snapshot');save();toast('Snapshot saved')};
async function importBackupFile(file){const t=await file.text();try{const d=JSON.parse(t);if(d.web&&d.tasks){state=d;save();toast('Workspace restored')}else toast('That file is not a workspace backup')}catch{toast('Could not read backup')}}
function downloadBlob(text,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}

let currentTaskFilter='all';
function renderTasks(){let ts=state.tasks;const f=currentTaskFilter;if(f==='today')ts=ts.filter(t=>t.due===today());if(f==='study')ts=ts.filter(t=>t.category==='study');if(f==='project')ts=ts.filter(t=>t.category==='project'||t.category==='web');if(f==='done')ts=ts.filter(t=>t.done);$('#taskList').innerHTML=ts.length?ts.map(t=>'<div class="task-row '+(t.done?'done':'')+'"><input type="checkbox" data-task-check="'+t.id+'" '+(t.done?'checked':'')+'><div><b>'+escapeHtml(t.title)+'</b><small>'+escapeHtml(t.category)+' · '+formatDate(t.due)+'</small></div><span class="priority '+t.priority+'">'+t.priority+'</span><button class="text-btn" data-task-delete="'+t.id+'">×</button></div>').join(''):'<div class="muted">No tasks match this view.</div>';$$('[data-task-check]').forEach(x=>x.onchange=()=>{const t=state.tasks.find(t=>t.id===x.dataset.taskCheck);if(t){t.done=x.checked;save()}});$$('[data-task-delete]').forEach(x=>x.onclick=()=>{state.tasks=state.tasks.filter(t=>t.id!==x.dataset.taskDelete);save()});
 const ds=state.deadlines.slice().sort((a,b)=>a.date.localeCompare(b.date));$('#assignmentDeadlines').innerHTML=ds.length?ds.map(deadlineMarkup).join(''):'<div class="muted">No deadlines.</div>';
}
$$('[data-task-filter]').forEach(b=>b.onclick=()=>{$$('.filter').forEach(x=>x.classList.remove('active'));b.classList.add('active');currentTaskFilter=b.dataset.taskFilter;renderTasks()});
function createTask(data){state.tasks.unshift({...data,id:uid(),done:false});logAutomation('Smart capture','Created task: '+data.title);save();toast('Task created')}
$('#newTaskBtn').onclick=()=>$('#taskModal').showModal();$('#taskForm').onsubmit=e=>{e.preventDefault();createTask({title:$('#taskTitle').value.trim(),category:$('#taskCategory').value,priority:$('#taskPriority').value,due:$('#taskDue').value||today(),source:'manual'});e.target.reset();$('#taskModal').close()};$('#clearDone').onclick=()=>{state.tasks=state.tasks.filter(t=>!t.done);save();toast('Completed tasks cleared')};

function renderDeadlines(){const ds=state.deadlines.slice().sort((a,b)=>a.date.localeCompare(b.date));$('#deadlineList').innerHTML=ds.slice(0,5).map(deadlineMarkup).join('')||'<div class="muted">No deadlines yet.</div>';$('#assignmentDeadlines').innerHTML=ds.map(deadlineMarkup).join('')||'<div class="muted">No deadlines yet.</div>'}
function openDeadline(){if(!$('#deadlineDate').value)$('#deadlineDate').value=addDays(today(),3);$('#deadlineModal').showModal()}
$('#addDeadlineBtn').onclick=openDeadline;$('#assignmentDeadlineBtn').onclick=openDeadline;$('#deadlineForm').onsubmit=e=>{e.preventDefault();state.deadlines.push({id:uid(),title:$('#deadlineTitle').value.trim(),date:$('#deadlineDate').value,kind:$('#deadlineKind').value});logAutomation('Deadline watch','Added deadline: '+$('#deadlineTitle').value.trim());save();e.target.reset();$('#deadlineModal').close();toast('Deadline saved')};

function renderAnalytics(){
 const total=state.sessions.reduce((a,s)=>a+s.minutes,0),st=streak(),rate=taskStats().rate;$('#totalFocused').textContent=total+'m';$('#completionRate').textContent=rate+'%';$('#analyticsStreak').textContent=st+'d';$('#analyticsAutomation').textContent=state.automations.runs;
 const days=[...Array(7)].map((_,i)=>addDays(today(),i-6)),vals=days.map(d=>state.sessions.filter(s=>s.date===d).reduce((a,s)=>a+s.minutes,0)),max=Math.max(30,...vals);$('#activityChart').innerHTML=days.map((d,i)=>'<div class="activity-day"><div class="bar-wrap"><i style="height:'+Math.max(3,Math.round(vals[i]/max*100))+'%"></i></div><b>'+vals[i]+'m</b><small>'+new Date(d+'T12:00:00').toLocaleDateString([], {weekday:'short'})+'</small></div>').join('');
 const by={};state.sessions.forEach(s=>by[s.subject]=(by[s.subject]||0)+s.minutes);$('#subjectAnalytics').innerHTML=Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([n,v])=>'<div class="subject-stat"><div><b>'+escapeHtml(n)+'</b><span>'+Math.round(v/Math.max(1,total)*100)+'% of time</span></div><strong>'+v+'m</strong></div>').join('')||'<div class="muted">No study data yet.</div>';
}
$('#generateReviewBtn').onclick=()=>{const total=state.sessions.reduce((a,s)=>a+s.minutes,0),done=state.tasks.filter(t=>t.done).length,open=state.tasks.filter(t=>!t.done).length,st=streak();$('#weeklyReview').textContent='This workspace logged '+total+' focused minutes, completed '+done+' tasks, and currently has '+open+' open actions. Your current study streak is '+st+' day'+(st===1?'':'s')+'. Next week, keep the highest-priority subject visible and protect at least one deep-work block each day.';logAutomation('Weekly review','Generated a personal progress summary');save();toast('Weekly review generated')};
$('#exportReportBtn').onclick=()=>{const report={generated:new Date().toISOString(),profile:state.profile,stats:{focusedMinutes:state.sessions.reduce((a,s)=>a+s.minutes,0),completionRate:taskStats().rate,streak:streak(),automationRuns:state.automations.runs},tasks:state.tasks,deadlines:state.deadlines,sessions:state.sessions};downloadBlob(JSON.stringify(report,null,2),'obaid-web-lab-report.json','application/json');toast('Report exported')};

function renderNotes(){
 const q=($('#noteSearch').value||'').toLowerCase(),ns=state.notes.filter(n=>(n.title+' '+n.body+' '+n.type).toLowerCase().includes(q)).slice().reverse();$('#notesList').innerHTML=ns.length?ns.map(n=>'<div class="note-card" data-note-id="'+n.id+'"><b>'+escapeHtml(n.title||'Untitled note')+'</b><small>'+new Date(n.date).toLocaleString()+'</small><em>'+escapeHtml(n.type)+'</em></div>').join(''):'<div class="muted">No notes match.</div>';$$('[data-note-id]').forEach(b=>b.onclick=()=>loadNote(b.dataset.noteId))
}
function loadNote(id){const n=state.notes.find(x=>x.id===id);if(!n)return;$('#noteTitle').value=n.title;$('#noteBody').value=n.body;$('#noteType').value=n.type;$('#notesList').scrollIntoView({behavior:'smooth',block:'nearest'})}
$('#saveNoteBtn').onclick=()=>{const title=$('#noteTitle').value.trim(),body=$('#noteBody').value.trim();if(!body&&!title)return toast('Write something first');state.notes.push({id:uid(),title:title||'Untitled note',body,type:$('#noteType').value,date:new Date().toISOString()});logAutomation('Smart capture','Saved note: '+(title||'Untitled note'));save();$('#noteTitle').value='';$('#noteBody').value='';toast('Note saved')};$('#newNoteBtn').onclick=()=>{$('#noteTitle').value='';$('#noteBody').value='';go('notes');$('#noteTitle').focus()};$('#noteSearch').oninput=renderNotes;

function renderProjects(){$('#projectGrid').innerHTML=state.projects.map(p=>'<article class="project-card"><div class="project-top"><span class="pill">'+escapeHtml(p.status)+'</span><small>'+p.progress+'%</small></div><h3>'+escapeHtml(p.title)+'</h3><p>'+escapeHtml(p.description)+'</p><div class="project-tags">'+p.tags.map(t=>'<span>'+escapeHtml(t)+'</span>').join('')+'</div><div class="project-progress"><i style="width:'+p.progress+'%"></i></div></article>').join('')}
function renderPortfolio(){const target=$('#portfolioProjectPreview');if(!target)return;target.innerHTML=state.projects.slice(0,3).map(p=>'<article class="portfolio-project"><b>'+escapeHtml(p.title)+'</b><small>'+escapeHtml(p.description)+'</small></article>').join('')}
$('#portfolioCopyBio')?.addEventListener('click',async()=>{const bio="I’m Mohammed Obaidul Hoque, a student focused on web development, data analytics and digital marketing. I like turning ideas into practical, measurable digital products.";try{await navigator.clipboard.writeText(bio);toast('Portfolio intro copied')}catch{toast('Copy permission was blocked')}});
$('#newProjectBtn').onclick=()=>{const title=prompt('Project name');if(!title)return;state.projects.push({id:uid(),title,description:'New project created from Obaid Web Lab.',status:'Idea',progress:0,tags:['New']});logAutomation('Project capture','Created project: '+title);save();toast('Project created')};
function renderMarketing(){$('#contentLanes').innerHTML=state.content.map((x,i)=>'<div class="content-lane"><span>0'+(i+1)+'</span><div><strong>'+escapeHtml(x[0])+'</strong><small>'+escapeHtml(x[1])+'</small></div><b>'+escapeHtml(x[2])+'</b></div>').join('');$$('[data-check]').forEach(c=>{c.checked=!!state.check[c.dataset.check];c.onchange=()=>{state.check[c.dataset.check]=c.checked;save()}})}
$('#newCampaignBtn').onclick=()=>{createTask({title:'Draft next content campaign',category:'marketing',priority:'medium',due:today(),source:'campaign'});go('assignments')};

const resources=[
['&lt;/&gt;','MDN Web Docs','HTML, CSS, JavaScript reference','https://developer.mozilla.org/'],
['JS','JavaScript.info','Modern JavaScript lessons','https://javascript.info/'],
['DS','Kaggle Learn','Data analysis and ML learning','https://www.kaggle.com/learn'],
['GA','Google Analytics','Analytics learning and measurement','https://developers.google.com/analytics'],
['SEO','Search Console','Search performance and indexing','https://support.google.com/webmasters/'],
['CR','Canva Design School','Visual communication fundamentals','https://www.canva.com/designschool/'],
['GIT','GitHub Docs','Git, repositories and collaboration','https://docs.github.com/'],
['SQL','SQLBolt','Interactive SQL practice','https://sqlbolt.com/'],
['WEB','web.dev','Modern web performance and UX','https://web.dev/']
];
function renderResources(){$('#resourceGrid').innerHTML=resources.map(r=>'<a class="resource" href="'+r[3]+'" target="_blank" rel="noreferrer"><span class="resource-icon">'+r[0]+'</span><div><b>'+r[1]+'</b><small>'+r[2]+'</small></div><span>↗</span></a>').join('')}

function renderAutomation(){
 $$('[data-auto]').forEach(x=>{x.checked=!!state.automations[x.dataset.auto];x.onchange=()=>{state.automations[x.dataset.auto]=x.checked;save();toast(x.checked?'Automation enabled':'Automation disabled')}});
 $('#webhookUrl').value=state.settings.webhook||'';
 $('#automationHistory').innerHTML=state.automations.history.length?state.automations.history.map(h=>'<div class="history-row"><span>⚡</span><div><b>'+escapeHtml(h.type)+'</b><small>'+escapeHtml(h.detail)+'</small></div><small>'+new Date(h.date).toLocaleString()+'</small></div>').join(''):'<div class="muted">No history yet.</div>';
}
function runAutomation(type){
 if(type==='planner'){generatePlan();return}
 if(type==='deadlines'){const urgent=state.deadlines.filter(d=>daysAway(d.date)<=2);logAutomation('Deadline watch',urgent.length?urgent.length+' urgent deadline(s) found':'No urgent deadlines');save();toast(urgent.length?urgent.length+' urgent deadline(s)':'No urgent deadlines');return}
 if(type==='studyLog'){renderAnalytics();logAutomation('Study logging','Refreshed study analytics');save();toast('Study analytics refreshed');return}
 if(type==='capture'){$('#captureModal').showModal();return}
 if(type==='backup'){downloadBlob(JSON.stringify(state,null,2),'obaid-web-lab-backup-'+today()+'.json','application/json');logAutomation('Backup routine','Exported full workspace backup');save();toast('Backup downloaded');return}
 if(type==='notifications'){requestNotifications();return}
}
$$('[data-auto-run]').forEach(b=>b.onclick=()=>runAutomation(b.dataset.autoRun));
$('#runAllAutomationBtn').onclick=()=>{if(state.automations.planner)generatePlan();if(state.automations.deadlines){const u=state.deadlines.filter(d=>daysAway(d.date)<=2);logAutomation('Deadline watch',u.length+' urgent deadline(s) checked')}if(state.automations.studyLog)logAutomation('Study logging','Analytics sync completed');if(state.automations.backup)logAutomation('Backup routine','Workspace checked for backup readiness');save();toast('Automation sweep completed')};
$('#clearAutomationLog').onclick=()=>{state.automations.history=[];save();toast('Automation history cleared')};
$('#testWebhookBtn').onclick=async()=>{const url=$('#webhookUrl').value.trim();state.settings.webhook=url;if(!url)return toast('Enter a webhook URL first');try{const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'owl.test',timestamp:new Date().toISOString(),profile:state.profile.name})});logAutomation('Webhook','Test event sent ('+res.status+')');save();toast('Webhook test sent')}catch(e){toast('Webhook request failed — check CORS / endpoint')}};
function processCapture(){
 const raw=$('#captureInput').value.trim();if(!raw)return;
 const lower=raw.toLowerCase();let type='note',text=raw;
 if(lower.startsWith('/task')){type='task';text=raw.slice(5).trim()}
 else if(lower.startsWith('/idea')){type='idea';text=raw.slice(5).trim()}
 else if(lower.startsWith('/study')){type='study';text=raw.slice(6).trim()}
 else if(lower.startsWith('/note')){type='note';text=raw.slice(5).trim()}
 if(type==='task')createTask({title:text,category:'personal',priority:'medium',due:today(),source:'capture'});
 else {state.notes.push({id:uid(),title:type==='idea'?'Idea capture':type==='study'?'Study capture':'Quick capture',body:text,type:type==='idea'?'Idea':type==='study'?'Learning':'Note',date:new Date().toISOString()});logAutomation('Smart capture','Routed text into '+type);save();toast('Captured as '+type)}
 $('#captureInput').value='';$('#captureModal').close()
}
$('#processCaptureBtn').onclick=processCapture;$('#captureInput').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')processCapture()});

function requestNotifications(){if(!('Notification' in window))return toast('Notifications are not supported here');Notification.requestPermission().then(p=>{state.automations.notifications=p==='granted';logAutomation('Notifications',p==='granted'?'Browser notifications enabled':'Permission not granted');save();toast(p==='granted'?'Notifications enabled':'Permission not granted')})}
function notify(title,body){if('Notification' in window&&Notification.permission==='granted')new Notification(title,{body})}
function applyTheme(){document.documentElement.classList.toggle('light-theme',state.settings.theme==='light');$('#themeBtn').textContent=state.settings.theme==='light'?'☀':'☾'}
$('#themeBtn').onclick=()=>{state.settings.theme=state.settings.theme==='light'?'dark':'light';save();applyTheme()};

let deferredInstall=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e});
$('#installAppBtn').onclick=async()=>{if(deferredInstall){deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null}else toast('Install is available from the browser menu when supported')};

$('#autoPlanBtn').onclick=generatePlan;$('#studyAutoPlan').onclick=generatePlan;$('#studyAdjust').onclick=()=>{$('#settingsModal').showModal();$('#dailyMinutesSetting').focus()};
$('#addSubjectBtn').onclick=()=>$('#subjectModal').showModal();$('#subjectForm').onsubmit=e=>{e.preventDefault();const colors=['#6aa9ff','#53ddb0','#9b84ff','#f4c66e','#ff8799'];state.subjects.push({id:uid(),name:$('#subjectTitle').value.trim(),weight:Math.max(1,Math.min(10,+$('#subjectTarget').value||3)),color:colors[state.subjects.length%colors.length]});save();$('#subjectModal').close();e.target.reset();toast('Subject added')};

$('#settingsBtn').onclick=()=>$('#settingsModal').showModal();$('#profileBtn').onclick=()=>$('#profileModal').showModal();
$('#displayNameSetting').oninput=e=>{state.profile.name=e.target.value;$('#profileName').textContent=e.target.value;localStorage.setItem(KEY,JSON.stringify(state))};
$('#dailyMinutesSetting').oninput=e=>{state.settings.dailyMinutes=+e.target.value||90;localStorage.setItem(KEY,JSON.stringify(state))};
$('#themeSetting').onchange=e=>{state.settings.theme=e.target.value;save();applyTheme()};
$('#resetWorkspaceBtn').onclick=()=>{if(confirm('Reset all Obaid Web Lab data in this browser?')){localStorage.removeItem(KEY);location.reload()}};

$('#settingsModal').addEventListener('close',()=>{state.settings.webhook=$('#webhookUrl').value;save()});
$$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());
$('#addDeadlineBtn').onclick=openDeadline;
$('#captureBtn').onclick=()=>$('#captureModal').showModal();

const cmdData=Object.entries(views);
function renderCommand(q=''){const items=cmdData.filter(([id,n])=>n.toLowerCase().includes(q.toLowerCase()));$('#commandResults').innerHTML=items.map(([id,n])=>'<button class="command-result" data-cmd="'+id+'">'+n+'</button>').join('');$$('[data-cmd]').forEach(b=>b.onclick=()=>{$('#commandModal').close();go(b.dataset.cmd)})}
$('#commandBtn').onclick=()=>{$('#commandModal').showModal();$('#commandSearch').value='';renderCommand();$('#commandSearch').focus()};$('#commandSearch').oninput=e=>renderCommand(e.target.value);
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#commandModal').showModal();renderCommand();$('#commandSearch').focus()}if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&$('#view-lab').classList.contains('active')){e.preventDefault();runLab()}});
$('#openPreviewBtn').onclick=()=>window.open($('#previewFrame').srcdoc,'_blank');

function renderAll(){renderHome();renderSubjects();renderStudy();renderTasks();renderDeadlines();renderAnalytics();renderNotes();renderProjects();renderMarketing();renderResources();renderAutomation();if(window.renderClassVault)window.renderClassVault();if(window.renderPortfolio)window.renderPortfolio();$('#profileName').textContent=state.profile.name;$('#displayNameSetting').value=state.profile.name;$('#dailyMinutesSetting').value=state.settings.dailyMinutes;$('#themeSetting').value=state.settings.theme;applyTheme()}
setInterval(()=>{renderHome();renderDeadlines()},30000);
renderAll();runLab();
function scheduledAutomationTick(){const d=today();if(state.automations.planner&&state.automations.lastDailyRun!==d){generatePlan();state.automations.lastDailyRun=d;localStorage.setItem(KEY,JSON.stringify(state));toast('Daily automation prepared your study plan')}else if(state.automations.deadlines){const urgent=state.deadlines.filter(x=>daysAway(x.date)<=2);if(urgent.length&&state.automations.history[0]?.type!=='Deadline watch'){logAutomation('Deadline watch',urgent.length+' urgent deadline(s) found');localStorage.setItem(KEY,JSON.stringify(state))}}}
scheduledAutomationTick();
const hash=location.hash.slice(1);if(views[hash])go(hash);
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').catch(()=>{})}
