
/* CreditWatch custom HTML front-end. Every data mutation is authorized and calculated in Python.
 * Compatible with Streamlit Components v2 and the optional standalone FastAPI test server.
 */
const E = (x) => String(x===null||x===undefined?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const N = (v,d=1) => v==null?'—':Number(v).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d});
const CR = v => v==null?'—':`₹${N(v,2)} Cr`;
const S = v => v==null?'—':String(v);
const ico = (name,sz=18) => {const paths={
  layers:'<path d="M12 3 2 8l10 5 10-5-10-5Z"/><path d="m2 12 10 5 10-5"/><path d="m2 16 10 5 10-5"/>',
  dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  building:'<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h1m6 0h1M8 10h1m6 0h1M8 14h1m6 0h1"/>',
  alert:'<path d="m10.29 3.86-8.48 14a2 2 0 0 0 1.71 3h16.96a2 2 0 0 0 1.71-3l-8.48-14a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4m0 4h.01"/>',
  review:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3.5V2h6v1.5M9 9h6m-6 4h6m-6 4h3"/>',
  database:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  chart:'<path d="M3 3v18h18M7 16l4-5 3 2 6-7"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  chevron:'<path d="m9 18 6-6-6-6"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-6 15-6 16 0"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  pencil:'<path d="m15 5 4 4M3 21l4.5-1L20 7.5 16.5 4 4 16.5 3 21Z"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
  spark:'<path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Zm7 13 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"/>',
  back:'<path d="m15 18-6-6 6-6M9 12h12"/>'};return `<svg aria-hidden="true" width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name]||paths.layers}</svg>`;};
const riskRank = {CRITICAL:0,HIGH:1,MEDIUM:2,LOW:3,UNASSESSED:4};
const labelRisk = s => (s||'UNASSESSED').replace(/_/g,' ');
const levelTag = (level) => `<span class="tag tag-${E(String(level||'NOT_EVALUATED').toLowerCase().replace(/_/g,'-'))}">${E(labelRisk(level))}</span>`;
const statusTag = (v) => `<span class="status status-${E((v||'NOT_STARTED').toLowerCase())}">${E({PENDING_CRO:'Pending CRO',PENDING_AVP:'Pending AVP',NOT_STARTED:'Not started',RETURNED:'Returned',FINALIZED:'Finalized',DRAFT:'Draft'}[v]||v)}</span>`;
const kpi=(label,v,sub,klass='')=>`<div class="metric ${klass}"><div class="metric-label">${E(label)}</div><div class="metric-value">${E(v)}</div><div class="metric-sub">${E(sub||'')}</div></div>`;

// Interactive summary card used in multiple workspaces.
const actionKpi=(label,v,sub,section,key,klass='',selected=false)=>`<button type="button" class="metric metric-jump ${E(klass)}" data-summary-section="${E(section)}" data-summary-key="${E(key)}" aria-label="View ${E(label)} details" aria-pressed="${selected}" ${selected?'style="border-color:#008f88;box-shadow:0 0 0 2px rgba(0,143,136,.13)"':''}><div class="metric-label">${E(label)}</div><div class="metric-value">${E(v)}</div><div class="metric-sub">${E(sub||'')} ${ico('arrow',13)}</div></button>`;

const sectionHead=(kicker,title,subtitle)=>`<div class="section-heading"><div><div class="eyebrow">${E(kicker)}</div><h1>${E(title)}</h1><p>${E(subtitle||'')}</p></div></div>`;

