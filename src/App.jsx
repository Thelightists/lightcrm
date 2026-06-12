import { useState, useMemo, useEffect, useCallback } from "react";

// ─── Google Sheets Config ─────────────────────────────────────────────────────
const SHEET_ID = "1DrZGKl5UPaMhLfrguKXi1AWpSeuZ5EhH9UhhX-0JYbg";
const API_KEY  = "AIzaSyAGXjD-SpkHtw0gtVjYEKDzrI5ZPltpHv8";
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzLLEr_RHYZluJyRId-Rir8W_j6nLf8GaW9bRoPl-s881bKkRgxsNM-JUmB09XojjKp/exec";

// Read a sheet tab → array of row arrays
async function readSheet(tabName) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(tabName)}?key=${API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.values || [];
}

// Write entire tab (array of row arrays)
async function writeSheet(tabName, rows) {
  await fetch(SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({ action: "write", sheet: tabName, rows }),
  });
}

// ─── Serialisation helpers ────────────────────────────────────────────────────
// Each entity is stored as ONE row with JSON in column B, ID in column A
const toRows  = (items) => items.map(item => [item.id, JSON.stringify(item)]);
const fromRows = (rows) => rows.map(r => { try { return JSON.parse(r[1]); } catch { return null; } }).filter(Boolean);

// ─── Passwords ────────────────────────────────────────────────────────────────
const PASSWORDS = {
  1: "Lx#9mK2w", 2: "Qr$7vN4p", 3: "Tz!3bJ8s", 4: "Wc@6hY1n",
  5: "Pk&5dF3e", 6: "Ry#2xM7q", 7: "Hs!8kL4z", 8: "Nb$1wC9j",
  9: "Gf@4tR6u", 10: "Vm&7aE2i", 11: "Jd#5nB0y"
};

// ─── Static team (not stored in sheets — passwords kept local) ────────────────
const TEAM = [
  { id: 1,  name: "Aman",    designation: "Director",                  role: "director",    initials: "AM", color: "#1a1a2e" },
  { id: 2,  name: "Mohini",  designation: "Operations",                role: "operations",  initials: "MO", color: "#16213e" },
  { id: 3,  name: "Ajay",    designation: "Project Coordinator",       role: "coordinator", initials: "AJ", color: "#0f3460" },
  { id: 4,  name: "Aatray",  designation: "Sales",                     role: "sales",       initials: "AA", color: "#533483" },
  { id: 5,  name: "Ram",     designation: "Accounts",                  role: "accounts",    initials: "RA", color: "#2d6a4f" },
  { id: 6,  name: "Chaitra", designation: "Design Team",               role: "design",      initials: "CH", color: "#b5446e" },
  { id: 7,  name: "Manisha", designation: "Design Team",               role: "design",      initials: "MA", color: "#c17c74" },
  { id: 8,  name: "Sheetal", designation: "Design Team",               role: "design",      initials: "SH", color: "#8b5e3c" },
  { id: 9,  name: "Rahul",   designation: "Design Team",               role: "design",      initials: "RH", color: "#4a7c59" },
  { id: 10, name: "Tarana",  designation: "Design Team",               role: "design",      initials: "TA", color: "#7b6d8d" },
  { id: 11, name: "Shivam",  designation: "Admin & Asset Management",  role: "admin",       initials: "SV", color: "#3d5a80" },
];

const STAGES = [
  "Lead","Meeting Done","Design Started","Quotation Requested from Supplier",
  "Quotation Sent","Order Confirmed","Fixtures Ordered","In Transit",
  "Delivered","Installation","Closed"
];

const today    = () => new Date().toISOString().split("T")[0];
const addDays  = (d, n) => { const dt = new Date(d); dt.setDate(dt.getDate() + n); return dt.toISOString().split("T")[0]; };
const uid      = (prefix) => `${prefix}${Date.now()}`;
const getMember     = (id, team) => team.find(m => m.id === id);
const isOverdue     = (date) => date && new Date(date) < new Date(today());
const daysDiff      = (date) => Math.floor((new Date(today()) - new Date(date)) / 86400000);
const currencySymbol = { INR: "₹", EUR: "€", USD: "$", GBP: "£" };
const canSeePayments = (user) => user && ["director","operations","accounts"].includes(user.role);

// ─── Shared UI components ─────────────────────────────────────────────────────
const Avatar = ({ member, size = 28 }) => {
  if (!member) return null;
  return (
    <span title={member.name} style={{
      display:"inline-flex",alignItems:"center",justifyContent:"center",
      width:size,height:size,borderRadius:"50%",background:member.color,color:"#fff",
      fontSize:size*0.38,fontWeight:700,letterSpacing:"-0.5px",flexShrink:0,fontFamily:"inherit"
    }}>{member.initials}</span>
  );
};

const Badge = ({ label, color }) => (
  <span style={{display:"inline-block",padding:"2px 8px",borderRadius:4,fontSize:11,fontWeight:600,
    background:color+"22",color,border:`1px solid ${color}44`,whiteSpace:"nowrap"}}>{label}</span>
);

const StageIndex = ({ stage }) => {
  const idx = STAGES.indexOf(stage);
  const pct = ((idx+1)/STAGES.length)*100;
  const color = idx>=10?"#2d6a4f":idx>=7?"#0f3460":idx>=4?"#533483":"#b5446e";
  return (
    <div style={{display:"flex",flexDirection:"column",gap:3}}>
      <span style={{fontSize:11,color,fontWeight:700}}>{stage}</span>
      <div style={{height:4,background:"#e8e8e8",borderRadius:2,width:100}}>
        <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:2,transition:"width .3s"}}/>
      </div>
    </div>
  );
};

