import { useState, useMemo, useRef, useEffect, useCallback } from "react";

// ─── IndexedDB helpers ────────────────────────────────────────────────────────
const DB_NAME = "lottery-tracker";
const DB_VER  = 1;
const STORE   = "entries";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE))
        db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}
async function dbGetAll() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}
async function dbPut(entry) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).put(entry);
    req.onsuccess = () => res();
    req.onerror   = e => rej(e.target.error);
  });
}
async function dbDelete(id) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(id);
    req.onsuccess = () => res();
    req.onerror   = e => rej(e.target.error);
  });
}
async function dbClear() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).clear();
    req.onsuccess = () => res();
    req.onerror   = e => rej(e.target.error);
  });
}

// ─── Blob ↔ Base64 for backup ────────────────────────────────────────────────
function blobToBase64(blob) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = () => res(r.result); // data:image/webp;base64,....
    r.readAsDataURL(blob);
  });
}
async function base64ToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

// ─── Seed data ────────────────────────────────────────────────────────────────
function days(n) { return new Date(Date.now()+n*86400000).toISOString().split("T")[0]; }
const SEED = [
  { id:1, prize:"AirPods Pro 2",     drawDate:days(+2), link:"https://www.instagram.com/p/example1", confirmed:false, thumbBlob:null, winners:3 },
  { id:2, prize:"Nike 球鞋 x2",      drawDate:days(+5), link:"https://www.instagram.com/p/example2", confirmed:false, thumbBlob:null, winners:null },
  { id:3, prize:"星巴克禮品卡 $500", drawDate:days(-3), link:"https://www.instagram.com/p/example3", confirmed:false, thumbBlob:null, winners:1 },
  { id:4, prize:"iPhone 16 Pro",     drawDate:days(-7), link:"https://www.instagram.com/p/example4", confirmed:true,  thumbBlob:null, winners:2 },
];