function table(heads,rows,empty='No records available.'){
 if(!rows?.length)return `<div class="empty">${E(empty)}</div>`;
 return `<div class="table-scroll"><table class="data-table"><thead><tr>${heads.map(h=>`<th>${E(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

const tcell=(txt,klass='')=>`<td class="${klass}">${txt}</td>`;
const btn=(name,kind,variant='')=>`<button class="btn ${variant}" type="submit" name="kind" value="${E(kind)}">${E(name)}</button>`;
const smallnote=t=>`<div class="mini-note">${ico('shield',14)}${E(t)}</div>`;

// CW_ONBOARD_BORROWER_UI_V1: four-stage UI; all writes go through Python.
function newOnboardState(){
  return {step:1,details:{legal_constitution:'Private Limited',segment:'MSME'},
    sanction:{},facilities:[{facility_type:'CC',sanctioned_limit:'',interest_rate:'',maturity_date:'',outstanding_cr:''}],
    baselines:[],pending:null,completed:null,error:''};
}
const obOpt=(value,selected)=>`<option value="${E(value)}" ${String(value)===String(selected)?'selected':''}>${E(value)}</option>`;
const obField=(title,name,value='',type='text',extra='',required=true)=>`<label class="cw-ob-field"><span>${E(title)}${required?' <b class="cw-ob-required">*</b>':''}</span><input name="${E(name)}" type="${E(type)}" value="${E(value)}" ${extra} ${required?'required':''}></label>`;
const obSelect=(title,name,values,selected='',required=true)=>`<label class="cw-ob-field"><span>${E(title)}${required?' <b class="cw-ob-required">*</b>':''}</span><select name="${E(name)}" ${required?'required':''}><option value="">Select ${E(title.toLowerCase())}</option>${values.map(s=>obOpt(s,selected)).join('')}</select></label>`;
function obDateOffset(days){const x=new Date();x.setDate(x.getDate()+days);return x.toISOString().slice(0,10);}

function onboardCollect(root){
  const form=root.querySelector('form[data-onboard-step]');
  if(!form)return;
  const s=ui.onboard,step=Number(form.dataset.onboardStep);
  if(!onboardCanEdit(s,step,currentData?.onboarding||{}))return;
  const fd=new FormData(form);
  if(step===1){
    const fields=['company_name','legal_constitution','sector','sub_industry','location','registration_no','gstin','segment','description'];
    for(const field of fields)s.details[field]=String(fd.get(field)||'').trim();
    // Start with the last completed FY, unless sanction was in an earlier year.
    if(!s.baselines.length){
      const sanctionFY=Number(s.sanction.sanction_date?.slice(0,4)||new Date().getFullYear());
      s.baselines=[{fy:Math.min(new Date().getFullYear()-1,sanctionFY),statement_type:'Audited',data:{}}];
    }
  }
  else if(step===2){
    for(const field of ['sanction_date','monitoring_due_date'])s.sanction[field]=String(fd.get(field)||'');
    s.facilities=s.facilities.map((f,i)=>({
      facility_type:String(fd.get(`f.${i}.facility_type`)||''),
      sanctioned_limit:String(fd.get(`f.${i}.sanctioned_limit`)||''),
      interest_rate:String(fd.get(`f.${i}.interest_rate`)||''),
      maturity_date:String(fd.get(`f.${i}.maturity_date`)||''),
      outstanding_cr:String(fd.get(`f.${i}.outstanding_cr`)||''),
    }));
    if(s.baselines.length){
      const sanctionFY=Number(s.sanction.sanction_date?.slice(0,4)||new Date().getFullYear());
      for(const r of s.baselines){if(Number(r.fy)>sanctionFY)r.fy=sanctionFY;}
    }
  }
  else if(step===3){
    s.baselines=s.baselines.map((b,i)=>({
      fy:String(fd.get(`b.${i}.fy`)||''),
      statement_type:String(fd.get(`b.${i}.statement_type`)||'Audited'),
      data:Object.fromEntries(Object.keys(currentData.onboarding.financial_groups)
        .flatMap(k=>Object.keys(currentData.onboarding.financial_groups[k]))
        .map(field=>[field,String(fd.get(`b.${i}.${field}`)??'')]))
    }));
  }
}

// CW_ONBOARD_STAGE_PREVIEW_V2
// All four stages are always visible. Only editing is sequential.
// Python remains the authoritative validator before Google Sheets is changed.
const obTrim = value => String(value??'').trim();
const obNum = value => obTrim(value)!=='' && Number.isFinite(Number(value)) ? Number(value) : null;
const obISODate = value => {
  const str=obTrim(value);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(str))return false;
  const d=new Date(str+'T00:00:00Z');
  return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===str;
};
function onboardStepIssues(step,s,o={}){
  const issues=[];
  if(step===1){
    const d=s.details||{};
    const t=(k)=>obTrim(d[k]);
    if(t('company_name').length<3||t('company_name').length>180)issues.push('Enter a borrower name of 3–180 characters.');
    if(!(o.legal_constitutions||[]).includes(t('legal_constitution')))issues.push('Select a legal constitution.');
    if(!Object.prototype.hasOwnProperty.call(o.sectors||{},t('sector')))issues.push('Select an industry sector.');
    if(t('sub_industry').length<2 || !(o.sectors?.[t('sector')]||[]).includes(t('sub_industry')))issues.push('Select a sub sector.');
    if(t('location').length<3||t('location').length>150)issues.push('Enter the registered HQ location.');
    if(!/^[A-Za-z0-9/-]{5,40}$/.test(t('registration_no')))issues.push('Enter a valid CIN / registration number (5–40 characters).');
    if(!/^[0-9]{2}[A-Za-z0-9]{13}$/.test(t('gstin')))issues.push('Enter a valid 15-character GSTIN.');
    if(!['MSME','Corporate'].includes(t('segment')))issues.push('Select the borrower segment.');
    if(t('description').length>750)issues.push('Business description is too long.');
  }
  if(step===2){
    const a=s.sanction||{}, sanction=obTrim(a.sanction_date),due=obTrim(a.monitoring_due_date);
    const today=obDateOffset(0);
    if(!obISODate(sanction)||sanction>today)issues.push('Enter a valid sanction date that is not in the future.');
    if(!obISODate(due)||due<sanction)issues.push('First monitoring due date must be on or after the sanction date.');
    if(!Array.isArray(s.facilities)||s.facilities.length<1||s.facilities.length>8)issues.push('Enter 1–8 sanctioned facilities.');
    (s.facilities||[]).forEach((f,i)=>{
      const label=`Facility ${i+1}`;
      if(!(o.facility_types||['CC','OD','TERM','BG']).includes(f.facility_type))issues.push(`${label}: select the facility type.`);
      const limit=obNum(f.sanctioned_limit),rate=obNum(f.interest_rate),os=obNum(f.outstanding_cr);
      if(limit===null||limit<0.000001||limit>1e8)issues.push(`${label}: enter a positive sanctioned limit.`);
      if(rate===null||rate<0||rate>40)issues.push(`${label}: enter a valid annual interest rate (0–40%).`);
      if(!obISODate(f.maturity_date)||f.maturity_date<sanction)issues.push(`${label}: maturity must not precede sanction.`);
      if(obTrim(f.outstanding_cr)!==''){
        if(os===null||os<0||os>1e8)issues.push(`${label}: enter a valid opening outstanding.`);
        if(f.facility_type==='BG')issues.push(`${label}: BG cannot have a funded opening outstanding.`);
        if(limit!==null&&os!==null&&os>limit+1e-6)issues.push(`${label}: outstanding exceeds sanctioned limit.`);
      }
    });
  }
  if(step===3){
    const yrs=s.baselines||[],keys=Object.values(o.financial_groups||{}).flatMap(fields=>Object.keys(fields));
    if(yrs.length<1||yrs.length>3)issues.push('Enter 1–3 baseline financial years.');
    if(!keys.length)issues.push('Financial fields are unavailable. Reload the application.');
    const seen=new Set();
    yrs.forEach((b,i)=>{
      const fy=Number(b.fy),label=`Baseline year ${i+1}`;
      const sanctionYear=Number(obTrim(s.sanction?.sanction_date).slice(0,4));
      if(!Number.isInteger(fy)||fy<2015||fy>new Date().getFullYear()||fy>sanctionYear)issues.push(`${label}: select a valid financial year on or before sanction.`);
      if(seen.has(fy))issues.push(`FY${fy} is entered more than once.`);
      seen.add(fy);
      if(!['Audited','Provisional'].includes(b.statement_type))issues.push(`${label}: choose a statement type.`);
      const d=b.data||{};
      const valid=keys.every(k=>obNum(d[k])!==null&&Math.abs(obNum(d[k]))<=1e8);
      if(!valid){issues.push(`${label}: complete all financial statement fields with valid amounts.`);return;}
      const n=k=>Number(d[k]);
      if(n('revenue')<=0)issues.push(`FY${fy}: revenue must be above zero.`);
      if(n('total_assets')<=0)issues.push(`FY${fy}: total assets must be above zero.`);
      for(const k of ['cogs','interest_expense','total_assets','total_liabilities','total_debt','cash','current_assets','current_liabilities','inventory','receivables','payables','capex','principal_due']){
        if(n(k)<0)issues.push(`FY${fy}: ${k.replace(/_/g,' ')} cannot be negative.`);
      }
      if(n('current_assets')>n('total_assets')+.01)issues.push(`FY${fy}: current assets exceed total assets.`);
      if(n('current_liabilities')>n('total_liabilities')+.01)issues.push(`FY${fy}: current liabilities exceed total liabilities.`);
      if(Math.abs(n('total_assets')-n('total_liabilities')-n('equity'))>Math.max(.05,n('total_assets')*.01))issues.push(`FY${fy}: balance sheet does not balance.`);
    });
  }
  return issues;
}
function onboardBlockedBy(s,requestedStep,o){
  for(let prior=1;prior<requestedStep;prior++){
    if(onboardStepIssues(prior,s,o).length)return prior;
  }
  return 0;
}
function onboardCanEdit(s,step,o){return !onboardBlockedBy(s,step,o);}

function onboardPage(d){
 const s=ui.onboard,o=d.onboarding||{},steps=['Borrower Details','Sanction & Facilities','Baseline Financials','Review & Add'];
 const sectorNames=Object.keys(o.sectors||{});
 const blockedBy=onboardBlockedBy(s,s.step,o);
 const previewOnly=Boolean(blockedBy);
 const sub=(o.sectors||{})[s.details.sector]||[];
 const formStart=n=>`<form data-onboard-step="${n}" class="cw-ob-form">`;
 const foot=(nextLabel)=>`<div class="cw-ob-actions">${s.step>1?'<button type="button" class="btn btn-outline" data-onboard-back>Back</button>':'<button type="button" class="btn btn-outline" data-onboard-reset>Clear</button>'}<button type="submit" class="btn btn-primary" ${s.pending?'disabled':''}>${E(nextLabel)} ${ico('arrow',14)}</button></div></form>`;
 let content='';
 if(s.completed){
   return `${sectionHead('SANCTIONED BORROWER MASTER','Onboard Borrower','Register newly sanctioned borrowers for post-sanction monitoring.')}
   <section class="panel cw-ob-done">${ico('check',38)}<h2>Borrower added successfully</h2><p><strong>${E(s.completed)}</strong> has been saved in Existing Borrowers, with its facilities and baseline financials. Monitoring is not yet active.</p><p>VP/CRO can activate this borrower and assign it to Analyst from Review & Approvals → Assignment & Ownership.</p><div class="cw-ob-actions"><button type="button" class="btn btn-outline" data-onboard-reset>Onboard another borrower</button><button type="button" class="btn btn-primary" data-onboard-view="${E(s.completed)}">View borrower ${ico('arrow',14)}</button></div></section>`;
 }
 if(s.step===1){
  content=`${formStart(1)}<div class="cw-ob-panel-title"><h3>1. Borrower Details</h3><p>Enter the basic information of a newly sanctioned corporate or MSME borrower.</p></div>
    <div class="cw-ob-grid">
      <label class="cw-ob-field"><span>Borrower ID</span><input value="${E(o.next_id||'Generated on save')}" disabled><small>Automatically assigned when the record is saved</small></label>
      ${obField('Borrower Name','company_name',s.details.company_name||'','text','maxlength="180"')}
      ${obSelect('Legal Constitution','legal_constitution',o.legal_constitutions||[],s.details.legal_constitution)}
      ${obSelect('Industry Sector','sector',sectorNames,s.details.sector)}
      ${obSelect('Sub Sector','sub_industry',sub,s.details.sub_industry)}
      ${obField('Location (Registered HQ)','location',s.details.location||'','text','maxlength="150"')}
      ${obField('CIN / Registration No.','registration_no',s.details.registration_no||'','text','maxlength="40"')}
      ${obField('GSTIN','gstin',s.details.gstin||'','text','minlength="15" maxlength="15" pattern="[0-9A-Za-z]{15}"')}
      ${obSelect('Borrower Segment','segment',['MSME','Corporate'],s.details.segment)}
    </div>
    <label class="cw-ob-field cw-ob-description"><span>Brief Business Description (Optional)</span><textarea name="description" rows="3" maxlength="750" placeholder="What does the company do?">${E(s.details.description||'')}</textarea></label>
    ${foot('Next: Sanction & Facilities')}`;
 }
 if(s.step===2){
  content=`${formStart(2)}<div class="cw-ob-panel-title"><h3>2. Sanction & Facilities</h3><p>Enter the sanction date and actual credit facilities. All amounts are in ₹ crore.</p></div>
    <div class="cw-ob-grid">${obField('Sanction Date','sanction_date',s.sanction.sanction_date||'','date',`max="${obDateOffset(0)}"`)}
    ${obField('First Monitoring Due Date','monitoring_due_date',s.sanction.monitoring_due_date||obDateOffset(90),'date')}</div>
    <div class="cw-ob-collection-head"><h4>Sanctioned credit facilities</h4><button class="btn btn-outline" type="button" data-onboard-add-facility ${s.facilities.length>=8?'disabled':''}>${ico('plus',14)} Add facility</button></div>
    ${s.facilities.map((f,i)=>`<div class="cw-ob-repeat"><div class="cw-ob-repeat-head"><strong>Facility ${i+1}</strong>${s.facilities.length>1?`<button type="button" class="text-action" data-onboard-remove-facility="${i}">Remove</button>`:''}</div>
      <div class="cw-ob-grid">
        ${obSelect('Facility Type',`f.${i}.facility_type`,o.facility_types||['CC','OD','TERM','BG'],f.facility_type)}
        ${obField('Sanctioned Limit (₹ Cr)',`f.${i}.sanctioned_limit`,f.sanctioned_limit,'number','min="0.000001" step="any"')}
        ${obField('Annual Interest Rate (%)',`f.${i}.interest_rate`,f.interest_rate,'number','min="0" max="40" step="any"')}
        ${obField('Maturity Date',`f.${i}.maturity_date`,f.maturity_date,'date')}
        ${obField('Opening Outstanding (₹ Cr)',`f.${i}.outstanding_cr`,f.outstanding_cr,'number','min="0" step="any"',false)}
      </div><p class="cw-ob-hint">Opening outstanding is optional for funded facilities. Leave it blank if it is not verified; never treat missing data as zero. BG has no funded outstanding.</p>
    </div>`).join('')}
    ${foot('Next: Baseline Financials')}`;
 }
 if(s.step===3){
  const groupEntries=Object.entries(o.financial_groups||{});
  const years=s.baselines.length?s.baselines:[{fy:new Date().getFullYear()-1,statement_type:'Audited',data:{}}];
  content=`${formStart(3)}<div class="cw-ob-panel-title"><h3>3. Baseline Financials</h3><p>Enter 1–3 audited or provisional historical financial years. These are the sanction-reference figures, not post-sanction monitoring updates.</p></div>
    <div class="cw-ob-collection-head"><h4>Historical financial years</h4><button type="button" class="btn btn-outline" data-onboard-add-fy ${years.length>=3?'disabled':''}>${ico('plus',14)} Add financial year</button></div>
    ${years.map((b,i)=>`<div class="cw-ob-repeat"><div class="cw-ob-repeat-head"><strong>Baseline year ${i+1}</strong>${years.length>1?`<button type="button" class="text-action" data-onboard-remove-fy="${i}">Remove</button>`:''}</div>
      <div class="cw-ob-grid">${obField('Financial Year',`b.${i}.fy`,b.fy,'number',`min="2015" max="${Math.min(new Date().getFullYear(),Number(s.sanction.sanction_date?.slice(0,4)||new Date().getFullYear()))}" step="1"`)}
      ${obSelect('Statement Type',`b.${i}.statement_type`,['Audited','Provisional'],b.statement_type||'Audited')}</div>
      ${groupEntries.map(([group,fields])=>`<div class="cw-ob-fin-group"><h4>${E(group)} <small>₹ Cr</small></h4><div class="cw-ob-fin-grid">${Object.entries(fields).map(([key,label])=>obField(label,`b.${i}.${key}`,(b.data||{})[key]??'','number','step="any"')).join('')}</div></div>`).join('')}
    </div>`).join('')}
    <p class="cw-ob-hint">The Python finance engine validates balance-sheet equality, revenue and required numeric fields before saving. Missing fields cannot be silently assumed to be zero.</p>
    ${foot('Next: Review & Add')}`;
 }
 if(s.step===4){
  const d0=s.details, sa=s.sanction;
  content=`${formStart(4)}<div class="cw-ob-panel-title"><h3>4. Review & Add</h3><p>Check all details before creating this borrower. The master record is created only once, on confirmation.</p></div>
    <div class="cw-ob-review-grid">
     <div class="cw-ob-review"><h4>Borrower</h4><dl>
       <dt>ID (reserved preview)</dt><dd>${E(o.next_id)}</dd><dt>Company</dt><dd>${E(d0.company_name)}</dd>
       <dt>Legal constitution</dt><dd>${E(d0.legal_constitution)}</dd><dt>Sector / Sub-sector</dt><dd>${E(d0.sector)} / ${E(d0.sub_industry)}</dd>
       <dt>Segment</dt><dd>${E(d0.segment)}</dd><dt>Location</dt><dd>${E(d0.location)}</dd>
       <dt>CIN / Registration</dt><dd>${E(d0.registration_no)}</dd><dt>GSTIN</dt><dd>${E(d0.gstin)}</dd>
     </dl></div>
     <div class="cw-ob-review"><h4>Sanction</h4><dl><dt>Sanction date</dt><dd>${E(sa.sanction_date)}</dd><dt>Monitoring due</dt><dd>${E(sa.monitoring_due_date)}</dd><dt>Facilities</dt><dd>${s.facilities.length}</dd><dt>Sanctioned total</dt><dd>${CR(s.facilities.reduce((v,f)=>v+Number(f.sanctioned_limit||0),0))}</dd><dt>Baseline FYs</dt><dd>${s.baselines.map(b=>`FY${E(b.fy)}`).join(', ')}</dd></dl></div>
    </div>
    <div class="cw-ob-review"><h4>Facilities</h4>${table(['Facility','Type','Sanctioned limit','Opening O/S','Maturity'],s.facilities.map((f,i)=>`<tr><td>${i+1}</td><td>${E(f.facility_type)}</td><td>${CR(f.sanctioned_limit)}</td><td>${f.outstanding_cr===''?'Not provided':CR(f.outstanding_cr)}</td><td>${E(f.maturity_date)}</td></tr>`))}</div>
    <div class="cw-ob-note">${ico('shield',17)} <span>The borrower will appear in <strong>Existing Borrowers</strong> as <strong>Not activated</strong>. Only VP/CRO can activate monitoring and assign responsibility. No transaction history or EWS triggers are fabricated. Use synthetic demo information until the app is access-controlled.</span></div>
    <label class="cw-ob-confirm"><input type="checkbox" name="ack" required><span>I confirm that these sanction details and baseline financial statements are ready to add to CreditWatch.</span></label>
    ${foot(s.pending?'Saving borrower…':'Confirm & Add Borrower')}`;
 }
 const stepper=`<div class="cw-ob-stepper" aria-label="Onboarding stages — click any stage to view">${steps.map((label,i)=>{
    const n=i+1,done=n<s.step&&!onboardStepIssues(n,s,o).length,locked=!!onboardBlockedBy(s,n,o);
    return `<button type="button" data-onboard-jump="${n}" class="cw-ob-step ${n===s.step?'active':''} ${done?'done':''} ${locked?'preview':''}" ${n===s.step?'aria-current="step"':''} ${s.pending?'disabled':''} title="${locked?'View fields — complete earlier stages to edit':'Open '+E(label)}"><span>${done?ico('check',14):n}</span><strong>${E(label)}</strong></button>`;
  }).join('')}</div>`;
 
const side=`<aside class="cw-ob-side">
  <div class="cw-ob-info">
    <h3>${ico('check',19)} Onboarding Progress</h3>
    ${steps.map((label,i)=>{
      const n=i+1,done=n<s.step&&!onboardStepIssues(n,s,o).length;
      return `<button type="button" data-onboard-jump="${n}" class="cw-ob-progress ${n===s.step?'active':''}" ${n===s.step?'aria-current="step"':''} ${s.pending?'disabled':''}><span>${done?'✓':n}</span>${E(label)}${onboardBlockedBy(s,n,o)?'<small>View only</small>':''}</button>`;
    }).join('')}
  </div>
</aside>`;

 const lockNotice=previewOnly?`<div class="cw-ob-preview-banner" role="status"><div>${ico('shield',18)} <span><strong>Preview only.</strong> Complete <b>${E(steps[blockedBy-1])}</b> to enter data in this stage. You can view the required fields now, but cannot change them.</span></div><button type="button" class="btn btn-outline" data-onboard-jump="${blockedBy}">Go to ${E(steps[blockedBy-1])}</button></div>`:'';
 const validationNotice=s.error?`<div class="cw-ob-error" role="alert">${ico('alert',17)} ${E(s.error)}</div>`:'';
 return `${sectionHead('SANCTIONED BORROWER MASTER','Onboard Borrower','Add a newly sanctioned borrower to CreditWatch for monitoring.')}${stepper}<div class="cw-ob-layout"><section class="panel cw-ob-main ${previewOnly?'cw-ob-readonly':''}">${lockNotice}${validationNotice}${content}</section>${side}</div>`;
}

const ui={
 page:'guide',
 onboard:newOnboardState(),
 tab:'snapshot',
 signal:'CW-01',
 financialEditor:null,
 search:'',
 caseId:null,
 overviewFocus:null,
 ewsFocus:null,
 signalFocus:null,
 investigationPriority:'ALL',
 aiRiskBorrower:null,
 aiRiskScope:'master',
 aiPortfolioScope:'active',
 aiPortfolioQuestion:''
};
let currentData=null;

function loginPage(d){return `<div class="login">
  <style>
    /* Entrance page role cards only. Original colours and left panel stay intact. */
    .login-box .cw-role-login {
      margin-top: 17px;
    }

    .login-box .cw-role-options {
      display: grid;
      gap: 7px;
      margin-top: 9px;
    }

    .login-box .cw-role-option {
      position: relative;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 11px;
      border: 1px solid #dce5e9;
      border-radius: 9px;
      background: #fff;
      cursor: pointer;
      line-height: 1.25;
      transition: border-color .18s ease,
                  background-color .18s ease,
                  box-shadow .18s ease,
                  transform .18s ease;
    }

    .login-box .cw-role-option:hover {
      border-color: #008f89;
      transform: translateY(-1px);
      box-shadow: 0 3px 12px rgba(13,42,60,.06);
    }

    .login-box .cw-role-option:has(input:checked) {
      border-color: #008f89;
      background: rgba(0,143,137,.055);
      box-shadow: 0 0 0 1px rgba(0,143,137,.10);
    }

    .login-box .cw-role-option:focus-within {
      outline: 2px solid #008f89;
      outline-offset: 2px;
    }

    .login-box .cw-role-option input[type="radio"] {
      position: absolute;
      opacity: 0;
      width: 1px;
      height: 1px;
      margin: 0;
      padding: 0;
      pointer-events: none;
    }

    .login-box .cw-role-icon {
      display: flex;
      color: #617283;
      flex: 0 0 auto;
    }

    .login-box .cw-role-option:has(input:checked) .cw-role-icon {
      color: #008f89;
    }

    .login-box .cw-role-name {
      flex: 1 1 auto;
      font-size: 13.5px;
      font-weight: 600;
      color: #142a40;
    }

    .login-box .cw-role-indicator {
      display: block;
      box-sizing: border-box;
      flex: 0 0 14px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 1.5px solid #a8b8c1;
      background: #fff;
    }

    .login-box .cw-role-option:has(input:checked) .cw-role-indicator {
      border: 4px solid #008f89;
    }

    .login-box .cw-role-info {
      margin-top: 12px;
      padding: 10px 12px;
      border-left: 3px solid #008f89;
      background: rgba(0,143,137,.055);
      border-radius: 6px;
    }

    .login-box .cw-role-info-title {
      display: block;
      font-size: 12.5px;
      font-weight: 700;
      color: #142a40;
      margin-bottom: 3px;
    }

    .login-box .cw-role-info-text {
      display: block;
      font-size: 12.5px;
      line-height: 1.5;
      color: #536a7a;
    }

    .login-box .cw-role-description {
      display: none;
    }

    .cw-role-login:has(input[value="VP/CRO"]:checked) .cw-desc-cro,
    .cw-role-login:has(input[value="AVP"]:checked) .cw-desc-avp,
    .cw-role-login:has(input[value="Analyst"]:checked) .cw-desc-analyst {
      display: block;
    }

    @media (prefers-reduced-motion: reduce) {
      .login-box .cw-role-option {
        transition: none;
        transform: none !important;
      }
    }
  </style>

  <div class="login-story">
    <div class="story-top">
      <div class="brand-mark">${ico('layers',27)}</div>
      <div>
        <strong>CreditWatch</strong>
        <span>POST-SANCTION INTELLIGENCE</span>
      </div>
    </div>

    <div class="story-copy">
      <div class="micro">LENDING RISK, IN MOTION.</div>
      <h1>Stay ahead of<br/><em>credit deterioration.</em></h1>
      <p>One workspace for Borrower Surveillance & Early warning system investigation and formal monitoring approvals.</p>
    </div>

    <div class="story-bottom" style="height:22px" aria-hidden="true"></div>
    <div class="story-ring ring-one"></div>
    <div class="story-ring ring-two"></div>
  </div>

  <div class="login-content">
    <div class="login-box">
      <div class="eyebrow">ACCESS WORKSPACE</div>
      <h2>Welcome to CreditWatch</h2>
      <p>Choose your monitoring designation to explore the Lending Portfolio.</p>

      <form data-form="login" class="cw-role-login">

        <div class="form-label" id="cw-role-label">
          Select your designation
        </div>

        <div class="cw-role-options" role="radiogroup" aria-labelledby="cw-role-label">

          <!-- 1. VP / CRO -->
          <label class="cw-role-option">
            <input type="radio" name="role" value="VP/CRO" checked required />
            <span class="cw-role-icon">${ico('shield',16)}</span>
            <span class="cw-role-name">VP / Chief Risk Officer</span>
            <span class="cw-role-indicator" aria-hidden="true"></span>
          </label>

          <!-- 2. AVP -->
          <label class="cw-role-option">
            <input type="radio" name="role" value="AVP" required />
            <span class="cw-role-icon">${ico('review',16)}</span>
            <span class="cw-role-name">Monitoring AVP</span>
            <span class="cw-role-indicator" aria-hidden="true"></span>
          </label>

          <!-- 3. ANALYST -->
          <label class="cw-role-option">
            <input type="radio" name="role" value="Analyst" required />
            <span class="cw-role-icon">${ico('user',16)}</span>
            <span class="cw-role-name">Monitoring Analyst</span>
            <span class="cw-role-indicator" aria-hidden="true"></span>
          </label>

        </div>

        <!-- Dynamic role descriptions -->
        <div class="cw-role-info" role="status" aria-live="polite">

          <div class="cw-role-description cw-desc-cro">
            <span class="cw-role-info-title">
              VP / Chief Risk Officer
            </span>
            <span class="cw-role-info-text">
              Oversee portfolio risk, make final monitoring decisions and review audited baseline corrections.
            </span>
          </div>

          <div class="cw-role-description cw-desc-avp">
            <span class="cw-role-info-title">
              Monitoring AVP
            </span>
            <span class="cw-role-info-text">
              Review reports, correct monitoring records and return or forward submissions.
            </span>
          </div>

          <div class="cw-role-description cw-desc-analyst">
            <span class="cw-role-info-title">
              Monitoring Analyst
            </span>
            <span class="cw-role-info-text">
              Monitor borrowers, investigate early warning signals and submit reports for review.
            </span>
          </div>

        </div>

        <button
          type="submit"
          class="btn btn-primary wide"
          style="margin-top: 15px;"
        >
          Enter monitoring workspace ${ico('arrow',16)}
        </button>

      </form>
    </div>
  </div>
</div>`;}


const NAV=[
 ['guide','file','How It Works'],
 ['onboard','plus','Onboard Borrower'],
 ['overview','dashboard','Command Centre'],
 ['borrower','building','Borrower Monitoring'],
 ['ews','alert','Early Warning Desk'],
 ['reviews','review','Review & Approvals'],
 ['data','database','Monitoring Data']
];

const allowedNav=d=>NAV.filter(([key])=>(d.available_pages||[]).includes(key));



function shell(d,body){

  const isCRO = d.role === 'VP/CRO';
  const visibleNav = allowedNav(d);

  // Role-specific profile display
  const roleAvatar =
    d.role === 'VP/CRO' ? 'CR' :
    d.role === 'AVP' ? 'AV' : 'AN';

  return `<div class="app-shell">

    <style>
      /* CreditWatch compact profile-style header */

      .cw-header-profile {
        display: inline-flex;
        align-items: center;
        gap: 9px;
        flex-shrink: 0;
      }

      .cw-header-avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        flex: 0 0 32px;
        border-radius: 50%;
        background: #008f89;
        color: #ffffff;
        font-size: 11px;
        font-weight: 700;
      }

      .cw-header-identity {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 2px;
        white-space: nowrap;
      }

      .cw-header-identity strong {
        color: #142a40;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.2;
      }

      .cw-header-identity span {
        color: #718696;
        font-size: 10px;
        font-weight: 500;
        line-height: 1.2;
      }

      .cw-header-exit {
        display: inline-flex;
        align-items: center;
        justify-content: center;

        width: 32px;
        height: 32px;
        flex: 0 0 32px;

        margin-left: 8px;
        padding: 0;

        background: #ffffff;
        color: #355b69;

        border: 1px solid #dce9eb;
        border-radius: 9px;

        cursor: pointer;

        transition:
          background-color .18s ease,
          border-color .18s ease,
          color .18s ease;
      }

      .cw-header-exit:hover {
        background: rgba(0,143,137,.07);
        color: #008f89;
        border-color: #008f89;
      }

      .cw-header-exit:focus-visible {
        outline: 2px solid #008f89;
        outline-offset: 2px;
      }

      @media (prefers-reduced-motion: reduce) {
        .cw-header-exit {
          transition: none;
        }
      }
    </style>

    <!-- LEFT SIDEBAR -->

    <aside class="sidebar">

      <div class="sidebar-brand">
        <div class="brand-mark">
          ${ico('layers',22)}
        </div>

        <div>
          <div class="brand-name">CreditWatch</div>
          <div class="brand-sub">CREDIT SURVEILLANCE</div>
        </div>
      </div>

      <div class="sidebar-caption">WORKSPACE</div>

      <nav class="side-nav">

        ${visibleNav.map(([key,symbol,title])=>`

          <button
            type="button"
            class="nav-item ${ui.page===key?'active':''}"
            data-nav="${key}"
          >

            ${ico(symbol,19)}

            <span>
              ${key==='overview'&&!isCRO
                ? 'Monitoring Overview'
                : title}
            </span>

            ${ui.page===key
              ? '<span class="active-marker"></span>'
              : ''}

          </button>

        `).join('')}

      </nav>

    </aside>

    <!-- MAIN CONTENT -->

    <main class="main">

      <div class="topbar">

        <div class="topbar-breadcrumb">

          <span>CreditWatch</span>

          ${ico('chevron',14)}

          <b>
            ${E(
              visibleNav.find(x=>x[0]===ui.page)?.[2]
              || 'Borrower Monitoring'
            )}
          </b>

        </div>

        <!-- TOP-RIGHT PROFILE SECTION -->

        <div class="topbar-right">

          <!-- Existing date -->
          <span class="date-pill">

            Today: ${E(
              new Date().toLocaleDateString('en-GB',{
                timeZone: 'Asia/Kolkata',
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              })
            )}

          </span>

          <!-- Compact role profile -->
          <div
            class="cw-header-profile"
            aria-label="Current designation: ${E(d.role)}"
          >

            <div class="cw-header-avatar">
              ${E(roleAvatar)}
            </div>

            <div class="cw-header-identity">

              <strong>
                ${E(d.role)}
              </strong>

              <span>
                Workspace
              </span>

            </div>

          </div>

          <!-- Compact Exit icon -->
          <button
            type="button"
            class="cw-header-exit"
            data-logout
            title="Exit CreditWatch workspace"
            aria-label="Exit CreditWatch workspace"
          >

            ${ico('logout',15)}

          </button>

        </div>

      </div>

      <!-- Notices -->

      ${d.notice ? `

        <div class="notice ${d.notice.type==='error'?'error':''}">

          ${ico(
            d.notice.type==='error'?'alert':'check',
            18
          )}

          ${E(d.notice.text||d.notice)}

        </div>

      ` : ''}

      <!-- Existing workspace content -->

      <div class="content">
        ${body}
      </div>

      <!-- Existing footer -->

      <div class="global-footer">

        CREDITWATCH V1.0

        <span>·</span>

        SYNTHETIC PORTFOLIO

        <span>·</span>

        INTERNAL DEMONSTRATION ONLY

        <span>·</span>

        NOT AN RBI SMA/NPA CLASSIFICATION

      </div>

    </main>

  </div>`;
}



function navToBorrower(id){ui.page='borrower';ui.tab='snapshot';ui.financialEditor=null;return id;}
function borrowerLink(r){return `<button type="button" class="link-button" data-open-borrower="${E(r.id)}">${E(r.name)}${ico('chevron',13)}</button>`;}

function spark(values){
 const pts=values.map(v=>v==null?null:Number(v));
 const valid=pts.filter(x=>x!==null&&Number.isFinite(x));
 if(!valid.length)return '<div class="no-spark">No series</div>';
 let mn=Math.min(...valid),mx=Math.max(...valid),ran=mx===mn?1:mx-mn;
 const path=pts.map((v,i)=>v==null?null:`${i?'L':'M'}${15+i*(190/(pts.length-1||1))} ${68-(v-mn)/ran*48}`).filter(Boolean).join(' ');
 return `<svg aria-hidden="true" viewBox="0 0 220 82" width="100%" height="80"><line x1="10" y1="68" x2="207" y2="68" stroke="#dde9ec"/><path d="${path}" stroke="#008b88" stroke-width="2.8" fill="none" stroke-linejoin="round" stroke-linecap="round"/>${pts.map((v,i)=>v==null?'':`<circle cx="${15+i*190/(pts.length-1||1)}" cy="${68-(v-mn)/ran*48}" r="3.2" fill="#008b88"/>`).join('')}</svg>`;
}

const WORKSPACE_GUIDE={
 onboard:['Register a newly sanctioned borrower','Enter borrower details, sanctioned facilities and historical financial statements. Analyst, AVP and VP/CRO can onboard; VP/CRO activates monitoring separately.'],
 overview:['Portfolio-wide oversight','Monitor all sanctioned borrowers, exposure at risk, overdue monitoring reports, risk concentrations and the AVP/CRO review pipeline.'],
 borrower:['Your main borrower workspace','Choose an existing borrower, inspect the read-only sanction baseline, compare post-sanction financials, investigate trends and prepare a monitoring submission. Analyst can edit draft/returned years; AVP can correct submissions; VP/CRO can also amend the baseline with an audit trail.'],
 ews:['Investigate early warning alerts','Review the ten signals and their source evidence, see affected borrowers, investigate alerts and document follow-up. Closing or escalating a case requires AVP/VP-CRO authority.'],
 reviews:['Formal monitoring approvals','Separate pending approvals from returns. AVP reviews reports returned by VP/CRO and can resubmit or return them to Analyst. VP/CRO manages final approval.'],
 data:['Source data and controlled testing','Inspect facilities, dated balances, repayments, covenants and ratings. Authorized roles can inject synthetic stress scenarios to test whether warning signals react correctly.'],
 guide:['Help and role permissions','Learn what each available workspace does, how monitoring reports flow, and what the ten Early Warning Signals mean.']
};

const EWS_GUIDE=[
 ['CW-01','Persistent utilisation','CC/OD utilisation at or above 85% on 15 of 30 days; High at 90% on 20 days.','Sustained reliance on the working-capital limit.','Check seasonality, available drawing power and cash collections.'],
 ['CW-02','Utilisation deterioration','Latest 30-day average rises at least 10 percentage points (High: 20), with current average at least 70%.','Borrowing dependence is rising.','Compare the previous 30 days and investigate working-capital needs.'],
 ['CW-04','Declining account credit','Qualifying operating credit decline by at least 15% (High: 25%) across comparable 30-day periods.','Business inflows may be weakening.','Reconcile credits to sales and exclude internal transfers or loan drawdowns.'],
 ['CW-07','Payment overdue','Internal alert at 1–7 days; High at 8–30; Critical at 31 or more days overdue.','Contractual debt servicing is delayed.','Verify payment dates, amounts due and borrower explanations.'],
 ['CW-11','Revenue deterioration','Revenue falls by at least 5% (High: 15%) versus the comparable sanction-reference actuals.','Business activity may have contracted since sanction.','Check sales mix, demand and sanctioned projections.'],
 ['CW-13','Operating cash-flow deterioration','OCF declines at least 20% (High: 40%) from a positive baseline; negative cash flow may also trigger.','Operations may be generating less cash.','Inspect cash conversion and working-capital movements.'],
 ['CW-14','DSCR deterioration','DSCR below 1.50× or down 0.20×; High below 1.20×, or down 0.40× with latest below 1.50×.','Debt-service headroom has narrowed.','Review CFADS and scheduled principal and interest.'],
 ['CW-16','Receivable days','Receivable days rise at least 10 days and 15%; High at 20 days and 25%.','Customer collections may be slowing.','Review debtor ageing and the CreditLens year-end-receivables/revenue proxy.'],
 ['CW-20','Covenant breach','Alert when financial-covenant headroom is 10% or less; High for an unwaived numerical breach.','The borrower may be close to or outside agreed loan conditions.','Verify covenant wording, test date, valid waivers and cure rights.'],
 ['CW-24','Credit rating migration','A one-notch internal downgrade; High for two or more; Critical for a move into the worst demo grade.','Internal creditworthiness has weakened.','Check comparable dated ratings on the same scale and reasons for downgrade.']
];

function guidePage(d){
 const roleTitle=d.role==='Analyst'?'Monitoring Analyst':d.role==='AVP'?'Monitoring AVP':'VP / Chief Risk Officer';
 const roleIntro={
  Analyst:'Onboard newly sanctioned borrowers; prepare new monitoring periods, examine post-sanction financial movements, investigate early warning signals and submit reports to AVP. Approval and Monitoring Data are restricted.',
  AVP:'Onboard newly sanctioned borrowers; review existing borrowers and EWS alerts, correct submitted monitoring financials, approve or return reports, and use controlled monitoring data tools. VP/CRO gives final approval.',
  'VP/CRO':'Onboard newly sanctioned borrowers and manage full access to the monitoring portfolio, review pipeline, data tools and all borrower actions, including audited baseline corrections and final report approval.'
 }[d.role];

 const items=allowedNav(d);
 const workspaceCards=items.map(([key,symbol,title])=>`<div class="signal-tile"><span class="sig-id">${ico(symbol,18)}</span><div class="sig-text"><b>${E(title)}</b><p>${E(WORKSPACE_GUIDE[key][1])}</p><button type="button" class="text-action" data-nav="${key}">Open ${E(title)} ${ico('arrow',13)}</button></div></div>`).join('');
 const howSignals=EWS_GUIDE.map(([id,name,trigger,why,investigate])=>`<div class="signal-tile"><span class="sig-id">${E(id)}</span><div class="sig-text"><b>${E(name)}</b><p><strong>When it alerts:</strong> ${E(trigger)}</p><p><strong>Why it matters:</strong> ${E(why)}</p><p><strong>What to check:</strong> ${E(investigate)}</p></div></div>`).join('');

 return `${sectionHead('NEW TO CREDITWATCH?','How CreditWatch Works','A quick guide to your permitted workspaces, the monitoring approval flow and the ten early warning indicators.')}
 <div class="section-grid"><section class="panel"><div class="panel-head"><div><div class="eyebrow">YOUR ACCESS</div><h3>${E(roleTitle)}</h3></div>${ico('shield',23)}</div><p class="report-text">${E(roleIntro)}</p><div class="evidence-note">${ico('shield',15)} Your sidebar shows only the workspaces available for this designation.</div></section>
 <section class="panel"><div class="panel-head"><div><div class="eyebrow">CREDIT MONITORING WORKFLOW</div><h3>From monitoring to approval</h3></div></div><div class="signal-list">
 <div class="signal-tile"><span class="sig-id">00</span><div class="sig-text"><b>Onboard a sanctioned borrower</b><p>Analyst, AVP and VP/CRO may register the borrower in the approved master. VP/CRO activates the borrower for monitoring and assigns an Analyst separately.</p></div></div>
 <div class="signal-tile"><span class="sig-id">01</span><div class="sig-text"><b>Analyst prepares</b><p>Choose an existing approved borrower, enter new-period financials, evaluate EWS and submit a post-sanction monitoring report.</p></div></div>
 <div class="signal-tile"><span class="sig-id">02</span><div class="sig-text"><b>AVP reviews</b><p>Check and correct monitoring submissions; approve and forward to VP/CRO or return for revision.</p></div></div>
 <div class="signal-tile"><span class="sig-id">03</span><div class="sig-text"><b>VP/CRO finalizes</b><p>Review the findings, make permitted amendments, approve the final monitoring report, and oversee ongoing portfolio risk.</p></div></div></div></section></div>
 <section class="panel"><div class="panel-head"><div><div class="eyebrow">WORKSPACE GUIDE</div><h3>What each of your tabs does</h3><p>The list below adapts to the designation used to sign in.</p></div></div><div class="section-grid">${workspaceCards}</div></section>
 <section class="panel"><div class="panel-head"><div class="eyebrow">EWS QUICK REFERENCE</div><h3>All ten Early Warning Signals explained</h3><p>What triggers each signal, why it matters after sanction, and the first checks for a monitoring officer.</p></div></div><div class="flag-box">${ico('shield',18)}<div><b>Demonstration screening thresholds</b><p>The examples below describe the current synthetic rule engine. A trigger is an investigation prompt, not proof of default, an RBI SMA/NPA classification, or a contractual breach unless separately verified. Missing data is not a clear signal.</p></div></div><div class="section-grid">${howSignals}</div></section>`;
}

// CW_INVESTIGATION_PRIORITY_FILTER_V1: view-only severity drilldown for AVP and VP/CRO.
const CW_INVESTIGATION_RANK = {CRITICAL:0,HIGH:1,MEDIUM:2,LOW:3};
function cwPriorityCases(sourceCases){
 const chosen=ui.investigationPriority||'ALL';
 return (sourceCases||[])
  .filter(c=>c.status!=='RESOLVED' && (chosen==='ALL'||String(c.severity||'').toUpperCase()===chosen))
  .slice()
  .sort((a,b)=>(CW_INVESTIGATION_RANK[String(a.severity||'').toUpperCase()]??4)-(CW_INVESTIGATION_RANK[String(b.severity||'').toUpperCase()]??4));
}
function cwPriorityFilter(source){
 const active=ui.investigationPriority||'ALL';
 const options=[['ALL','All'],['CRITICAL','Critical'],['HIGH','High'],['MEDIUM','Medium']];
 return `<div class="cw-priority-filter" role="group" aria-label="Filter open investigations by priority" style="display:flex;align-items:center;flex-wrap:wrap;gap:7px;margin:12px 0 14px;">
  <span style="font-size:11px;font-weight:700;color:#60798c;margin-right:4px;">Priority</span>
  ${options.map(([value,label])=>`<button type="button" class="btn ${active===value?'btn-primary':'btn-outline'}" data-investigation-priority="${value}" data-investigation-source="${E(source)}" aria-pressed="${active===value}" style="min-height:30px;padding:6px 11px;border-radius:8px;font-size:11px;line-height:1.1;font-weight:700;">${label}</button>`).join('')}
 </div>`;
}

// Command Centre details
function overviewDetailPanel(d){
 const key=ui.overviewFocus;
 if(!key)return '';

 const o=d.overview;
 const items=o.borrowers||[];
 const cases=cwPriorityCases(o.cases||[]);

 const definitions={
  borrowers:['Existing approved borrowers','All borrowers currently in the monitoring portfolio.'],
  pending:['Pending CRO approval','Monitoring reports waiting for final VP/CRO approval.'],
  triggered:['Borrowers with active EWS','Borrowers with one or more triggered warning indicators.'],
  high:['High / critical watch','Borrowers with a high or critical overall surveillance classification.'],
  funded:['Total funded outstanding','Borrowers ranked by funded outstanding exposure.'],
  highfund:['High / critical funded O/S','Funded outstanding associated with high/critical borrowers, counted once per borrower.'],
  overdue:['Overdue monitoring reports','Non-finalized reports past the monitoring due date.'],
  cases:['Open investigations','EWS investigations that have not been resolved.']
 };

 if(!definitions[key])return '';

 let filtered=key==='pending'?items.filter(r=>r.status==='PENDING_CRO')
  :key==='triggered'?items.filter(r=>Number(r.triggered)>0)
  :key==='high'||key==='highfund'?items.filter(r=>['HIGH','CRITICAL'].includes(r.risk))
  :key==='overdue'?items.filter(r=>r.overdue)
  :items.slice();

 if(key==='funded'||key==='highfund')
  filtered.sort((a,b)=>Number(b.funded_os_cr||0)-Number(a.funded_os_cr||0));

 const reportRows=filtered.map(r=>`<tr><td>${borrowerLink(r)}<span class="sub-id">${E(r.id)} · ${E(r.sector||'')}</span></td><td>${levelTag(r.risk)}</td><td class="num">${E(r.triggered)}</td><td class="num">${CR(r.funded_os_cr)}</td><td>${statusTag(r.status)}</td></tr>`);
 const caseRows=cases.map(c=>`<tr><td><button type="button" class="link-button" data-open-borrower="${E(c.borrower_id)}" data-open-tab="signals">${E(c.company)}</button></td><td>${E(c.signal_id)}</td><td>${levelTag(c.severity)}</td><td>${E(c.status)}</td><td>${E(c.updated_at||'—')}</td></tr>`);

 return `<section class="panel" id="overview-focus-panel" style="scroll-margin-top:20px">
 <div class="panel-head"><div><div class="eyebrow">COMMAND CENTRE / SELECTED METRIC</div><h3>${E(definitions[key][0])} (${key==='cases'?cases.length:filtered.length})</h3><p>${E(definitions[key][1])}</p></div>
 <button type="button" class="btn btn-outline" data-summary-reset="overview">View full dashboard</button></div>
 ${key==='cases'?cwPriorityFilter('overview'):''}
 ${key==='cases'?table(['Borrower','Signal','Priority','Status','Last updated'],caseRows,'No investigations match the selected priority.')
 :table(['Existing borrower','Risk','Signals','Funded O/S','Report status'],reportRows,'No matching borrowers.')}
 </section>`;
}

// CW_GROQ_INTELLIGENCE_V1: CRO-only free-form portfolio questions.
// Calculations and filters are performed by Python, not by the model.
function cwPortfolioIntelligencePanel(d){
 if(d.role!=='VP/CRO')return '';
 const last=d.ai_portfolio_result;
 const query=ui.aiPortfolioQuestion||'';
 const recordRows=(last?.matches||[]).map(r=>`<tr>
   <td><strong>${E(r.name)}</strong><span class="sub-id">${E(r.borrower_id)} · ${E(r.sector)}</span></td>
   <td>${levelTag(r.risk)}</td><td class="num">${E(r.triggered)}</td>
   <td class="num">${CR(r.funded_os_cr)}</td><td>${statusTag(r.status)}</td>
 </tr>`);
 const filters=(last?.filters||[]).map(f=>f.value!=null?`${f.field}: ${f.value}`:`${f.field}: ${(f.values||[]).join(', ')}${f.match==='all'?' (all)':''}`).join(' · ');
 const out=last?`<div class="assistant-response" aria-live="polite" style="margin-top:16px">
   <div class="eyebrow">PYTHON-VERIFIED PORTFOLIO RESULTS</div>
   <p><b>Question:</b> ${E(last.question)}</p>
   <p><b>Scope:</b> ${last.scope==='active'?'VP/CRO-activated monitoring borrowers':'Approved borrower master (including unactivated borrowers)'}</p>
   <p><b>Filters applied:</b> ${E(filters||'None - full selected scope')}</p>
   <div class="metric-grid compact-metrics" style="margin:12px 0">
    ${kpi('Scope borrowers',N(last.scope_total,0),'Python source')}
    ${kpi('Matching borrowers',N(last.total.borrowers,0),'Python filtered')}
    ${kpi('Matching funded O/S',CR(last.total.funded_os_cr),'Python aggregated')}
   </div>
   ${table(['Matched borrower','Risk','Triggered EWS','Funded O/S','Report status'],recordRows,'No matching borrowers.')}
   ${last.commentary?`<div style="margin-top:16px"><div class="eyebrow">GROQ QUALITATIVE PORTFOLIO INTELLIGENCE</div>
     ${cwAIProse(last.commentary,[['portfolio_assessment','Portfolio assessment'],['why_it_matters','Credit risk implications'],['if_trends_continue','If current trends continue'],['recommended_follow_up','Recommended monitoring actions']])}</div>`:''}
   <div class="mini-note">${E(last.notice)}</div>
 </div>`:'';
 return `<section class="panel" id="cw-ai-portfolio" style="scroll-margin-top:20px">
  <div class="panel-head"><div><div class="eyebrow">VP/CRO · AI INTELLIGENCE</div>
    <h3>AI Portfolio Intelligence</h3>
    <p>Ask any portfolio question in your own words. Python selects borrowers, filters records and calculates all displayed numbers.</p>
  </div>${ico('spark',20)}</div>
  <form data-form="ai_portfolio_intelligence" class="ask-form">
    <label class="form-field"><span>Ask a question about monitored borrowers</span>
      <textarea name="question" rows="3" minlength="5" maxlength="1200" required placeholder="Ask about risks, exposures, financial deterioration, EWS combinations or a particular borrower...">${E(query)}</textarea>
    </label>
    <label class="form-field"><span>Which borrowers should Python search?</span>
      <select name="scope" required>
        <option value="active" ${ui.aiPortfolioScope==='active'?'selected':''}>Active monitoring - VP/CRO-selected borrowers</option>
        <option value="master" ${ui.aiPortfolioScope==='master'?'selected':''}>All approved borrowers</option>
      </select>
    </label>
    <div class="consent-row"><label><input type="checkbox" name="ai_consent" required ${d.groq_configured?'':'disabled'}/> I consent to sending synthetic portfolio evidence to AI</label></div>
    <div class="ask-bottom"><span>${d.groq_configured?'AI available when consent is checked':'Groq key missing - configure server secret to enable'}</span>
      <button type="submit" class="btn btn-primary" ${d.groq_configured?'':'disabled'}>Analyse Portfolio ${ico('arrow',16)}</button></div>
  </form>
  ${out}
 </section>`;
}

function cwAIProse(parts,sections){
 return sections.map(([key,title])=>`<div style="margin:12px 0"><h4 style="margin:0 0 6px">${E(title)}</h4><p>${E(parts?.[key]||'Not available')}</p></div>`).join('');
}

function overviewPage(d){
 const o=d.overview,m=o.metrics,role=d.role;
 const pending=m.overdue_reports;
 const signalBars=o.signal_counts.map(s=>`<button type="button" class="signal-bar-row" data-focus-signal="${s.id}"><span><b>${E(s.id)}</b> ${E(s.name)}</span><div class="bar-track"><div class="bar-fill" style="width:${100*s.count/Math.max(1,m.borrowers)}%"></div></div><strong>${s.count}</strong></button>`).join('');
 const pipeline=[['NOT_STARTED','Not started'],['DRAFT','Draft'],['PENDING_AVP','With AVP'],['PENDING_CRO','With CRO'],['RETURNED','Returned'],['FINALIZED','Finalized']].map(([s,l])=>`<div class="pipeline-item"><div class="pipeline-number">${o.counts[s]||0}</div><span>${l}</span></div>`).join('');

 let visible=[...o.borrowers].sort((a,b)=>(riskRank[a.risk]-riskRank[b.risk])||b.triggered-a.triggered);
 if(ui.search.trim())
  visible=visible.filter(x=>`${x.name} ${x.id} ${x.sector}`.toLowerCase().includes(ui.search.toLowerCase()));
 const watch=visible.slice(0,20).map(r=>`<tr><td>${borrowerLink(r)}<span class="sub-id">${E(r.id)} · ${E(r.segment)}</span></td><td>${levelTag(r.risk)}</td><td class="num">${r.triggered}</td><td class="num">${CR(r.funded_os_cr)}</td><td>${statusTag(r.status)}</td></tr>`);

 return `${sectionHead('PORTFOLIO INTELLIGENCE',role==='VP/CRO'?'Risk monitoring command centre':'Monitoring overview','Existing sanctioned borrowers only. Review changing exposures, EWS triggers and the formal monitoring pipeline.')}
 <div class="hero-banner"><div><span class="hero-kicker">MONITORING DATA SNAPSHOT · ${E(d.metadata.generated_as_of)}</span><h2>From account conduct<br/>to early intervention.</h2><p>Monitor the post-sanction financial trajectory of every existing borrower.</p></div><div class="hero-graphic"><div class="orbit orbit-a"></div><div class="orbit orbit-b"></div><div class="hero-central">${ico('chart',35)}</div></div></div>

 <div class="metric-grid">
 ${actionKpi('Existing approved borrowers',N(m.borrowers,0),'Corporate and MSME','overview','borrowers','',ui.overviewFocus==='borrowers')}
 ${actionKpi('Pending CRO approval',N(o.counts.PENDING_CRO||0,0),'Monitoring reports','overview','pending','highlight',ui.overviewFocus==='pending')}
 ${actionKpi('Borrowers with active EWS',N(m.triggered_borrowers,0),'Unique borrowers, not signals','overview','triggered')}
 ${actionKpi('High / critical watch',N(m.high_critical,0),`${N(m.unassessed,0)} unassessed`,'overview','high','danger',ui.overviewFocus==='high')}
 ${actionKpi('Total funded outstanding',CR(m.total_funded_os_cr),'Across funded facilities','overview','funded','',ui.overviewFocus==='funded')}
 ${actionKpi('High / critical funded O/S',CR(m.high_critical_funded_cr),'Counted once per borrower','overview','highfund','danger',ui.overviewFocus==='highfund')}
 ${actionKpi('Overdue monitoring reports',N(pending,0),'Pending past due date','overview','overdue','',ui.overviewFocus==='overdue')}
 ${actionKpi('Open investigations',N(m.unresolved_cases,0),'Across 10 signal categories','overview','cases','',ui.overviewFocus==='cases')}
 </div>
 ${overviewDetailPanel(d)}
 ${cwPortfolioIntelligencePanel(d)}

 <div class="section-grid"><section class="panel"><div class="panel-head"><div><div class="eyebrow">WORKFLOW</div><h3>Monitoring approval pipeline</h3></div><button class="text-action" data-nav="reviews">Review all ${ico('arrow',15)}</button></div><div class="pipeline">${pipeline}</div><p class="panel-caption">Each figure represents the latest recorded monitoring report per existing borrower.</p></section>
 <section class="panel"><div class="panel-head"><div><div class="eyebrow">EARLY WARNING INTELLIGENCE</div><h3>Which signals are firing?</h3></div><button class="text-action" data-nav="ews">Signal desk ${ico('arrow',15)}</button></div><div class="signal-bars">${signalBars}</div></section></div>

 <section class="panel"><div class="panel-head"><div><div class="eyebrow">MONITORING REGISTER</div><h3>Borrowers needing attention</h3><p>Sorted by current surveillance risk. Open a borrower to see the source evidence and approval status.</p></div><input class="compact-search" placeholder="Search borrowers…" data-filter value="${E(ui.search)}" aria-label="Filter borrowers"/></div>
 ${table(['Existing borrower','EWS risk','Signals','Funded O/S','Report status'],watch,'No borrowers match your filter.')}</section>

 <div class="section-grid"><section class="panel"><div class="panel-head"><h3>Risk distribution</h3></div><div class="distribution">${['LOW','MEDIUM','HIGH','CRITICAL','UNASSESSED'].map(l=>`<div class="dist-row"><span>${levelTag(l)}</span><div class="bar-track"><div class="bar-fill ${l.toLowerCase()}" style="width:${100*(o.risk_distribution[l]||0)/Math.max(1,m.borrowers)}%"></div></div><b>${o.risk_distribution[l]||0}</b></div>`).join('')}</div></section>
 <section class="panel"><div class="panel-head"><h3>Risk by sector</h3></div>${table(['Sector','Borrowers','High/Critical','Funded O/S'],o.sectors.sort((a,b)=>b.high-a.high).map(s=>`<tr><td>${E(s.sector)}</td><td class="num">${s.borrowers}</td><td class="num">${s.high}</td><td class="num">${CR(s.funded_os_cr)}</td></tr>`))}</section></div>`;
}

function borrowerSelector(d){
 return `<label class="select-wrapper">Existing borrower<select data-borrower-select aria-label="Choose existing borrower">${d.overview.borrowers.map(b=>`<option value="${E(b.id)}" ${b.id===d.selected_borrower?'selected':''}>${E(b.name)} · ${E(b.id)}</option>`).join('')}</select></label>`;
}

// Returned monitoring reports are routed to a role, never an individual assignee.
function returnQueue(d,destination){
 return d.overview.borrowers.filter(r=>r.monitoring_active===true && r.status==='RETURNED'&&(destination==='all'||r.returned_to===destination));
}

function returnedPanel(rows,heading,description,showDestination=false,anchor='returned-reports'){
 const cols=['Borrower','Monitoring FY','Returned on','Reason'];
 if(showDestination)cols.push('Returned to');
 cols.push('Action');

 const trs=rows.map(r=>`<tr><td><strong>${E(r.name)}</strong><span class="sub-id">${E(r.id)}</span></td>
 <td>FY${E(r.fin_year??'—')}</td><td>${E((r.returned_at||'—').slice(0,10))}</td>
 <td class="return-reason-cell">${E(r.return_reason||(r.legacy_return_unknown?'Historical return — originating reviewer not recorded':'See review history for details'))}</td>
 ${showDestination?`<td><span class="status status-returned">${E(r.returned_to||'—')}</span></td>`:''}
 <td><button type="button" class="text-action" data-open-borrower="${E(r.id)}" data-open-tab="report">${E(r.monitoring_active!==true?'View report':showDestination?'View report':r.returned_to==='Analyst'?'Correct & resubmit':'Review & correct')} ${ico('arrow',14)}</button></td></tr>`);

 return `<section class="panel" id="${E(anchor)}"><div class="panel-head"><div><div class="eyebrow">RETURNED REPORTS</div><h3>${E(heading)} (${rows.length})</h3><p>${E(description)}</p></div></div>
 ${table(cols,trs,'No reports currently in this return queue.')}</section>`;
}

function returnedJumpKpi(count){
 return `<button type="button" class="metric metric-jump" data-scroll-target="returned-reports" aria-label="View ${E(count)} returned reports"><div class="metric-label">Returned</div><div class="metric-value">${E(count)}</div><div class="metric-sub">View correction queue ${ico('arrow',13)}</div></button>`;
}

// CW_ANALYST_WORKLIST_V1: compact Analyst-only role-level monitoring worklist.
// CW_ANALYST_EIGHT_CASE_QUEUE_V3: shared Analyst-stage queue across all three roles.
// The queue is NOT_STARTED/DRAFT work that has not been reassigned to AVP.
// It includes legacy unassigned cases still awaiting Analyst-stage work.
function analystWorkQueue(rows){
  return (rows || []).filter(r =>
    (r.status === 'NOT_STARTED' || r.status === 'DRAFT') &&
    r.assignment_role !== 'AVP' && r.monitoring_active === true
  );
}

function analystWorklist(d){
  if(d.role !== 'Analyst') return '';

  // The pending queue is shared with the AVP and VP/CRO "With Analyst" cards.
  const cases = analystWorkQueue(d.overview.borrowers).slice().sort((a,b) =>
    Number(!!b.overdue) - Number(!!a.overdue) ||
    String(a.due_date || '9999-12-31').localeCompare(String(b.due_date || '9999-12-31'))
  );
  // CW_ASSIGNED_VISIBILITY_V2: ownership is visible independently of report-stage queue.
  // An assigned case already at AVP/CRO must not be reset to Draft merely to show it.
  const assigned = (d.overview.borrowers || []).filter(r =>
    r.monitoring_active === true && r.assignment_role === 'Analyst'
  ).slice().sort((a,b) =>
    Number(!!b.overdue) - Number(!!a.overdue) ||
    String(a.due_date || '9999-12-31').localeCompare(String(b.due_date || '9999-12-31'))
  );
  const notStarted = cases.filter(r => r.status === 'NOT_STARTED').length;
  const drafts = cases.filter(r => r.status === 'DRAFT').length;

  // Genuine submissions in the CURRENT report, recorded by the Python workflow.
  // We do not calculate Submitted as an arbitrary starting total minus pending.
  const submitted = (d.overview.borrowers || [])
    .filter(r => r.monitoring_active === true && r.analyst_submission_at)
    .slice()
    .sort((a,b) => String(b.analyst_submission_at).localeCompare(String(a.analyst_submission_at)));

  const dateTime = v => {
    const t = Date.parse(v || '');
    return Number.isFinite(t)
      ? new Date(t).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        }) + ' IST'
      : '—';
  };

  const pendingRows = cases.map(r => `<tr>
    <td><strong>${E(r.name)}</strong><span class="sub-id">${E(r.id)}</span></td>
    <td>${statusTag(r.status)}</td>
    <td>${r.fin_year == null ? '—' : `FY${E(r.fin_year)}`}</td>
    <td>${E(r.due_date || '—')} ${r.overdue ? '<span class="overdue-label">Overdue</span>' : ''}</td>
    <td><button type="button" class="text-action" data-open-borrower="${E(r.id)}">Open borrower ${ico('arrow',13)}</button></td>
  </tr>`);

  const assignedRows = assigned.map(r => `<tr>
    <td><strong>${E(r.name)}</strong><span class="sub-id">${E(r.id)}</span></td>
    <td>${statusTag(r.status)}</td>
    <td>${r.fin_year == null ? '—' : `FY${E(r.fin_year)}`}</td>
    <td>${r.status === 'NOT_STARTED' || r.status === 'DRAFT' ? 'Analyst preparation' :
      r.status === 'PENDING_AVP' ? 'With AVP for review' :
      r.status === 'PENDING_CRO' ? 'With VP/CRO for approval' :
      r.status === 'FINALIZED' ? 'Completed; historical ownership' :
      r.status === 'RETURNED' ? `Returned to ${E(r.returned_to || 'reviewer')}` : 'View workflow'}</td>
    <td><button type="button" class="text-action" data-open-borrower="${E(r.id)}" data-open-tab="${r.status === 'NOT_STARTED' || r.status === 'DRAFT' ? 'snapshot' : 'report'}">Open borrower ${ico('arrow',13)}</button></td>
  </tr>`);

  const submittedRows = submitted.map(r => `<tr>
    <td><strong>${E(r.name)}</strong><span class="sub-id">${E(r.id)}</span></td>
    <td>FY${E(r.fin_year == null ? '—' : r.fin_year)}</td>
    <td>${E(dateTime(r.analyst_submission_at))}</td>
    <td>${statusTag(r.status)}</td>
    <td><button type="button" class="text-action" data-open-borrower="${E(r.id)}" data-open-tab="report">Open report ${ico('arrow',13)}</button></td>
  </tr>`);

  return `<section class="cw-analyst-worklist-wrapper" aria-label="Cases with Analyst">
    <details class="cw-analyst-worklist">
      <summary class="cw-analyst-worklist-head">
        <span class="cw-analyst-worklist-heading">
          <span class="eyebrow">MONITORING WORKLOAD</span>
          <strong>With Analyst</strong>
        </span>
        <span class="cw-analyst-worklist-stats">
          <span><small>Assigned</small><strong>${assigned.length}</strong></span>
          <span><small>Not started</small><strong>${notStarted}</strong></span>
          <span><small>Draft</small><strong>${drafts}</strong></span>

        </span>
        <span class="cw-analyst-worklist-toggle"><span class="cw-worklist-show">View cases</span><span class="cw-worklist-hide">Hide cases</span>${ico('down',15)}</span>
      </summary>
      <div class="cw-analyst-worklist-body">
        <p>Assigned shows all active borrowers owned by Analyst, including cases already in review. Pending shows only cases the Analyst can prepare. Submitted shows reports sent from Analyst to AVP. Assignment never resets a report already in review.</p>
        <div class="cw-analyst-queue-switch" role="group" aria-label="Analyst monitoring case lists">
          <button type="button" class="btn btn-primary" data-analyst-view="assigned" aria-pressed="true">Assigned (${assigned.length})</button>
          <button type="button" class="btn btn-outline" data-analyst-view="pending" aria-pressed="false">Pending (${cases.length})</button>
          <button type="button" class="btn btn-outline" data-analyst-view="submitted" aria-pressed="false">Submitted (${submitted.length})</button>
        </div>
        <div data-analyst-panel="assigned">
          ${table(['Borrower','Monitoring status','FY','Current workflow','Action'],assignedRows,'No active borrowers explicitly assigned to Analyst.')}
        </div>
        <div data-analyst-panel="pending" hidden>
          ${table(['Borrower','Monitoring status','FY','Due date','Action'],pendingRows,'No pending Analyst-stage monitoring cases.')}
        </div>
        <div data-analyst-panel="submitted" hidden>
          ${table(['Borrower','FY','Submitted on','Current status','Action'],submittedRows,'No Analyst submissions recorded for the current monitoring reports.')}
        </div>
      </div>
    </details>
  </section>`;
}

