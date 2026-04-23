import { useState, useEffect, useCallback, useRef } from "react";

// ── AIRTABLE CONFIG ───────────────────────────────────────────────────────────
const AT_BASE    = "app6glwSp0GclwNmE";
const AT_TABLE   = "tblfMkw5lLEadlBO1";
const AT_TOKEN   = "patMT1rjQzKR46R4A";
const AT_URL     = `https://api.airtable.com/v0/${AT_BASE}/${AT_TABLE}`;
const AT_HEADERS = { "Authorization": `Bearer ${AT_TOKEN}`, "Content-Type": "application/json" };

async function atFetch(method, path = "", body = null) {
  const res = await fetch(AT_URL + path, {
    method,
    headers: AT_HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Airtable error ${res.status}`);
  }
  return res.json();
}

async function fetchAllDeals() {
  let records = [], offset;
  do {
    const params = offset ? `?offset=${offset}` : "";
    const data = await atFetch("GET", params);
    records = records.concat(data.records);
    offset = data.offset;
  } while (offset);
  return records.map(r => ({
    id: r.id,
    company:      r.fields.Company      || "",
    contact:      r.fields.Contact      || "",
    ae:           r.fields.AE           || "",
    stage:        r.fields.Stage        || "lead",
    createdAt:    r.fields.CreatedAt    || new Date().toISOString().slice(0,10),
    criteria:     safeJSON(r.fields.CriteriaData),
  }));
}

async function createDeal(deal) {
  const data = await atFetch("POST", "", {
    records: [{ fields: dealToFields(deal) }]
  });
  return { ...deal, id: data.records[0].id };
}

async function updateDeal(deal) {
  await atFetch("PATCH", "", {
    records: [{ id: deal.id, fields: dealToFields(deal) }]
  });
}

async function deleteDeal(id) {
  await atFetch("DELETE", `?records[]=${id}`);
}

function dealToFields(deal) {
  return {
    Company:      deal.company,
    Contact:      deal.contact,
    AE:           deal.ae,
    Stage:        deal.stage,
    CreatedAt:    deal.createdAt,
    CriteriaData: JSON.stringify(deal.criteria || {}),
  };
}

function safeJSON(str) {
  try { return JSON.parse(str || "{}"); } catch { return {}; }
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const STAGES = [
  { id:"lead",      label:"Lead",           hint:"AE first action", color:"#1D9E75" },
  { id:"qualified", label:"Qualified",       hint:"Go / no-go",      color:"#378ADD" },
  { id:"meeting",   label:"First Meeting",   hint:"Discovery",       color:"#7F77DD" },
  { id:"poc",       label:"Showcase / PoC",  hint:"Conditional",     color:"#BA7517" },
  { id:"nego",      label:"Negotiation",     hint:"Commercial",      color:"#D85A30" },
  { id:"payment",   label:"Payment",         hint:"AE-owned",        color:"#639922" },
];
const STAGE_IDS = STAGES.map(s => s.id);

const TAG = {
  gate:   { label:"Gate",   bg:"#E6F1FB", color:"#0C447C" },
  build:  { label:"Build",  bg:"#E1F5EE", color:"#085041" },
  verify: { label:"Verify", bg:"#EEEDFE", color:"#3C3489" },
  track:  { label:"Track",  bg:"#FAEEDA", color:"#633806" },
  watch:  { label:"Watch",  bg:"#FAECE7", color:"#712B13" },
};

const CRITERIA = [
  { group:"Pain & Business Impact", source:"SPIN · SPICED · MEDDIC · BANT", items:[
    { id:"icp", label:"ICP match", source:"Industry · size · profile",
      stages:{ lead:"gate", qualified:"verify" },
      detail:[
        { id:"industry",  label:"Industry",               type:"text",     placeholder:"e.g. Manufacturing, Retail..." },
        { id:"size",      label:"Company size",           type:"text",     placeholder:"e.g. 200–500 employees" },
        { id:"branches",  label:"No. of offices",         type:"text",     placeholder:"e.g. 3 offices" },
        { id:"icpfit",    label:"ICP fit",                type:"select",   options:["Strong fit","Partial fit","Weak fit","Unknown"] },
        { id:"source",    label:"Lead source",            type:"text",     placeholder:"e.g. Inbound, referral..." },
        { id:"date",      label:"Date qualified",         type:"date" },
        { id:"notes",     label:"Notes",                  type:"textarea", placeholder:"Additional context..." },
      ]},
    { id:"situation", label:"Situation / context", source:"SPIN — Situation",
      stages:{ lead:"gate", qualified:"verify" },
      detail:[
        { id:"tools",      label:"Current tools in use",   type:"textarea", placeholder:"e.g. Excel, MISA, Zalo..." },
        { id:"structure",  label:"Team / dept structure",   type:"textarea", placeholder:"Key departments, sizes..." },
        { id:"maturity",   label:"Digital maturity",        type:"select",   options:["Paper / manual","Partial digital","Some software","Mostly digital","Fully digital"] },
        { id:"confidence", label:"Confidence level",        type:"select",   options:["High","Medium","Low"] },
        { id:"date",       label:"Date captured",           type:"date" },
        { id:"notes",      label:"Notes",                   type:"textarea", placeholder:"Other context..." },
      ]},
    { id:"corepain", label:"Core pain identified", source:"SPIN · SPICED · MEDDIC",
      stages:{ qualified:"gate", meeting:"verify" },
      detail:[
        { id:"pain",       label:"Pain in client's own words", type:"textarea", placeholder:"Quote or paraphrase..." },
        { id:"area",       label:"Pain area",                  type:"select",   options:["Task & project mgmt","Workflow & approvals","HR & payroll","Recruitment","Sales & CRM","Finance & reporting","Internal comms","Other"] },
        { id:"felt",       label:"How widely felt?",           type:"select",   options:["Leadership only","One dept","Multiple depts","Company-wide","Unknown"] },
        { id:"confidence", label:"Confidence level",           type:"select",   options:["High","Medium","Low"] },
        { id:"date",       label:"Date identified",            type:"date" },
        { id:"notes",      label:"Notes",                      type:"textarea", placeholder:"Additional context..." },
      ]},
    { id:"implication", label:"Pain implication", source:"SPIN — Implication",
      stages:{ meeting:"gate", poc:"verify" },
      detail:[
        { id:"inaction",   label:"Cost of inaction",    type:"textarea", placeholder:"What breaks if unsolved?" },
        { id:"type",       label:"Impact type",         type:"select",   options:["Revenue loss","Cost inefficiency","HR risk","Compliance risk","Growth blocker","Customer experience","Other"] },
        { id:"magnitude",  label:"Magnitude",           type:"select",   options:["Critical","High","Medium","Low"] },
        { id:"confidence", label:"Confidence level",    type:"select",   options:["High","Medium","Low"] },
        { id:"date",       label:"Date captured",       type:"date" },
        { id:"notes",      label:"Notes",               type:"textarea", placeholder:"Additional context..." },
      ]},
    { id:"impact", label:"Quantified business impact", source:"MEDDIC — Metrics · SPICED",
      stages:{ meeting:"build", poc:"verify", nego:"track" },
      detail:[
        { id:"m1",        label:"Key metric #1",       type:"text",     placeholder:"e.g. 2 hrs/day saved per employee" },
        { id:"m2",        label:"Key metric #2",       type:"text",     placeholder:"e.g. 15% payroll error → ~0" },
        { id:"m3",        label:"Key metric #3",       type:"text",     placeholder:"e.g. Hiring cycle 45 → 20 days" },
        { id:"validated", label:"Metrics validated?",  type:"select",   options:["Client confirmed","AE estimated","PoC validated","Not yet quantified"] },
        { id:"date",      label:"Date captured",       type:"date" },
        { id:"notes",     label:"Notes",               type:"textarea", placeholder:"How derived?" },
      ]},
    { id:"valuefit", label:"Value proposition fit", source:"SPIN — Need-payoff · SPICED",
      stages:{ meeting:"gate", poc:"verify", nego:"track" },
      detail:[
        { id:"package",   label:"Recommended package",       type:"select",   options:["Digital Workspace","Employee Happiness","E-Hiring","Financial Management","Base CRM","DT Basic","DT Premium","Multiple / custom"] },
        { id:"rationale", label:"Why this package fits",     type:"textarea", placeholder:"Connect pain to solution..." },
        { id:"reaction",  label:"Client reaction",           type:"select",   options:["Strongly resonated","Partially resonated","Neutral","Skeptical","Not yet presented"] },
        { id:"confidence",label:"Confidence level",          type:"select",   options:["High","Medium","Low"] },
        { id:"date",      label:"Date presented",            type:"date" },
        { id:"notes",     label:"Notes",                     type:"textarea", placeholder:"Additional notes..." },
      ]},
    { id:"criticalevent", label:"Critical event / trigger", source:"SPICED — Critical event",
      stages:{ qualified:"build", meeting:"verify", poc:"track", nego:"watch" },
      detail:[
        { id:"event",     label:"Forcing event",       type:"text",     placeholder:"e.g. New CEO, audit in Q3..." },
        { id:"eventdate", label:"Event date",          type:"date" },
        { id:"type",      label:"Event type",          type:"select",   options:["Regulatory / audit","Leadership change","Rapid growth","New office","System failure","Competitive pressure","End of contract","Other"] },
        { id:"certainty", label:"Certainty",           type:"select",   options:["Confirmed","Likely","Possible","Unconfirmed"] },
        { id:"date",      label:"Date identified",     type:"date" },
        { id:"notes",     label:"Notes",               type:"textarea", placeholder:"How solid is this?" },
      ]},
    { id:"timeline", label:"Timeline / urgency", source:"BANT · SPICED",
      stages:{ qualified:"gate", meeting:"verify", poc:"track", nego:"track" },
      detail:[
        { id:"golive",    label:"Desired go-live date",   type:"date" },
        { id:"urgency",   label:"Urgency level",          type:"select",   options:["This month","1–3 months","3–6 months","6–12 months","Not decided"] },
        { id:"driver",    label:"What drives timeline?",  type:"textarea", placeholder:"Budget cycle, event, leadership..." },
        { id:"realistic", label:"Is timeline realistic?", type:"select",   options:["Yes — confirmed","Likely","Unclear","No — needs reset"] },
        { id:"date",      label:"Date captured",          type:"date" },
        { id:"notes",     label:"Notes",                  type:"textarea", placeholder:"Timeline risks?" },
      ]},
    { id:"pocjustify", label:"PoC necessity justified", source:"Reduce PoC frequency",
      stages:{ meeting:"gate" },
      detail:[
        { id:"needed",    label:"Is PoC needed?",          type:"select",   options:["Yes — justified","No — value prop sufficient","Undecided"] },
        { id:"reason",    label:"Reason for PoC",          type:"textarea", placeholder:"What doubt makes it necessary?" },
        { id:"scope",     label:"Agreed PoC scope",        type:"textarea", placeholder:"What tested, duration, success criteria..." },
        { id:"date",      label:"Date decided",            type:"date" },
        { id:"notes",     label:"Notes",                   type:"textarea", placeholder:"Additional context..." },
      ]},
  ]},
  { group:"Stakeholders & Authority", source:"MEDDIC · BANT", items:[
    { id:"ecobuyer", label:"Economic buyer ID", source:"MEDDIC — Econ. buyer",
      stages:{ qualified:"build", meeting:"verify", poc:"track", nego:"watch", payment:"watch" },
      detail:[
        { id:"name",      label:"Economic buyer name",  type:"text",   placeholder:"Full name" },
        { id:"title",     label:"Title / role",         type:"text",   placeholder:"e.g. CEO, CFO..." },
        { id:"engaged",   label:"Engaged directly?",    type:"select", options:["Yes — met in person","Yes — call / email","Indirect via champion","Not yet"] },
        { id:"stance",    label:"Buyer stance",         type:"select", options:["Strongly supportive","Neutral / evaluating","Skeptical","Unknown"] },
        { id:"confidence",label:"Confidence level",     type:"select", options:["High","Medium","Low"] },
        { id:"date",      label:"Date identified",      type:"date" },
        { id:"notes",     label:"Notes",                type:"textarea", placeholder:"Motivation or concerns..." },
      ]},
    { id:"committee", label:"Decision committee map", source:"MEDDIC — Decision process",
      stages:{ qualified:"build", meeting:"verify", poc:"track", nego:"watch" },
      detail:[
        { id:"members",   label:"Members (name · role · influence)", type:"textarea", placeholder:"1. Nguyen Van A — CEO — Final decision\n2. ..." },
        { id:"process",   label:"How do they decide?",              type:"textarea", placeholder:"IT evaluates → dept head → CEO approves" },
        { id:"gaps",      label:"Unknown stakeholders?",            type:"textarea", placeholder:"Who haven't we reached?" },
        { id:"date",      label:"Date mapped",                      type:"date" },
        { id:"notes",     label:"Notes",                            type:"textarea", placeholder:"Political dynamics, alliances..." },
      ]},
    { id:"deccriteria", label:"Decision criteria", source:"MEDDIC — Dec. criteria",
      stages:{ meeting:"gate", poc:"verify", nego:"track" },
      detail:[
        { id:"criteria",  label:"Client's decision criteria",  type:"textarea", placeholder:"Ease of use, support, price, integrations..." },
        { id:"musthave",  label:"Must-haves",                  type:"textarea", placeholder:"Non-negotiable requirements..." },
        { id:"nicehave",  label:"Nice-to-haves",               type:"textarea", placeholder:"What would accelerate the decision?" },
        { id:"compete",   label:"Competitors evaluated?",      type:"select",   options:["Yes — known","Yes — unknown who","No — Base only","Unknown"] },
        { id:"date",      label:"Date captured",               type:"date" },
        { id:"notes",     label:"Notes",                       type:"textarea", placeholder:"Shifting criteria..." },
      ]},
    { id:"champion", label:"Champion identified", source:"MEDDIC — Champion",
      stages:{ qualified:"build", meeting:"build", poc:"verify", nego:"watch", payment:"watch" },
      detail:[
        { id:"name",      label:"Champion name",        type:"text",   placeholder:"Full name" },
        { id:"title",     label:"Title / role",         type:"text",   placeholder:"e.g. HR Manager..." },
        { id:"motivation",label:"Why are they championing?", type:"textarea", placeholder:"Personal stake in solving this?" },
        { id:"access",    label:"Level of access",      type:"select", options:["Speaks to decision-maker","Part of committee","Influential peer","Working-level only"] },
        { id:"date",      label:"Date identified",      type:"date" },
        { id:"notes",     label:"Notes",                type:"textarea", placeholder:"Risks — could they leave or lose influence?" },
      ]},
    { id:"champstrength", label:"Champion strength", source:"Influence & engagement",
      stages:{ meeting:"build", poc:"verify", nego:"watch", payment:"watch" },
      detail:[
        { id:"influence", label:"Influence level",    type:"select",   options:["High — drives decisions","Medium — respected voice","Low — limited sway","Unknown"] },
        { id:"advocacy",  label:"Active advocacy",    type:"select",   options:["Proactively selling internally","Responsive when asked","Passive","Declining engagement"] },
        { id:"evidence",  label:"Evidence",           type:"textarea", placeholder:"e.g. Set up CEO meeting, pushed timeline..." },
        { id:"risk",      label:"Champion risk",      type:"select",   options:["Low","Medium","High","Critical — champion gone"] },
        { id:"date",      label:"Date assessed",      type:"date" },
        { id:"notes",     label:"Notes",              type:"textarea", placeholder:"Additional assessment..." },
      ]},
  ]},
  { group:"Budget & Payment Health", source:"BANT · AE revenue = actual payment", items:[
    { id:"budget", label:"Budget existence", source:"BANT — Budget",
      stages:{ qualified:"build", meeting:"track", poc:"track" },
      detail:[
        { id:"status",  label:"Budget status",      type:"select",   options:["Allocated — ready","Needs to be requested","Part of annual planning","Unknown","Client declined to share"] },
        { id:"range",   label:"Estimated range",    type:"text",     placeholder:"e.g. 50–100M VND / year" },
        { id:"cycle",   label:"Budget cycle",       type:"text",     placeholder:"e.g. Annual Jan–Dec..." },
        { id:"source",  label:"Source of info",     type:"text",     placeholder:"Client stated, inferred..." },
        { id:"date",    label:"Date captured",      type:"date" },
        { id:"notes",   label:"Notes",              type:"textarea", placeholder:"Any willingness-to-pay signals..." },
      ]},
    { id:"budgetctrl", label:"Budget controller", source:"Who holds the purse",
      stages:{ qualified:"build", meeting:"verify", poc:"track", nego:"gate", payment:"watch" },
      detail:[
        { id:"name",     label:"Controller name",     type:"text",   placeholder:"Full name" },
        { id:"title",    label:"Title / role",         type:"text",   placeholder:"e.g. CFO, Finance Director..." },
        { id:"samebuyer",label:"Same as econ. buyer?", type:"select", options:["Yes","No","Unknown"] },
        { id:"engaged",  label:"Engaged?",             type:"select", options:["Yes — directly","Indirect","Not yet"] },
        { id:"date",     label:"Date identified",      type:"date" },
        { id:"notes",    label:"Notes",                type:"textarea", placeholder:"Supportive of the spend?" },
      ]},
    { id:"payprocess", label:"Internal payment process", source:"Who approves release",
      stages:{ poc:"build", nego:"verify", payment:"gate" },
      detail:[
        { id:"approver",  label:"Who approves release?", type:"text",     placeholder:"Name and role" },
        { id:"steps",     label:"Approval steps",        type:"textarea", placeholder:"Finance → Director → bank transfer..." },
        { id:"duration",  label:"Processing time",       type:"text",     placeholder:"e.g. 5–10 business days" },
        { id:"docs",      label:"Documents required",    type:"textarea", placeholder:"Contract, invoice, PO..." },
        { id:"date",      label:"Date mapped",           type:"date" },
        { id:"notes",     label:"Notes",                 type:"textarea", placeholder:"Risks to payment release?" },
      ]},
    { id:"paycommit", label:"Payment commitment & timeline", source:"Verbal → written → executed",
      stages:{ nego:"build", payment:"gate" },
      detail:[
        { id:"verbal",    label:"Verbal commitment",    type:"textarea", placeholder:"Who said what, when?" },
        { id:"written",   label:"Written confirmation", type:"select",   options:["Contract signed","Email confirmation","Pending","Not yet"] },
        { id:"paydate",   label:"Agreed payment date",  type:"date" },
        { id:"structure", label:"Payment structure",    type:"select",   options:["Full upfront","50/50","Quarterly","Monthly","Annual","Other"] },
        { id:"executed",  label:"Payment executed?",    type:"select",   options:["Yes — confirmed","Partial","Pending","Not yet"] },
        { id:"date",      label:"Date of commitment",   type:"date" },
        { id:"notes",     label:"Notes",                type:"textarea", placeholder:"Delays, concerns, next actions..." },
      ]},
  ]},
];

// ── HELPERS ───────────────────────────────────────────────────────────────────
function newDeal() {
  return { id: null, company:"", contact:"", ae:"", stage:"lead", createdAt: new Date().toISOString().slice(0,10), criteria:{} };
}

function countFilled(deal) {
  let filled = 0, total = 0;
  CRITERIA.forEach(g => g.items.forEach(c => {
    STAGE_IDS.forEach(sid => {
      if (c.stages[sid]) { total++; if ((deal.criteria[c.id]?.stages?.[sid]?.note || "").trim()) filled++; }
    });
  }));
  return { filled, total };
}

function TagBadge({ type }) {
  if (!type) return <span style={{color:"#ccc",fontSize:11}}>—</span>;
  const t = TAG[type];
  return <span style={{display:"inline-block",background:t.bg,color:t.color,borderRadius:4,padding:"2px 7px",fontSize:10,fontWeight:600,whiteSpace:"nowrap"}}>{t.label}</span>;
}

function Toast({ msg, type }) {
  return (
    <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,background: type==="error" ? "#FEE2E2" : "#DCFCE7",color: type==="error" ? "#991B1B" : "#166534",borderRadius:10,padding:"12px 18px",fontSize:13,fontWeight:500,boxShadow:"0 4px 20px rgba(0,0,0,0.12)",display:"flex",alignItems:"center",gap:8,maxWidth:320}}>
      <span>{type==="error" ? "⚠️" : "✓"}</span>{msg}
    </div>
  );
}

// ── DETAIL MODAL ──────────────────────────────────────────────────────────────
function CriterionDetail({ deal, criterion, onClose, onSave }) {
  const saved = deal.criteria[criterion.id]?.detail || {};
  const [form, setForm] = useState(saved);
  const stageEntries = STAGE_IDS.filter(s => criterion.stages[s]);

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(10,10,20,0.55)",zIndex:1000,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"24px 16px",overflowY:"auto"}} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:560,boxShadow:"0 24px 80px rgba(0,0,0,0.18)",overflow:"hidden",marginTop:8}}>
        <div style={{background:"#0F172A",padding:"20px 24px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:10,fontWeight:600,letterSpacing:"0.1em",color:"rgba(255,255,255,0.35)",textTransform:"uppercase",marginBottom:6}}>Detail form</div>
              <div style={{fontSize:16,fontWeight:600,color:"#fff",marginBottom:3}}>{criterion.label}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",fontFamily:"monospace"}}>{criterion.source}</div>
            </div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.08)",border:"none",borderRadius:8,color:"rgba(255,255,255,0.6)",cursor:"pointer",padding:"6px 10px",fontSize:15}}>✕</button>
          </div>
          <div style={{display:"flex",gap:6,marginTop:14,flexWrap:"wrap"}}>
            {STAGE_IDS.map(sid => {
              const type = criterion.stages[sid]; if (!type) return null;
              const s = STAGES.find(x => x.id===sid);
              return (
                <span key={sid} style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,255,255,0.08)",borderRadius:20,padding:"3px 10px"}}>
                  <span style={{width:6,height:6,borderRadius:"50%",background:s.color,display:"inline-block"}}/>
                  <span style={{fontSize:10,color:"rgba(255,255,255,0.5)"}}>{s.label}</span>
                  <TagBadge type={type}/>
                </span>
              );
            })}
          </div>
        </div>
        <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:14}}>
          {criterion.detail.map(f => (
            <div key={f.id}>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:"#475569",marginBottom:5,letterSpacing:"0.04em",textTransform:"uppercase"}}>{f.label}</label>
              {f.type==="textarea" ? (
                <textarea value={form[f.id]||""} onChange={e=>setForm(p=>({...p,[f.id]:e.target.value}))} placeholder={f.placeholder}
                  style={{width:"100%",minHeight:72,padding:"8px 11px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13,fontFamily:"inherit",resize:"vertical",outline:"none",lineHeight:1.6}}
                  onFocus={e=>e.target.style.borderColor="#1B4FD8"} onBlur={e=>e.target.style.borderColor="#E2E8F0"}/>
              ) : f.type==="select" ? (
                <select value={form[f.id]||""} onChange={e=>setForm(p=>({...p,[f.id]:e.target.value}))}
                  style={{width:"100%",padding:"8px 11px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13,fontFamily:"inherit",outline:"none",appearance:"none",background:"#F8FAFF"}}>
                  <option value="">Select...</option>
                  {f.options.map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input type={f.type} value={form[f.id]||""} onChange={e=>setForm(p=>({...p,[f.id]:e.target.value}))} placeholder={f.placeholder||""}
                  style={{width:"100%",padding:"8px 11px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13,fontFamily:"inherit",outline:"none"}}
                  onFocus={e=>e.target.style.borderColor="#1B4FD8"} onBlur={e=>e.target.style.borderColor="#E2E8F0"}/>
              )}
            </div>
          ))}
        </div>
        <div style={{padding:"14px 24px",background:"#F8FAFF",borderTop:"1px solid #E2E8F0",display:"flex",justifyContent:"flex-end",gap:10}}>
          <button onClick={onClose} style={{padding:"8px 18px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"transparent",fontSize:13,cursor:"pointer",fontFamily:"inherit",color:"#64748B"}}>Cancel</button>
          <button onClick={()=>{onSave(criterion.id,form);onClose();}} style={{padding:"8px 18px",borderRadius:8,border:"none",background:"#0F172A",color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>Save details</button>
        </div>
      </div>
    </div>
  );
}

// ── MATRIX CELL ───────────────────────────────────────────────────────────────
function MatrixCell({ deal, criterion, stageId, onNoteChange, onOpenDetail }) {
  const type = criterion.stages[stageId];
  const note = deal.criteria[criterion.id]?.stages?.[stageId]?.note || "";
  if (!type) return <td style={{background:"#F8F9FB",textAlign:"center",verticalAlign:"middle",borderRight:"1px solid #EEF0F4",padding:10,opacity:0.45}}><span style={{color:"#CBD5E1",fontSize:14}}>—</span></td>;
  return (
    <td style={{verticalAlign:"top",borderRight:"1px solid #EEF0F4",padding:"8px 10px",minWidth:148}}>
      <div style={{marginBottom:6}}><TagBadge type={type}/></div>
      <textarea value={note} onChange={e=>onNoteChange(criterion.id,stageId,e.target.value)}
        placeholder={PLACEHOLDERS[criterion.id]?.[stageId]||"Notes..."}
        style={{width:"100%",minHeight:50,fontSize:11,fontFamily:"inherit",border:"1px solid #E2E8F0",borderRadius:6,padding:"5px 7px",resize:"none",outline:"none",lineHeight:1.5,background:note?"#fff":"#F8FAFF",transition:"border-color 0.15s"}}
        onFocus={e=>e.target.style.borderColor="#1B4FD8"} onBlur={e=>e.target.style.borderColor="#E2E8F0"}
        onInput={e=>{e.target.style.height="auto";e.target.style.height=Math.max(50,e.target.scrollHeight)+"px";}}/>
    </td>
  );
}

const PLACEHOLDERS = {
  icp:          {lead:"Industry? Size? Profile fit?",qualified:"ICP fit confirmed?"},
  situation:    {lead:"Current setup, tools, team?",qualified:"Context confirmed?"},
  corepain:     {qualified:"Core pain — in client's words?",meeting:"Pain confirmed widely felt?"},
  implication:  {meeting:"Cost of inaction?",poc:"Still holds after PoC?"},
  impact:       {meeting:"Any numbers? Time, errors, revenue?",poc:"PoC validated impact?",nego:"Impact front of mind?"},
  valuefit:     {meeting:"Which package fits? Why?",poc:"Value confirmed?",nego:"Still holding?"},
  criticalevent:{qualified:"Any forcing event or deadline?",meeting:"Event confirmed?",poc:"Still driving urgency?",nego:"Risk of urgency fading?"},
  timeline:     {qualified:"Desired go-live? Hard deadline?",meeting:"Timeline realistic?",poc:"Any shift?",nego:"Still on track?"},
  pocjustify:   {meeting:"Why PoC needed? What's the doubt?"},
  ecobuyer:     {qualified:"Who is the economic buyer?",meeting:"Confirmed? Engaged?",poc:"Still engaged?",nego:"Any change?",payment:"Driving payment?"},
  committee:    {qualified:"Who are the stakeholders?",meeting:"Map confirmed?",poc:"New stakeholders?",nego:"Committee aligned?"},
  deccriteria:  {meeting:"What must be true for them to say yes?",poc:"Criteria shift?",nego:"New criteria?"},
  champion:     {qualified:"Who could champion internally?",meeting:"Champion engaged?",poc:"Actively supporting?",nego:"Still on side?",payment:"Helping close payment?"},
  champstrength:{meeting:"Influence level? Advocating?",poc:"Influence confirmed?",nego:"Holding under pressure?",payment:"Driving payment?"},
  budget:       {qualified:"Any budget signals?",meeting:"Budget update?",poc:"Budget on track?"},
  budgetctrl:   {qualified:"Who controls budget?",meeting:"Identity confirmed?",poc:"Still same?",nego:"Confirmed, aligned?",payment:"Any last change?"},
  payprocess:   {poc:"Who approves payment release?",nego:"Steps confirmed?",payment:"Payment released?"},
  paycommit:    {nego:"Verbal commitment? From whom? Agreed date?",payment:"Written confirmed? Executed?"},
};

// ── DEAL VIEW ─────────────────────────────────────────────────────────────────
function DealView({ deal, onBack, onUpdate, onSaveStatus }) {
  const [activeStage, setActiveStage] = useState(null);
  const [detailCriterion, setDetailCriterion] = useState(null);
  const [editingHeader, setEditingHeader] = useState(false);
  const [header, setHeader] = useState({company:deal.company,contact:deal.contact,ae:deal.ae,stage:deal.stage});
  const saveTimer = useRef(null);

  function scheduleUpdate(updated) {
    onUpdate(updated);
    onSaveStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await updateDeal(updated); onSaveStatus("saved"); }
      catch { onSaveStatus("error"); }
    }, 1200);
  }

  function handleNoteChange(criterionId, stageId, value) {
    const updated = { ...deal, criteria: { ...deal.criteria, [criterionId]: { ...deal.criteria[criterionId], stages: { ...(deal.criteria[criterionId]?.stages||{}), [stageId]:{ note:value } } } } };
    scheduleUpdate(updated);
  }

  function handleDetailSave(criterionId, detailData) {
    const updated = { ...deal, criteria: { ...deal.criteria, [criterionId]: { ...deal.criteria[criterionId], detail:detailData } } };
    scheduleUpdate(updated);
  }

  async function saveHeader() {
    const updated = { ...deal, ...header };
    onUpdate(updated);
    setEditingHeader(false);
    try { await updateDeal(updated); onSaveStatus("saved"); }
    catch { onSaveStatus("error"); }
  }

  const { filled, total } = countFilled(deal);
  const pct = total ? Math.round((filled/total)*100) : 0;
  const visibleStages = activeStage ? STAGES.filter(s=>s.id===activeStage) : STAGES;

  return (
    <div style={{minHeight:"100vh",background:"#F4F3EF",fontFamily:"'DM Sans',sans-serif"}}>
      {/* Topbar */}
      <div style={{background:"#0F172A",padding:"11px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={onBack} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:7,color:"rgba(255,255,255,0.7)",cursor:"pointer",padding:"5px 12px",fontSize:12,fontFamily:"inherit"}}>← All deals</button>
          <span style={{color:"rgba(255,255,255,0.2)"}}>·</span>
          <span style={{fontSize:13,fontWeight:600,color:"#fff"}}>{deal.company||"Untitled deal"}</span>
          {deal.contact && <span style={{fontSize:12,color:"rgba(255,255,255,0.35)"}}>· {deal.contact}</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>{filled}/{total} filled</span>
          <div style={{width:64,height:3,background:"rgba(255,255,255,0.1)",borderRadius:2,overflow:"hidden"}}>
            <div style={{width:`${pct}%`,height:"100%",background:"#1D9E75",borderRadius:2}}/>
          </div>
          <button onClick={()=>setEditingHeader(true)} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:7,color:"rgba(255,255,255,0.7)",cursor:"pointer",padding:"5px 12px",fontSize:12,fontFamily:"inherit"}}>Edit info</button>
        </div>
      </div>

      {/* Stage tabs */}
      <div style={{background:"#fff",borderBottom:"1px solid #E2E8F0",padding:"0 22px",position:"sticky",top:46,zIndex:90,display:"flex",gap:0,overflowX:"auto"}}>
        <button onClick={()=>setActiveStage(null)} style={{padding:"10px 14px",border:"none",borderBottom:!activeStage?"2px solid #0F172A":"2px solid transparent",background:"transparent",fontSize:12,fontWeight:500,cursor:"pointer",color:!activeStage?"#0F172A":"#94A3B8",whiteSpace:"nowrap",fontFamily:"inherit"}}>All stages</button>
        {STAGES.map(s=>(
          <button key={s.id} onClick={()=>setActiveStage(activeStage===s.id?null:s.id)}
            style={{padding:"10px 14px",border:"none",borderBottom:activeStage===s.id?`2px solid ${s.color}`:"2px solid transparent",background:"transparent",fontSize:12,fontWeight:500,cursor:"pointer",color:activeStage===s.id?s.color:"#94A3B8",whiteSpace:"nowrap",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:s.color,display:"inline-block"}}/>
            {s.label}
          </button>
        ))}
      </div>

      {/* Matrix */}
      <div style={{padding:"22px",overflowX:"auto"}}>
        <div style={{background:"#fff",borderRadius:14,border:"1px solid #E2E8F0",overflow:"hidden",boxShadow:"0 2px 12px rgba(0,0,0,0.05)",minWidth:activeStage?"auto":900}}>
          <table style={{borderCollapse:"collapse",width:"100%",fontSize:12}}>
            <thead>
              <tr style={{background:"#F8FAFF",borderBottom:"2px solid #E2E8F0"}}>
                <th style={{padding:"11px 12px",textAlign:"left",fontSize:10,fontWeight:600,letterSpacing:"0.08em",color:"#94A3B8",textTransform:"uppercase",width:168,position:"sticky",left:0,background:"#F8FAFF",zIndex:2}}>Criteria</th>
                {visibleStages.map(s=>(
                  <th key={s.id} style={{padding:"10px 12px",textAlign:"center",borderLeft:"1px solid #EEF0F4",borderTop:`3px solid ${s.color}`}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
                      <span style={{width:6,height:6,borderRadius:"50%",background:s.color,display:"inline-block"}}/>
                      <span style={{fontSize:12,fontWeight:600,color:"#0F172A"}}>{s.label}</span>
                    </div>
                    <div style={{fontSize:9,color:"#94A3B8",marginTop:2}}>{s.hint}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CRITERIA.map((group,gi)=>(
                <>
                  <tr key={`g${gi}`}>
                    <th colSpan={visibleStages.length+1} style={{padding:"8px 12px 6px",background:"#F8FAFF",borderTop:gi>0?"2px solid #E2E8F0":"none",textAlign:"left",fontSize:9.5,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",color:"#94A3B8"}}>
                      {group.group} <span style={{fontWeight:400,opacity:0.65}}>· {group.source}</span>
                    </th>
                  </tr>
                  {group.items.map(criterion=>{
                    if (activeStage && !criterion.stages[activeStage]) return null;
                    const hasDetail = criterion.detail.some(f => deal.criteria[criterion.id]?.detail?.[f.id]);
                    return (
                      <tr key={criterion.id} style={{borderBottom:"1px solid #F1F5F9"}}>
                        <td style={{padding:"10px 12px",verticalAlign:"top",position:"sticky",left:0,background:"#fff",zIndex:1,borderRight:"1px solid #E2E8F0",width:168}}>
                          <div style={{fontSize:11,fontWeight:600,color:"#0F172A",lineHeight:1.3}}>{criterion.label}</div>
                          <div style={{fontSize:9.5,color:"#94A3B8",marginTop:2,fontFamily:"monospace"}}>{criterion.source}</div>
                          <button onClick={()=>setDetailCriterion(criterion)}
                            style={{marginTop:7,fontSize:10,padding:"2px 8px",borderRadius:4,border:"1px solid #E2E8F0",background:hasDetail?"#0F172A":"#F8FAFF",cursor:"pointer",color:hasDetail?"#fff":"#64748B",fontFamily:"inherit",fontWeight:500}}>
                            {hasDetail?"✓ Detail":"⊕ Detail"}
                          </button>
                        </td>
                        {visibleStages.map(s=>(
                          <MatrixCell key={s.id} deal={deal} criterion={criterion} stageId={s.id} onNoteChange={handleNoteChange} onOpenDetail={setDetailCriterion}/>
                        ))}
                      </tr>
                    );
                  })}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div style={{display:"flex",flexWrap:"wrap",gap:"8px 18px",marginTop:14,alignItems:"center",fontSize:11,color:"#64748B"}}>
          <span style={{fontSize:10,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",color:"#94A3B8"}}>Legend</span>
          {Object.entries(TAG).map(([k,v])=>(
            <span key={k} style={{display:"flex",alignItems:"center",gap:5}}>
              <span style={{background:v.bg,color:v.color,borderRadius:4,padding:"1px 7px",fontSize:10,fontWeight:600}}>{v.label}</span>
              <span>{{gate:"Must pass to advance",build:"Actively develop",verify:"Confirm & challenge",track:"Monitor for changes",watch:"Risk alert"}[k]}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Edit header modal */}
      {editingHeader && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#fff",borderRadius:14,padding:26,width:"100%",maxWidth:420,boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
            <div style={{fontSize:15,fontWeight:600,marginBottom:18}}>Edit deal info</div>
            {[["company","Company name"],["contact","Primary contact · title"],["ae","Account Executive"]].map(([k,l])=>(
              <div key={k} style={{marginBottom:13}}>
                <label style={{display:"block",fontSize:11,fontWeight:600,color:"#64748B",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>{l}</label>
                <input value={header[k]} onChange={e=>setHeader(p=>({...p,[k]:e.target.value}))}
                  style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13,fontFamily:"inherit",outline:"none"}}/>
              </div>
            ))}
            <div style={{marginBottom:18}}>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:"#64748B",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>Current stage</label>
              <select value={header.stage} onChange={e=>setHeader(p=>({...p,stage:e.target.value}))}
                style={{width:"100%",padding:"9px 12px",borderRadius:8,border:"1.5px solid #E2E8F0",fontSize:13,fontFamily:"inherit",outline:"none",appearance:"none"}}>
                {STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
              <button onClick={()=>setEditingHeader(false)} style={{padding:"9px 18px",borderRadius:8,border:"1.5px solid #E2E8F0",background:"transparent",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
              <button onClick={saveHeader} style={{padding:"9px 18px",borderRadius:8,border:"none",background:"#0F172A",color:"#fff",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit"}}>Save</button>
            </div>
          </div>
        </div>
      )}

      {detailCriterion && <CriterionDetail deal={deal} criterion={detailCriterion} onClose={()=>setDetailCriterion(null)} onSave={handleDetailSave}/>}
    </div>
  );
}

// ── DEAL LIST ─────────────────────────────────────────────────────────────────
function DealList({ deals, loading, onSelect, onNew, onDelete }) {
  const [search, setSearch] = useState("");
  const filtered = deals.filter(d =>
    [d.company,d.contact,d.ae].some(v=>v.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{minHeight:"100vh",background:"#F4F3EF",fontFamily:"'DM Sans',sans-serif"}}>
      <div style={{background:"#0F172A",padding:"28px 32px 32px"}}>
        <div style={{maxWidth:960,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:22}}>
            <div style={{width:30,height:30,background:"#fff",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:14,color:"#0F172A"}}>B</div>
            <span style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.55)"}}>Base.vn</span>
            <span style={{color:"rgba(255,255,255,0.2)"}}>·</span>
            <span style={{fontSize:12,color:"rgba(255,255,255,0.3)",letterSpacing:"0.04em"}}>AE Qualification Tool</span>
            <span style={{marginLeft:"auto",fontSize:11,color:"rgba(255,255,255,0.3)",display:"flex",alignItems:"center",gap:5}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:"#1D9E75",display:"inline-block"}}/>
              Synced to Airtable
            </span>
          </div>
          <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
            <div>
              <div style={{fontSize:26,fontWeight:300,color:"#fff",lineHeight:1.2,fontFamily:"serif",fontStyle:"italic"}}>Deal records</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.35)",marginTop:6}}>
                {loading ? "Loading from Airtable..." : `${deals.length} deal${deals.length!==1?"s":""} · shared across team`}
              </div>
            </div>
            <button onClick={onNew} style={{background:"#fff",color:"#0F172A",border:"none",borderRadius:9,padding:"10px 20px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              + New deal
            </button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:960,margin:"0 auto",padding:"24px 32px"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by company, contact, or AE..."
          style={{width:"100%",padding:"11px 16px",borderRadius:10,border:"1.5px solid #E2E8F0",fontSize:13,fontFamily:"inherit",outline:"none",marginBottom:20,background:"#fff"}}/>

        {loading ? (
          <div style={{textAlign:"center",padding:"60px 0",color:"#94A3B8"}}>
            <div style={{fontSize:24,marginBottom:10}}>⟳</div>
            <div style={{fontSize:14}}>Loading deals from Airtable...</div>
          </div>
        ) : filtered.length===0 ? (
          <div style={{textAlign:"center",padding:"60px 0",color:"#94A3B8"}}>
            <div style={{fontSize:36,marginBottom:12}}>📋</div>
            <div style={{fontSize:15,fontWeight:500,marginBottom:6}}>{search ? "No deals match your search" : "No deals yet"}</div>
            <div style={{fontSize:13}}>{!search && "Click \"+ New deal\" to create your first qualification record"}</div>
          </div>
        ) : (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
            {filtered.map(deal=>{
              const {filled,total} = countFilled(deal);
              const pct = total ? Math.round((filled/total)*100) : 0;
              const stage = STAGES.find(s=>s.id===deal.stage)||STAGES[0];
              return (
                <div key={deal.id} onClick={()=>onSelect(deal.id)}
                  style={{background:"#fff",borderRadius:12,padding:20,border:"1px solid #E2E8F0",cursor:"pointer",boxShadow:"0 1px 4px rgba(0,0,0,0.04)",transition:"box-shadow 0.15s,transform 0.15s",position:"relative"}}
                  onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 6px 24px rgba(0,0,0,0.10)";e.currentTarget.style.transform="translateY(-2px)";}}
                  onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";e.currentTarget.style.transform="none";}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                    <span style={{display:"flex",alignItems:"center",gap:6,background:"#F8FAFF",borderRadius:20,padding:"3px 10px",border:"1px solid #E2E8F0"}}>
                      <span style={{width:7,height:7,borderRadius:"50%",background:stage.color,display:"inline-block"}}/>
                      <span style={{fontSize:11,fontWeight:500,color:"#475569"}}>{stage.label}</span>
                    </span>
                    <button onClick={e=>{e.stopPropagation();if(confirm(`Delete "${deal.company||"this deal"}"?`))onDelete(deal.id);}}
                      style={{background:"transparent",border:"none",cursor:"pointer",color:"#CBD5E1",fontSize:14,padding:"2px 4px"}}>✕</button>
                  </div>
                  <div style={{fontSize:15,fontWeight:600,color:"#0F172A",marginBottom:3}}>{deal.company||<span style={{color:"#CBD5E1"}}>Untitled</span>}</div>
                  {deal.contact && <div style={{fontSize:12,color:"#64748B",marginBottom:2}}>{deal.contact}</div>}
                  {deal.ae && <div style={{fontSize:11,color:"#94A3B8"}}>AE: {deal.ae}</div>}
                  <div style={{marginTop:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#94A3B8",marginBottom:5}}>
                      <span>Qualification progress</span>
                      <span style={{fontWeight:600,color:pct>60?"#1D9E75":pct>30?"#BA7517":"#94A3B8"}}>{pct}%</span>
                    </div>
                    <div style={{height:3,background:"#F1F5F9",borderRadius:2,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${pct}%`,background:pct>60?"#1D9E75":pct>30?"#BA7517":"#CBD5E1",borderRadius:2,transition:"width 0.4s"}}/>
                    </div>
                  </div>
                  <div style={{fontSize:10,color:"#CBD5E1",marginTop:10}}>Created {deal.createdAt}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [deals, setDeals]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeDealId, setActive]   = useState(null);
  const [saveStatus, setSaveStatus] = useState(null); // "saving"|"saved"|"error"
  const [toast, setToast]           = useState(null);
  const toastTimer = useRef(null);

  function showToast(msg, type="success") {
    setToast({msg,type});
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(()=>setToast(null), 3000);
  }

  function handleSaveStatus(s) {
    setSaveStatus(s);
    if (s==="saved") showToast("Saved to Airtable");
    if (s==="error") showToast("Airtable save failed — check connection","error");
  }

  useEffect(()=>{
    fetchAllDeals()
      .then(data=>{ setDeals(data); setLoading(false); })
      .catch(()=>{ showToast("Could not load from Airtable","error"); setLoading(false); });
  },[]);

  const activeDeal = deals.find(d=>d.id===activeDealId);

  async function handleNew() {
    const d = newDeal();
    try {
      const saved = await createDeal(d);
      setDeals(prev=>[saved,...prev]);
      setActive(saved.id);
    } catch { showToast("Failed to create deal in Airtable","error"); }
  }

  function handleUpdate(updated) {
    setDeals(prev=>prev.map(d=>d.id===updated.id?updated:d));
  }

  async function handleDelete(id) {
    try {
      await deleteDeal(id);
      setDeals(prev=>prev.filter(d=>d.id!==id));
      if (activeDealId===id) setActive(null);
      showToast("Deal deleted");
    } catch { showToast("Failed to delete — check connection","error"); }
  }

  return (
    <>
      {activeDeal
        ? <DealView deal={activeDeal} onBack={()=>setActive(null)} onUpdate={handleUpdate} onSaveStatus={handleSaveStatus}/>
        : <DealList deals={deals} loading={loading} onSelect={setActive} onNew={handleNew} onDelete={handleDelete}/>
      }
      {toast && <Toast msg={toast.msg} type={toast.type}/>}
    </>
  );
}