// ─── Blob URL cache ───────────────────────────────────────────────────────────
const urlCache = new Map();
function getBlobUrl(id, blob) {
  if (!blob) return null;
  if (!urlCache.has(id)) urlCache.set(id, URL.createObjectURL(blob));
  return urlCache.get(id);
}
function revokeBlobUrl(id) {
  if (urlCache.has(id)) { URL.revokeObjectURL(urlCache.get(id)); urlCache.delete(id); }
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function formatDate(d) {
  return new Date(d+"T00:00:00").toLocaleDateString("zh-TW",{month:"long",day:"numeric",weekday:"short"});
}
function daysUntil(d) {
  const t = new Date(); t.setHours(0,0,0,0);
  return Math.ceil((new Date(d+"T00:00:00")-t)/86400000);
}
function isPast(d) { return daysUntil(d)<0; }

const IG_PH = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 56 56'><rect width='56' height='56' rx='10' fill='%23dde8f0'/><rect x='14' y='14' width='28' height='28' rx='6' fill='none' stroke='%238EA9BC' stroke-width='2.2'/><circle cx='28' cy='28' r='7' fill='none' stroke='%238EA9BC' stroke-width='2.2'/><circle cx='37' cy='19' r='2' fill='%238EA9BC'/></svg>`;

// ─── CountdownBadge ───────────────────────────────────────────────────────────
function CountdownBadge({ dateStr }) {
  const d = daysUntil(dateStr);
  if (d<0)   return <span className="badge b-past">已開獎 {Math.abs(d)} 天前</span>;
  if (d===0) return <span className="badge b-today">今天開獎</span>;
  if (d===1) return <span className="badge b-soon">明天開獎</span>;
  return <span className="badge b-up">{d} 天後</span>;
}

// ─── Card Action Sheet (mobile long-press menu) ───────────────────────────────
function ActionSheet({ entry, onEdit, onDelete, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div className="sheet-prize">{entry.prize}</div>
        <button className="sheet-btn" onClick={()=>{ onEdit(entry); onClose(); }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          編輯
        </button>
        <button className="sheet-btn sheet-del" onClick={()=>{ onDelete(entry.id); onClose(); }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          刪除
        </button>
        <button className="sheet-cancel" onClick={onClose}>取消</button>
      </div>
    </div>
  );
}

// ─── LotteryCard ──────────────────────────────────────────────────────────────
function LotteryCard({ entry, onToggleConfirm, onDelete, onEdit }) {
  const past     = isPast(entry.drawDate);
  const thumbUrl = getBlobUrl(entry.id, entry.thumbBlob);
  const [showSheet,   setShowSheet]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const pressTimer = useRef(null);

  function startPress() {
    pressTimer.current = setTimeout(()=>setShowSheet(true), 500);
  }
  function cancelPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }

  return (
    <>
      <div
        className={`card ${entry.confirmed?"card-done":""} ${past&&!entry.confirmed?"card-past":""}`}
        onTouchStart={startPress} onTouchEnd={cancelPress} onTouchMove={cancelPress}
        onMouseDown={startPress}  onMouseUp={cancelPress}  onMouseLeave={cancelPress}
      >
        <div className="thumb-wrap">
          <img src={thumbUrl||IG_PH} alt="預覽"
            className={`thumb-img ${!thumbUrl?"thumb-ph":""}`} />
        </div>
        <div className="card-body">
          <div className="card-row">
            <span className="prize">{entry.prize}</span>
            <CountdownBadge dateStr={entry.drawDate} />
          </div>
          <div className="card-meta">
            <span className="meta">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              {formatDate(entry.drawDate)}
            </span>
            {entry.winners && (
              <span className="meta">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                抽 {entry.winners} 人
              </span>
            )}
            {entry.link && (
              <a href={entry.link} target="_blank" rel="noopener noreferrer"
                className="meta meta-link" onClick={e=>e.stopPropagation()}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                查看貼文
              </a>
            )}
          </div>
        </div>
        <div className="card-controls">
          <button className={`tog ${entry.confirmed?"tog-off":"tog-on"}`}
            onTouchStart={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()}
            onClick={()=>onToggleConfirm(entry.id)}
            title={entry.confirmed?"標記為未確認":"確認未中獎"}>
            <span className="tog-track"><span className="tog-knob"/></span>
          </button>
          {/* visible edit/delete for desktop */}
          <div className="card-actions">
            <button className="act-btn edit-btn" onMouseDown={e=>e.stopPropagation()} onClick={()=>onEdit(entry)} title="編輯">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button className="act-btn del-btn" onMouseDown={e=>e.stopPropagation()} onClick={()=>setShowConfirm(true)} title="刪除">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </div>
      </div>

      {showSheet && (
        <ActionSheet entry={entry} onEdit={onEdit}
          onDelete={id=>setShowConfirm(true)} onClose={()=>setShowSheet(false)} />
      )}
      {showConfirm && (
        <div className="overlay" onClick={()=>setShowConfirm(false)}>
          <div className="confirm-box" onClick={e=>e.stopPropagation()}>
            <div className="confirm-icon">🗑️</div>
            <div className="confirm-title">確認刪除？</div>
            <div className="confirm-msg">「{entry.prize}」刪除後無法復原</div>
            <div className="confirm-btns">
              <button className="btn-sec" onClick={()=>setShowConfirm(false)}>取消</button>
              <button className="btn-danger" onClick={()=>{ setShowConfirm(false); onDelete(entry.id); }}>確認刪除</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────
function Section({ title, icon, count, children, defaultOpen=true, cls }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`sec ${cls}`}>
      <button className="sec-hd" onClick={()=>setOpen(o=>!o)}>
        <span className="sec-icon">{icon}</span>
        <span className="sec-title">{title}</span>
        <span className="sec-pill">{count}</span>
        <span className={`chev ${open?"chev-open":""}`}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </button>
      {open && <div className="sec-body">{children}</div>}
    </div>
  );
}

// ─── EntryModal (Add + Edit) ──────────────────────────────────────────────────
function EntryModal({ initial, onSave, onClose }) {
  const isEdit = !!initial;
  const today  = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    prize:     initial?.prize     ?? "",
    drawDate:  initial?.drawDate  ?? today,
    link:      initial?.link      ?? "",
    winners:   initial?.winners   ?? "",
    thumbBlob: initial?.thumbBlob ?? null,
  });
  const [previewUrl, setPreviewUrl] = useState(
    initial?.thumbBlob ? URL.createObjectURL(initial.thumbBlob) : null
  );
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr]           = useState("");
  const fileRef = useRef();

  useEffect(()=>()=>{ if(previewUrl) URL.revokeObjectURL(previewUrl); },[]);

  function handleFile(file) {
    if (!file||!file.type.startsWith("image/")) return;
    const img = new Image(), ou = URL.createObjectURL(file);
    img.onload = () => {
      const MAX=600, s=Math.min(1,MAX/img.width);
      const w=Math.round(img.width*s), h=Math.round(img.height*s);
      const c=document.createElement("canvas"); c.width=w; c.height=h;
      c.getContext("2d").drawImage(img,0,0,w,h);
      c.toBlob(blob=>{ URL.revokeObjectURL(ou); if(previewUrl) URL.revokeObjectURL(previewUrl);
        setForm(f=>({...f,thumbBlob:blob})); setPreviewUrl(URL.createObjectURL(blob));
      },"image/webp",0.82);
    };
    img.src=ou;
  }
  function removeThumb() {
    if(previewUrl) URL.revokeObjectURL(previewUrl);
    setForm(f=>({...f,thumbBlob:null})); setPreviewUrl(null);
  }
  function submit() {
    if(!form.prize.trim()){setErr("請填寫獎品名稱");return;}
    if(!form.drawDate){setErr("請選擇開獎日期");return;}
    onSave({...form,prize:form.prize.trim(),winners:form.winners?parseInt(form.winners):null});
    onClose();
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-hd">
          <span>{isEdit?"編輯抽獎紀錄":"新增抽獎紀錄"}</span>
          <button className="modal-x" onClick={onClose}>✕</button>
        </div>
        <div className="modal-bd">
          <label className="lbl">獎品名稱 *</label>
          <input className="inp" placeholder="e.g. AirPods Pro 2" value={form.prize}
            onChange={e=>setForm(f=>({...f,prize:e.target.value}))} autoFocus />
          <label className="lbl">開獎日期 *</label>
          <input className="inp" type="date" value={form.drawDate}
            onChange={e=>setForm(f=>({...f,drawDate:e.target.value}))} />
          <label className="lbl">IG 貼文連結</label>
          <input className="inp" placeholder="https://www.instagram.com/p/..." value={form.link}
            onChange={e=>setForm(f=>({...f,link:e.target.value}))} />
          <label className="lbl">開獎人數（選填）</label>
          <input className="inp" type="number" min="1" placeholder="e.g. 3" value={form.winners}
            onChange={e=>setForm(f=>({...f,winners:e.target.value}))} />
          <label className="lbl">貼文截圖</label>
          <div className={`drop-zone ${dragOver?"drop-over":""} ${previewUrl?"drop-has-img":""}`}
            onClick={()=>fileRef.current.click()}
            onDragOver={e=>{e.preventDefault();setDragOver(true);}}
            onDragLeave={()=>setDragOver(false)}
            onDrop={e=>{e.preventDefault();setDragOver(false);handleFile(e.dataTransfer.files[0]);}}>
            {previewUrl?(
              <div className="drop-preview">
                <img src={previewUrl} alt="preview" className="drop-img"/>
                <button className="drop-remove" onClick={e=>{e.stopPropagation();removeThumb();}}>✕ 移除</button>
              </div>
            ):(
              <div className="drop-hint">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>點擊上傳 或 拖曳截圖</span>
                <span className="drop-sub">自動壓縮為 WebP，節省空間</span>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}}
            onChange={e=>handleFile(e.target.files[0])} />
          {err&&<p className="err">{err}</p>}
        </div>
        <div className="modal-ft">
          <button className="btn-sec" onClick={onClose}>取消</button>
          <button className="btn-pri" onClick={submit}>{isEdit?"儲存變更":"新增並儲存"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── BackupModal ──────────────────────────────────────────────────────────────
function BackupModal({ entries, onImport, onClose }) {
  const [importing, setImporting] = useState(false);
  const [msg, setMsg]             = useState("");
  const [msgType, setMsgType]     = useState("ok");
  const fileRef = useRef();

  async function handleExport() {
    setMsg("備份中…"); setMsgType("ok");
    try {
      const serialized = await Promise.all(entries.map(async e => ({
        ...e,
        thumbBlob: e.thumbBlob ? await blobToBase64(e.thumbBlob) : null,
      })));
      const json = JSON.stringify({ version:1, exportedAt: new Date().toISOString(), entries: serialized }, null, 2);
      const blob = new Blob([json], { type:"application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      const date = new Date().toISOString().slice(0,10);
      a.href = url; a.download = `抽獎追蹤備份_${date}.json`; a.click();
      URL.revokeObjectURL(url);
      setMsg(`✅ 已備份 ${entries.length} 筆資料`);
    } catch(e) {
      setMsg("❌ 備份失敗："+e.message); setMsgType("err");
    }
  }

  async function handleImportFile(file) {
    if (!file) return;
    setImporting(true); setMsg("匯入中…"); setMsgType("ok");
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.entries || !Array.isArray(data.entries)) throw new Error("格式不正確");
      const restored = await Promise.all(data.entries.map(async e => ({
        ...e,
        thumbBlob: e.thumbBlob ? await base64ToBlob(e.thumbBlob) : null,
      })));
      // revoke old caches
      restored.forEach(e=>revokeBlobUrl(e.id));
      await dbClear();
      await Promise.all(restored.map(e=>dbPut(e)));
      onImport(restored);
      setMsg(`✅ 成功匯入 ${restored.length} 筆資料`);
    } catch(e) {
      setMsg("❌ 匯入失敗："+e.message); setMsgType("err");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-hd">
          <span>備份 ／ 匯入</span>
          <button className="modal-x" onClick={onClose}>✕</button>
        </div>
        <div className="bk-body">
          <div className="bk-card">
            <div className="bk-card-top">
              <span className="bk-emoji">📤</span>
              <div>
                <div className="bk-card-title">匯出備份</div>
                <div className="bk-card-desc">將所有資料（含截圖）存成 JSON 檔，可存至手機或雲端硬碟</div>
              </div>
            </div>
            <button className="bk-action-btn bk-export" onClick={handleExport}>立即備份</button>
          </div>
          <div className="bk-card">
            <div className="bk-card-top">
              <span className="bk-emoji">📥</span>
              <div>
                <div className="bk-card-title">匯入備份</div>
                <div className="bk-card-desc">選擇之前匯出的 JSON 檔，資料將覆蓋目前所有紀錄</div>
              </div>
            </div>
            <button className="bk-action-btn bk-import" onClick={()=>fileRef.current.click()} disabled={importing}>
              {importing ? "匯入中…" : "選擇檔案"}
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" style={{display:"none"}}
              onChange={e=>handleImportFile(e.target.files[0])} />
          </div>
          {msg && <div className={`bk-msg ${msgType==="err"?"bk-msg-err":""}`}>{msg}</div>}
        </div>
        <div className="modal-ft">
          <button className="btn-pri" style={{flex:1}} onClick={onClose}>完成</button>
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [entries,   setEntries]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modalMode, setModalMode] = useState(null); // null | "add" | entry
  const [showBackup,setShowBackup]= useState(false);
  const [nextId,    setNextId]    = useState(Date.now());

  useEffect(()=>{
    dbGetAll().then(rows=>{
      if(rows.length===0){
        Promise.all(SEED.map(s=>dbPut(s))).then(()=>setEntries(SEED));
      } else {
        setEntries(rows);
        setNextId(Math.max(...rows.map(r=>r.id))+1);
      }
      setLoading(false);
    });
  },[]);

  const active = useMemo(()=>entries.filter(e=>!e.confirmed&&!isPast(e.drawDate)),[entries]);
  const drawn  = useMemo(()=>entries.filter(e=>!e.confirmed&&isPast(e.drawDate)),[entries]);
  const done   = useMemo(()=>entries.filter(e=>e.confirmed),[entries]);
  const sort   = arr=>[...arr].sort((a,b)=>new Date(a.drawDate)-new Date(b.drawDate));

  const toggle = useCallback(async id=>{
    const updated=entries.map(e=>e.id===id?{...e,confirmed:!e.confirmed}:e);
    await dbPut(updated.find(e=>e.id===id));
    setEntries(updated);
  },[entries]);

  const del = useCallback(async id=>{
    revokeBlobUrl(id); await dbDelete(id);
    setEntries(es=>es.filter(e=>e.id!==id));
  },[]);

  const save = useCallback(async formData=>{
    const isEdit = modalMode && modalMode!=="add";
    if(isEdit){
      const updated={...modalMode,...formData};
      if(formData.thumbBlob!==modalMode.thumbBlob) revokeBlobUrl(modalMode.id);
      await dbPut(updated);
      setEntries(es=>es.map(e=>e.id===updated.id?updated:e));
    } else {
      const entry={...formData,id:nextId,confirmed:false};
      await dbPut(entry);
      setEntries(es=>[...es,entry]);
      setNextId(n=>n+1);
    }
  },[modalMode,nextId]);

  if(loading) return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"#8EA9BC",fontFamily:"sans-serif",fontSize:"13px",letterSpacing:"2px"}}>
      載入中…
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;700&family=Cormorant+Garamond:wght@400;600&family=DM+Sans:wght@400;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        :root{
          --blue1:#7191AA;--blue2:#8EA9BC;--blue3:#AABDCC;
          --sand:#E2D5C8;--greige:#BEAFA3;
          --white:#F7F4F1;--ink:#4a5f6e;--ink2:#7a8f9e;--ink3:#a8bbc8;
          --r:16px;--rs:10px;
        }
        body{background:var(--white);background-image:radial-gradient(ellipse at 0% 0%,#aabdcc30 0%,transparent 55%),radial-gradient(ellipse at 100% 100%,#e2d5c830 0%,transparent 55%);min-height:100vh;font-family:'Noto Sans TC',sans-serif;color:var(--ink);}
        .app{max-width:500px;margin:0 auto;padding:20px 16px 80px;}

        .header{text-align:center;padding:40px 0 24px;}
        .header-eyebrow{font-family:'DM Sans',sans-serif;font-size:10.5px;letter-spacing:5px;text-transform:uppercase;color:var(--blue2);margin-bottom:10px;}
        .header h1{font-family:'Cormorant Garamond',serif;font-size:2.2rem;font-weight:600;font-style:normal;color:var(--blue1);line-height:1.1;}
        .header-line{width:40px;height:1.5px;background:linear-gradient(90deg,transparent,var(--blue3),transparent);margin:12px auto 10px;}
        .header-sub{font-size:12px;color:var(--ink3);letter-spacing:1px;font-weight:300;}

        .stats{display:flex;gap:10px;margin-bottom:20px;}
        .stat{flex:1;border-radius:var(--r);padding:16px 10px;text-align:center;border:1px solid transparent;}
        .stat-a{background:#ddeaf3;border-color:#c8dce8;}
        .stat-b{background:#e8dfd8;border-color:#d8cdc4;}
        .stat-c{background:#eef3f7;border-color:#d8e5ee;}
        .stat-num{font-family:'DM Sans',sans-serif;font-size:1.9rem;font-weight:700;line-height:1;}
        .stat-a .stat-num{color:var(--blue1);}
        .stat-b .stat-num{color:var(--greige);}
        .stat-c .stat-num{color:var(--blue2);}
        .stat-label{font-size:10.5px;color:var(--ink3);margin-top:5px;font-weight:300;letter-spacing:0.5px;}

        .top-btns{display:flex;gap:10px;margin-bottom:22px;}
        .add-btn{flex:1;padding:13px;background:var(--blue1);border:none;border-radius:50px;color:#fff;font-family:'Noto Sans TC',sans-serif;font-size:13.5px;font-weight:500;letter-spacing:2px;cursor:pointer;box-shadow:0 6px 24px rgba(113,145,170,0.3);transition:background 0.2s,transform 0.12s;}
        .add-btn:hover{background:#5d7f98;}
        .add-btn:active{transform:scale(0.98);}
        .backup-btn-top{flex-shrink:0;padding:13px 16px;background:#fff;border:1.5px solid #ccdde8;border-radius:50px;color:var(--blue1);cursor:pointer;font-size:18px;transition:background 0.15s,transform 0.1s;box-shadow:0 2px 10px rgba(113,145,170,0.1);}
        .backup-btn-top:hover{background:#eef4f8;}
        .backup-btn-top:active{transform:scale(0.96);}

        .sec{margin-bottom:12px;border-radius:var(--r);overflow:hidden;}
        .sec-active{background:#eef4f8;border:1px solid #ccdde8;}
        .sec-drawn{background:#f5f0eb;border:1px solid #ddd0c4;}
        .sec-confirmed{background:#f5f7f9;border:1px solid #d5dde4;}
        .sec-hd{width:100%;display:flex;align-items:center;gap:10px;padding:14px 18px;background:transparent;border:none;cursor:pointer;font-family:'Noto Sans TC',sans-serif;font-size:13px;font-weight:700;color:var(--ink);transition:background 0.15s;}
        .sec-hd:hover{background:rgba(255,255,255,0.5);}
        .sec-icon{font-size:16px;}
        .sec-title{flex:1;text-align:left;letter-spacing:0.5px;}
        .sec-pill{font-size:10.5px;font-weight:500;padding:2px 10px;border-radius:20px;background:rgba(255,255,255,0.8);color:var(--ink2);border:1px solid rgba(0,0,0,0.06);}
        .chev{color:var(--ink3);transition:transform 0.22s;}
        .chev-open{transform:rotate(180deg);}
        .sec-body{padding:4px 10px 12px;display:flex;flex-direction:column;gap:6px;}

        /* Card */
        .card{display:flex;align-items:center;gap:11px;padding:10px 12px;background:rgba(255,255,255,0.88);border-radius:var(--rs);border:1px solid rgba(170,189,204,0.3);box-shadow:0 1px 8px rgba(113,145,170,0.07);transition:box-shadow 0.18s,border-color 0.18s,opacity 0.2s;user-select:none;-webkit-user-select:none;}
        .card:hover{box-shadow:0 3px 14px rgba(113,145,170,0.14);border-color:rgba(113,145,170,0.35);}
        .card-done{opacity:0.38;}
        .card-past{border-left:3px solid var(--greige);}

        .thumb-wrap{flex-shrink:0;width:52px;height:52px;border-radius:8px;overflow:hidden;border:1px solid rgba(170,189,204,0.4);background:#eef4f8;}
        .thumb-img{width:100%;height:100%;object-fit:cover;display:block;}
        .thumb-ph{opacity:0.85;}

        .card-body{flex:1;min-width:0;}
        .card-row{display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;}
        .prize{font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:148px;}

        .badge{font-size:10px;font-weight:600;padding:3px 9px;border-radius:20px;white-space:nowrap;letter-spacing:0.3px;}
        .b-today{background:#ddeaf3;color:var(--blue1);border:1px solid #c0d8ea;}
        .b-soon{background:#ddeaf3;color:#5d9ab8;border:1px solid #b8d5e5;}
        .b-up{background:#eef3f7;color:var(--ink2);border:1px solid #ccdde8;}
        .b-past{background:#ede7e1;color:var(--greige);border:1px solid #d8cdc4;}

        .card-meta{display:flex;align-items:center;gap:10px;margin-top:4px;flex-wrap:wrap;}
        .meta{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--ink3);font-weight:300;}
        .meta-link{color:var(--blue2);text-decoration:none;transition:opacity 0.15s;}
        .meta-link:hover{opacity:0.65;}

        .card-controls{display:flex;flex-direction:column;align-items:center;gap:5px;flex-shrink:0;}
        .tog{background:none;border:none;cursor:pointer;padding:2px;}
        .tog-track{display:flex;align-items:center;width:34px;height:19px;border-radius:10px;padding:2px;transition:background 0.22s;background:#d0dde8;}
        .tog-on .tog-track{background:var(--blue1);}
        .tog-knob{width:15px;height:15px;border-radius:50%;background:#fff;transition:transform 0.22s;box-shadow:0 1px 4px rgba(0,0,0,0.15);}
        .tog-on .tog-knob{transform:translateX(15px);}
        .card-actions{display:flex;gap:2px;opacity:0;transition:opacity 0.15s;}
        .card:hover .card-actions{opacity:1;}
        .act-btn{background:none;border:none;cursor:pointer;padding:4px;border-radius:5px;color:var(--ink3);transition:background 0.12s,color 0.12s;}
        .edit-btn:hover{background:#ddeaf3;color:var(--blue1);}
        .del-btn:hover{background:#faeaea;color:#b07070;}

        .empty{text-align:center;padding:20px;color:var(--ink3);font-size:12.5px;font-weight:300;letter-spacing:0.5px;}

        /* Overlay / Modal */
        .overlay{position:fixed;inset:0;background:rgba(113,145,170,0.2);backdrop-filter:blur(10px);z-index:100;display:flex;align-items:center;justify-content:center;padding:16px;animation:fi 0.15s ease;}
        @keyframes fi{from{opacity:0}to{opacity:1}}
        .modal{background:var(--white);border:1px solid #ccdde8;border-radius:22px;width:100%;max-width:390px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 60px rgba(94,125,148,0.18);animation:pu 0.22s cubic-bezier(0.34,1.56,0.64,1);}
        @keyframes pu{from{transform:scale(0.93) translateY(10px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}
        .modal-hd{display:flex;justify-content:space-between;align-items:center;padding:20px 22px 16px;font-family:'Cormorant Garamond',serif;font-size:17px;font-style:normal;font-weight:600;color:var(--blue1);border-bottom:1px solid #dde8f0;background:linear-gradient(135deg,#eef4f8,#f5f0eb);position:sticky;top:0;z-index:1;}
        .modal-x{background:none;border:none;color:var(--ink3);cursor:pointer;font-size:14px;padding:4px 8px;border-radius:8px;transition:background 0.15s;}
        .modal-x:hover{background:#dde8f0;}
        .modal-bd{padding:18px 22px 10px;display:flex;flex-direction:column;gap:4px;}
        .lbl{font-size:10.5px;color:var(--ink2);font-weight:600;margin-top:12px;letter-spacing:1.5px;text-transform:uppercase;}
        .inp{width:100%;background:#f7f4f1;border:1px solid #ccdde8;border-radius:10px;color:var(--ink);font-family:'Noto Sans TC',sans-serif;font-size:13.5px;padding:10px 13px;outline:none;transition:border-color 0.15s,box-shadow 0.15s;}
        .inp:focus{border-color:var(--blue2);box-shadow:0 0 0 3px rgba(142,169,188,0.15);}
        .inp::placeholder{color:var(--ink3);}
        .err{font-size:11.5px;color:#b07070;margin-top:4px;}
        .drop-zone{border:1.5px dashed #b8d0e0;border-radius:12px;background:#f2f7fb;cursor:pointer;transition:border-color 0.18s,background 0.18s;overflow:hidden;margin-top:2px;}
        .drop-zone:hover,.drop-over{border-color:var(--blue2);background:#e8f2f8;}
        .drop-has-img{border-style:solid;border-color:rgba(142,169,188,0.4);background:#fff;}
        .drop-hint{display:flex;flex-direction:column;align-items:center;gap:6px;padding:22px 16px;color:var(--ink3);}
        .drop-hint svg{opacity:0.6;}
        .drop-hint span{font-size:12.5px;font-weight:400;}
        .drop-sub{font-size:10.5px;opacity:0.7;}
        .drop-preview{position:relative;}
        .drop-img{width:100%;max-height:200px;object-fit:cover;display:block;border-radius:10px;}
        .drop-remove{position:absolute;top:8px;right:8px;background:rgba(255,255,255,0.88);border:1px solid #ccdde8;border-radius:20px;padding:3px 10px;font-size:11px;color:var(--ink2);cursor:pointer;font-family:'Noto Sans TC',sans-serif;transition:background 0.15s;}
        .drop-remove:hover{background:#fff;color:#b07070;}
        .modal-ft{display:flex;gap:10px;padding:16px 22px 22px;}
        .btn-sec{flex:1;padding:11px;border-radius:10px;background:#eef4f8;border:1px solid #ccdde8;color:var(--ink2);font-family:'Noto Sans TC',sans-serif;font-size:13px;cursor:pointer;transition:background 0.15s;}
        .btn-sec:hover{background:#dde8f0;}
        .btn-pri{flex:2;padding:11px;border-radius:10px;background:var(--blue1);border:none;color:white;font-family:'Noto Sans TC',sans-serif;font-size:13px;font-weight:600;letter-spacing:1px;cursor:pointer;box-shadow:0 4px 16px rgba(113,145,170,0.3);transition:background 0.2s,transform 0.1s;}
        .btn-pri:hover{background:#5d7f98;}
        .btn-pri:active{transform:scale(0.98);}

        /* Confirm dialog */
        .confirm-box{background:var(--white);border:1px solid #ccdde8;border-radius:20px;padding:28px 24px;width:100%;max-width:320px;text-align:center;box-shadow:0 24px 60px rgba(94,125,148,0.2);animation:pu 0.2s cubic-bezier(0.34,1.56,0.64,1);}
        .confirm-icon{font-size:32px;margin-bottom:10px;}
        .confirm-title{font-size:15px;font-weight:700;color:var(--ink);margin-bottom:6px;}
        .confirm-msg{font-size:12.5px;color:var(--ink2);margin-bottom:20px;line-height:1.6;}
        .confirm-btns{display:flex;gap:10px;}
        .btn-danger{flex:2;padding:11px;border-radius:10px;background:#c97070;border:none;color:white;font-family:'Noto Sans TC',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:background 0.15s;}
        .btn-danger:hover{background:#b05858;}

        /* Action Sheet (mobile long-press) */
        .overlay.sheet-overlay{align-items:flex-end;padding:0;}
        .sheet{background:var(--white);border-radius:22px 22px 0 0;width:100%;max-width:500px;padding:8px 16px 32px;box-shadow:0 -8px 40px rgba(94,125,148,0.18);animation:slideUp 0.25s cubic-bezier(0.34,1.2,0.64,1);}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        .sheet-prize{font-size:13px;font-weight:700;color:var(--ink2);text-align:center;padding:12px 0 14px;border-bottom:1px solid #e8eef4;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .sheet-btn{width:100%;display:flex;align-items:center;gap:12px;padding:15px 16px;background:none;border:none;border-radius:12px;font-family:'Noto Sans TC',sans-serif;font-size:15px;font-weight:500;color:var(--ink);cursor:pointer;transition:background 0.12s;}
        .sheet-btn:hover{background:#eef4f8;}
        .sheet-del{color:#c97070;}
        .sheet-del:hover{background:#faeaea;}
        .sheet-cancel{width:100%;padding:15px;background:#eef4f8;border:none;border-radius:12px;font-family:'Noto Sans TC',sans-serif;font-size:15px;font-weight:600;color:var(--ink2);cursor:pointer;margin-top:8px;transition:background 0.12s;}
        .sheet-cancel:hover{background:#dde8f0;}

        /* Backup modal */
        .backup-block{display:flex;align-items:center;gap:14px;padding:16px 0;}
        /* Backup modal redesign */
        .bk-body{padding:18px 20px 10px;display:flex;flex-direction:column;gap:12px;}
        .bk-card{background:#f7f9fc;border:1px solid #dde8f0;border-radius:14px;padding:18px 16px;display:flex;flex-direction:column;gap:14px;}
        .bk-card-top{display:flex;align-items:flex-start;gap:14px;}
        .bk-emoji{font-size:26px;flex-shrink:0;margin-top:1px;}
        .bk-card-title{font-size:14px;font-weight:700;color:var(--ink);margin-bottom:5px;}
        .bk-card-desc{font-size:12.5px;color:var(--ink2);line-height:1.65;}
        .bk-action-btn{width:100%;padding:12px;border-radius:10px;font-family:"Noto Sans TC",sans-serif;font-size:13.5px;font-weight:600;cursor:pointer;border:none;transition:background 0.15s,transform 0.1s;letter-spacing:0.5px;}
        .bk-action-btn:active{transform:scale(0.98);}
        .bk-export{background:var(--blue1);color:#fff;box-shadow:0 4px 14px rgba(113,145,170,0.28);}
        .bk-export:hover{background:#5d7f98;}
        .bk-import{background:#fff;color:var(--blue1);border:1.5px solid #ccdde8 !important;}
        .bk-import:hover{background:#eef4f8;}
        .bk-import:disabled{opacity:0.55;cursor:not-allowed;}
        .bk-msg{padding:11px 14px;border-radius:10px;font-size:12.5px;background:#e8f4ed;color:#3a6e50;border:1px solid #b8ddc8;line-height:1.5;}
        .bk-msg-err{background:#faeaea;color:#8a3a3a;border-color:#e8c0c0;}

        input[type="date"]::-webkit-calendar-picker-indicator{opacity:0.45;cursor:pointer;}
        input[type="number"]::-webkit-inner-spin-button{opacity:0.4;}
      `}</style>

      <div className="app">
        <div className="header">
          <div className="header-eyebrow">Instagram Giveaway</div>
          <h1>抽獎追蹤</h1>
          <div className="header-line"/>
          <div className="header-sub">資料自動儲存於裝置本機</div>
        </div>

        <div className="stats">
          <div className="stat stat-a"><div className="stat-num">{active.length}</div><div className="stat-label">進行中</div></div>
          <div className="stat stat-b"><div className="stat-num">{drawn.length}</div><div className="stat-label">待確認</div></div>
          <div className="stat stat-c"><div className="stat-num">{entries.length}</div><div className="stat-label">總計</div></div>
        </div>

        <div className="top-btns">
          <button className="add-btn" onClick={()=>setModalMode("add")}>＋ 新增抽獎</button>
          <button className="backup-btn-top" onClick={()=>setShowBackup(true)} title="備份／匯入">☁️</button>
        </div>

        <Section title="進行中" icon="◎" count={active.length} cls="sec-active" defaultOpen={true}>
          {sort(active).length===0?<div className="empty">目前沒有進行中的抽獎</div>
            :sort(active).map(e=><LotteryCard key={e.id} entry={e} onToggleConfirm={toggle} onDelete={del} onEdit={setModalMode}/>)}
        </Section>
        <Section title="已開獎・待確認" icon="◷" count={drawn.length} cls="sec-drawn" defaultOpen={true}>
          {sort(drawn).length===0?<div className="empty">沒有待確認的抽獎</div>
            :sort(drawn).map(e=><LotteryCard key={e.id} entry={e} onToggleConfirm={toggle} onDelete={del} onEdit={setModalMode}/>)}
        </Section>
        <Section title="已確認未中" icon="✓" count={done.length} cls="sec-confirmed" defaultOpen={false}>
          {done.length===0?<div className="empty">還沒有已確認的紀錄</div>
            :sort(done).map(e=><LotteryCard key={e.id} entry={e} onToggleConfirm={toggle} onDelete={del} onEdit={setModalMode}/>)}
        </Section>
      </div>

      {modalMode && (
        <EntryModal initial={modalMode==="add"?null:modalMode} onSave={save} onClose={()=>setModalMode(null)}/>
      )}
      {showBackup && (
        <BackupModal entries={entries} onImport={restored=>{setEntries(restored); setShowBackup(false);}} onClose={()=>setShowBackup(false)}/>
      )}
    </>
  );
}