function borrowerPage(d){
 const x=d.detail,b=x.borrower,a=x.assess,e=x.exposure,report=x.current_report;
 const tabs=[['snapshot','At a glance'],['financials','Financial data'],['cashflow','Cash Flow'],['ratios','Financial Ratios'],['signals','Ten EWS signals'],['report','Monitoring report'],['audit','History & audit']];

 const head=`${sectionHead('EXISTING BORROWER MONITORING')}
 ${analystWorklist(d)}
 <div class="borrower-select-line">${borrowerSelector(d)}</div>
 <section class="borrower-title panel"><div><div class="eyebrow">${E(b.segment)} / ${E(b.sector)} / ${E(b.sub_industry)}</div><h2>${E(b.company_name)}</h2><p>${E(b.borrower_id)} · ${E(b.location)} · Sanction ${E(b.sanction_date)}</p></div><div class="borrower-status">${levelTag(a.classification)}${report?statusTag(report.status):statusTag('NOT_STARTED')}</div></section>

 ${!x.monitoring_active?`<div class="cw-analyst-viewonly">${ico('shield',14)} This approved borrower is not yet active for monitoring. VP/CRO can activate it under Review & Approvals → Assignment & Ownership.</div>`:''}
 ${d.role==='Analyst'&&x.assignment_role==='AVP'?`<div class="cw-analyst-viewonly">${ico('shield',14)} This borrower is assigned to AVP. Analyst may view the record but cannot edit, submit, or update cases.</div>`:''}
 ${d.role==='Analyst'?'':`<div class="cw-assign-shortcut">
   <span>Monitoring assigned to <strong>${E(x.assignment_role||'Unassigned')}</strong></span>
   <button type="button" class="text-action" data-manage-assignment="${E(b.borrower_id)}">Manage assignment ${ico('arrow',14)}</button>
 </div>`}
 <div class="mini-metrics">
 ${actionKpi('Funded O/S',CR(e.funded_os_cr),'Latest verified per facility','borrower','funded')}
 ${actionKpi('Sanctioned facilities',CR(e.sanctioned_total_cr),'Funded and non-funded limits','borrower','facilities')}
 ${actionKpi('EWS triggered',String(a.triggered),`${a.evaluated} / ${a.applicable} evaluated`,'borrower','ews')}
 ${actionKpi('Latest monitoring FY',a.monitoring_year?`FY${a.monitoring_year}`:'Not available',`Sanction baseline FY${a.baseline_year||'—'}`,'borrower','year')}
 </div>

 <div class="tabstrip" role="tablist" aria-label="Borrower monitoring sections" style="flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;white-space:nowrap;">${tabs.map(([key,title])=>`<button role="tab" aria-selected="${ui.tab===key}" class="tab ${ui.tab===key?'active':''}" data-tab="${key}">${E(title)}</button>`).join('')}</div>`;

 let body={snapshot:snapshotTab,financials:financialTab,cashflow:cashflowTab,ratios:ratiosTab,signals:signalsTab,report:reportTab,audit:auditTab}[ui.tab](d);
 return head+body+
 (d.role==='Analyst'
  ?returnedPanel(returnQueue(d,'Analyst'),'Returned to Analyst','Reports returned by AVP require corrections before resubmission.',false,'analyst-returns')
  :'');
}