const Spinner = ({ text = "Saving…" }) => (
  <span style={{fontSize:11,color:"#c9a84c",display:"inline-flex",alignItems:"center",gap:5}}>
    <span style={{display:"inline-block",width:10,height:10,border:"2px solid #c9a84c44",
      borderTop:"2px solid #c9a84c",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/>
    {text}
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </span>
);

const NotesPanel = ({ comments=[], onAdd, currentUser, label="Comments & Notes" }) => {
  const [text, setText] = useState("");
  return (
    <div style={{marginTop:10}}>
      <div style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:6}}>{label}</div>
      {comments.map((c,i) => (
        <div key={i} style={{background:"#f8f8f8",borderRadius:6,padding:"7px 10px",marginBottom:6,fontSize:12}}>
          <span style={{fontWeight:700,color:"#1a1a2e"}}>{c.by}</span>
          <span style={{color:"#aaa",marginLeft:6,fontSize:10}}>{c.date}</span>
          <div style={{marginTop:3,color:"#444"}}>{c.text}</div>
        </div>
      ))}
      <div style={{display:"flex",gap:6}}>
        <input value={text} onChange={e=>setText(e.target.value)} placeholder="Add a note…"
          style={{flex:1,border:"1px solid #ddd",borderRadius:6,padding:"6px 10px",fontSize:12,fontFamily:"inherit"}}
          onKeyDown={e=>{if(e.key==="Enter"&&text.trim()){onAdd(text);setText("");}}}/>
        <button onClick={()=>{if(text.trim()){onAdd(text);setText("");}}}
          style={{background:"#1a1a2e",color:"#fff",border:"none",borderRadius:6,padding:"0 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Add</button>
      </div>
    </div>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function LightCRM() {
  const [currentUser, setCurrentUser] = useState(null);
  const [tab, setTab]         = useState("dashboard");
  const [projects, setProjectsRaw]   = useState([]);
  const [leads, setLeadsRaw]         = useState([]);
  const [tasks, setTasksRaw]         = useState([]);
  const [quotations, setQuotationsRaw] = useState([]);
  const [orders, setOrdersRaw]       = useState([]);
  const [payments, setPaymentsRaw]   = useState([]);
  const [loading, setLoading]        = useState(true);
  const [saving, setSaving]          = useState("");
  const [drawerProject, setDrawerProject] = useState(null);
  const [alertsDismissed, setAlertsDismissed] = useState(false);
  const [modal, setModal]            = useState(null);
  const [lastSync, setLastSync]      = useState(null);

  // ── Load all data from Sheets on mount & every 60s ──
  const loadAll = useCallback(async () => {
    try {
      const [pRows, lRows, tRows, qRows, oRows, payRows] = await Promise.all([
        readSheet("Projects"), readSheet("Leads"), readSheet("Tasks"),
        readSheet("Quotations"), readSheet("Orders"), readSheet("Payments"),
      ]);
      if (pRows.length)   setProjectsRaw(fromRows(pRows));
      if (lRows.length)   setLeadsRaw(fromRows(lRows));
      if (tRows.length)   setTasksRaw(fromRows(tRows));
      if (qRows.length)   setQuotationsRaw(fromRows(qRows));
      if (oRows.length)   setOrdersRaw(fromRows(oRows));
      if (payRows.length) setPaymentsRaw(fromRows(payRows));
      setLastSync(new Date().toLocaleTimeString());
    } catch(e) { console.error("Load error", e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); const t = setInterval(loadAll, 60000); return () => clearInterval(t); }, [loadAll]);

  // ── Persist helpers — update state + write to sheet ──
  const persist = async (setter, sheetName, updater, savingLabel) => {
    setSaving(savingLabel);
    setter(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      writeSheet(sheetName, toRows(next)).finally(() => setSaving(""));
      return next;
    });
  };

  const setProjects   = (u) => persist(setProjectsRaw,   "Projects",   u, "Saving project…");
  const setLeads      = (u) => persist(setLeadsRaw,      "Leads",      u, "Saving lead…");
  const setTasks      = (u) => persist(setTasksRaw,      "Tasks",      u, "Saving task…");
  const setQuotations = (u) => persist(setQuotationsRaw, "Quotations", u, "Saving quotation…");
  const setOrders     = (u) => persist(setOrdersRaw,     "Orders",     u, "Saving order…");
  const setPayments   = (u) => persist(setPaymentsRaw,   "Payments",   u, "Saving payment…");

  // ── Alerts ──
  const alerts = useMemo(() => {
    const a = [];
    projects.forEach(p => {
      if (p.stage==="Quotation Sent" && daysDiff(p.lastUpdated)>=15)
        a.push({type:"red",msg:`Quotation overdue — ${p.client} (sent ${daysDiff(p.lastUpdated)}d ago)`});
      if (p.stage==="In Transit" && daysDiff(p.lastUpdated)>=30)
        a.push({type:"red",msg:`Delivery overdue — ${p.client} (in transit ${daysDiff(p.lastUpdated)}d ago)`});
      if (p.followUpDate && isOverdue(p.followUpDate) && p.stage!=="Closed")
        a.push({type:"amber",msg:`Follow-up due — ${p.client} (${p.stage})`});
    });
    tasks.forEach(t => {
      if (t.status!=="Done" && isOverdue(t.dueDate))
        a.push({type:"red",msg:`Task overdue — "${t.title}" → ${getMember(t.assignedTo,TEAM)?.name}`});
    });
    return a;
  }, [projects, tasks]);

  const canAdmin = currentUser && (currentUser.role==="director"||currentUser.role==="operations");

  if (!currentUser) return <LoginScreen onLogin={setCurrentUser}/>;

  if (loading) return (
    <div style={{minHeight:"100vh",background:"#1a1a2e",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",gap:16,color:"#fff"}}>
      <div style={{fontSize:22,fontWeight:800}}>The Lightists <span style={{color:"#c9a84c",fontSize:13,letterSpacing:2}}>CRM</span></div>
      <Spinner text="Loading data from Google Sheets…"/>
    </div>
  );

  const activeLeads      = leads.length;
  const overdueFollowups = leads.filter(l=>isOverdue(l.followUpDate)).length + projects.filter(p=>p.followUpDate&&isOverdue(p.followUpDate)).length;
  const inTransit        = projects.filter(p=>p.stage==="In Transit").length;
  const pendingPayments  = payments.reduce((a,p)=>a+p.subPayments.filter(s=>s.status==="Pending").length, 0);

  const tabs = [
    {id:"dashboard",label:"Dashboard"},
    {id:"projects",label:"Projects"},
    {id:"leads",label:"Leads & Contacts"},
    {id:"quotations",label:"Quotations"},
    {id:"orders",label:"Orders"},
    ...(canSeePayments(currentUser)?[{id:"payments",label:"Payments"}]:[]),
    {id:"delivery",label:"Delivery & Install"},
    {id:"tasks",label:"Tasks"},
    ...(canAdmin?[{id:"team",label:"Team"}]:[]),
  ];

  return (
    <div style={{fontFamily:"'Inter',system-ui,sans-serif",minHeight:"100vh",background:"#f5f5f7",color:"#1a1a2e"}}>
      {/* Top bar */}
      <div style={{background:"#1a1a2e",padding:"0 20px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{display:"flex",alignItems:"baseline",gap:7}}>
            <span style={{color:"#fff",fontWeight:800,fontSize:17,letterSpacing:"-0.4px"}}>The Lightists</span>
            <span style={{color:"#c9a84c",fontWeight:500,fontSize:11,letterSpacing:"2px",textTransform:"uppercase"}}>CRM</span>
          </div>
          <span style={{color:"#c9a84c",fontSize:10,fontWeight:600,background:"#c9a84c22",border:"1px solid #c9a84c44",borderRadius:4,padding:"1px 6px"}}>Phase 2 · Live</span>
          {saving && <Spinner text={saving}/>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {lastSync && <span style={{color:"#555",fontSize:10}}>Synced {lastSync}</span>}
          <button onClick={loadAll} title="Refresh" style={{background:"none",border:"1px solid #333",color:"#888",borderRadius:5,padding:"2px 8px",fontSize:11,cursor:"pointer"}}>↺</button>
          {alerts.length>0 && <div style={{background:"#c0392b22",border:"1px solid #c0392b55",borderRadius:6,padding:"2px 8px",color:"#e74c3c",fontSize:12,fontWeight:700}}>⚠ {alerts.length} alerts</div>}
          <Avatar member={currentUser} size={30}/>
          <span style={{color:"#ccc",fontSize:13}}>{currentUser.name}</span>
          <button onClick={()=>setCurrentUser(null)} style={{background:"none",border:"1px solid #444",color:"#aaa",borderRadius:5,padding:"3px 10px",fontSize:11,cursor:"pointer"}}>Switch</button>
        </div>
      </div>

      {/* Nav */}
      <div style={{background:"#fff",borderBottom:"1px solid #e0e0e0",overflowX:"auto",display:"flex",padding:"0 16px"}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            background:"none",border:"none",cursor:"pointer",padding:"12px 14px",
            fontWeight:tab===t.id?700:400,fontSize:13,
            color:tab===t.id?"#1a1a2e":"#666",
            borderBottom:tab===t.id?"2px solid #c9a84c":"2px solid transparent",
            whiteSpace:"nowrap",fontFamily:"inherit"
          }}>{t.label}</button>
        ))}
      </div>

      {/* Alerts bar */}
      {alerts.length>0&&!alertsDismissed&&(
        <div style={{background:"#fff3cd",borderBottom:"1px solid #ffc107",padding:"8px 20px",display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
          {alerts.slice(0,3).map((a,i)=>(
            <span key={i} style={{fontSize:12,color:a.type==="red"?"#c0392b":"#856404",fontWeight:600}}>
              {a.type==="red"?"🔴":"🟡"} {a.msg}
            </span>
          ))}
          {alerts.length>3&&<span style={{fontSize:12,color:"#666"}}>+{alerts.length-3} more</span>}
          <button onClick={()=>setAlertsDismissed(true)} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#888"}}>✕</button>
        </div>
      )}

      {/* Content */}
      <div style={{padding:"20px",maxWidth:1200,margin:"0 auto"}}>
        {tab==="dashboard"  && <Dashboard projects={projects} leads={leads} tasks={tasks} alerts={alerts} activeLeads={activeLeads} overdueFollowups={overdueFollowups} inTransit={inTransit} pendingPayments={pendingPayments} setDrawerProject={setDrawerProject} setTab={setTab} currentUser={currentUser} onCompleteTask={id=>setTasks(ts=>ts.map(t=>t.id===id?{...t,status:"Done"}:t))}/>}
        {tab==="projects"   && <ProjectsTab projects={projects} setDrawerProject={setDrawerProject} currentUser={currentUser} setModal={setModal} setProjects={setProjects}/>}
        {tab==="leads"      && <LeadsTab leads={leads} currentUser={currentUser} setModal={setModal} setLeads={setLeads}/>}
        {tab==="quotations" && <QuotationsTab quotations={quotations} projects={projects} setQuotations={setQuotations}/>}
        {tab==="orders"     && <OrdersTab orders={orders} projects={projects} setOrders={setOrders}/>}
        {tab==="payments"   && canSeePayments(currentUser) && <PaymentsTab payments={payments} orders={orders} setPayments={setPayments} currentUser={currentUser}/>}
        {tab==="delivery"   && <DeliveryTab projects={projects}/>}
        {tab==="tasks"      && <TasksTab tasks={tasks} projects={projects} currentUser={currentUser} setTasks={setTasks} setModal={setModal}/>}
        {tab==="team"       && canAdmin && <TeamTab currentUser={currentUser}/>}
      </div>

      {/* Project drawer */}
      {drawerProject&&(
        <ProjectDrawer
          project={projects.find(p=>p.id===drawerProject)}
          tasks={tasks} currentUser={currentUser}
          onClose={()=>setDrawerProject(null)}
          onAdvanceStage={(pid,comment)=>setProjects(ps=>ps.map(p=>{
            if(p.id!==pid)return p;
            const ni=STAGES.indexOf(p.stage)+1;
            if(ni>=STAGES.length)return p;
            const ns=STAGES[ni];
            return{...p,stage:ns,lastUpdated:today(),
              stageHistory:[...p.stageHistory,{stage:ns,date:today(),by:currentUser.name}],
              comments:[...p.comments,{by:currentUser.name,date:today(),text:comment}]};
          }))}
          onAddComment={(pid,text)=>setProjects(ps=>ps.map(p=>p.id!==pid?p:{...p,comments:[...p.comments,{by:currentUser.name,date:today(),text}]}))}
          onUpdateDriveLink={(pid,link)=>setProjects(ps=>ps.map(p=>p.id!==pid?p:{...p,driveLink:link}))}
        />
      )}

      {/* Modal */}
      {modal&&(
        <Modal modal={modal} projects={projects} currentUser={currentUser} onClose={()=>setModal(null)}
          onSaveTask={task=>{setTasks(ts=>[...ts,{...task,id:uid("T")}]);setModal(null);}}
          onSaveProject={proj=>{setProjects(ps=>[...ps,{...proj,id:uid("P"),stageHistory:[{stage:"Lead",date:today(),by:currentUser.name}],comments:[],driveLink:"",lastUpdated:today()}]);setModal(null);}}
          onSaveLead={lead=>{setLeads(ls=>[...ls,{...lead,id:uid("L"),comments:[]}]);setModal(null);}}
        />
      )}
    </div>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [selected, setSelected] = useState(null);
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");

  const handleLogin = () => {
    if (!selected) return;
    if (password === PASSWORDS[selected.id]) { setError(""); onLogin(selected); }
    else setError("Incorrect password. Try again.");
  };

  return (
    <div style={{minHeight:"100vh",background:"#1a1a2e",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:24}}>
      <div style={{textAlign:"center"}}>
        <h1 style={{color:"#fff",margin:0,fontSize:30,fontWeight:800,letterSpacing:"-0.5px"}}>The Lightists</h1>
        <p style={{color:"#c9a84c",margin:"8px 0 0",fontSize:11,letterSpacing:"3px",textTransform:"uppercase",fontWeight:500}}>CRM</p>
      </div>
      <div style={{background:"#ffffff0f",border:"1px solid #ffffff1a",borderRadius:14,padding:24,width:360}}>
        {!selected?(
          <>
            <p style={{color:"#aaa",margin:"0 0 14px",fontSize:13,textAlign:"center"}}>Select your name to continue</p>
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {TEAM.map(m=>(
                <button key={m.id} onClick={()=>{setSelected(m);setPassword("");setError("");}} style={{
                  display:"flex",alignItems:"center",gap:12,background:"#ffffff08",
                  border:"1px solid #ffffff15",borderRadius:8,padding:"10px 14px",
                  cursor:"pointer",color:"#fff",fontFamily:"inherit",textAlign:"left"}}>
                  <Avatar member={m} size={32}/>
                  <div>
                    <div style={{fontWeight:700,fontSize:14}}>{m.name}</div>
                    <div style={{fontSize:11,color:"#888"}}>{m.designation}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <Avatar member={selected} size={36}/>
              <div>
                <div style={{color:"#fff",fontWeight:700,fontSize:15}}>{selected.name}</div>
                <div style={{color:"#888",fontSize:11}}>{selected.designation}</div>
              </div>
              <button onClick={()=>setSelected(null)} style={{marginLeft:"auto",background:"none",border:"none",color:"#666",cursor:"pointer",fontSize:18}}>✕</button>
            </div>
            <input type="password" value={password} placeholder="Enter your password"
              onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} autoFocus
              style={{width:"100%",background:"#ffffff10",border:"1px solid #ffffff25",borderRadius:8,
                padding:"10px 14px",color:"#fff",fontSize:14,fontFamily:"inherit",boxSizing:"border-box",outline:"none"}}/>
            {error&&<div style={{color:"#e74c3c",fontSize:12}}>{error}</div>}
            <button onClick={handleLogin} style={{background:"linear-gradient(135deg,#c9a84c,#e8c96f)",border:"none",borderRadius:8,
              padding:"11px",fontSize:14,fontWeight:700,cursor:"pointer",color:"#1a1a2e",fontFamily:"inherit"}}>Login →</button>
          </div>
        )}
      </div>
      <p style={{color:"#333",fontSize:11}}>Phase 2 · Live · Contact Mohini for your password</p>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({projects,leads,tasks,alerts,activeLeads,overdueFollowups,inTransit,pendingPayments,setDrawerProject,setTab,currentUser,onCompleteTask}){
  const todayTasks=tasks.filter(t=>t.status!=="Done");
  const pipeline=projects.filter(p=>p.stage!=="Closed");
  const StatCard=({label,value,sub,color})=>(
    <div style={{background:"#fff",borderRadius:10,padding:"16px 20px",flex:1,minWidth:130,borderLeft:`4px solid ${color}`}}>
      <div style={{fontSize:26,fontWeight:800,color}}>{value}</div>
      <div style={{fontSize:13,fontWeight:700,color:"#333",marginTop:2}}>{label}</div>
      {sub&&<div style={{fontSize:11,color:"#888",marginTop:2}}>{sub}</div>}
    </div>
  );
  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
        <StatCard label="Active Leads" value={activeLeads} color="#533483"/>
        <StatCard label="Overdue Follow-ups" value={overdueFollowups} color="#c0392b" sub="Need attention"/>
        <StatCard label="Orders in Transit" value={inTransit} color="#0f3460" sub="Awaiting delivery"/>
        <StatCard label="Payments Pending" value={pendingPayments} color="#2d6a4f" sub="SWIFT to initiate"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div style={{background:"#fff",borderRadius:10,padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <h3 style={{margin:0,fontSize:14,fontWeight:700}}>Today's Tasks</h3>
            <button onClick={()=>setTab("tasks")} style={{background:"none",border:"none",color:"#c9a84c",cursor:"pointer",fontSize:12,fontWeight:600}}>View all →</button>
          </div>
          {todayTasks.length===0&&<p style={{color:"#888",fontSize:13}}>All tasks done! 🎉</p>}
          {todayTasks.map(t=>{
            const m=getMember(t.assignedTo,TEAM);const overdue=isOverdue(t.dueDate);
            return(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #f0f0f0"}}>
                <button onClick={()=>onCompleteTask(t.id)} style={{width:18,height:18,borderRadius:4,border:"2px solid #ddd",background:"none",cursor:"pointer",flexShrink:0}}/>
                <Avatar member={m} size={24}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:overdue?"#c0392b":"#1a1a2e",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.title}</div>
                  <div style={{fontSize:10,color:"#888"}}>{m?.name} · {overdue?<span style={{color:"#c0392b"}}>Overdue</span>:`Due ${t.dueDate}`}</div>
                </div>
                {overdue&&<span style={{fontSize:10}}>🔴</span>}
              </div>
            );
          })}
        </div>
        <div style={{background:"#fff",borderRadius:10,padding:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <h3 style={{margin:0,fontSize:14,fontWeight:700}}>Pipeline Snapshot</h3>
            <button onClick={()=>setTab("projects")} style={{background:"none",border:"none",color:"#c9a84c",cursor:"pointer",fontSize:12,fontWeight:600}}>View all →</button>
          </div>
          {pipeline.map(p=>{
            const members=p.assignedTo.map(id=>getMember(id,TEAM));
            const overdue=(p.stage==="Quotation Sent"&&daysDiff(p.lastUpdated)>=15)||(p.stage==="In Transit"&&daysDiff(p.lastUpdated)>=30);
            return(
              <div key={p.id} onClick={()=>setDrawerProject(p.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #f0f0f0",cursor:"pointer"}}>
                {overdue?<span style={{fontSize:10}}>🔴</span>:p.followUpDate&&isOverdue(p.followUpDate)?<span style={{fontSize:10}}>🟡</span>:<span style={{width:14}}/>}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.client}</div>
                  <StageIndex stage={p.stage}/>
                </div>
                <div style={{display:"flex"}}>{members.slice(0,2).map(m=>m&&<Avatar key={m.id} member={m} size={22}/>)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Projects ─────────────────────────────────────────────────────────────────
function ProjectsTab({projects,setDrawerProject,currentUser,setModal}){
  const [filter,setFilter]=useState("all");
  const filtered=filter==="all"?projects:projects.filter(p=>p.stage===filter);
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <select value={filter} onChange={e=>setFilter(e.target.value)} style={{border:"1px solid #ddd",borderRadius:6,padding:"6px 10px",fontSize:13,fontFamily:"inherit"}}>
          <option value="all">All Stages</option>
          {STAGES.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={()=>setModal({type:"newProject"})} style={{background:"#1a1a2e",color:"#fff",border:"none",borderRadius:7,padding:"8px 16px",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>+ New Project</button>
      </div>
      <div style={{background:"#fff",borderRadius:10,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{background:"#f8f8f8",borderBottom:"1px solid #e8e8e8"}}>
            {["Client","Stage","Value","Drive","Assigned To","Last Updated","Follow-up"].map(h=>(
              <th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:700,color:"#555",fontSize:11,textTransform:"uppercase",letterSpacing:"0.5px"}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map(p=>{
              const overdue=isOverdue(p.followUpDate);
              return(
                <tr key={p.id} style={{borderBottom:"1px solid #f0f0f0"}}
                  onMouseEnter={e=>e.currentTarget.style.background="#fafafa"}
                  onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <td onClick={()=>setDrawerProject(p.id)} style={{padding:"12px 14px",fontWeight:700,cursor:"pointer"}}>{p.client}<div style={{fontSize:10,color:"#888",fontWeight:400}}>{p.id}</div></td>
                  <td onClick={()=>setDrawerProject(p.id)} style={{padding:"12px 14px",cursor:"pointer"}}><StageIndex stage={p.stage}/></td>
                  <td onClick={()=>setDrawerProject(p.id)} style={{padding:"12px 14px",fontWeight:600,cursor:"pointer"}}>{p.value}</td>
                  <td style={{padding:"12px 14px"}}>
                    {p.driveLink?<a href={p.driveLink} target="_blank" rel="noreferrer" style={{color:"#0f3460",fontSize:12,textDecoration:"none",fontWeight:600}} onClick={e=>e.stopPropagation()}>📁 Open</a>:<span style={{color:"#ccc",fontSize:11}}>—</span>}
                  </td>
                  <td onClick={()=>setDrawerProject(p.id)} style={{padding:"12px 14px",cursor:"pointer"}}>
                    <div style={{display:"flex",gap:4}}>{p.assignedTo.map(id=>{const m=getMember(id,TEAM);return m?<Avatar key={id} member={m} size={24}/>:null;})}</div>
                  </td>
                  <td onClick={()=>setDrawerProject(p.id)} style={{padding:"12px 14px",color:"#666",cursor:"pointer"}}>{p.lastUpdated}</td>
                  <td style={{padding:"12px 14px"}}>{p.followUpDate?<span style={{color:overdue?"#c0392b":"#2d6a4f",fontWeight:600}}>{overdue?"🔴 ":""}{p.followUpDate}</span>:<span style={{color:"#ccc"}}>—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Leads ────────────────────────────────────────────────────────────────────
function LeadsTab({leads,currentUser,setModal,setLeads}){
  const [expanded,setExpanded]=useState(null);
  const [editing,setEditing]=useState({});
  const inputS={border:"1px solid #ddd",borderRadius:5,padding:"4px 8px",fontSize:12,fontFamily:"inherit",width:"100%"};
  const updateLead=(id,patch)=>setLeads(ls=>ls.map(l=>l.id===id?{...l,...patch}:l));
  const addComment=(id,text)=>setLeads(ls=>ls.map(l=>l.id===id?{...l,comments:[...(l.comments||[]),{by:currentUser.name,date:today(),text}]}:l));
  return(
    <div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:16}}>
        <button onClick={()=>setModal({type:"newLead"})} style={{background:"#1a1a2e",color:"#fff",border:"none",borderRadius:7,padding:"8px 16px",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>+ New Lead</button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {leads.map(l=>{
          const m=getMember(l.assignedTo,TEAM);const overdue=isOverdue(l.followUpDate);const isOpen=expanded===l.id;const ed=editing[l.id]||{};
          return(
            <div key={l.id} style={{background:"#fff",borderRadius:10,overflow:"hidden",border:isOpen?"1px solid #c9a84c55":"1px solid #f0f0f0"}}>
              <div onClick={()=>setExpanded(isOpen?null:l.id)} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",cursor:"pointer"}}>
                <Avatar member={m} size={30}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:14}}>{l.name}</div>
                  <div style={{fontSize:11,color:"#888"}}>{l.type} · {l.source} · {l.contact}</div>
                </div>
                <Badge label={l.meetingStatus} color={l.meetingStatus==="Met"?"#2d6a4f":"#533483"}/>
                <span style={{fontSize:12,color:overdue?"#c0392b":"#555",fontWeight:overdue?700:400}}>{overdue?"🔴 ":"📅 "}{l.followUpDate}</span>
                <span style={{color:"#aaa",fontSize:14}}>{isOpen?"▲":"▼"}</span>
              </div>
              {isOpen&&(
                <div style={{borderTop:"1px solid #f0f0f0",padding:"14px 16px",display:"flex",flexDirection:"column",gap:14}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                    <div><div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>MEETING STATUS</div>
                      <select value={ed.meetingStatus??l.meetingStatus} onChange={e=>setEditing(ev=>({...ev,[l.id]:{...ev[l.id],meetingStatus:e.target.value}}))} style={inputS}>
                        {["Not yet","Meeting scheduled","Met","Proposal sent","Converted"].map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div><div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>FOLLOW-UP DATE</div>
                      <input type="date" value={ed.followUpDate??l.followUpDate??""} onChange={e=>setEditing(ev=>({...ev,[l.id]:{...ev[l.id],followUpDate:e.target.value}}))} style={inputS}/>
                    </div>
                    <div><div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>ASSIGNED TO</div>
                      <select value={ed.assignedTo??l.assignedTo} onChange={e=>setEditing(ev=>({...ev,[l.id]:{...ev[l.id],assignedTo:parseInt(e.target.value)}}))} style={inputS}>
                        {TEAM.map(tm=><option key={tm.id} value={tm.id}>{tm.name}</option>)}
                      </select>
                    </div>
                    <div style={{gridColumn:"1 / -1"}}><div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>NOTES</div>
                      <input value={ed.notes??l.notes??""} onChange={e=>setEditing(ev=>({...ev,[l.id]:{...ev[l.id],notes:e.target.value}}))} style={inputS} placeholder="Update notes…"/>
                    </div>
                  </div>
                  {Object.keys(ed).length>0&&(
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>{updateLead(l.id,ed);setEditing(ev=>{const n={...ev};delete n[l.id];return n;});}}
                        style={{background:"#1a1a2e",color:"#fff",border:"none",borderRadius:6,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Save Changes</button>
                      <button onClick={()=>setEditing(ev=>{const n={...ev};delete n[l.id];return n;})}
                        style={{background:"none",border:"1px solid #ddd",borderRadius:6,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Discard</button>
                    </div>
                  )}
                  <NotesPanel comments={l.comments||[]} onAdd={text=>addComment(l.id,text)} currentUser={currentUser}/>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Quotations ───────────────────────────────────────────────────────────────
function QuotationsTab({quotations,projects,setQuotations}){
  const [expanded,setExpanded]=useState(null);const [editing,setEditing]=useState({});
  const inputS={border:"1px solid #ddd",borderRadius:5,padding:"4px 8px",fontSize:12,fontFamily:"inherit"};
  const updateQ=(id,patch)=>setQuotations(qs=>qs.map(q=>q.id===id?{...q,...patch}:q));
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {quotations.map(q=>{
        const isOpen=expanded===q.id;const ed=editing[q.id]||{};
        return(
          <div key={q.id} style={{background:"#fff",borderRadius:10,overflow:"hidden",border:isOpen?"1px solid #c9a84c55":"1px solid #f0f0f0"}}>
            <div onClick={()=>setExpanded(isOpen?null:q.id)} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",cursor:"pointer"}}>
              <div style={{flex:1}}><div style={{fontWeight:700}}>{q.client} <span style={{color:"#888",fontWeight:400,fontSize:12}}>· {q.supplier}</span></div>
                <div style={{fontSize:11,color:"#888"}}>{q.id} · Sent {q.sentDate}</div></div>
              <span style={{fontWeight:700}}>{currencySymbol[q.currency]}{q.value.toLocaleString()}</span>
              <Badge label={q.status} color={q.status==="Confirmed"?"#2d6a4f":"#533483"}/>
              <span style={{color:"#aaa",fontSize:14}}>{isOpen?"▲":"▼"}</span>
            </div>
            {isOpen&&(
              <div style={{borderTop:"1px solid #f0f0f0",padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  <div><div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>STATUS</div>
                    <select value={ed.status??q.status} onChange={e=>setEditing(ev=>({...ev,[q.id]:{...ev[q.id],status:e.target.value}}))} style={{...inputS,width:"100%"}}>
                      {["Awaiting reply","Confirmed","Rejected","Revised"].map(s=><option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>FOLLOW-UP DATE</div>
                    <input type="date" value={ed.followUpDate??q.followUpDate??""} onChange={e=>setEditing(ev=>({...ev,[q.id]:{...ev[q.id],followUpDate:e.target.value}}))} style={{...inputS,width:"100%"}}/>
                  </div>
                  <div><div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>VALUE</div>
                    <input type="number" value={ed.value??q.value} onChange={e=>setEditing(ev=>({...ev,[q.id]:{...ev[q.id],value:parseFloat(e.target.value)}}))} style={{...inputS,width:"100%"}}/>
                  </div>
                </div>
                {Object.keys(ed).length>0&&(
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>{updateQ(q.id,ed);setEditing(ev=>{const n={...ev};delete n[q.id];return n;});}}
                      style={{background:"#1a1a2e",color:"#fff",border:"none",borderRadius:6,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Save</button>
                    <button onClick={()=>setEditing(ev=>{const n={...ev};delete n[q.id];return n;})}
                      style={{background:"none",border:"1px solid #ddd",borderRadius:6,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Discard</button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Orders ───────────────────────────────────────────────────────────────────
function OrdersTab({orders,projects,setOrders}){
  const [expanded,setExpanded]=useState(null);const [editing,setEditing]=useState({});
  const inputS={border:"1px solid #ddd",borderRadius:5,padding:"4px 8px",fontSize:12,fontFamily:"inherit",width:"100%"};
  const updateO=(id,patch)=>setOrders(os=>os.map(o=>o.id===id?{...o,...patch}:o));
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {orders.map(o=>{
        const proj=projects.find(p=>p.id===o.projectId);const isOpen=expanded===o.id;const ed=editing[o.id]||{};
        return(
          <div key={o.id} style={{background:"#fff",borderRadius:10,overflow:"hidden",border:isOpen?"1px solid #c9a84c55":"1px solid #f0f0f0"}}>
            <div onClick={()=>setExpanded(isOpen?null:o.id)} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",cursor:"pointer"}}>
              <div style={{flex:1}}><div style={{fontWeight:700}}>{proj?.client} <span style={{color:"#888",fontWeight:400,fontSize:12}}>· {o.vendor}</span></div>
                <div style={{fontSize:11,color:"#888"}}>{o.id} · PO: {o.poNumber}</div></div>
              <span style={{fontWeight:700}}>{currencySymbol[o.currency]}{o.value.toLocaleString()}</span>
              <Badge label={o.status} color="#0f3460"/>
              <span style={{color:"#aaa",fontSize:14}}>{isOpen?"▲":"▼"}</span>
            </div>
            {isOpen&&(
              <div style={{borderTop:"1px solid #f0f0f0",padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  <div><div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>STATUS</div>
                    <select value={ed.status??o.status} onChange={e=>setEditing(ev=>({...ev,[o.id]:{...ev[o.id],status:e.target.value}}))} style={inputS}>
                      {["Ordered","In Transit","Delivered","Cancelled"].map(s=><option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>TRACKING NUMBER</div>
                    <input value={ed.trackingNumber??o.trackingNumber} onChange={e=>setEditing(ev=>({...ev,[o.id]:{...ev[o.id],trackingNumber:e.target.value}}))} style={inputS}/>
                  </div>
                  <div><div style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:4}}>ETA</div>
                    <input type="date" value={ed.eta??o.eta} onChange={e=>setEditing(ev=>({...ev,[o.id]:{...ev[o.id],eta:e.target.value}}))} style={inputS}/>
                  </div>
                </div>
                {Object.keys(ed).length>0&&(
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>{updateO(o.id,ed);setEditing(ev=>{const n={...ev};delete n[o.id];return n;});}}
                      style={{background:"#1a1a2e",color:"#fff",border:"none",borderRadius:6,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Save</button>
                    <button onClick={()=>setEditing(ev=>{const n={...ev};delete n[o.id];return n;})}
                      style={{background:"none",border:"1px solid #ddd",borderRadius:6,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Discard</button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Payments ─────────────────────────────────────────────────────────────────
function PaymentsTab({payments,orders,setPayments,currentUser}){
  const [expanded,setExpanded]=useState(null);const [showAddSub,setShowAddSub]=useState(null);const [subForm,setSubForm]=useState({});
  const inputS={border:"1px solid #ddd",borderRadius:5,padding:"5px 8px",fontSize:12,fontFamily:"inherit",width:"100%",boxSizing:"border-box"};
  const updateSubPayment=(payId,spId,patch)=>setPayments(ps=>ps.map(p=>p.id!==payId?p:{...p,subPayments:p.subPayments.map(sp=>sp.id!==spId?sp:{...sp,...patch})}));
  const addSubPayment=(payId)=>{
    if(!subForm.amount||!subForm.type)return;
    const newSp={id:`SP${Date.now()}`,amount:parseFloat(subForm.amount),currency:subForm.currency||"EUR",type:subForm.type,swiftRef:subForm.swiftRef||"",date:subForm.date||today(),status:subForm.status||"Pending",notes:subForm.notes||""};
    setPayments(ps=>ps.map(p=>p.id!==payId?p:{...p,subPayments:[...p.subPayments,newSp]}));
    setSubForm({});setShowAddSub(null);
  };
  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{background:"#fff3cd",border:"1px solid #ffc107",borderRadius:8,padding:"8px 14px",fontSize:12,color:"#856404"}}>🔒 Visible to Aman, Mohini, and Ram only</div>
      {payments.map(pay=>{
        const isOpen=expanded===pay.id;
        const totalMade=pay.subPayments.filter(s=>s.type==="made"&&s.status==="Confirmed").reduce((a,s)=>a+s.amount,0);
        const totalPending=pay.subPayments.filter(s=>s.status==="Pending").reduce((a,s)=>a+s.amount,0);
        return(
          <div key={pay.id} style={{background:"#fff",borderRadius:10,overflow:"hidden",border:isOpen?"1px solid #c9a84c55":"1px solid #f0f0f0"}}>
            <div onClick={()=>setExpanded(isOpen?null:pay.id)} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",cursor:"pointer"}}>
              <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{pay.client} <span style={{color:"#888",fontWeight:400,fontSize:12}}>· {pay.supplier}</span></div>
                <div style={{fontSize:11,color:"#888"}}>{pay.id} · Order: {pay.orderId}</div></div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:12,color:"#2d6a4f",fontWeight:700}}>✓ {currencySymbol[pay.currency]}{totalMade.toLocaleString()} paid</div>
                {totalPending>0&&<div style={{fontSize:11,color:"#c0392b"}}>⏳ {currencySymbol[pay.currency]}{totalPending.toLocaleString()} pending</div>}
              </div>
              <span style={{color:"#aaa",fontSize:14}}>{isOpen?"▲":"▼"}</span>
            </div>
            {isOpen&&(
              <div style={{borderTop:"1px solid #f0f0f0",padding:"14px 16px"}}>
                <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"}}>Sub-Payments ({pay.subPayments.length})</div>
                {pay.subPayments.map(sp=>(
                  <div key={sp.id} style={{background:sp.type==="made"?"#f0faf4":"#fff8f0",border:`1px solid ${sp.type==="made"?"#2d6a4f33":"#c0392b33"}`,borderRadius:8,padding:"10px 12px",marginBottom:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                      <Badge label={sp.type==="made"?"▲ Outgoing":"▼ Incoming"} color={sp.type==="made"?"#0f3460":"#2d6a4f"}/>
                      <span style={{fontWeight:700}}>{currencySymbol[sp.currency]}{sp.amount.toLocaleString()}</span>
                      <span style={{fontSize:11,color:"#888"}}>{sp.date||"—"}</span>
                      {sp.swiftRef&&<span style={{fontSize:11,fontFamily:"monospace",color:"#0f3460"}}>{sp.swiftRef}</span>}
                      <span style={{fontSize:11,color:"#888",flex:1}}>{sp.notes}</span>
                      <select value={sp.status} onChange={e=>updateSubPayment(pay.id,sp.id,{status:e.target.value})}
                        style={{border:"1px solid #ddd",borderRadius:5,padding:"3px 6px",fontSize:11,fontFamily:"inherit",background:"#fff"}}>
                        {["Pending","Confirmed","Failed"].map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                    {sp.status==="Pending"&&(
                      <div style={{marginTop:8,display:"flex",gap:6}}>
                        <input placeholder="Enter SWIFT ref when paid…" defaultValue={sp.swiftRef} onBlur={e=>updateSubPayment(pay.id,sp.id,{swiftRef:e.target.value})} style={{flex:1,border:"1px solid #ddd",borderRadius:5,padding:"4px 8px",fontSize:11,fontFamily:"inherit"}}/>
                        <input type="date" defaultValue={sp.date} onBlur={e=>updateSubPayment(pay.id,sp.id,{date:e.target.value})} style={{border:"1px solid #ddd",borderRadius:5,padding:"4px 8px",fontSize:11,fontFamily:"inherit"}}/>
                      </div>
                    )}
                  </div>
                ))}
                {showAddSub===pay.id?(
                  <div style={{background:"#f8f8f8",borderRadius:8,padding:12,marginTop:8}}>
                    <div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Add Sub-Payment</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                      <div><div style={{fontSize:11,color:"#888",marginBottom:3}}>TYPE *</div>
                        <select value={subForm.type||""} onChange={e=>setSubForm(f=>({...f,type:e.target.value}))} style={inputS}>
                          <option value="">—</option><option value="made">▲ Outgoing</option><option value="received">▼ Incoming</option>
                        </select>
                      </div>
                      <div><div style={{fontSize:11,color:"#888",marginBottom:3}}>AMOUNT *</div>
                        <input type="number" value={subForm.amount||""} onChange={e=>setSubForm(f=>({...f,amount:e.target.value}))} style={inputS}/>
                      </div>
                      <div><div style={{fontSize:11,color:"#888",marginBottom:3}}>CURRENCY</div>
                        <select value={subForm.currency||pay.currency} onChange={e=>setSubForm(f=>({...f,currency:e.target.value}))} style={inputS}>
                          {["INR","EUR","USD","GBP"].map(c=><option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div><div style={{fontSize:11,color:"#888",marginBottom:3}}>DATE</div>
                        <input type="date" value={subForm.date||today()} onChange={e=>setSubForm(f=>({...f,date:e.target.value}))} style={inputS}/>
                      </div>
                      <div><div style={{fontSize:11,color:"#888",marginBottom:3}}>SWIFT REF</div>
                        <input placeholder="Optional" value={subForm.swiftRef||""} onChange={e=>setSubForm(f=>({...f,swiftRef:e.target.value}))} style={inputS}/>
                      </div>
                      <div><div style={{fontSize:11,color:"#888",marginBottom:3}}>STATUS</div>
                        <select value={subForm.status||"Pending"} onChange={e=>setSubForm(f=>({...f,status:e.target.value}))} style={inputS}>
                          {["Pending","Confirmed"].map(s=><option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div style={{gridColumn:"1 / -1"}}><div style={{fontSize:11,color:"#888",marginBottom:3}}>NOTES</div>
                        <input placeholder="e.g. Balance payment…" value={subForm.notes||""} onChange={e=>setSubForm(f=>({...f,notes:e.target.value}))} style={inputS}/>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,marginTop:10}}>
                      <button onClick={()=>addSubPayment(pay.id)} style={{background:"#1a1a2e",color:"#fff",border:"none",borderRadius:6,padding:"7px 16px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Add Payment</button>
                      <button onClick={()=>{setShowAddSub(null);setSubForm({});}} style={{background:"none",border:"1px solid #ddd",borderRadius:6,padding:"7px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
                    </div>
                  </div>
                ):(
                  <button onClick={()=>setShowAddSub(pay.id)} style={{marginTop:8,background:"none",border:"1px dashed #ddd",borderRadius:7,padding:"7px 16px",fontSize:12,cursor:"pointer",fontFamily:"inherit",color:"#555",width:"100%"}}>+ Add Sub-Payment</button>
                )}
                <div style={{marginTop:14}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:4}}>Payment Notes</div>
                  <textarea defaultValue={pay.notes} onBlur={e=>setPayments(ps=>ps.map(p=>p.id!==pay.id?p:{...p,notes:e.target.value}))}
                    style={{width:"100%",border:"1px solid #ddd",borderRadius:6,padding:"7px 10px",fontSize:12,fontFamily:"inherit",resize:"vertical",minHeight:50,boxSizing:"border-box"}}/>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Delivery & Install ───────────────────────────────────────────────────────
function DeliveryTab({projects}){
  const relevant=projects.filter(p=>["In Transit","Delivered","Installation","Closed"].includes(p.stage));
  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {relevant.map(p=>{
        const members=p.assignedTo.map(id=>getMember(id,TEAM)).filter(Boolean);
        return(
          <div key={p.id} style={{background:"#fff",borderRadius:10,padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div><div style={{fontWeight:800,fontSize:15}}>{p.client}</div><div style={{fontSize:11,color:"#888",marginTop:2}}>{p.id}</div></div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>{members.map(m=><Avatar key={m.id} member={m} size={28}/>)}<StageIndex stage={p.stage}/></div>
            </div>
            {p.comments.length>0&&(
              <div style={{marginTop:10,padding:"8px 12px",background:"#f8f8f8",borderRadius:6,fontSize:12,color:"#555"}}>
                <strong>{p.comments[p.comments.length-1].by}:</strong> {p.comments[p.comments.length-1].text}
              </div>
            )}
          </div>
        );
      })}
      {relevant.length===0&&<div style={{background:"#fff",borderRadius:10,padding:32,textAlign:"center",color:"#888"}}>No active deliveries or installations.</div>}
    </div>
  );
}

// ─── Tasks ────────────────────────────────────────────────────────────────────
function TasksTab({tasks,projects,currentUser,setTasks,setModal}){
  const [filter,setFilter]=useState("all");
  const filtered=filter==="all"?tasks:filter==="mine"?tasks.filter(t=>t.assignedTo===currentUser.id):tasks.filter(t=>t.status===filter);
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{display:"flex",gap:6}}>
          {["all","mine","Pending","Done"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{background:filter===f?"#1a1a2e":"#fff",color:filter===f?"#fff":"#555",border:"1px solid #ddd",borderRadius:6,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
              {f==="all"?"All":f==="mine"?"Mine":f}
            </button>
          ))}
        </div>
        <button onClick={()=>setModal({type:"newTask"})} style={{background:"#1a1a2e",color:"#fff",border:"none",borderRadius:7,padding:"8px 16px",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>+ New Task</button>
      </div>
      <div style={{background:"#fff",borderRadius:10,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr style={{background:"#f8f8f8",borderBottom:"1px solid #e8e8e8"}}>
            {["","Task","Type","Assigned To","Due Date","Project","Status"].map(h=>(
              <th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:700,color:"#555",fontSize:11,textTransform:"uppercase"}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map(t=>{
              const m=getMember(t.assignedTo,TEAM);const proj=projects.find(p=>p.id===t.projectId);const overdue=t.status!=="Done"&&isOverdue(t.dueDate);
              return(
                <tr key={t.id} style={{borderBottom:"1px solid #f0f0f0",opacity:t.status==="Done"?0.5:1}}>
                  <td style={{padding:"10px 14px"}}>
                    <button onClick={()=>setTasks(ts=>ts.map(tt=>tt.id===t.id?{...tt,status:tt.status==="Done"?"Pending":"Done"}:tt))}
                      style={{width:18,height:18,borderRadius:4,border:`2px solid ${t.status==="Done"?"#2d6a4f":"#ddd"}`,background:t.status==="Done"?"#2d6a4f":"none",cursor:"pointer",color:"#fff",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {t.status==="Done"?"✓":""}
                    </button>
                  </td>
                  <td style={{padding:"10px 14px",fontWeight:600,textDecoration:t.status==="Done"?"line-through":"none"}}>{t.title}</td>
                  <td style={{padding:"10px 14px"}}><Badge label={t.type} color={t.type==="project"?"#0f3460":"#533483"}/></td>
                  <td style={{padding:"10px 14px"}}>{m&&<div style={{display:"flex",alignItems:"center",gap:6}}><Avatar member={m} size={24}/><span style={{fontSize:12}}>{m.name}</span></div>}</td>
                  <td style={{padding:"10px 14px",color:overdue?"#c0392b":"#333",fontWeight:overdue?700:400}}>{overdue?"🔴 ":""}{t.dueDate}</td>
                  <td style={{padding:"10px 14px",color:"#666",fontSize:12}}>{proj?.client||"—"}</td>
                  <td style={{padding:"10px 14px"}}><Badge label={t.status} color={t.status==="Done"?"#2d6a4f":"#c0392b"}/></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Team ─────────────────────────────────────────────────────────────────────
function TeamTab({currentUser}){
  return(
    <div style={{background:"#fff",borderRadius:10,overflow:"hidden"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr style={{background:"#f8f8f8",borderBottom:"1px solid #e8e8e8"}}>
          {["Member","Designation","Role",...(currentUser.role==="operations"?["Password"]:[]),"CRM Access"].map(h=>(
            <th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:700,color:"#555",fontSize:11,textTransform:"uppercase"}}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {TEAM.map(m=>(
            <tr key={m.id} style={{borderBottom:"1px solid #f0f0f0"}}>
              <td style={{padding:"12px 14px"}}><div style={{display:"flex",alignItems:"center",gap:10}}><Avatar member={m} size={32}/><span style={{fontWeight:700}}>{m.name}</span></div></td>
              <td style={{padding:"12px 14px",color:"#555"}}>{m.designation}</td>
              <td style={{padding:"12px 14px"}}><Badge label={m.role} color="#533483"/></td>
              {currentUser.role==="operations"&&<td style={{padding:"12px 14px",fontFamily:"monospace",fontSize:12,color:"#888"}}>{PASSWORDS[m.id]}</td>}
              <td style={{padding:"12px 14px",fontSize:12,color:"#555"}}>
                {m.role==="director"?"Full access":m.role==="operations"?"All modules":m.role==="sales"?"Leads, Tasks":m.role==="accounts"?"Orders, Payments, SWIFT":m.role==="design"?"Projects (Design), Tasks":m.role==="coordinator"?"Projects, Orders, Quotations":"Delivery, Installation"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Project Drawer ───────────────────────────────────────────────────────────
function ProjectDrawer({project,tasks,currentUser,onClose,onAdvanceStage,onAddComment,onUpdateDriveLink}){
  const [comment,setComment]=useState("");const [advanceMode,setAdvanceMode]=useState(false);
  const [advanceComment,setAdvanceComment]=useState("");const [driveLink,setDriveLink]=useState(project?.driveLink||"");const [editingDrive,setEditingDrive]=useState(false);
  if(!project)return null;
  const projTasks=tasks.filter(t=>t.projectId===project.id);
  const stageIdx=STAGES.indexOf(project.stage);const nextStage=stageIdx<STAGES.length-1?STAGES[stageIdx+1]:null;
  return(
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex"}}>
      <div style={{flex:1,background:"#00000060"}} onClick={onClose}/>
      <div style={{width:500,background:"#fff",overflowY:"auto",padding:24,display:"flex",flexDirection:"column",gap:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div><div style={{fontSize:10,color:"#888",fontFamily:"monospace"}}>{project.id}</div>
            <h2 style={{margin:"4px 0 0",fontSize:20,fontWeight:800}}>{project.client}</h2></div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:20,cursor:"pointer",color:"#888"}}>✕</button>
        </div>
        <div style={{background:"#f8f8f8",borderRadius:8,padding:12}}>
          <div style={{fontSize:11,fontWeight:700,color:"#555",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.5px"}}>📁 Google Drive Folder</div>
          {!editingDrive?(
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {project.driveLink?<a href={project.driveLink} target="_blank" rel="noreferrer" style={{color:"#0f3460",fontWeight:600,fontSize:13}}>Open Project Folder ↗</a>:<span style={{color:"#aaa",fontSize:13}}>No Drive link added</span>}
              <button onClick={()=>{setDriveLink(project.driveLink||"");setEditingDrive(true);}} style={{marginLeft:"auto",background:"none",border:"1px solid #ddd",borderRadius:5,padding:"3px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{project.driveLink?"Edit":"Add Link"}</button>
            </div>
          ):(
            <div style={{display:"flex",gap:6}}>
              <input value={driveLink} onChange={e=>setDriveLink(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" style={{flex:1,border:"1px solid #ddd",borderRadius:6,padding:"6px 10px",fontSize:12,fontFamily:"inherit"}}/>
              <button onClick={()=>{onUpdateDriveLink(project.id,driveLink);setEditingDrive(false);}} style={{background:"#1a1a2e",color:"#fff",border:"none",borderRadius:6,padding:"0 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Save</button>
              <button onClick={()=>setEditingDrive(false)} style={{background:"none",border:"1px solid #ddd",borderRadius:6,padding:"0 10px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
            </div>
          )}
        </div>
        <div>
          <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.5px"}}>Stage History</div>
          {project.stageHistory.map((s,i)=>(
            <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:"#c9a84c",marginTop:3,flexShrink:0}}/>
                {i<project.stageHistory.length-1&&<div style={{width:2,flex:1,background:"#e8e8e8",minHeight:16}}/>}
              </div>
              <div style={{paddingBottom:12}}>
                <div style={{fontSize:12,fontWeight:700}}>{s.stage}</div>
                <div style={{fontSize:10,color:"#888"}}>{s.date} · {s.by}</div>
              </div>
            </div>
          ))}
        </div>
        {nextStage&&(
          <div style={{background:"#f8f8f8",borderRadius:8,padding:14}}>
            {!advanceMode?(
              <button onClick={()=>setAdvanceMode(true)} style={{background:"#1a1a2e",color:"#fff",border:"none",borderRadius:6,padding:"8px 16px",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:600,width:"100%"}}>Advance to: {nextStage} →</button>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                <div style={{fontSize:12,fontWeight:700}}>Comment required before advancing</div>
                <textarea value={advanceComment} onChange={e=>setAdvanceComment(e.target.value)} placeholder="What was done at this stage?" style={{border:"1px solid #ddd",borderRadius:6,padding:"8px 10px",fontSize:12,fontFamily:"inherit",resize:"vertical",minHeight:60}}/>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>{if(advanceComment.trim()){onAdvanceStage(project.id,advanceComment);setAdvanceMode(false);setAdvanceComment("");}}} style={{background:"#1a1a2e",color:"#fff",border:"none",borderRadius:6,padding:"7px 16px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600,flex:1}}>Confirm</button>
                  <button onClick={()=>{setAdvanceMode(false);setAdvanceComment("");}} style={{background:"none",border:"1px solid #ddd",borderRadius:6,padding:"7px 16px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
        {projTasks.length>0&&(
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"#555",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.5px"}}>Linked Tasks ({projTasks.length})</div>
            {projTasks.map(t=>{const m=getMember(t.assignedTo,TEAM);return(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid #f0f0f0"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:t.status==="Done"?"#2d6a4f":isOverdue(t.dueDate)?"#c0392b":"#ccc"}}/>
                <span style={{flex:1,fontSize:12,textDecoration:t.status==="Done"?"line-through":"none",color:t.status==="Done"?"#888":"#333"}}>{t.title}</span>
                {m&&<Avatar member={m} size={22}/>}
              </div>
            );})}
          </div>
        )}
        <NotesPanel comments={project.comments} onAdd={text=>onAddComment(project.id,text)} currentUser={currentUser} label="Comments"/>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({modal,projects,currentUser,onClose,onSaveTask,onSaveProject,onSaveLead}){
  const [form,setForm]=useState({});
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const inputStyle={width:"100%",border:"1px solid #ddd",borderRadius:6,padding:"7px 10px",fontSize:13,fontFamily:"inherit",boxSizing:"border-box"};
  const labelStyle={fontSize:12,fontWeight:700,color:"#555",display:"block",marginBottom:4};
  const renderForm=()=>{
    if(modal.type==="newTask")return(
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div><label style={labelStyle}>Task title *</label><input style={inputStyle} value={form.title||""} onChange={e=>set("title",e.target.value)} placeholder="What needs to be done?"/></div>
        <div><label style={labelStyle}>Assign to *</label>
          <select style={inputStyle} value={form.assignedTo||""} onChange={e=>set("assignedTo",parseInt(e.target.value))}>
            <option value="">— Select team member —</option>
            {TEAM.map(m=><option key={m.id} value={m.id}>{m.name} ({m.designation})</option>)}
          </select>
        </div>
        <div><label style={labelStyle}>Due date *</label><input type="date" style={inputStyle} value={form.dueDate||today()} onChange={e=>set("dueDate",e.target.value)}/></div>
        <div><label style={labelStyle}>Linked project (optional)</label>
          <select style={inputStyle} value={form.projectId||""} onChange={e=>set("projectId",e.target.value||null)}>
            <option value="">— Standalone task —</option>
            {projects.map(p=><option key={p.id} value={p.id}>{p.client} ({p.id})</option>)}
          </select>
        </div>
        <button onClick={()=>{if(form.title&&form.assignedTo&&form.dueDate)onSaveTask({title:form.title,assignedTo:form.assignedTo,dueDate:form.dueDate,projectId:form.projectId||null,status:"Pending",type:form.projectId?"project":"standalone"});}} style={{background:"#1a1a2e",color:"#fff",border:"none",borderRadius:7,padding:"10px",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Add Task</button>
      </div>
    );
    if(modal.type==="newLead")return(
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div><label style={labelStyle}>Name *</label><input style={inputStyle} value={form.name||""} onChange={e=>set("name",e.target.value)} placeholder="Client / Architect name"/></div>
        <div><label style={labelStyle}>Type</label>
          <select style={inputStyle} value={form.type||"End Client"} onChange={e=>set("type",e.target.value)}>
            {["End Client","Architect","Interior Designer","Developer"].map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <div><label style={labelStyle}>Source</label><input style={inputStyle} value={form.source||""} onChange={e=>set("source",e.target.value)} placeholder="Referral, Exhibition, Instagram…"/></div>
        <div><label style={labelStyle}>Contact</label><input style={inputStyle} value={form.contact||""} onChange={e=>set("contact",e.target.value)} placeholder="+91 XXXXX XXXXX"/></div>
        <div><label style={labelStyle}>Follow-up date</label><input type="date" style={inputStyle} value={form.followUpDate||addDays(today(),3)} onChange={e=>set("followUpDate",e.target.value)}/></div>
        <div><label style={labelStyle}>Notes</label><input style={inputStyle} value={form.notes||""} onChange={e=>set("notes",e.target.value)}/></div>
        <div><label style={labelStyle}>Assigned to</label>
          <select style={inputStyle} value={form.assignedTo||currentUser.id} onChange={e=>set("assignedTo",parseInt(e.target.value))}>
            {TEAM.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <button onClick={()=>{if(form.name)onSaveLead({name:form.name,type:form.type||"End Client",source:form.source||"",contact:form.contact||"",followUpDate:form.followUpDate||addDays(today(),3),meetingStatus:"Not yet",notes:form.notes||"",assignedTo:form.assignedTo||currentUser.id});}} style={{background:"#1a1a2e",color:"#fff",border:"none",borderRadius:7,padding:"10px",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Add Lead</button>
      </div>
    );
    if(modal.type==="newProject")return(
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div><label style={labelStyle}>Client name *</label><input style={inputStyle} value={form.client||""} onChange={e=>set("client",e.target.value)}/></div>
        <div><label style={labelStyle}>Source</label><input style={inputStyle} value={form.source||""} onChange={e=>set("source",e.target.value)}/></div>
        <div style={{display:"flex",gap:10}}>
          <div style={{flex:1}}><label style={labelStyle}>Currency</label>
            <select style={inputStyle} value={form.currency||"INR"} onChange={e=>set("currency",e.target.value)}>
              {["INR","EUR","USD","GBP"].map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{flex:2}}><label style={labelStyle}>Estimated value</label><input style={inputStyle} value={form.value||""} onChange={e=>set("value",e.target.value)} placeholder="Optional"/></div>
        </div>
        <div><label style={labelStyle}>Google Drive folder link (optional)</label><input style={inputStyle} value={form.driveLink||""} onChange={e=>set("driveLink",e.target.value)} placeholder="https://drive.google.com/…"/></div>
        <div><label style={labelStyle}>Assigned to</label>
          <select style={inputStyle} value={form.assignedTo||currentUser.id} onChange={e=>set("assignedTo",parseInt(e.target.value))}>
            {TEAM.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div><label style={labelStyle}>Follow-up date</label><input type="date" style={inputStyle} value={form.followUpDate||addDays(today(),5)} onChange={e=>set("followUpDate",e.target.value)}/></div>
        <button onClick={()=>{if(form.client)onSaveProject({client:form.client,source:form.source||"",stage:"Lead",currency:form.currency||"INR",value:form.value||"—",driveLink:form.driveLink||"",assignedTo:[form.assignedTo||currentUser.id],followUpDate:form.followUpDate||addDays(today(),5)});}} style={{background:"#1a1a2e",color:"#fff",border:"none",borderRadius:7,padding:"10px",fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Create Project</button>
      </div>
    );
  };
  const titles={newTask:"New Task",newLead:"New Lead",newProject:"New Project"};
  return(
    <div style={{position:"fixed",inset:0,zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{position:"absolute",inset:0,background:"#00000060"}} onClick={onClose}/>
      <div style={{position:"relative",background:"#fff",borderRadius:12,padding:24,width:420,maxHeight:"90vh",overflowY:"auto",zIndex:1}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h3 style={{margin:0,fontSize:16,fontWeight:800}}>{titles[modal.type]}</h3>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:"#888"}}>✕</button>
        </div>
        {renderForm()}
      </div>
    </div>
  );
}