function snapshotTab(d){
 const x=d.detail,a=x.assess,b=x.borrower,n=x.narrative;
 const years=x.financials.filter(r=>r.valid!==false).map(r=>r.fy),latest=years.slice(-4);
 const mainRatios=['revenue','ebitda_margin','ocf','dscr'];

 return `<div class="section-grid dashboard-detail"><section class="panel"><div class="panel-head"><div><div class="eyebrow">POST-SANCTION FINANCIAL POSITION</div><h3>Executive monitoring assessment</h3></div>${levelTag(a.classification)}</div><p class="report-text">${E(n.executive)}</p><div class="evidence-note">${ico('shield',15)} Actual FY${a.baseline_year||'—'} vs monitoring FY${a.monitoring_year||'—'}. Sanction date: ${E(b.sanction_date)}. All figures synthetic.</div>
 <button type="button" class="btn btn-outline" data-tab="report">Read full commentary ${ico('arrow',15)}</button></section>
 <section class="panel"><div class="panel-head"><div><div class="eyebrow">RISK MONITORING</div><h3>Early warning coverage</h3></div><div class="coverage-ring">${N(a.coverage_percent,0)}%</div></div>
 <div class="signal-brief">${a.signals.filter(s=>['HIGH','CRITICAL','MEDIUM'].includes(s.level)).slice(0,5).map(s=>`<div class="brief-row">${levelTag(s.level)}<div><b>${E(s.id)} · ${E(s.name)}</b><p>${E(s.detail)}</p></div></div>`).join('')||'<p class="muted">No triggered signals from the evaluated data.</p>'}</div>
 <button type="button" class="text-action" data-tab="signals">Inspect all ten signals ${ico('arrow',15)}</button></section></div>

 <div class="section-grid"><section class="panel"><div class="panel-head"><div><div class="eyebrow">FINANCIAL EVOLUTION</div><h3>From baseline to monitoring</h3></div></div>
 <div class="spark-grid">${mainRatios.map(metric=>{let row=x.ratio_rows.find(r=>r.key===metric);return `<div class="spark-card"><div class="spark-head"><span>${E(row?.label||metric)}</span><strong>${N(row?.values?.[String(latest[latest.length-1])],2)}</strong></div>${spark(latest.map(y=>row?.values[String(y)]))}<div class="spark-label">${latest.map(y=>`FY${y}`).join(' · ')}</div></div>`}).join('')}</div></section>
 <section class="panel" id="borrower-facilities" style="scroll-margin-top:20px"><div class="panel-head"><div><div class="eyebrow">EXPOSURE POSITION</div><h3>Active sanctioned facilities</h3></div></div>${table(['Facility','Limit','Outstanding','Utilisation'],x.exposure.facilities.map(f=>`<tr><td>${E(f.facility_type)}<span class="sub-id">${E(f.facility_id)}</span></td><td class="num">${CR(f.sanctioned_limit)}</td><td class="num">${CR(f.latest_os_cr)}</td><td class="num">${f.facility_utilisation==null?'Not a CC/OD metric':`${N(f.facility_utilisation,1)}%`}</td></tr>`))}</section></div>

 <section class="panel"><div class="panel-head"><div><div class="eyebrow">EVIDENCE ASSISTANT</div><h3>Ask CreditWatch</h3></div></div>${aiPanel(d)}</section>`;
}

// CW_SUBMITTED_AND_DELETE_DRAFT_V1: server-authorized unsubmitted draft-year deletion.
function canDeleteDraftPeriod(d,row){
  // CW_ANALYST_FINANCIAL_OWNERSHIP_V1: only the monitoring owner (or VP/CRO) can delete an unsubmitted FY.
  if(d.role==='Analyst' && d.detail.assignment_role==='AVP') return false;
  if(d.role==='AVP' && d.detail.assignment_role!=='AVP') return false;
  return Number(row.fy)>2025 && row.can_delete_draft===true && canEditMonitoring(d,row.fy);
}

// CW_SEVEN_FINANCIAL_TABS_V1: financial data and cash flow use one FY record;
// ratios are read-only, and the seven top-level tabs never stack their contents.
function financialYearsUI(d, tab){
 const x=d.detail, role=d.role, years=x.financials;
 const cashflow=(tab==='cashflow');
 const reviewInProgress=x.reports.some(r=>['PENDING_AVP','PENDING_CRO','RETURNED'].includes(r.status));
 const isAssignedPreparer=(role==='Analyst'&&x.assignment_role!=='AVP')||(role==='AVP'&&x.assignment_role==='AVP');
 const nextFy=Math.max(2025,...years.map(r=>Number(r.fy)))+1;
 const maxNewFy=new Date().getFullYear()+2;
 const canCreate=nextFy<=maxNewFy && (role==='VP/CRO'||(isAssignedPreparer&&!reviewInProgress));
 const title=cashflow?'Cash flow & debt service':'Financial data · Profit & loss and balance sheet';
 const subtitle=cashflow
   ? 'INR crore · Enter cash-flow and debt-service values. Financial ratios update automatically.'
   : 'INR crore · The sanction baseline stays protected. P&L and balance-sheet data share the same FY as cash flow.';

 return `<div class="panel-head"><div><div class="eyebrow">CREDITLENS-STANDARD FINANCE ENGINE</div><h3>${title}</h3><p>${subtitle}</p></div>
 ${canCreate?`<form data-form="create_period" class="inline-form"><input type="number" min="2026" max="${maxNewFy}" name="fy" value="${nextFy}" aria-label="New monitoring financial year" style="max-width:98px"/><button type="submit" class="btn btn-primary">${ico('plus',15)} Add FY</button></form>`:''}
 </div>
 <div class="flag-box">${ico('shield',19)} <div><b>Locked sanction baseline</b><p>FY2023–FY2025 remain read-only for Analyst and AVP. VP/CRO corrections require an audited reason.</p></div></div>
 <div class="year-strips">${years.map(r=>`<div class="year-card ${Number(r.fy)<=2025?'is-baseline':'is-monitoring'}">
   <div class="year-top">FY${E(r.fy)} ${Number(r.fy)<=2025?'<span class="tiny-pill">SANCTION BASELINE</span>':'<span class="tiny-pill highlighted">MONITORING</span>'}</div>
   <strong>${E(r.statement_type||'Audited')}</strong>
   <small>${r.valid===false?'<span class="errtxt">Incomplete draft</span>':'Financial validation available'}</small>
   ${Number(r.fy)<=2025
    ?(role==='VP/CRO'
      ?`<button type="button" class="text-action" data-edit-financial="${E(r.fy)}" data-baseline="true">${ico('pencil',14)} Correct baseline</button>`
      :'<span class="muted">Read only</span>')
    :(canEditMonitoring(d,r.fy)
      ?`<div class="cw-year-action-row">
          <button type="button" class="text-action" data-edit-financial="${E(r.fy)}">${ico('pencil',14)} ${cashflow?'Edit cash flow FY':'Edit monitoring FY'}</button>
          ${canDeleteDraftPeriod(d,r)
            ?`<button type="button" class="text-action cw-delete-year-trigger" data-show-delete-period="${E(r.fy)}" aria-label="Delete draft monitoring FY${E(r.fy)}">${ico('alert',13)} Delete</button>`
            :''}
        </div>`
      :'<span class="muted">Under approval / locked</span>')}
 </div>`).join('')}</div>
 ${years.some(r=>canDeleteDraftPeriod(d,r))?`<div class="cw-delete-year-panel" hidden>
  <form data-form="delete_period" class="cw-delete-year-form">
   <input type="hidden" name="fy" value=""/>
   <strong class="cw-delete-year-title">Delete draft monitoring year?</strong>
   <p>Deletion removes the entire unsubmitted FY, including P&L, balance sheet, cash flow and its draft report. The audit trail is retained; submitted or approved years cannot be deleted.</p>
   <label class="form-field"><span>Reason for deletion (required)</span><textarea name="reason" rows="2" required minlength="10" maxlength="1200" placeholder="For example, monitoring year added by mistake"></textarea></label>
   <div class="form-actions"><button type="submit" class="btn cw-delete-confirm-button">Confirm deletion</button><button type="button" class="btn btn-outline" data-cancel-delete-period>Cancel</button></div>
  </form>
 </div>`:''}`;
}

function financialTab(d){
 const x=d.detail,years=x.financials;
 if(ui.financialEditor){
  const selected=years.find(r=>Number(r.fy)===Number(ui.financialEditor.fy));
  if(selected)return financialEditor(d,selected,!!ui.financialEditor.baseline,'financials');
 }
 const groups=Object.entries(x.financial_groups).filter(([name])=>name!=='Cash flow & debt service');
 return `<section class="panel" id="borrower-financials" style="scroll-margin-top:20px">
  ${financialYearsUI(d,'financials')}
  ${groups.map(([name,fields])=>`<h3 class="group-title">${E(name)}</h3>${table(['Financial line',...years.map(y=>`FY${y.fy}`)],Object.entries(fields).map(([field,title])=>`<tr><td>${E(title)}</td>${years.map(row=>tcell(row.data?.[field]==null?'—':N(row.data[field],2),'num')).join('')}</tr>`))}`).join('')}
  <div class="mini-note">Cash Flow and Financial Ratios have their own tabs above. All figures remain connected to the same monitoring FY.</div>
 </section>`;
}

function cashflowTab(d){
 const x=d.detail,years=x.financials;
 if(ui.financialEditor){
  const selected=years.find(r=>Number(r.fy)===Number(ui.financialEditor.fy));
  if(selected)return financialEditor(d,selected,!!ui.financialEditor.baseline,'cashflow');
 }
 const fields=x.financial_groups['Cash flow & debt service']||{};
 return `<section class="panel" id="borrower-cashflow" style="scroll-margin-top:20px">
  ${financialYearsUI(d,'cashflow')}
  <h3 class="group-title">Cash flow & debt service</h3>
  ${table(['Financial line',...years.map(y=>`FY${y.fy}`)],Object.entries(fields).map(([field,title])=>`<tr><td>${E(title)}</td>${years.map(row=>tcell(row.data?.[field]==null?'—':N(row.data[field],2),'num')).join('')}</tr>`))}
  <div class="mini-note">Financial ratios are recalculated from saved financial data and displayed separately under Financial Ratios.</div>
 </section>`;
}

function ratiosTab(d){
 const x=d.detail,years=x.financials;
 return `<section class="panel" id="borrower-ratios" style="scroll-margin-top:20px">
  <div class="panel-head"><div><div class="eyebrow">AUTOMATED CREDIT RATIO ENGINE</div><h3>Financial ratios</h3><p>Calculated automatically from the saved P&L, Balance Sheet and Cash Flow values. No manual Add, Edit or Delete is available here.</p></div>${ico('chart',20)}</div>
  ${table(['Ratio / metric',...years.map(y=>`FY${y.fy}`)],x.ratio_rows.map(row=>`<tr><td>${E(row.label)}</td>${years.map(y=>tcell(metricDisplay(row.key,row.values[String(y.fy)]),'num')).join('')}</tr>`))}
  ${x.projections.length?`<h3 class="group-title">Sanction-approved projections vs monitoring actuals</h3>${table(['Metric','Projected','Monitoring actual','Variance'],x.projections.flatMap(pr=>['revenue','ebitda_margin','ocf','dscr'].map(metric=>{const actual=x.ratios_by_year[String(pr.fy)]?.[metric];const expected=pr[metric];const delta=actual==null||expected==null?'—':metric==='revenue'||metric==='ocf'?(Math.abs(expected)>0?`${N(100*(actual/expected-1),1)}%`:'—'):`${N(actual-expected,2)} ${metric==='ebitda_margin'?'pp':'x'}`;return `<tr><td>${E(metric==='ebitda_margin'?'EBITDA margin':metric==='dscr'?'DSCR':metric==='ocf'?'Operating cash flow':'Revenue')} · FY${pr.fy}</td><td>${metricDisplay(metric,expected)}</td><td>${metricDisplay(metric,actual)}</td><td>${E(delta)}</td></tr>`})))}`:''}

 </section>`;
}

function canEditMonitoring(d,fy){
 if(d.role==='Analyst'&&d.detail.assignment_role==='AVP')return false;
 const r=d.detail.reports.find(r=>Number(r.fy)===Number(fy));
 if(d.role==='VP/CRO')return true;
 if(!r)return false;
 if(d.role==='AVP')return (d.detail.assignment_role==='AVP'&&r.status==='DRAFT')
   ||r.status==='PENDING_AVP'||(r.status==='RETURNED'&&r.returned_to==='AVP');
 return r.status==='DRAFT'||(r.status==='RETURNED'&&r.returned_to==='Analyst');
}

function financialEditor(d,row,baseline,editTab='financials'){
 const group=d.detail.financial_groups,fy=row.fy;
 const can=baseline?d.role==='VP/CRO':canEditMonitoring(d,fy);
 if(!can){ui.financialEditor=null;return '<div class="notice error">Financial records are locked for your current role and stage.</div>';}
 const cashflow=editTab==='cashflow';
 // Preserve all fields not visible in this tab: the Python service expects a full FY payload.
 const visibleGroups=Object.entries(group).filter(([name])=>baseline || (cashflow?name==='Cash flow & debt service':name!=='Cash flow & debt service'));
 const hiddenGroups=Object.entries(group).filter(([name])=>!visibleGroups.some(([shown])=>shown===name));
 const hiddenFields=hiddenGroups.flatMap(([,fields])=>Object.keys(fields).map(field=>`<input type="hidden" name="v.${E(field)}" value="${E(row.data?.[field]??0)}"/>`)).join('');
 const backLabel=cashflow?'Back to cash flow':'Back to financial data';
 const editorTitle=baseline?'Correct sanction baseline':cashflow?'Edit cash flow & debt service':'Edit financial data';
 return `<section class="panel" id="borrower-financial-editor"><div class="panel-head"><div><div class="eyebrow">CONTROLLED FINANCIAL REVISION</div><h3>${editorTitle} · FY${E(fy)}</h3><p>INR crore · ${baseline?'Baseline correction retains the full financial statement.':cashflow?'Other P&L and balance-sheet figures are preserved when saving.':'Other cash-flow figures are preserved when saving.'}</p></div><button type="button" data-cancel-edit class="btn btn-outline">${backLabel}</button></div>
 <form data-form="save_financial"><input type="hidden" name="fy" value="${E(fy)}"/><input type="hidden" name="baseline" value="${baseline?'true':'false'}"/>
 ${hiddenFields}
 ${visibleGroups.map(([groupName,fields])=>`<div class="form-section"><h3>${E(groupName)}</h3><div class="edit-grid">${Object.entries(fields).map(([key,label])=>`<label class="form-field"><span>${E(label)}</span><input type="number" step="any" name="v.${E(key)}" value="${E(row.data?.[key]??'')}" required/></label>`).join('')}</div></div>`).join('')}
 <div class="edit-grid"><label class="form-field"><span>Statement type</span><select name="statement_type"><option ${row.statement_type==='Audited'?'selected':''}>Audited</option><option ${row.statement_type!=='Audited'?'selected':''}>Provisional</option></select></label>
 <label class="form-field large"><span>Reason for change ${baseline||d.role!=='Analyst'?'(mandatory)':''}</span><textarea name="reason" placeholder="Document source and reason for correction" rows="2" ${baseline||d.role!=='Analyst'?'required':''}></textarea></label></div>
 ${row.validation_errors?.length?`<div class="alert-detail">${row.validation_errors.map(v=>`<p>${E(v)}</p>`).join('')}</div>`:''}
 <div class="form-actions"><button class="btn btn-primary" type="submit">${ico('check',17)} Save and recalculate</button><button class="btn btn-outline" type="button" data-cancel-edit>Cancel</button></div>
 </form></section>`;
}

function metricDisplay(k,v){
 if(v==null||!Number.isFinite(Number(v)))return '—';
 const perc=['gross_margin','ebitda_margin','net_margin','roce','ocf_debt'];
 const day=['dso','dio','dpo','ccc'];
 const money=['revenue','ebitda','total_debt','ocf'];
 return perc.includes(k)?`${N(v,1)}%`:day.includes(k)?`${N(v,1)} days`:money.includes(k)?CR(v):`${N(v,2)}x`;
}

// EWS summary cards inside Borrower Monitoring

// CW_SAVED_INVESTIGATION_HISTORY_UI_V1: show saved case findings; new input remains blank.
function savedInvestigationHistory(c) {
  const notes = Array.isArray(c?.notes) ? c.notes.filter(n =>
    n && (typeof n === 'string' ? n.trim() : String(n.reason || '').trim())
  ) : [];
  if (!notes.length) {
    return `<div class="mini-note">No investigation findings have been saved for this case yet.</div>`;
  }

  const renderNote = n => {
    const value = typeof n === 'string' ? n : (n.reason || '');
    const actor = typeof n === 'object' ? n.actor || 'Monitoring officer' : 'Monitoring officer';
    const at = typeof n === 'object' ? n.at || '' : '';
    const status = typeof n === 'object' ? n.status || '' : '';
    return `<div style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.65;color:#284b57;">${E(value)}</div>
      <div style="font-size:10px;color:#6e8592;margin-top:7px;">${E(actor)}${at ? ` · ${E(at)}` : ''}${status ? ` · Status: ${E(status)}` : ''}</div>`;
  };

  const latest = notes[notes.length - 1];
  const previous = notes.slice(0, -1).reverse();
  return `<section aria-label="Saved investigation findings" style="margin:0 0 18px;">
    <div style="padding:14px 16px;background:#edf8f5;border:1px solid #d1e9e3;border-radius:9px;">
      <div style="font-size:11px;font-weight:800;color:#187c73;margin-bottom:9px;">Latest saved investigation finding</div>
      ${renderNote(latest)}
    </div>
    ${previous.length ? `<details style="margin-top:11px;padding:11px 14px;background:#fff;border:1px solid #dce9ea;border-radius:8px;">
      <summary style="cursor:pointer;font-size:11px;font-weight:750;color:#365966;">Previous investigation history (${previous.length})</summary>
      <div style="display:grid;gap:12px;margin-top:12px;">
        ${previous.map(n => `<div style="border-top:1px solid #e6eeef;padding-top:11px;">${renderNote(n)}</div>`).join('')}
      </div>
    </details>` : ''}
  </section>`;
}

function signalsTab(d) {
  const a = d.detail.assess;
  const inc = d.detail.cases;
  const selectedCase = inc.find(c => c.case_id === ui.caseId);

  const selected = ['triggered', 'evaluated', 'gaps'].includes(ui.signalFocus)
    ? ui.signalFocus
    : null;

  const signals = a.signals || [];

  const visibleSignals = selected === 'triggered'
    ? signals.filter(s => ['MEDIUM', 'HIGH', 'CRITICAL'].includes(s.level))
    : selected === 'evaluated'
      ? signals.filter(s => !['NOT_EVALUATED', 'NOT_APPLICABLE'].includes(s.level))
      : selected === 'gaps'
        ? signals.filter(s => s.level === 'NOT_EVALUATED')
        : signals;

  const selectedLabel = {
    triggered: 'Triggered indicators',
    evaluated: 'Evaluated indicators',
    gaps: 'Data gaps'
  }[selected];

  // Reuse the ten screening rules already defined in How It Works.
  const guideByCode = Object.fromEntries(
    EWS_GUIDE.map(item => [item[0], item])
  );

  const signalCard = s => {
    const guide = guideByCode[s.id] || [];
    const observation = s.detail || 'No observation is available for this indicator.';
    const status = String(s.level || 'NOT_EVALUATED');

    const statusMeaning = status === 'CLEAR'
      ? 'The configured alert threshold is not met on the currently evaluated evidence. Continue regular monitoring.'
      : status === 'NOT_EVALUATED'
        ? 'The available evidence is insufficient or stale, so this signal must not be treated as clear.'
        : status === 'NOT_APPLICABLE'
          ? 'This test does not apply to the current borrower or facility.'
          : 'The monitoring engine assigned this severity after comparing the available evidence with its configured screening rules.';

    return `<details class="cw-ews-compact-card" name="cw-ews-signal-details">

      <summary class="cw-ews-compact-head">

        <span class="cw-ews-code">
          ${E(s.id)}
        </span>

        <span class="cw-ews-main">

          <strong class="cw-ews-name">
            ${E(s.name)}
          </strong>

          <span
            class="cw-ews-one-line"
            title="${E(observation)}"
          >
            ${E(observation)}
          </span>

        </span>

        <span class="cw-ews-right">

          ${levelTag(s.level)}

          <span class="cw-ews-expand-label">
            <span class="cw-ews-view">View details</span>
            <span class="cw-ews-hide">Hide details</span>
            ${ico('down', 13)}
          </span>

        </span>

      </summary>

      <div class="cw-ews-expanded">

        <div class="cw-ews-facts">

          <div class="cw-ews-fact">
            <strong>What was observed?</strong>
            <p>${E(observation)}</p>
          </div>

          <div class="cw-ews-fact">
            <strong>Configured screening rule</strong>
            <p>
              ${E(
                guide[2] ||
                'Refer to the configured signal rule in the monitoring engine.'
              )}
            </p>
          </div>

          <div class="cw-ews-fact">
            <strong>What does this status mean?</strong>
            <p>${E(statusMeaning)}</p>
          </div>

          <div class="cw-ews-fact">
            <strong>Why is this important?</strong>
            <p>
              ${E(
                guide[3] ||
                'Review the impact on the borrower’s credit risk position.'
              )}
            </p>
          </div>

          <div class="cw-ews-fact cw-ews-fact-wide">
            <strong>What should the monitoring officer check?</strong>
            <p>
              ${E(
                guide[4] ||
                'Verify the source records and document the investigation.'
              )}
            </p>
          </div>

        </div>

        <div class="cw-ews-evidence">
          ${ico('database', 13)}
          <span>
            ${E(s.source || 'Source not available')}
            ·
            ${E(s.as_of || 'Date not available')}
          </span>
        </div>

      </div>

    </details>`;
  };

  return `<style>

    /* Compact expandable EWS cards */

    .cw-ews-accordion {
      display: grid;
      gap: 8px;
      margin-top: 3px;
    }

    .cw-ews-compact-card {
      background: #ffffff;
      border: 1px solid #e4ecf0;
      border-radius: 10px;
      overflow: hidden;
      min-width: 0;

      transition:
        border-color .18s ease,
        box-shadow .18s ease;
    }

    .cw-ews-compact-card:hover {
      border-color: #bfdedb;
    }

    .cw-ews-compact-card[open] {
      border-color: #b6ddd7;
      box-shadow: 0 3px 12px rgba(15,48,62,.035);
    }

    .cw-ews-compact-head {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 65px;
      padding: 10px 14px;

      list-style: none;
      cursor: pointer;
      user-select: none;
    }

    .cw-ews-compact-head::-webkit-details-marker {
      display: none;
    }

    .cw-ews-compact-head::marker {
      content: '';
    }

    .cw-ews-compact-head:focus-visible {
      outline: 2px solid #008f89;
      outline-offset: -3px;
    }

    .cw-ews-code {
      flex: 0 0 auto;
      min-width: 52px;

      text-align: center;
      padding: 7px 8px;
      border-radius: 6px;

      background: #f1f6f8;
      color: #257d7c;

      font-weight: 800;
      font-size: 10px;
    }

    .cw-ews-main {
      flex: 1 1 0;
      min-width: 0;

      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .cw-ews-name {
      font-size: 12px;
      color: #142a40;
      font-weight: 750;
      line-height: 1.2;
    }

    .cw-ews-one-line {
      display: block;
      min-width: 0;

      color: #657f91;
      font-size: 10.5px;

      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.35;
    }

    .cw-ews-right {
      display: flex;
      flex: 0 0 auto;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
    }

    .cw-ews-right .tag {
      padding: 5px 9px;
    }

    .cw-ews-expand-label {
      display: inline-flex;
      gap: 5px;
      align-items: center;

      color: #008f89;
      font-size: 10px;
      font-weight: 750;
      white-space: nowrap;
    }

    .cw-ews-expand-label svg {
      transition: transform .18s ease;
    }

    .cw-ews-hide {
      display: none;
    }

    .cw-ews-compact-card[open] .cw-ews-view {
      display: none;
    }

    .cw-ews-compact-card[open] .cw-ews-hide {
      display: inline;
    }

    .cw-ews-compact-card[open] .cw-ews-expand-label svg {
      transform: rotate(180deg);
    }

    /* Expanded information */

    .cw-ews-expanded {
      border-top: 1px solid #edf1f3;
      padding: 14px 16px 12px;
      background: #fcfefe;
    }

    .cw-ews-facts {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 15px 20px;
    }

    .cw-ews-fact {
      min-width: 0;
    }

    .cw-ews-fact strong {
      display: block;
      font-size: 10.5px;
      color: #142a40;
      margin: 0 0 5px;
    }

    .cw-ews-fact p {
      margin: 0;
      color: #5c7486;
      font-size: 11px;
      line-height: 1.65;
    }

    .cw-ews-fact-wide {
      grid-column: 1 / -1;
    }

    .cw-ews-evidence {
      display: flex;
      align-items: center;
      gap: 6px;

      margin-top: 13px;
      padding-top: 10px;

      border-top: 1px solid #edf1f3;
      color: #78909f;
      font-size: 10px;
    }

    .cw-ews-evidence svg {
      color: #008f89;
      flex: 0 0 auto;
    }

    @media (max-width: 650px) {

      .cw-ews-compact-head {
        padding: 10px;
        gap: 8px;
        min-height: 66px;
      }

      .cw-ews-code {
        min-width: 43px;
        padding: 6px 5px;
        font-size: 9px;
      }

      .cw-ews-name {
        font-size: 11px;
      }

      .cw-ews-one-line {
        font-size: 10px;
      }

      .cw-ews-expand-label {
        font-size: 9px;
      }

      .cw-ews-facts {
        grid-template-columns: minmax(0, 1fr);
        gap: 13px;
      }

      .cw-ews-expanded {
        padding: 12px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .cw-ews-compact-card,
      .cw-ews-expand-label svg {
        transition: none;
      }
    }

  </style>

  <section class="panel">

    <div class="panel-head">
      <div>
        <div class="eyebrow">CREDITWATCH SIGNAL ENGINE</div>
        <h3>All ten early warning signals</h3>
        <p>
          Compact overview. Open a signal to understand its observation,
          rule, and suggested review.
        </p>
      </div>

      ${levelTag(a.classification)}
    </div>

    <div class="signal-summary">

      ${actionKpi(
        'Triggered',
        a.triggered,
        'Across distinct signal IDs',
        'signals',
        'triggered',
        '',
        selected === 'triggered'
      )}

      ${actionKpi(
        'Evaluated',
        `${a.evaluated}/${a.applicable}`,
        'Applicable signals',
        'signals',
        'evaluated',
        '',
        selected === 'evaluated'
      )}

      ${actionKpi(
        'Data gaps',
        a.data_gaps,
        'Not evaluated / stale',
        'signals',
        'gaps',
        '',
        selected === 'gaps'
      )}

    </div>

    ${selected ? `
      <div
        class="panel-head"
        id="signal-focus-panel"
        style="scroll-margin-top:20px"
      >
        <div>
          <div class="eyebrow">SELECTED EWS CATEGORY</div>
          <h3>${E(selectedLabel)} (${visibleSignals.length})</h3>
        </div>

        <button
          type="button"
          class="btn btn-outline"
          data-summary-reset="signals"
        >
          Show all ten signals
        </button>

      </div>
    ` : ''}

    <div
      class="cw-ews-accordion"
      ${selected ? '' : 'id="signal-focus-panel"'}
    >

      ${visibleSignals.map(signalCard).join('') ||
        '<div class="empty">No signals in this category.</div>'}

    </div>

    <div class="mini-note">
      ${ico('shield', 15)}
      An unresolved investigation remains open until an authorized monitoring
      officer records an outcome, even if its original numeric signal
      subsequently clears.
    </div>

  </section>

  <section class="panel">

    <div class="panel-head">
      <div>
        <div class="eyebrow">INVESTIGATION WORKFLOW</div>
        <h3>Borrower EWS cases</h3>
      </div>
    </div>

    ${inc.length
      ? table(
          ['EWS', 'Severity', 'Case status', 'Assigned', 'Action'],
          inc.map(c => `
            <tr>
              <td>${E(c.signal_id)}</td>
              <td>${levelTag(c.severity)}</td>
              <td>${E(c.status)}</td>
              <td>${E(c.owner)}</td>
              <td>
                ${d.role==='Analyst'&&d.detail.assignment_role==='AVP'
                  ? '<span class="muted">View only</span>'
                  : `<button type="button" class="text-action" data-case-pick="${E(c.case_id)}">Update</button>`}
              </td>
            </tr>
          `)
        )
      : '<div class="empty">No EWS investigations have been created for this borrower.</div>'
    }

    ${!(d.role==='Analyst'&&d.detail.assignment_role==='AVP') && selectedCase
      ? `
        <form data-form="case_update" class="case-form">

          <h4>Update ${E(ui.caseId)}</h4>

          ${savedInvestigationHistory(selectedCase)}

          <input
            type="hidden"
            name="case_id"
            value="${E(ui.caseId)}"
          />

          <div class="edit-grid">

            <label class="form-field">
              <span>Investigation status</span>

              <select name="status">
                <option ${selectedCase.status==='OPEN'?'selected':''}>OPEN</option>
                <option ${selectedCase.status==='INVESTIGATING'?'selected':''}>INVESTIGATING</option>

                ${d.role === 'Analyst'
                  ? ''
                  : `<option ${selectedCase.status==='ESCALATED'?'selected':''}>ESCALATED</option><option ${selectedCase.status==='RESOLVED'?'selected':''}>RESOLVED</option>`
                }
              </select>
            </label>

            <label class="form-field large">
              <span>Add new investigation finding / reason</span>

              <textarea
                name="reason"
                rows="2"
                required
                minlength="10"
                placeholder="Record the evidence, responsible officer and next action"
              ></textarea>
            </label>

          </div>

          <button
            type="submit"
            class="btn btn-primary"
          >
            Save case update
          </button>

        </form>
      `
      : ''
    }

  </section>`;
}

function reportTab(d){
 const x=d.detail,report=x.current_report,n=x.narrative,a=x.assess,role=d.role;
 const fy=report?.fy;
 const viewer=report?`<div class="report-meta">${statusTag(report.status)}<span>FY${report.fy} · Version ${report.version}</span><span>Report ID: ${E(report.report_id)}</span></div>${report.status==='RETURNED'?`<div class="alert-detail"><b>Returned to ${E(report.returned_to||'Analyst')} for correction.</b><p>${E((report.review_history||[]).slice().reverse().find(h=>String(h.action||'').startsWith('RETURNED'))?.reason||'Open Review Governance below for the return history.')}</p></div>`:''}`:'<div class="alert-detail">No monitoring-year report started. Open Financial statements to create the next monitoring period.</div>';
 let actions='';

 if(report && !(role==='Analyst' && x.assignment_role==='AVP')){
  const form=`<form data-form="report_action" class="approval-form"><input type="hidden" name="fy" value="${fy}"/><label class="form-field"><span>${role==='Analyst'?'Monitoring Analyst observations':role==='AVP'?'AVP review observations':'VP/CRO review observations'}</span><textarea name="notes" rows="4" placeholder="Document the monitoring assessment and supporting evidence">${E(report[role==='Analyst'?'analyst_notes':role==='AVP'?'avp_notes':'cro_notes']||'')}</textarea></label>
  <div class="form-field"><label>Reason for approval, return, or final decision</label><textarea name="reason" rows="2" placeholder="Explain review decision, exceptions and corrective actions"></textarea></div>
  <div class="form-actions"><button type="submit" name="kind" value="save_notes" class="btn btn-outline">Save observations</button>
  ${role==='Analyst'&&(report.status==='DRAFT'||(report.status==='RETURNED'&&report.returned_to==='Analyst'))?btn('Submit to AVP','submit','btn-primary'):''}
  ${role==='AVP'&&x.assignment_role==='AVP'&&['DRAFT','PENDING_AVP','RETURNED'].includes(report.status)?btn('Send to VP/CRO (as owner)','avp_owner_submit','btn-primary'):''}
 ${role==='AVP'&&x.assignment_role!=='AVP'&&report.status==='PENDING_AVP'?btn('Approve & forward to CRO','avp_approve','btn-primary')+btn('Return to Analyst','return','btn-danger-outline'):''}
  ${role==='AVP'&&x.assignment_role!=='AVP'&&report.status==='RETURNED'&&report.returned_to==='AVP'?btn('Resubmit to VP/CRO','avp_approve','btn-primary')+btn('Return to Analyst','return','btn-danger-outline'):''}
  ${role==='VP/CRO'&&['DRAFT','PENDING_AVP','PENDING_CRO'].includes(report.status)?btn('Finalize monitoring report','finalize','btn-primary')+(report.status!=='DRAFT'?btn('Return to AVP','return','btn-danger-outline'):''):''}
  ${role==='VP/CRO'&&report.status==='PENDING_AVP'?btn('Approve AVP stage','avp_approve',''):''}
  </div></form>`;
  actions=form;
 }

 return `<section class="panel report-paper"><div class="report-doc-head"><div><div class="eyebrow">FORMAL CREDIT MONITORING REPORT</div><h2>${E(n.title)}</h2><p>Post-sanction financial movement · Corporate & MSME</p></div><button type="button" class="btn btn-outline" data-print>${ico('file',15)} Print report</button></div>${viewer}
 <div class="report-exec"><div class="eyebrow">01 / EXECUTIVE POST-SANCTION ASSESSMENT</div><p>${E(n.executive)}</p></div>
 <div class="report-chapters">${n.sections.map((s,i)=>`<section class="report-chapter"><div class="eyebrow">${String(i+2).padStart(2,'0')} / FINANCIAL MONITORING</div><h3>${E(s.title)}</h3><p>${E(s.body)}</p></section>`).join('')}</div>
 <div class="actions-box"><div class="eyebrow">MONITORING ACTION PLAN</div><h3>Recommended checks</h3><ol>${n.actions.map(t=>`<li>${E(t)}</li>`).join('')}</ol></div>
 <div class="report-method">${ico('shield',16)} ${E(n.method)}</div></section>
 <section class="panel"><div class="panel-head"><div><div class="eyebrow">REVIEW GOVERNANCE</div><h3>Analyst · AVP · VP/CRO approvals</h3></div></div>${actions}
 ${report?table(['At','Reviewer','Action / decision','Reason'],report.review_history.map(h=>`<tr><td>${E(h.at)}</td><td>${E(h.actor)}</td><td>${E(h.action)}</td><td>${E(h.reason||'—')}</td></tr>`),'No review decisions recorded yet.') :''}
 ${report?.finalized_snapshot?'<div class="ok-note">Finalized report snapshot preserved. Subsequent data corrections cannot silently rewrite this approved evidence.</div>':''}</section>
 <section class="panel"><div class="panel-head"><h3>Ask CreditWatch about the report</h3></div>${aiPanel(d)}</section>`;
}

function aiPanel(d){
 const last=d.last_ai;
 return `<form data-form="ask" class="ask-form"><div class="ask-head"><div class="ai-logo">${ico('spark',20)}</div><div><b>Ask CreditWatch</b><span>Evidence-backed local mode · Optional Groq AI with explicit consent</span></div></div>
 <textarea name="question" rows="3" maxlength="1000" placeholder="How has this borrower's financial position changed since sanction? Which EWS indicators worsened?" required></textarea>
 <div class="consent-row"><label><input type="checkbox" name="use_groq" ${d.groq_configured?'':'disabled'}/> Use Groq AI (optional)</label><label><input type="checkbox" name="ai_consent" ${d.groq_configured?'':'disabled'}/> I consent to sending this <b>synthetic</b> financial evidence to Groq</label></div>
 <div class="ask-bottom"><span>${d.groq_configured?'Optional Groq available · Local deterministic mode is default':'No Groq key configured · Local evidence mode available'}</span><button type="submit" class="btn btn-primary">Analyse ${ico('arrow',16)}</button></div></form>
 ${last&&last.borrower_id===d.selected_borrower?`<div class="assistant-response"><div class="eyebrow">VERIFIED EVIDENCE RESPONSE</div><div class="answer-query">${E(last.question)}</div>${E(last.answer).split(/\n\n/g).map(s=>`<p>${E(s)}</p>`).join('')}<div class="mini-note">${E(last.notice)}</div></div>`:''}`;
}

function auditTab(d){
 const x=d.detail;
 return `<div class="section-grid"><section class="panel"><div class="panel-head"><h3>Audit history</h3></div>${table(['Timestamp','Actor','Event','Changes'],[...x.audit].reverse().map(y=>`<tr><td>${E(y.at)}</td><td>${E(y.actor)}</td><td>${E(y.action)}</td><td class="small-cell">${E(JSON.stringify(y.details).slice(0,150))}</td></tr>`),'No audit events since the synthetic seed was created.')}</section>
 <section class="panel"><div class="panel-head"><h3>VP/CRO baseline corrections</h3></div>${table(['Financial year','Corrected by','Recorded','Reason'],x.baseline_versions.map(v=>`<tr><td>FY${v.fy}</td><td>${E(v.actor)}</td><td>${E(v.at)}</td><td>${E(v.reason)}</td></tr>`),'No baseline amendments recorded. The original financials are unchanged.')}
 <div class="flag-box">${ico('shield',20)}<div><b>Immutable original references</b><p>Every VP/CRO baseline correction retains the before and after financial figures. Approved report snapshots are independently preserved.</p></div></div></section></div>`;
}

// Early Warning Desk card drilldowns
function ewsDetailPanel(d){
 const key=ui.ewsFocus;
 const titles={
  triggered:'Borrowers with active EWS',
  cases:'Open investigations',
  high:'High / critical borrowers',
  gaps:'Borrowers with insufficient coverage'
 };
 if(!titles[key])return '';

 const o=d.overview;
 const cases=d.role==='Analyst'?(o.cases||[]).filter(c=>c.status!=='RESOLVED'):cwPriorityCases(o.cases||[]);
 const borrowers=(o.borrowers||[]).filter(r=>
  key==='triggered'?Number(r.triggered)>0
  :key==='high'?['HIGH','CRITICAL'].includes(r.risk)
  :key==='gaps'?r.risk==='UNASSESSED':true
 );

 const rows=borrowers.map(r=>`<tr><td><button type="button" class="link-button" data-open-borrower="${E(r.id)}" data-open-tab="signals">${E(r.name)}</button><span class="sub-id">${E(r.id)}</span></td><td>${levelTag(r.risk)}</td><td class="num">${E(r.triggered)}</td><td class="num">${CR(r.funded_os_cr)}</td></tr>`);
 const caseRows=cases.map(c=>`<tr><td><button type="button" class="link-button" data-open-borrower="${E(c.borrower_id)}" data-open-tab="signals">${E(c.company)}</button></td><td>${E(c.signal_id)}</td><td>${levelTag(c.severity)}</td><td>${E(c.status)}</td><td>${E(c.updated_at||'—')}</td></tr>`);

 return `<section class="panel" id="ews-focus-panel" style="scroll-margin-top:20px">
 <div class="panel-head"><div><div class="eyebrow">EARLY WARNING / SELECTED METRIC</div><h3>${E(titles[key])} (${key==='cases'?cases.length:borrowers.length})</h3><p>Open any borrower to examine the underlying EWS calculations and evidence.</p></div><button type="button" class="btn btn-outline" data-summary-reset="ews">View all signals</button></div>
 ${key==='cases'&&d.role!=='Analyst'?cwPriorityFilter('ews-focus'):''}
 ${key==='cases'?table(['Borrower','Signal','Severity','Investigation','Last updated'],caseRows,'No investigations match the selected priority.')
 :table(['Borrower','Risk','Triggered signals','Funded O/S'],rows,'No matching borrowers.')}
 </section>`;
}

// CW_GROQ_INTELLIGENCE_V1: cross-signal investigation and conditional forward risk.
function cwRiskInvestigationPanel(d){
 // CREDITWATCH_RISK_JSON_400_SCOPE_V1: VP/CRO can inspect master records,
 // without enrolling them in active monitoring. All other roles stay active-only.
 const allBorrowers=d.overview.borrowers||[];
 const active=allBorrowers.filter(b=>b.monitoring_active===true);
 const isCRO=d.role==='VP/CRO';
 const scope=isCRO&&ui.aiRiskScope!=='active'?'master':'active';
 const eligible=scope==='master'?allBorrowers:active;
 const selected=eligible.some(b=>b.id===ui.aiRiskBorrower)?ui.aiRiskBorrower:
   eligible.some(b=>b.id===d.selected_borrower)?d.selected_borrower:eligible[0]?.id;
 const prior=d.ai_risk_result;
 const last=prior&&prior.borrower_id===selected&&(prior.scope||'active')===scope?prior:null;
 const verified=last?`<div class="assistant-response" aria-live="polite" style="margin-top:16px">
   <div class="eyebrow">VERIFIED BORROWER EVIDENCE</div>
   <h4>${E(last.borrower_name)} <span class="sub-id">${E(last.borrower_id)}</span></h4>
   ${table(['Verified indicator','Python result'],(last.facts||[]).map(f=>`<tr><td>${E(f.label)}</td><td>${E(f.value)}</td></tr>`))}
   <div style="margin:14px 0"><b>Triggered warning signals (${E(last.signals?.length||0)})</b>
      ${table(['Signal','Python severity','Observed'],(last.signals||[]).map(sig=>`<tr>
       <td>${E(sig.id)} · ${E(sig.name)}</td><td>${levelTag(sig.level)}</td>
       <td>${E(sig.observed??'Not available')} ${E(sig.unit||'')}</td></tr>`),'No triggered EWS signals in Python assessment.')}
   </div>
   <div class="eyebrow">GROQ CONNECTED-RISK INVESTIGATION</div>
   ${cwAIProse(last.commentary,[['current_assessment','Current borrower situation'],['connected_signals','How the EWS signals connect'],['if_trends_continue','What could happen if deterioration continues'],['evidence_gaps','Evidence gaps and alternative explanations'],['recommended_checks','Recommended investigation actions']])}
   <div class="mini-note">${E(last.notice)}</div>
 </div>`:'';
 return `<section class="panel" id="cw-ai-risk-investigation" style="scroll-margin-top:20px">
   <div class="panel-head"><div><div class="eyebrow">AI · CROSS-SIGNAL INVESTIGATION</div>
      <h3>AI Risk Investigation Engine</h3>
      <p>Connect multiple triggered early warning signals. Explain the combined risks and what could happen if the situation continues.</p>
   </div>${ico('spark',20)}</div>
   ${eligible.length?`<form data-form="ai_risk_investigate" class="ask-form">
      ${isCRO?`<label class="form-field"><span>Borrower investigation scope</span>
        <select name="scope" data-ai-risk-scope>
          <option value="master" ${scope==='master'?'selected':''}>All approved borrowers (${allBorrowers.length}) — read-only investigation</option>
          <option value="active" ${scope==='active'?'selected':''}>Active monitoring borrowers (${active.length})</option>
        </select></label>`:''}
      <label class="form-field"><span>Select a borrower</span>
        <select name="borrower_id" data-ai-risk-borrower required>
          ${eligible.map(b=>`<option value="${E(b.id)}" ${b.id===selected?'selected':''}>${E(b.name)} (${E(b.id)})${b.monitoring_active===true?'':' · Not active'}</option>`).join('')}
        </select>
      </label>
      ${scope==='master'?`<div class="mini-note">Master borrowers can be investigated for risk evidence without joining the active monitoring worklist. Only VP/CRO can activate a borrower in Assignment &amp; Ownership.</div>`:''}
      <div class="consent-row"><label><input type="checkbox" name="ai_consent" required ${d.groq_configured?'':'disabled'}/> I consent to sending this synthetic borrower evidence to AI.</label></div>
      <div class="ask-bottom"><span>${d.groq_configured?'Figures remain Python-verified; AI writes interpretation only':'API key missing - configure it in the Python backend'}</span>
       <button type="submit" class="btn btn-primary" ${d.groq_configured?'':'disabled'}>Investigate with AI ${ico('arrow',16)}</button></div>
   </form>`:'<div class="empty">No borrowers have been activated for monitoring. VP/CRO must select and activate a borrower first.</div>'}
   ${verified}
 </section>`;
}

function ewsDesk(d){
 const o=d.overview,s=o.signal_counts.find(x=>x.id===ui.signal)||o.signal_counts[0];
 const victims=[...s.borrowers].sort((a,b)=>SEV_ORDER[b.level]-SEV_ORDER[a.level]);
 const watch=o.borrowers.filter(r=>r.monitoring_active===true).sort((a,b)=>riskRank[a.risk]-riskRank[b.risk]);
 const monitoredIds=new Set(watch.map(r=>r.id));
 const monitoredCases=(o.cases||[]).filter(c=>monitoredIds.has(c.borrower_id));
 const caseRegister=d.role==='Analyst'?monitoredCases.filter(c=>c.status!=='RESOLVED').slice(0,35):cwPriorityCases(monitoredCases);

 return `${sectionHead('RISK SURVEILLANCE','Early warning desk','All ten signals, affected borrowers, ongoing investigations and the borrower × signal monitoring matrix.')}

 <div class="metric-grid compact-metrics">
 ${actionKpi('Triggered borrowers',o.metrics.triggered_borrowers,'Distinct impacted borrowers','ews','triggered','',ui.ewsFocus==='triggered')}
 ${actionKpi('Open investigations',o.metrics.unresolved_cases,'Unresolved cases','ews','cases','',ui.ewsFocus==='cases')}
 ${actionKpi('High / critical borrowers',o.metrics.high_critical,'Under elevated monitoring','ews','high','',ui.ewsFocus==='high')}
 ${actionKpi('Data gaps',o.metrics.unassessed,'Insufficient coverage','ews','gaps','',ui.ewsFocus==='gaps')}
 </div>
 ${ewsDetailPanel(d)}
 ${cwRiskInvestigationPanel(d)}

 <div class="section-grid"><section class="panel"><div class="panel-head"><div><div class="eyebrow">SELECT EWS</div><h3>Signal breach explorer</h3></div></div><div class="signal-buttons">${o.signal_counts.map(row=>`<button data-focus-signal="${row.id}" class="sig-button ${ui.signal===row.id?'selected':''}"><b>${E(row.id)}</b><span>${E(row.name)}</span><strong>${row.count}</strong></button>`).join('')}</div></section>

 <section class="panel"><div class="panel-head"><div><div class="eyebrow">AFFECTED BORROWERS</div><h3>${E(s.id)} · ${E(s.name)}</h3><p>${s.count} borrowers currently triggered. Click a name to investigate the evidence.</p></div></div>${table(['Borrower','Severity','Observed','Funded O/S'],victims.map(row=>`<tr><td><button class="link-button" data-open-borrower="${E(row.borrower_id)}">${E(row.name)}</button></td><td>${levelTag(row.level)}</td><td>${E(row.observed??'—')}</td><td class="num">${CR(row.funded_os_cr)}</td></tr>`),'No borrowers currently trigger this signal.')}</section></div>

 <section class="panel"><div class="panel-head"><div><div class="eyebrow">BORROWER × SIGNAL MATRIX</div><h3>Early warning heatmap</h3><p>Select a borrower to open its monitoring dossier. Grey indicates clear, outlined indicates no evaluation.</p></div><div class="heat-legend"><span><i class="hm-dot hm-clear"></i> Clear</span><span><i class="hm-dot hm-medium"></i> Medium</span><span><i class="hm-dot hm-high"></i> High</span><span><i class="hm-dot hm-critical"></i> Critical</span><span><i class="hm-dot hm-not-evaluated"></i> No data / N/A</span></div></div>
 <div class="heat-scroll"><table class="heat-table"><thead><tr><th>Existing borrower</th>${o.signal_catalog.map(x=>`<th title="${E(x.name)}">${E(x.id.slice(3))}</th>`).join('')}<th>Overall</th></tr></thead><tbody>
 ${watch.map(r=>`<tr><td><button class="link-button" data-open-borrower="${E(r.id)}">${E(r.name)}</button><span class="sub-id">${E(r.id)}</span></td>${o.signal_catalog.map(sig=>`<td><button data-open-borrower="${E(r.id)}" class="heat-cell hm-${E((r.signal_levels[sig.id]||'not-evaluated').toLowerCase().replace('_','-'))}" title="${E(sig.id+' '+sig.name+' — '+labelRisk(r.signal_levels[sig.id]))}" aria-label="${E(r.name+' '+sig.name+' '+labelRisk(r.signal_levels[sig.id]))}"></button></td>`).join('')}<td>${levelTag(r.risk)}</td></tr>`).join('')}</tbody></table></div></section>

 <section class="panel" id="ews-case-register" style="scroll-margin-top:20px"><div class="panel-head"><div><div class="eyebrow">OPEN INVESTIGATIONS</div><h3>Case register${d.role==='Analyst'?'':` (${caseRegister.length})`}</h3></div></div>${d.role==='Analyst'?'':cwPriorityFilter('ews-register')}${table(['Borrower','Signal','Priority','Investigation','Last updated'],caseRegister.map(c=>`<tr><td><button class="link-button" data-open-borrower="${E(c.borrower_id)}" data-open-tab="signals">${E(c.company)}</button></td><td>${E(c.signal_id)}</td><td>${levelTag(c.severity)}</td><td>${E(c.status)}</td><td>${E(c.updated_at)}</td></tr>`))}</section>`;
}

const SEV_ORDER={CRITICAL:4,HIGH:3,MEDIUM:2,CLEAR:1,NOT_EVALUATED:0,NOT_APPLICABLE:0};

// Existing Review & Approvals navigation (AVP + VP/CRO).
// CW_ASSIGNMENT_PATCH_V1: role-level assignment manager in existing Review & Approvals.
function assignmentSection(d){
 if(d.role==='Analyst')return '';
 const isCRO=d.role==='VP/CRO';
 const records=d.overview.borrowers||[];
 const preferred=isCRO?(ui.assignmentFocus||d.selected_borrower):d.selected_borrower;
 const active=records.find(r=>r.id===preferred)||records.find(r=>r.id===d.selected_borrower)||records[0];
 if(!active)return '';
 const current=active.assignment_role||'Unassigned';
 const activeMonitoring=active.monitoring_active===true;
 const allHistory=isCRO?(d.overview.assignment_events||[]):(d.detail.assignment_history||[]);
 const history=allHistory.filter(h=>h.borrower_id===active.id).slice(-8).reverse();
 const inactiveBorrowers=records.filter(r=>r.monitoring_active!==true);
 const enrollmentPanel=isCRO?`<div class="cw-assign-editor" style="margin-bottom:16px;padding:16px;border:1px solid var(--border,#dce5e8);border-radius:12px">
   <div class="eyebrow">VP/CRO ONLY · MONITORING ENROLMENT</div>
   <h4 style="margin:6px 0 8px">Move an existing borrower into monitoring</h4>
   <p class="mini-note">Only borrowers explicitly activated by VP/CRO join the monitoring worklist. Existing historical reports stay unchanged.</p>
   ${inactiveBorrowers.length?`<form data-form="activate_monitoring" class="cw-assign-form">
     <label class="cw-assign-field"><span>Select from approved borrower master (${inactiveBorrowers.length} available)</span>
       <select name="borrower_id" required aria-label="Existing borrower to move into monitoring">
         <option value="" selected disabled>Select approved borrower</option>
         ${inactiveBorrowers.map(r=>`<option value="${E(r.id)}">${E(r.name)} (${E(r.id)}) · ${E(r.status)}</option>`).join('')}
       </select></label>
     <button class="btn btn-primary" type="submit">Move to monitoring & assign Analyst ${ico('arrow',14)}</button>
   </form>`:`<p class="mini-note">All borrowers in this master have already been explicitly activated.</p>`}
 </div>`:'';
 const count={Analyst:0,AVP:0,Unassigned:0};
 records.forEach(r=>{const k=r.assignment_role||'Unassigned';count[k]=(count[k]||0)+1;});
 const when=t=>{const n=Date.parse(t||'');return Number.isFinite(n)?new Date(n).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})+' IST':(t||'—');};
 const historyRows=history.map(h=>`<tr><td>${E(when(h.at))}</td><td>${E(h.previous_role||'Unassigned')} ${ico('arrow',12)} ${E(h.new_role)}</td><td>${E(h.initiated_by||'—')}</td><td>${E(h.reason||'—')}</td></tr>`);
 const portfolio=isCRO?`<details class="cw-assign-register"><summary>Portfolio assignment overview · ${records.length} borrowers ${ico('down',14)}</summary>
 <div class="cw-assign-register-stats">${E(count.Analyst)} Analyst · ${E(count.AVP)} AVP · ${E(count.Unassigned)} Unassigned · ${records.filter(r=>r.monitoring_active).length} active monitoring</div>
 <div class="cw-assign-table-scroll">${table(['Borrower','Assigned to','Monitoring status','Action'],records.map(r=>`<tr><td>${E(r.name)}<span class="sub-id">${E(r.id)}</span></td><td>${E(r.assignment_role||'Unassigned')}</td><td>${r.monitoring_active?'Active monitoring': 'Not in monitoring'} · ${statusTag(r.status)}</td><td><button type="button" class="text-action" data-pick-assignment-borrower="${E(r.id)}">Manage ${ico('arrow',12)}</button></td></tr>`))}</div></details>`:'';
 return `<section class="panel cw-assignment-panel" id="assignment-ownership" style="scroll-margin-top:18px">
 <div class="panel-head"><div><div class="eyebrow">WORKLOAD ALLOCATION</div><h3>Assignment & Ownership</h3><p>VP/CRO moves approved borrowers into active monitoring. Reassignment is a separate decision made later.</p></div>${ico('user',21)}</div>
 ${enrollmentPanel}
 <div class="cw-assign-layout">
   <div class="cw-assign-editor">
     <div class="cw-assign-field"><span>Borrower</span>${isCRO?`<select data-pick-assignment-borrower aria-label="Select borrower for assignment">${records.map(r=>`<option value="${E(r.id)}" ${r.id===active.id?'selected':''}>${E(r.name)} (${E(r.id)})</option>`).join('')}</select>`:`<strong>${E(active.name)} (${E(active.id)})</strong>`}</div>
     <div class="cw-assign-current"><span>Current responsibility</span><strong>${E(current)}</strong></div>
     <div class="cw-assign-current"><span>Monitoring membership</span><strong>${activeMonitoring?'Active':'Not active'}</strong></div>
     ${!activeMonitoring?`<p class="mini-note">This approved borrower is in the master database but not yet in the active monitoring worklist. Only VP/CRO can activate it.</p>`:''}
     ${activeMonitoring?`
     <form data-form="assign_monitoring" class="cw-assign-form">
       <input type="hidden" name="borrower_id" value="${E(active.id)}"/>
       <label class="cw-assign-field"><span>${current==='Unassigned'?'Assign monitoring responsibility':'Reassign monitoring responsibility'}</span>
         <select name="owner_role" required>
          <option value="" ${current==='Unassigned'?'selected':''} disabled>Select designation</option>
          <option value="Analyst" ${current==='Analyst'?'selected':''}>Analyst</option>
          <option value="AVP" ${current==='AVP'?'selected':''}>AVP</option>
         </select></label>
       <label class="cw-assign-field"><span>Reason ${current==='Unassigned'?'(optional for first assignment)':'(required for reassignment)'}</span>
         <textarea name="reason" rows="2" maxlength="1200" ${current==='Unassigned'?'':'required minlength="10"'} placeholder="For example, redistribution of monitoring workload"></textarea></label>
       <button class="btn btn-primary" type="submit">${current==='Unassigned'?'Assign borrower':'Save reassignment'} ${ico('arrow',14)}</button>
     </form>`:''}
   </div>
   <div class="cw-assign-history">
      <h4>Recent assignment changes</h4>
      <p>Changes initiated by AVP or VP/CRO are visible to VP/CRO.</p>
      ${table(['When','From → To','Changed by','Reason'],historyRows,'No assignment changes recorded for this borrower.')}
   </div>
 </div>
 ${portfolio}
 </section>`;
}
function approvalsPage(d){
 const o=d.overview,borrowers=o.borrowers||[];
 if(ui.reviewRole!==d.role){ui.reviewRole=d.role;ui.reviewFilter='all';}
 const selected=['analyst','avp','cro','returned','finalized','overdue'].includes(ui.reviewFilter)?ui.reviewFilter:'all';
 const isAVP=d.role==='AVP';
 // CW_HISTORICAL_REVIEW_PIPELINE_V1: report-stage summary covers all recorded
 // borrower reports. The separate VP/CRO activation gate controls active worklists.
 // Do not confuse an existing report record with a newly activated assignment.
 const analyst=borrowers.filter(r=>r.status==='NOT_STARTED'||r.status==='DRAFT');
 const avpWork=borrowers.filter(r=>r.status==='PENDING_AVP');
 const pendingCRO=borrowers.filter(r=>r.status==='PENDING_CRO');
 const returned=borrowers.filter(r=>r.status==='RETURNED');
 const finalized=borrowers.filter(r=>r.status==='FINALIZED');
 // The overdue KPI was activation-based before this fix. Keep it unchanged.
 const overdue=borrowers.filter(r=>r.monitoring_active && r.overdue).sort((a,b)=>(a.due_date||'').localeCompare(b.due_date||''));
 const returnedDescription='All recorded returned reports, with the destination role displayed. Inactive historical cases remain view-only until VP/CRO activation.';
 const labels={analyst:'With Analyst',avp:'With AVP',cro:'With VP/CRO',returned:'Returned',finalized:'Finalized',overdue:'Overdue'};
 const chosenItems={analyst,avp:avpWork,cro:pendingCRO,returned,finalized,overdue}[selected]||[];

 const descriptions={
  analyst:'Recorded Not Started and Draft report stages. Active Analyst worklists remain restricted to VP/CRO-activated borrowers.',
  avp:'Recorded reports with Pending AVP status, including historical records. Only activated borrowers can be processed.',
  cro:'Recorded Pending CRO reports. Inactive historical records can be viewed but not approved until activated.',
  returned:returnedDescription,
  finalized:'Reports with completed final approval and preserved approval history.',
  overdue:'Reports past their due date, regardless of which review stage they are in.'
 };

 const reviewCard=(key,count,sub)=>`<button type="button" class="metric metric-jump" data-review-filter="${key}" aria-pressed="${selected===key}" aria-label="Show ${E(labels[key])} reports" ${selected===key?'style="border-color:#008f88;box-shadow:0 0 0 2px rgba(0,143,136,.13)"':''}><div class="metric-label">${E(labels[key])}</div><div class="metric-value">${E(count)}</div><div class="metric-sub">${E(sub)} ${ico('arrow',13)}</div></button>`;

 const rows=items=>items.map(r=>{
  const isDraft=r.status==='DRAFT'||r.status==='NOT_STARTED';
  const canReview=r.monitoring_active===true && ((isAVP&&r.status==='PENDING_AVP')||(!isAVP&&r.status==='PENDING_CRO'));
  const action=r.monitoring_active!==true?(isDraft?'View borrower':'View report'):isDraft?'Open borrower':r.status==='FINALIZED'?'Open approved version':canReview?'Review report':'View report';
  return `<tr><td><strong>${E(r.name)}</strong><span class="sub-id">${E(r.id)}</span></td><td>FY${E(r.fin_year??'—')}</td><td>${levelTag(r.risk)}</td><td>${E(r.due_date||'—')} ${r.overdue?'<span class="overdue-label">Overdue</span>':''}</td><td>${statusTag(r.status)}</td><td><button type="button" class="text-action" data-open-borrower="${E(r.id)}" data-open-tab="${isDraft?'snapshot':'report'}">${E(action)} ${ico('arrow',14)}</button></td></tr>`;
 });

 const standardTable=items=>table(['Borrower','Monitoring FY','Risk','Due date','Workflow status','Action'],rows(items),'No reports in this category.');
 const pendingPanel=(heading,description,items)=>`<section class="panel"><div class="panel-head"><div><div class="eyebrow">REVIEW PIPELINE</div><h3>${E(heading)} (${items.length})</h3><p>${E(description)}</p></div></div>${standardTable(items)}</section>`;
 const finalizedPanel=`<section class="panel"><div class="panel-head"><h3>Finalized monitoring reports</h3></div>${table(['Borrower','Report status','Risk','Latest monitoring FY','Action'],finalized.map(r=>`<tr><td>${E(r.name)}</td><td>${statusTag(r.status)}</td><td>${levelTag(r.risk)}</td><td>FY${E(r.fin_year??'—')}</td><td><button type="button" class="text-action" data-open-borrower="${E(r.id)}" data-open-tab="report">Open approved version</button></td></tr>`),'No finalized monitoring reports.')}</section>`;

 const originalQueues=`${returnedPanel(returned,'Recorded returned reports',returnedDescription,true)}
 ${isAVP?pendingPanel('With AVP','AVP-owned preparation and reports awaiting AVP review, separate from returned reports.',avpWork):pendingPanel('Awaiting VP/CRO final approval','Reports forwarded by AVP for final decision.',pendingCRO)+pendingPanel('With AVP','AVP-owned preparation and reports awaiting AVP review; VP/CRO retains oversight.',avpWork)}
 ${finalizedPanel}`;

 const reset=`<div style="display:flex;justify-content:flex-end;margin:0 0 12px"><button type="button" class="btn btn-outline" data-review-reset>View all queues ${ico('arrow',14)}</button></div>`;
 const focusedSection=selected==='returned'
 ?returnedPanel(returned,'Recorded returned reports',returnedDescription,true)
 :`<section class="panel"><div class="panel-head"><div><div class="eyebrow">SELECTED REVIEW CATEGORY</div><h3>${E(labels[selected])} (${chosenItems.length})</h3><p>${E(descriptions[selected])}</p></div></div>${standardTable(chosenItems)}</section>`;

 return `${sectionHead('MONITORING GOVERNANCE','Review & approvals','Recorded report stages across existing borrowers. VP/CRO activation separately controls current monitoring worklists.')}
 <div class="metric-grid compact-metrics">${reviewCard('analyst',analyst.length,'Analyst preparation')}${reviewCard('avp',avpWork.length,'Preparation & review')}${reviewCard('cro',pendingCRO.length,'Final approval queue')}${reviewCard('returned',returned.length,'All recorded returns')}${reviewCard('finalized',finalized.length,'Version-locked')}${reviewCard('overdue',overdue.length,'Past report due date')}</div>
 ${assignmentSection(d)}
 ${selected==='all'?originalQueues:`<div id="review-focus-panel" style="scroll-margin-top:20px">${reset}${focusedSection}</div>`}`;
}


function dataPage(d) {
  const x = d.detail;
  const b = x.borrower;

  return `${sectionHead(
    'MONITORING DATA',
    'Verified inputs & monitoring evidence',
    'Explore the structured records supporting the ten early warning signals.'
  )}

  <div class="borrower-select-line">
    ${borrowerSelector(d)}
    <span class="lock-note">
      ${ico('shield',16)} APPROVED BORROWERS ONLY
    </span>
  </div>

  <div class="section-grid">

    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="eyebrow">ORIGINAL SANCTION REFERENCE</div>
          <h3>${E(b.company_name)}</h3>
        </div>
      </div>

      <div class="info-list">
        <div>
          <span>Approval</span>
          <b>APPROVED (preloaded)</b>
        </div>

        <div>
          <span>Sanctioned on</span>
          <b>${E(b.sanction_date)}</b>
        </div>

        <div>
          <span>Source</span>
          <b>Synthetic approved master</b>
        </div>

        <div>
          <span>Financial baseline</span>
          <b>FY2023–FY2025</b>
        </div>

        <div>
          <span>Last dataset date</span>
          <b>${E(d.metadata.generated_as_of)}</b>
        </div>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="eyebrow">MONITORING EVIDENCE</div>
          <h3>Required source-data coverage</h3>
        </div>
      </div>

      <div class="info-list">
        ${[
          ['Financials', x.financials.length + ' periods'],

          ['Outstanding',
            x.exposure.facilities.filter(
              f => f.latest_os_cr != null
            ).length + ' funded facilities'
          ],

          ['Repayment obligations',
            x.repayments.length + ' events'
          ],

          ['Covenants',
            x.covenants.length + ' conditions'
          ],

          ['Credit rating history',
            x.ratings.length + ' events'
          ],

          ['Latest account-credit sample',
            CR(x.account_credits_recent_cr)
          ]

        ].map(([k,v]) => `
          <div>
            <span>${E(k)}</span>
            <b>${E(v)}</b>
          </div>
        `).join('')}
      </div>
    </section>

  </div>

  <section class="panel">
    <div class="panel-head">
      <h3>Facility-level sanctioned limits & latest outstanding</h3>
    </div>

    ${table(
      [
        'Facility',
        'Product',
        'Sanctioned limit',
        'O/S',
        'Observation date'
      ],

      x.exposure.facilities.map(f => `
        <tr>
          <td>${E(f.facility_id)}</td>
          <td>${E(f.facility_type)}</td>
          <td>${CR(f.sanctioned_limit)}</td>
          <td>${CR(f.latest_os_cr)}</td>
          <td>${E(f.latest_date || 'Not available')}</td>
        </tr>
      `)
    )}
  </section>

  <div class="section-grid">

    <section class="panel">
      <div class="panel-head">
        <h3>Repayment records</h3>
      </div>

      ${table(
        [
          'Facility',
          'Due date',
          'Amount due',
          'Amount paid'
        ],

        x.repayments.map(r => `
          <tr>
            <td>${E(r.facility_id.split('-').slice(-1)[0])}</td>
            <td>${E(r.due_date)}</td>
            <td>${CR(r.amount_due_cr)}</td>
            <td>${CR(r.paid_cr)}</td>
          </tr>
        `)
      )}
    </section>

    <section class="panel">
      <div class="panel-head">
        <h3>Covenant & rating references</h3>
      </div>

      ${table(
        [
          'Reference',
          'Current value / requirement'
        ],
        [
          ...x.covenants.map(c => `
            <tr>
              <td>${E(c.metric.toUpperCase())} covenant</td>
              <td>
                ${E(c.operator)}
                ${N(c.threshold,2)}x
                ${c.waiver_active
                  ? '· documented waiver'
                  : ''}
              </td>
            </tr>
          `),

          ...x.ratings.map(r => `
            <tr>
              <td>
                ${E(r.date)} · Internal ${E(r.scale)}
              </td>
              <td>${E(r.grade)}</td>
            </tr>
          `)
        ]
      )}
    </section>

  </div>`;
}

function sendAction(component,payload){
 const event_id=`cw-${Date.now()}-${Math.random().toString(36).slice(2)}`;
 component.setTriggerValue('action',{...payload,event_id});
}

function onForm(e,component){
 e.preventDefault();
 const el=e.currentTarget,kind=el.dataset.form,fd=new FormData(el);
 let p={kind,borrower_id:currentData.selected_borrower};

 if(kind==='login'){p.role=fd.get('role');}
 else if(kind==='save_financial'){
  p.kind='save_financial';
  p.fy=Number(fd.get('fy'));
  p.baseline=fd.get('baseline')==='true';
  p.reason=fd.get('reason')||'';
  p.statement_type=fd.get('statement_type')||'Provisional';
  p.values={};
  for(let [k,v] of fd.entries())if(k.startsWith('v.'))p.values[k.slice(2)]=String(v).trim()===''?'':Number(v);
 }
 else if(kind==='create_period'){p.fy=Number(fd.get('fy'));}
 else if(kind==='delete_period'){p.fy=Number(fd.get('fy'));p.reason=fd.get('reason')||'';}
 else if(kind==='ask'){p.question=fd.get('question');p.use_groq=fd.get('use_groq')==='on';p.ai_consent=fd.get('ai_consent')==='on';}
 else if(kind==='ai_risk_investigate'){p.borrower_id=fd.get('borrower_id');p.scope=fd.get('scope')||'active';p.ai_consent=fd.get('ai_consent')==='on';ui.aiRiskBorrower=p.borrower_id;ui.aiRiskScope=p.scope;}
 else if(kind==='ai_portfolio_intelligence'){p.question=fd.get('question');p.scope=fd.get('scope');p.ai_consent=fd.get('ai_consent')==='on';ui.aiPortfolioScope=p.scope;ui.aiPortfolioQuestion=p.question;}
 else if(kind==='case_update'){p.case_id=fd.get('case_id');p.status=fd.get('status');p.reason=fd.get('reason');}
 else if(kind==='simulate'){p.scenario=fd.get('scenario');}
 else if(kind==='assign_monitoring'){p.borrower_id=fd.get('borrower_id');p.owner_role=fd.get('owner_role');p.reason=fd.get('reason')||'';}
 else if(kind==='activate_monitoring'){p.borrower_id=fd.get('borrower_id');}
 else if(kind==='report_action'){p.kind=e.submitter?.value||'save_notes';p.fy=Number(fd.get('fy'));p.reason=fd.get('reason');p.notes=fd.get('notes');}
 sendAction(component,p);
}

function draw(component){
 currentData=component.data;
 const root=component.parentElement.querySelector('#creditwatch-html-root')||component.parentElement.querySelector('#creditwatch-root')||component.parentElement;
 if(!currentData||!root)return;
 if(!currentData.authenticated){root.innerHTML=loginPage(currentData);attach(component);return;}
 // A saved borrower only counts as success after the Python server confirms the request.
 const onboardResult=currentData.onboarding?.result;
 if(onboardResult && ((ui.onboard.pending && ui.onboard.pending===onboardResult.request_id)
    || (currentData.notice?.type==='success' && ui.page==='onboard'))){
    ui.onboard.completed=onboardResult.borrower_id;
    ui.onboard.pending=null;
 }
 if(ui.onboard.pending && currentData.notice?.type==='error')ui.onboard.pending=null;
 if(!allowedNav(currentData).some(x=>x[0]===ui.page))ui.page=allowedNav(currentData)[0]?.[0]||'guide';

 let body;
 switch(ui.page){
  case 'onboard':body=onboardPage(currentData);break;
  case 'borrower':body=borrowerPage(currentData);break;
  case 'ews':body=ewsDesk(currentData);break;
  case 'reviews':body=approvalsPage(currentData);break;
  case 'data':body=dataPage(currentData);break;
  case 'guide':body=guidePage(currentData);break;
  default:body=overviewPage(currentData);
 }

 root.innerHTML=shell(currentData,body);
 attach(component);
}

function attach(component){
 let root=component.parentElement.querySelector('#creditwatch-html-root')||component.parentElement.querySelector('#creditwatch-root')||component.parentElement;

 // CW_ONBOARD_BORROWER_EVENTS_V1: browser-side draft, server-side final validation.
 root.querySelectorAll('form[data-onboard-step]').forEach(form=>form.addEventListener('submit',e=>{
   e.preventDefault();
   const stage=Number(form.dataset.onboardStep);
   if(ui.onboard.pending||!onboardCanEdit(ui.onboard,stage,currentData.onboarding))return;
   if(!form.reportValidity())return;
   onboardCollect(root);
   const issues=stage<4?onboardStepIssues(stage,ui.onboard,currentData.onboarding):
     [1,2,3].flatMap(n=>onboardStepIssues(n,ui.onboard,currentData.onboarding));
   if(issues.length){ui.onboard.error=issues[0];draw(component);return;}
   ui.onboard.error='';
   if(stage<4){
     ui.onboard.step=stage+1;
     draw(component);
     window.scrollTo?.(0,0);
   }else{
     const requestId=`ob-${Date.now()}-${Math.random().toString(36).slice(2)}`;
     ui.onboard.pending=requestId;
     sendAction(component,{kind:'onboard_borrower',request_id:requestId,
       payload:{...ui.onboard.details,...ui.onboard.sanction,
         facilities:ui.onboard.facilities,baselines:ui.onboard.baselines}});
     draw(component);
   }
 }));
 // Viewing never requires earlier stages to be complete. Editing does.
 root.querySelectorAll('[data-onboard-jump]').forEach(btn=>btn.addEventListener('click',()=>{
   if(ui.onboard.pending)return;
   const stage=Number(btn.dataset.onboardJump);
   if(!Number.isInteger(stage)||stage<1||stage>4)return;
   onboardCollect(root); // capture the current draft, including incomplete fields
   ui.onboard.error='';
   ui.onboard.step=stage;
   draw(component);
   window.scrollTo?.(0,0);
 }));
 // Disabled controls preserve the form's visible preview but prevent all edits.
 const previewForm=root.querySelector('form[data-onboard-step]');
 if(previewForm&&!onboardCanEdit(ui.onboard,Number(previewForm.dataset.onboardStep),currentData.onboarding)){
   previewForm.querySelectorAll('input,select,textarea,button:not([data-onboard-back])').forEach(el=>{el.disabled=true;});
 }
 root.querySelectorAll('[data-onboard-back]').forEach(btn=>btn.addEventListener('click',()=>{
   onboardCollect(root);ui.onboard.error='';ui.onboard.step=Math.max(1,ui.onboard.step-1);draw(component);
 }));
 root.querySelectorAll('[data-onboard-reset]').forEach(btn=>btn.addEventListener('click',()=>{
   ui.onboard=newOnboardState();draw(component);
 }));
 root.querySelectorAll('[data-onboard-view]').forEach(btn=>btn.addEventListener('click',()=>{
   const id=btn.dataset.onboardView;
   ui.page='borrower';ui.tab='snapshot';ui.financialEditor=null;
   sendAction(component,{kind:'select_borrower',borrower_id:id});
 }));
 root.querySelectorAll('[data-onboard-add-facility]').forEach(btn=>btn.addEventListener('click',()=>{
   onboardCollect(root);
   if(ui.onboard.facilities.length<8)ui.onboard.facilities.push({facility_type:'CC',sanctioned_limit:'',interest_rate:'',maturity_date:'',outstanding_cr:''});
   draw(component);
 }));
 root.querySelectorAll('[data-onboard-remove-facility]').forEach(btn=>btn.addEventListener('click',()=>{
   onboardCollect(root);
   if(ui.onboard.facilities.length>1)ui.onboard.facilities.splice(Number(btn.dataset.onboardRemoveFacility),1);
   draw(component);
 }));
 root.querySelectorAll('[data-onboard-add-fy]').forEach(btn=>btn.addEventListener('click',()=>{
   onboardCollect(root);
   const baselines=ui.onboard.baselines;
   if(baselines.length<3){const oldest=Math.min(...baselines.map(y=>Number(y.fy)));
     baselines.push({fy:Math.max(2015,oldest-1),statement_type:'Audited',data:{}});}
   draw(component);
 }));
 root.querySelectorAll('[data-onboard-remove-fy]').forEach(btn=>btn.addEventListener('click',()=>{
   onboardCollect(root);
   if(ui.onboard.baselines.length>1)ui.onboard.baselines.splice(Number(btn.dataset.onboardRemoveFy),1);
   draw(component);
 }));
 const sectorSelect=root.querySelector('form[data-onboard-step="1"] select[name="sector"]');
 if(sectorSelect){sectorSelect.addEventListener('change',()=>{
   const subSelect=root.querySelector('form[data-onboard-step="1"] select[name="sub_industry"]');
   if(!subSelect)return;
   const sectors=currentData.onboarding?.sectors||{};
   subSelect.innerHTML='<option value="">Select sub sector</option>'+((sectors[sectorSelect.value]||[])
     .map(value=>obOpt(value,'')).join(''));
 });}
 root.querySelectorAll('form[data-form]').forEach(f=>f.addEventListener('submit',e=>onForm(e,component)));
 root.querySelectorAll('select[data-ai-risk-borrower]').forEach(el=>el.addEventListener('change',()=>{ui.aiRiskBorrower=el.value;}));
 root.querySelectorAll('select[data-ai-risk-scope]').forEach(el=>el.addEventListener('change',()=>{ui.aiRiskScope=el.value;ui.aiRiskBorrower=null;draw(component);}));

 root.querySelectorAll('[data-nav]').forEach(el=>el.addEventListener('click',()=>{
  if(!allowedNav(currentData).some(([key])=>key===el.dataset.nav))return;
  ui.page=el.dataset.nav;
  ui.financialEditor=null;
  draw(component);
  window.scrollTo?.(0,0);
 }));

 root.querySelectorAll('[data-scroll-target]').forEach(el=>el.addEventListener('click',()=>{
  root.querySelector('#'+el.dataset.scrollTarget)?.scrollIntoView({behavior:'smooth',block:'start'});
 }));

 root.querySelectorAll('[data-tab]').forEach(el=>el.addEventListener('click',()=>{
  ui.tab=el.dataset.tab;
  ui.financialEditor=null;
  draw(component);
 }));

 root.querySelectorAll('[data-borrower-select]').forEach(el=>el.addEventListener('change',e=>{
  ui.financialEditor=null;
  ui.caseId=null;
  sendAction(component,{kind:'select_borrower',borrower_id:e.target.value});
 }));

 root.querySelectorAll('[data-open-borrower]').forEach(el=>el.addEventListener('click',()=>{
  ui.page='borrower';
  ui.tab=el.dataset.openTab||'snapshot';
  ui.financialEditor=null;
  ui.caseId=null;
  sendAction(component,{kind:'select_borrower',borrower_id:el.dataset.openBorrower});
  window.scrollTo?.(0,0);
 }));

 root.querySelectorAll('[data-focus-signal]').forEach(el=>el.addEventListener('click',()=>{
  ui.page='ews';
  ui.signal=el.dataset.focusSignal;
  draw(component);
 }));

  // CW_SUBMITTED_AND_DELETE_DRAFT_V1: switch Analyst queues without losing the expanded worklist.
  root.querySelectorAll('[data-analyst-view]').forEach(btn=>btn.addEventListener('click',()=>{
    const chosen=btn.dataset.analystView;
    root.querySelectorAll('[data-analyst-view]').forEach(other=>{
      const active=other.dataset.analystView===chosen;
      other.setAttribute('aria-pressed',String(active));
      other.classList.toggle('btn-primary',active);
      other.classList.toggle('btn-outline',!active);
    });
    root.querySelectorAll('[data-analyst-panel]').forEach(panel=>{
      panel.hidden=panel.dataset.analystPanel!==chosen;
    });
  }));

  // Controlled deletion is a two-step inline confirmation; no browser popup required.
  root.querySelectorAll('[data-show-delete-period]').forEach(btn=>btn.addEventListener('click',()=>{
    const container=root.querySelector('.cw-delete-year-panel');
    if(!container)return;
    const fy=btn.dataset.showDeletePeriod;
    const field=container.querySelector('input[name="fy"]');
    const heading=container.querySelector('.cw-delete-year-title');
    if(!field||!heading)return;
    field.value=fy;
    heading.textContent=`Delete FY${fy} draft monitoring year?`;
    container.hidden=false;
    container.scrollIntoView({behavior:'smooth',block:'nearest'});
    container.querySelector('textarea[name="reason"]')?.focus();
  }));
  root.querySelectorAll('[data-cancel-delete-period]').forEach(btn=>btn.addEventListener('click',()=>{
    const container=btn.closest('.cw-delete-year-panel');
    if(container){container.hidden=true;container.querySelector('form')?.reset();}
  }));

 root.querySelectorAll('[data-edit-financial]').forEach(el=>el.addEventListener('click',()=>{
  ui.financialEditor={fy:Number(el.dataset.editFinancial),baseline:el.dataset.baseline==='true'};
  draw(component);
 }));

 root.querySelectorAll('[data-cancel-edit]').forEach(el=>el.addEventListener('click',()=>{
  ui.financialEditor=null;
  draw(component);
 }));

 root.querySelectorAll('[data-case-pick]').forEach(el=>el.addEventListener('click',()=>{
  ui.caseId=el.dataset.casePick;
  draw(component);
 }));

 root.querySelectorAll('[data-logout]').forEach(el=>el.addEventListener('click',()=>{
  ui.page='guide';
  ui.onboard=newOnboardState();
  ui.tab='snapshot';
  ui.investigationPriority='ALL';
  sendAction(component,{kind:'logout'});
 }));

 root.querySelectorAll('[data-filter]').forEach(el=>el.addEventListener('change',()=>{
  ui.search=el.value;
  draw(component);
 }));

 // CW_INVESTIGATION_PRIORITY_FILTER_V1: keep the chosen priority in both drilldowns.
 root.querySelectorAll('[data-investigation-priority]').forEach(el=>el.addEventListener('click',()=>{
  if(currentData.role==='Analyst')return;
  const priority=el.dataset.investigationPriority;
  if(!['ALL','CRITICAL','HIGH','MEDIUM'].includes(priority))return;
  ui.investigationPriority=priority;
  const scope=el.dataset.investigationSource;
  draw(component);
  const target={overview:'#overview-focus-panel','ews-focus':'#ews-focus-panel','ews-register':'#ews-case-register'}[scope];
  if(target)root.querySelector(target)?.scrollIntoView({block:'start'});
 }));

 // Review & Approvals summary-card navigation
 root.querySelectorAll('[data-review-filter]').forEach(el=>el.addEventListener('click',()=>{
  ui.reviewFilter=el.dataset.reviewFilter;
  draw(component);
  root.querySelector('#review-focus-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
 }));

 root.querySelectorAll('[data-review-reset]').forEach(el=>el.addEventListener('click',()=>{
  ui.reviewFilter='all';
  draw(component);
  root.querySelector('.compact-metrics')?.scrollIntoView({behavior:'smooth',block:'start'});
 }));

 // Shared clickable summary cards throughout CreditWatch.
 root.querySelectorAll('[data-summary-section]').forEach(el=>el.addEventListener('click',()=>{
  const section=el.dataset.summarySection,key=el.dataset.summaryKey;
  let target='';

  if(section==='overview'){
   ui.overviewFocus=key;
   target='#overview-focus-panel';
  }
  else if(section==='ews'){
   ui.ewsFocus=key;
   target='#ews-focus-panel';
  }
  else if(section==='borrower'){
   ui.financialEditor=null;
   if(key==='ews'){
    ui.tab='signals';
    ui.signalFocus='triggered';
    target='#signal-focus-panel';
   }
   else if(key==='year'){
    ui.tab='financials';
    target='#borrower-financials';
   }
   else{
    ui.tab='snapshot';
    target='#borrower-facilities';
   }
  }
  else if(section==='signals'){
   ui.signalFocus=key;
   target='#signal-focus-panel';
  }
  else return;

  draw(component);
  root.querySelector(target)?.scrollIntoView({behavior:'smooth',block:'start'});
 }));

 root.querySelectorAll('[data-summary-reset]').forEach(el=>el.addEventListener('click',()=>{
  const section=el.dataset.summaryReset;
  if(section==='overview')ui.overviewFocus=null;
  else if(section==='ews')ui.ewsFocus=null;
  else if(section==='signals')ui.signalFocus=null;

  draw(component);
  root.querySelector(section==='signals'?'.signal-summary':'.metric-grid')?.scrollIntoView({behavior:'smooth',block:'start'});
 }));

 // CW_ASSIGNMENT_PATCH_V1: role-guarded navigation and borrower focus.
 root.querySelectorAll('[data-manage-assignment]').forEach(el=>el.addEventListener('click',()=>{
   if(currentData.role==='Analyst'||!(currentData.available_pages||[]).includes('reviews'))return;
   ui.assignmentFocus=el.dataset.manageAssignment;
   ui.page='reviews';ui.reviewFilter='all';
   draw(component);
   root.querySelector('#assignment-ownership')?.scrollIntoView({behavior:'smooth',block:'start'});
 }));
 root.querySelectorAll('select[data-pick-assignment-borrower]').forEach(el=>el.addEventListener('change',()=>{
   if(currentData.role!=='VP/CRO')return;
   ui.assignmentFocus=el.value;
   draw(component);
   root.querySelector('#assignment-ownership')?.scrollIntoView({block:'start'});
 }));
 root.querySelectorAll('button[data-pick-assignment-borrower]').forEach(el=>el.addEventListener('click',()=>{
   if(currentData.role!=='VP/CRO')return;
   ui.assignmentFocus=el.dataset.pickAssignmentBorrower;
   draw(component);
   root.querySelector('#assignment-ownership')?.scrollIntoView({block:'start'});
 }));
 root.querySelectorAll('[data-print]').forEach(el=>el.addEventListener('click',()=>window.print?.()));
}

export default function(component){draw(component);}
