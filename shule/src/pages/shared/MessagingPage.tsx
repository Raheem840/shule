/**
 * MessagingPage
 *
 * Mobile  : createPortal → .ar element.
 *           Portalling into .ar means:
 *             • CSS custom variables (--brand, --surface, etc.) resolve normally
 *             • position:fixed is viewport-relative (.ar has no transform/filter)
 *             • z-index:40 sits above mob-topbar(35), below mob-nav(50)
 *           No parent-layout manipulation needed.
 *
 * Desktop : Normal flex split-panel in document flow.
 *
 * Inspiration: WhatsApp contact rows, Telegram gradients, iMessage bubble tails.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useStaffPhotoUrl } from '../../hooks/useStaffPhotoUrl'
import { useBandwidth } from '../../store/BandwidthContext'
import { supabase } from '../../lib/supabase'
import {
  useContacts, useMessages, useSendMessage, useMarkRead,
  useAnnouncements, usePostAnnouncement, useUploadAttachment,
} from '../../hooks/useMessaging'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { ROLE_LABEL } from '../../config/roleNav'
import { useIsMobile } from '../../hooks/useIsMobile'
import type { Contact, Announcement } from '../../types/week9'
import type { Message, UserRole } from '../../types/app'

// ─── Helpers ─────────────────────────────────────────────────────────────────────
const CAN_POST = ['principal','deputy','dos','secretary','bursar','it_admin'] as const

const COLORS: [string,string][] = [
  ['#0d9488','#0f766e'],['#8b5cf6','#7c3aed'],['#0ea5e9','#0284c7'],
  ['#f59e0b','#d97706'],['#f43f5e','#e11d48'],['#10b981','#059669'],
  ['#ec4899','#db2777'],['#6366f1','#4f46e5'],
]
const pal=(s:string)=>COLORS[((s.charCodeAt(0)||65)+(s.charCodeAt(1)||65))%COLORS.length]
const ini=(s:string)=>s.split(' ').filter(Boolean).slice(0,2).map(w=>w[0]?.toUpperCase()??'').join('')
const hhmm=(iso:string)=>new Date(iso).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})
const dayLbl=(iso:string)=>{
  const d=new Date(iso),t=new Date(),y=new Date(t);y.setDate(t.getDate()-1)
  if(d.toDateString()===t.toDateString()) return 'Today'
  if(d.toDateString()===y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
}

const TPLS=[
  {label:'Exam reminder', body:'Dear [Name], [Subject] exam is on [Date] at [Time]. Ensure [Class] is fully prepared.'},
  {label:'Class teacher', body:'Dear [Name], you are assigned class teacher for [Class] from [Date]. Collect the register from the secretary.'},
  {label:'End of term',   body:'Dear [Name], Term [Number] ends on [Date]. Report cards on [Release Date]. Remarks due by [Deadline].'},
] as const

// ─── CSS ─────────────────────────────────────────────────────────────────────────
const CSS=`
.mg-glass{background:rgba(255,255,255,.84);backdrop-filter:blur(32px) saturate(200%);-webkit-backdrop-filter:blur(32px) saturate(200%)}
.ar[data-theme=dark] .mg-glass{background:rgba(7,14,30,.88);border-bottom-color:rgba(255,255,255,.06)!important}
.mg-bar{background:rgba(255,255,255,.93);backdrop-filter:blur(40px) saturate(180%);-webkit-backdrop-filter:blur(40px) saturate(180%)}
.ar[data-theme=dark] .mg-bar{background:rgba(7,14,30,.94)}
.mg-sidebar-desk{background:rgba(255,255,255,.72);backdrop-filter:blur(40px) saturate(180%);-webkit-backdrop-filter:blur(40px) saturate(180%)}
.ar[data-theme=dark] .mg-sidebar-desk{background:rgba(6,12,26,.82)}
.mg-contacts-mob{background:rgba(255,255,255,.9);backdrop-filter:blur(24px) saturate(160%);-webkit-backdrop-filter:blur(24px) saturate(160%)}
.ar[data-theme=dark] .mg-contacts-mob{background:rgba(6,12,26,.9)}
.mg-feed{background-color:var(--bg);background-image:radial-gradient(rgba(13,148,136,.028) 1.5px,transparent 1.5px),radial-gradient(rgba(139,92,246,.018) 1px,transparent 1px);background-size:30px 30px,15px 15px;background-position:0 0,15px 15px}
.ar[data-theme=dark] .mg-feed{background-color:#060c18}
.mg-row{display:flex;align-items:center;gap:13px;padding:10px 16px;min-height:72px;cursor:pointer;-webkit-tap-highlight-color:transparent;border-bottom:.5px solid rgba(0,0,0,.05);transition:background .1s}
.mg-row:hover{background:rgba(13,148,136,.04)}
.mg-row:active{background:rgba(13,148,136,.08)!important}
.ar[data-theme=dark] .mg-row{border-bottom-color:rgba(255,255,255,.04)}
.mg-in-r{animation:mgInR .18s cubic-bezier(.34,1.4,.64,1) both}
.mg-in-l{animation:mgInL .18s cubic-bezier(.34,1.4,.64,1) both}
.mg-ring{position:absolute;inset:0;border-radius:50%;border:2px solid #22c55e;opacity:0;animation:mgRing 2.8s ease-out infinite}
@keyframes mgInR{from{opacity:0;transform:translateX(12px) scale(.93)}to{opacity:1;transform:none}}
@keyframes mgInL{from{opacity:0;transform:translateX(-12px) scale(.93)}to{opacity:1;transform:none}}
@keyframes mgRing{0%{transform:scale(1);opacity:.65}100%{transform:scale(1.9);opacity:0}}
@keyframes mgUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes mgSpin{to{transform:rotate(360deg)}}
@keyframes mgPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.14)}}
@keyframes mgOrbA{0%,100%{transform:translate(0,0)}45%{transform:translate(28px,-22px)}70%{transform:translate(-18px,16px)}}
@keyframes mgOrbB{0%,100%{transform:translate(0,0)}55%{transform:translate(-34px,26px)}}
@keyframes mgAnn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
`

// ─── Orb ─────────────────────────────────────────────────────────────────────────
const Orb=({w,h,t,r,b,l,color,anim}:{w:number;h:number;t?:number;r?:number;b?:number;l?:number;color:string;anim:string})=>(
  <div style={{position:'absolute',width:w,height:h,top:t,right:r,bottom:b,left:l,borderRadius:'50%',pointerEvents:'none',filter:'blur(64px)',background:color,animation:anim}}/>
)

// ─── Avatar ───────────────────────────────────────────────────────────────────────
function Av({name,photo,sz=46,online=false,low=false}:{name:string;photo?:string|null;sz?:number;online?:boolean;low?:boolean}){
  const url=useStaffPhotoUrl(low?null:photo)
  const [c1,c2]=pal(name)
  return(
    <div style={{position:'relative',width:sz,height:sz,flexShrink:0}}>
      <div style={{width:sz,height:sz,borderRadius:'50%',overflow:'hidden',background:url?undefined:`linear-gradient(145deg,${c1},${c2})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:Math.round(sz*.36),fontWeight:900,color:'#fff',fontFamily:'var(--font2)',userSelect:'none',boxShadow:url?'0 2px 10px rgba(0,0,0,.13)':`0 3px 14px ${c1}42`}}>
        {url?<img src={url} alt={name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:ini(name)}
      </div>
      {online&&(
        <div style={{position:'absolute',bottom:1,right:1,width:Math.round(sz*.28),height:Math.round(sz*.28)}}>
          <div style={{position:'relative',width:'100%',height:'100%'}}>
            <div className="mg-ring"/>
            <div style={{width:'100%',height:'100%',borderRadius:'50%',background:'#22c55e',border:`2px solid var(--surface)`}}/>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Date pill ────────────────────────────────────────────────────────────────────
const DPill=({label}:{label:string})=>(
  <div style={{display:'flex',alignItems:'center',gap:10,margin:'14px 4px 10px',userSelect:'none'}}>
    <div style={{flex:1,height:.5,background:'var(--border)',opacity:.6}}/>
    <div style={{padding:'3px 12px',borderRadius:99,background:'rgba(255,255,255,.72)',border:'.5px solid rgba(0,0,0,.08)',backdropFilter:'blur(12px)',WebkitBackdropFilter:'blur(12px)',fontSize:10.5,fontWeight:700,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:.8,boxShadow:'0 1px 6px rgba(0,0,0,.04)'}}>{label}</div>
    <div style={{flex:1,height:.5,background:'var(--border)',opacity:.6}}/>
  </div>
)

// ─── Bubble ───────────────────────────────────────────────────────────────────────
const Bbl=({msg,mine,delay=0}:{msg:Message;mine:boolean;delay?:number})=>{
  const[c1]=pal('me')
  return(
    <div style={{display:'flex',justifyContent:mine?'flex-end':'flex-start',paddingLeft:mine?52:0,paddingRight:mine?0:52,marginBottom:3}}>
      <div className={mine?'mg-in-r':'mg-in-l'} style={{animationDelay:`${delay}s`,maxWidth:'100%',padding:'10px 14px 8px',borderRadius:mine?'20px 4px 20px 20px':'4px 20px 20px 20px',background:mine?`linear-gradient(145deg,${c1},var(--brand-dark))`:'var(--surface)',color:mine?'#fff':'var(--txt)',boxShadow:mine?`0 2px 16px ${c1}28,0 1px 4px rgba(0,0,0,.09)`:'0 1px 8px rgba(0,0,0,.07),0 0 0 .5px rgba(0,0,0,.05)'}}>
        {msg.attachmentUrl&&(
          <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" style={{display:'flex',alignItems:'center',gap:6,marginBottom:6,color:mine?'rgba(255,255,255,.9)':'var(--brand)',fontSize:12,fontWeight:700,textDecoration:'none',padding:'5px 9px',borderRadius:8,background:mine?'rgba(255,255,255,.14)':'rgba(13,148,136,.07)'}}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
            Attachment
          </a>
        )}
        <div style={{fontSize:15,lineHeight:1.5}}>{msg.body}</div>
        <div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:4,marginTop:4}}>
          <span style={{fontSize:10.5,color:mine?'rgba(255,255,255,.55)':'var(--txt3)'}}>{hhmm(msg.sentAt)}</span>
          {mine&&(
            <svg width="16" height="10" viewBox="0 0 20 12" fill="none">
              {msg.readAt?<><path d="M1 6l4 4L13 1" stroke="rgba(255,255,255,.95)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 6l4 4L19 1" stroke="rgba(255,255,255,.95)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>:<path d="M1 6l4 4L14 1" stroke="rgba(255,255,255,.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>}
            </svg>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Back button ─────────────────────────────────────────────────────────────────
const BkBtn=({onBack}:{onBack:()=>void})=>(
  <button onClick={onBack} aria-label="Back" style={{width:36,height:36,borderRadius:11,border:'none',flexShrink:0,background:'rgba(13,148,136,.1)',color:'var(--brand)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',WebkitTapHighlightColor:'transparent',transition:'background .13s'}}
    onMouseEnter={e=>(e.currentTarget.style.background='rgba(13,148,136,.18)')}
    onMouseLeave={e=>(e.currentTarget.style.background='rgba(13,148,136,.1)')}>
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
  </button>
)

// ─── Input bar ────────────────────────────────────────────────────────────────────
function InBar({text,setText,onSend,sending,attach,onClearAttach,onFileClick,isDos,showTpl,onToggleTpl,ph,violet=false}:{
  text:string;setText:(v:string)=>void;onSend:(e:React.FormEvent)=>void;sending:boolean
  attach:string|null;onClearAttach:()=>void;onFileClick:()=>void
  isDos?:boolean;showTpl?:boolean;onToggleTpl?:()=>void;ph:string;violet?:boolean
}){
  const ok=!!(text.trim()||attach)
  const grad=violet?'linear-gradient(145deg,#8b5cf6,#7c3aed)':'linear-gradient(145deg,#0d9488,#0f766e)'
  const glow=violet?'rgba(139,92,246,.42)':'rgba(13,148,136,.4)'
  return(
    <div className="mg-bar" style={{borderTop:'.5px solid rgba(0,0,0,.07)',padding:'8px 12px',flexShrink:0}}>
      {attach&&(
        <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'3px 10px',borderRadius:99,marginBottom:6,background:'rgba(13,148,136,.08)',border:'.5px solid rgba(13,148,136,.2)'}}>
          <span style={{fontSize:11,fontWeight:700,color:'var(--brand)'}}>File attached</span>
          <button type="button" onClick={onClearAttach} style={{border:'none',background:'none',cursor:'pointer',color:'var(--danger)',fontSize:16,fontWeight:900,lineHeight:1,padding:0}}>×</button>
        </div>
      )}
      <form onSubmit={onSend} style={{display:'flex',alignItems:'flex-end',gap:7}}>
        <div style={{display:'flex',gap:5,flexShrink:0}}>
          {isDos&&onToggleTpl&&(
            <button type="button" onClick={onToggleTpl} style={{width:36,height:36,borderRadius:10,border:'none',flexShrink:0,background:showTpl?'rgba(13,148,136,.12)':'var(--surface2)',color:showTpl?'var(--brand)':'var(--txt3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .14s',WebkitTapHighlightColor:'transparent'}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </button>
          )}
          <button type="button" onClick={onFileClick} style={{width:36,height:36,borderRadius:10,border:'none',flexShrink:0,background:'var(--surface2)',color:'var(--txt3)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .14s',WebkitTapHighlightColor:'transparent'}}
            onMouseEnter={e=>{e.currentTarget.style.color='var(--brand)';e.currentTarget.style.background='rgba(13,148,136,.08)'}}
            onMouseLeave={e=>{e.currentTarget.style.color='var(--txt3)';e.currentTarget.style.background='var(--surface2)'}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
          </button>
        </div>
        <textarea value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void onSend(e)}}} placeholder={ph} rows={1} className="sui-input" style={{flex:1,resize:'none',padding:'9px 14px',borderRadius:22,fontSize:15,lineHeight:1.5,maxHeight:120}}/>
        <button type="submit" disabled={sending||!ok} style={{width:38,height:38,borderRadius:19,border:'none',flexShrink:0,background:ok&&!sending?grad:'var(--surface2)',color:ok?'#fff':'var(--txt3)',cursor:ok?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s cubic-bezier(.34,1.56,.64,1)',transform:ok?'scale(1)':'scale(.88)',boxShadow:ok?`0 4px 14px ${glow}`:'none',WebkitTapHighlightColor:'transparent'}}>
          {sending
            ?<div style={{width:13,height:13,borderRadius:'50%',border:'2.5px solid rgba(255,255,255,.3)',borderTopColor:'#fff',animation:'mgSpin .6s linear infinite'}}/>
            :<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none"/></svg>}
        </button>
      </form>
    </div>
  )
}

const TplTxt=({body}:{body:string})=>(
  <span>{body.split(/(\[[^\]]+\])/g).map((p,i)=>/^\[.+\]$/.test(p)?<mark key={i} style={{background:'rgba(245,158,11,.15)',color:'#d97706',borderRadius:3,padding:'0 3px',fontWeight:700}}>{p}</mark>:<span key={i}>{p}</span>)}</span>
)

// ─── Thread ───────────────────────────────────────────────────────────────────────
function Thread({contact,onBack,mob=false}:{contact:Contact;onBack?:()=>void;mob?:boolean}){
  const {user}=useAuth()
  const {isLowBandwidth}=useBandwidth()
  const {data:msgs=[]}=useMessages(contact.id)
  const {mutate:markRead}=useMarkRead()
  const {mutateAsync:send,isPending}=useSendMessage()
  const {mutateAsync:upload}=useUploadAttachment()
  const {error:toastErr}=useToast()
  const [text,setText]=useState('')
  const [attach,setAttach]=useState<string|null>(null)
  const [showTpl,setShowTpl]=useState(false)
  const bottomRef=useRef<HTMLDivElement>(null)
  const fileRef=useRef<HTMLInputElement>(null)
  const isDos=user?.role==='dos'
  const roleLabel=ROLE_LABEL[contact.role as UserRole]??contact.role.replace(/_/g,' ')
  const [c1]=pal(contact.name)
  useEffect(()=>{if(contact.unreadCount>0)markRead(contact.id)},[contact.id])
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'})},[msgs.length])
  const doSend=useCallback(async(e:React.FormEvent)=>{
    e.preventDefault();if(!text.trim()&&!attach)return
    await send({toUserId:contact.id,body:text.trim(),attachmentUrl:attach})
    setText('');setAttach(null)
  },[text,attach,contact.id,send])
  async function doFile(e:React.ChangeEvent<HTMLInputElement>){
    const f=e.target.files?.[0];if(!f)return
    try{setAttach(await upload(f))}catch(err:any){toastErr(err.message??'Upload failed')}
  }
  const groups:{date:string;msgs:Message[]}[]=[]
  for(const m of msgs){
    const d=dayLbl(m.sentAt);const last=groups.at(-1)
    if(!last||last.date!==d)groups.push({date:d,msgs:[m]})
    else last.msgs.push(m)
  }
  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      <div className="mg-glass" style={{borderBottom:'.5px solid rgba(0,0,0,.07)',flexShrink:0}}>
        <div style={{height:56,display:'flex',alignItems:'center',gap:10,padding:'0 14px'}}>
          {onBack&&<BkBtn onBack={onBack}/>}
          {mob?(
            <>
              <div style={{flex:1,textAlign:'center',lineHeight:1.25}}>
                <div style={{fontWeight:700,fontSize:15.5,color:'var(--txt)',letterSpacing:-.3}}>{contact.name}</div>
                <div style={{fontSize:11,color:'var(--txt3)',textTransform:'capitalize',marginTop:1}}>{roleLabel}</div>
              </div>
              <Av name={contact.name} photo={contact.photoUrl} sz={34} low={isLowBandwidth}/>
            </>
          ):(
            <>
              <Av name={contact.name} photo={contact.photoUrl} sz={38} low={isLowBandwidth}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:800,fontSize:15,color:'var(--txt)',letterSpacing:-.3,fontFamily:'var(--font2)'}}>{contact.name}</div>
                <div style={{fontSize:11,color:'var(--txt3)',textTransform:'capitalize'}}>{roleLabel}</div>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="mg-feed" style={{flex:1,overflowY:'auto',padding:'8px 14px',minHeight:0} as React.CSSProperties}>
        {msgs.length===0?(
          <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,userSelect:'none'}}>
            <div style={{width:78,height:78,borderRadius:26,overflow:'hidden',background:`linear-gradient(145deg,${c1}1a,${c1}0a)`,border:`1.5px solid ${c1}22`,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 8px 32px ${c1}12`}}>
              <Av name={contact.name} sz={52} low={isLowBandwidth}/>
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:16,fontWeight:800,color:'var(--txt)',fontFamily:'var(--font2)',letterSpacing:-.3,marginBottom:4}}>{contact.name}</div>
              <div style={{fontSize:13,color:'var(--txt3)'}}>No messages yet — say hello</div>
            </div>
          </div>
        ):groups.map(({date,msgs:gm})=>(
          <div key={date}>
            <DPill label={date}/>
            {gm.map((m,i)=><Bbl key={m.id} msg={m} mine={m.fromUserId===user?.id} delay={Math.min(i*.025,.2)}/>)}
          </div>
        ))}
        <div ref={bottomRef} style={{height:8}}/>
      </div>
      {isDos&&showTpl&&(
        <div style={{borderTop:'.5px solid var(--border)',background:'var(--surface)',maxHeight:185,overflowY:'auto',animation:'mgUp .16s ease both'}}>
          <div style={{padding:'6px 14px 3px',fontSize:9,fontWeight:800,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:1}}>Templates</div>
          {TPLS.map((t,i)=>(
            <button key={i} type="button" onClick={()=>{setText(t.body);setShowTpl(false)}} style={{display:'block',width:'100%',textAlign:'left',padding:'9px 14px',border:'none',background:'none',cursor:'pointer',borderBottom:i<TPLS.length-1?'.5px solid var(--border)':'none',transition:'background .1s',WebkitTapHighlightColor:'transparent'}}
              onMouseEnter={e=>(e.currentTarget.style.background='var(--surface2)')}
              onMouseLeave={e=>(e.currentTarget.style.background='none')}>
              <div style={{fontWeight:700,fontSize:12,color:'var(--txt)',marginBottom:2}}>{t.label}</div>
              <div style={{fontSize:11,color:'var(--txt3)'}}><TplTxt body={t.body}/></div>
            </button>
          ))}
        </div>
      )}
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls" style={{display:'none'}} onChange={e=>{void doFile(e)}}/>
      <InBar text={text} setText={setText} onSend={e=>{void doSend(e)}} sending={isPending} attach={attach} onClearAttach={()=>setAttach(null)} onFileClick={()=>fileRef.current?.click()} isDos={isDos} showTpl={showTpl} onToggleTpl={()=>setShowTpl(v=>!v)} ph="Message…"/>
    </div>
  )
}

// ─── Announcements ────────────────────────────────────────────────────────────────
function AnnsPanel({onBack,mob=false}:{onBack?:()=>void;mob?:boolean}){
  const {user}=useAuth()
  const {data:anns=[]}=useAnnouncements()
  const {mutateAsync:post,isPending}=usePostAnnouncement()
  const {error:toastErr}=useToast()
  const [text,setText]=useState('')
  const bottomRef=useRef<HTMLDivElement>(null)
  const fileRef=useRef<HTMLInputElement>(null)
  const canPost=user&&(CAN_POST as readonly string[]).includes(user.role)
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'})},[anns.length])
  async function doPost(e:React.FormEvent){
    e.preventDefault();if(!text.trim())return
    try{await post({body:text.trim()});setText('');void supabase.functions.invoke('broadcast-announcement',{body:{body:text.trim(),role:user?.role}})}
    catch(err:any){toastErr(err.message)}
  }
  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      <div className="mg-glass" style={{borderBottom:'.5px solid rgba(0,0,0,.07)',flexShrink:0}}>
        <div style={{height:56,display:'flex',alignItems:'center',gap:10,padding:'0 14px'}}>
          {onBack&&<BkBtn onBack={onBack}/>}
          <div style={{width:mob?34:38,height:mob?34:38,borderRadius:'50%',flexShrink:0,background:'linear-gradient(145deg,#8b5cf6,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 3px 14px rgba(139,92,246,.44)'}}>
            <svg width={mob?15:18} height={mob?15:18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
          </div>
          {mob?(
            <div style={{flex:1,textAlign:'center',lineHeight:1.25}}>
              <div style={{fontWeight:700,fontSize:15.5,color:'var(--txt)',letterSpacing:-.3}}>Announcements</div>
              <div style={{fontSize:11,color:'#8b5cf6',marginTop:1}}>All staff</div>
            </div>
          ):(
            <div style={{flex:1}}>
              <div style={{fontWeight:800,fontSize:15,color:'var(--txt)',fontFamily:'var(--font2)',letterSpacing:-.2}}>Announcements</div>
              <div style={{fontSize:11,color:'#8b5cf6'}}>Broadcast to all staff</div>
            </div>
          )}
          <div style={{padding:'3px 9px',borderRadius:99,fontSize:10,fontWeight:800,background:'rgba(139,92,246,.1)',color:'#8b5cf6',border:'.5px solid rgba(139,92,246,.22)'}}>{anns.length}</div>
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'12px 14px',minHeight:0,background:'var(--bg)',backgroundImage:'radial-gradient(rgba(139,92,246,.03) 1.5px,transparent 1.5px)',backgroundSize:'28px 28px'} as React.CSSProperties}>
        {anns.length===0&&(
          <div style={{height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14}}>
            <div style={{width:66,height:66,borderRadius:22,background:'rgba(139,92,246,.1)',border:'1px solid rgba(139,92,246,.18)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 8px 28px rgba(139,92,246,.1)'}}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            </div>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:15,fontWeight:800,color:'var(--txt2)',fontFamily:'var(--font2)',marginBottom:4}}>No announcements</div>
              <div style={{fontSize:12.5,color:'var(--txt3)'}}>{canPost?'Post the first broadcast to all staff':'Leadership broadcasts appear here'}</div>
            </div>
          </div>
        )}
        {[...anns].reverse().map((a,i)=>{
          const[c1]=pal(a.fromName)
          const time=new Date(a.postedAt).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
          return(
            <div key={a.id} className="mg-ann" style={{display:'flex',gap:11,marginBottom:14,animationDelay:`${Math.min(i*.04,.3)}s`}}>
              <div style={{width:36,height:36,borderRadius:'50%',flexShrink:0,background:`linear-gradient(145deg,${c1},#7c3aed)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,color:'#fff',boxShadow:`0 3px 12px ${c1}36`}}>{ini(a.fromName)}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:5}}>
                  <span style={{fontSize:13,fontWeight:800,color:'var(--txt)'}}>{a.fromName}</span>
                  <span style={{fontSize:10.5,color:'var(--txt3)'}}>{time}</span>
                </div>
                <div style={{padding:'11px 14px',borderRadius:'4px 16px 16px 16px',background:'rgba(139,92,246,.07)',border:'.5px solid rgba(139,92,246,.18)',boxShadow:'0 2px 12px rgba(139,92,246,.06)'}}>
                  <div style={{fontSize:14.5,color:'var(--txt)',lineHeight:1.6}}>{a.body}</div>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef}/>
      </div>
      {canPost&&(
        <>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:'none'}}/>
          <InBar text={text} setText={setText} onSend={e=>{void doPost(e)}} sending={isPending} attach={null} onClearAttach={()=>{}} onFileClick={()=>fileRef.current?.click()} ph="Broadcast to all staff…" violet/>
        </>
      )}
    </div>
  )
}

// ─── Contact list ─────────────────────────────────────────────────────────────────
function ContactList({contacts,loading,totalUnread,search,onSearch,active,onSelect}:{
  contacts:Contact[];loading:boolean;totalUnread:number;search:string;onSearch:(v:string)=>void
  active:Contact|'announcements'|null;onSelect:(v:Contact|'announcements')=>void
}){
  return(
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      <div className="mg-glass" style={{borderBottom:'.5px solid rgba(0,0,0,.07)',padding:'12px 16px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',marginBottom:10}}>
          <span style={{flex:1,fontFamily:'var(--font2)',fontWeight:900,fontSize:22,color:'var(--txt)',letterSpacing:-.6}}>Messages</span>
          {totalUnread>0&&<div style={{background:'linear-gradient(145deg,var(--brand),var(--brand-dark))',color:'#fff',borderRadius:99,fontSize:11,fontWeight:800,padding:'2px 9px',boxShadow:'0 2px 8px rgba(13,148,136,.4)',animation:'mgPulse 2.6s ease infinite'}}>{totalUnread}</div>}
        </div>
        <div style={{position:'relative'}}>
          <svg style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',opacity:.4}} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--txt)" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e=>onSearch(e.target.value)} placeholder="Search contacts…" className="sui-input" style={{paddingLeft:32,width:'100%',fontSize:14,height:37,borderRadius:13,background:'rgba(0,0,0,.05)',border:'.5px solid rgba(0,0,0,.07)'}}/>
        </div>
      </div>
      {/* Announcements pin */}
      <div onClick={()=>onSelect('announcements')} className={`mg-row${active==='announcements'?' active':''}`} style={{borderLeft:`3px solid ${active==='announcements'?'#8b5cf6':'transparent'}`,background:active==='announcements'?'rgba(139,92,246,.06)':undefined}}>
        <div style={{width:50,height:50,borderRadius:'50%',flexShrink:0,background:active==='announcements'?'linear-gradient(145deg,#8b5cf6,#7c3aed)':'rgba(139,92,246,.1)',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .2s',boxShadow:active==='announcements'?'0 3px 16px rgba(139,92,246,.44)':'none'}}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={active==='announcements'?'#fff':'#8b5cf6'} strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:15,color:active==='announcements'?'#8b5cf6':'var(--txt)',transition:'color .12s'}}>Announcements</div>
          <div style={{fontSize:12,color:'var(--txt3)',marginTop:2}}>Broadcast to all staff</div>
        </div>
      </div>
      <div style={{padding:'7px 16px 2px',fontSize:10,fontWeight:700,color:'var(--txt3)',textTransform:'uppercase',letterSpacing:1.1,flexShrink:0}}>Direct</div>
      <div style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch'} as React.CSSProperties}>
        {loading&&Array.from({length:5}).map((_,i)=>(
          <div key={i} style={{display:'flex',gap:13,alignItems:'center',padding:'11px 16px',minHeight:72}}>
            <div className="shule-skeleton" style={{width:50,height:50,borderRadius:'50%',flexShrink:0}}/>
            <div style={{flex:1}}><div className="shule-skeleton" style={{height:13,borderRadius:6,marginBottom:6,width:'55%'}}/><div className="shule-skeleton" style={{height:10,borderRadius:5,width:'36%'}}/></div>
          </div>
        ))}
        {!loading&&contacts.length===0&&<div style={{padding:'28px 16px',textAlign:'center',color:'var(--txt3)',fontSize:13}}>{search?'No contacts match.':'No staff to message.'}</div>}
        {contacts.map(c=>{
          const isAct=active!=='announcements'&&(active as Contact)?.id===c.id
          const[col]=pal(c.name)
          const role=ROLE_LABEL[c.role as UserRole]??c.role.replace(/_/g,' ')
          return(
            <div key={c.id} onClick={()=>onSelect(c)} className={`mg-row${isAct?' active':''}`} style={{borderLeft:`3px solid ${isAct?col:'transparent'}`,background:isAct?`${col}0d`:undefined}}>
              <Av name={c.name} photo={c.photoUrl} sz={50} low={false}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,fontSize:15,letterSpacing:-.1,color:isAct?col:'var(--txt)',transition:'color .12s',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.name}</div>
                <div style={{fontSize:12,color:'var(--txt3)',marginTop:2,textTransform:'capitalize'}}>{role}</div>
              </div>
              {c.unreadCount>0&&<div style={{background:`linear-gradient(145deg,${col},${col}bb)`,color:'#fff',borderRadius:99,fontSize:11,fontWeight:800,minWidth:22,height:22,padding:'0 6px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:`0 2px 8px ${col}48`,animation:'mgPulse 2.6s ease infinite'}}>{c.unreadCount>9?'9+':c.unreadCount}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════════
export function MessagingPage(){
  const {data:contacts=[],isLoading}=useContacts()
  const [active,setActive]=useState<Contact|'announcements'|null>(null)
  const [search,setSearch]=useState('')
  const isMobile=useIsMobile()

  // Desktop: cancel .page padding so the container fills shell-main edge-to-edge.
  // Without this, shell-main's --bg shows as a gray strip below the container.
  useEffect(()=>{
    if(isMobile) return
    const page=document.querySelector('.shell-main > .page') as HTMLElement|null
    if(!page) return
    page.style.cssText='padding:0!important;height:100%;display:flex;flex-direction:column;'
    return ()=>{ page.style.cssText='' }
  },[isMobile])

  const filtered=search.trim()
    ?contacts.filter(c=>c.name.toLowerCase().includes(search.toLowerCase())||c.role.includes(search.toLowerCase()))
    :contacts
  const totalUnread=contacts.reduce((s,c)=>s+c.unreadCount,0)

  // Portal target: .ar element — inherits all CSS custom properties, has no
  // transform, so position:fixed children are viewport-relative. Computed once.
  const arEl=useMemo(()=>document.querySelector('.ar') as HTMLElement??document.body,[])

  // ── MOBILE ─────────────────────────────────────────────────────────────────────
  if(isMobile){
    const panel=(
      <>
        <style>{CSS}</style>
        {/*
          Positioned exactly between mob-topbar bottom and mob-nav top.
          mob-topbar: height = calc(56px + safe-area-inset-top), position:sticky z:35
          mob-nav:    height = calc(64px + safe-area-inset-bottom), position:fixed z:50
          This panel: position:fixed z:36 — above topbar content, below nav
        */}
        <div style={{
          position:'fixed',
          top:'calc(56px + env(safe-area-inset-top,0px))',
          left:0, right:0,
          bottom:'calc(64px + env(safe-area-inset-bottom,0px))',
          zIndex:36,
          overflow:'hidden',
          /* Solid surface — no gap/stripe should show between slide panels */
          background:'var(--surface)',
        }}>
          {/* Ambient orbs visible behind semi-transparent panels */}
          <Orb w={280} h={280} t={-60} r={-60} color="radial-gradient(circle,rgba(13,148,136,.22) 0%,transparent 70%)" anim="mgOrbA 14s ease-in-out infinite"/>
          <Orb w={240} h={240} b={-50} l={-50} color="radial-gradient(circle,rgba(139,92,246,.18) 0%,transparent 70%)" anim="mgOrbB 16s ease-in-out infinite"/>

          {/* Contacts panel — always rendered at translateX(0); chat overlays it */}
          <div className="mg-contacts-mob" style={{
            position:'absolute', inset:0,
            /* No transform/transition — it stays still, chat slides over it */
          }}>
            <ContactList contacts={filtered} loading={isLoading} totalUnread={totalUnread} search={search} onSearch={setSearch} active={active} onSelect={setActive}/>
          </div>

          {/* Chat panel — slides in from RIGHT over the contact list (WhatsApp pattern) */}
          <div style={{
            position:'absolute', inset:0,
            background:'var(--bg)',
            transform:active!==null?'translateX(0)':'translateX(100%)',
            /* 0.24s feels instant, not sluggish; spring easing for iOS feel */
            transition:active!==null
              ?'transform .24s cubic-bezier(.32,.72,0,1)'
              :'transform .22s cubic-bezier(.4,0,.6,1)',
            willChange:'transform',
            /* Left-edge shadow gives depth: chat is "above" contact list */
            boxShadow:active!==null?'-6px 0 24px rgba(0,0,0,.16)':'none',
          }}>
            {active==='announcements'
              ?<AnnsPanel onBack={()=>setActive(null)} mob/>
              :active!==null
                ?<Thread contact={active as Contact} onBack={()=>setActive(null)} mob/>
                :null}
          </div>
        </div>
      </>
    )
    return createPortal(panel, arEl)
  }

  // ── DESKTOP ────────────────────────────────────────────────────────────────────
  return(
    <>
      <style>{CSS}</style>
      {/*
        height uses 100dvh so mobile-browser chrome (URL bar) is excluded.
        On desktop dvh === vh; on Android Chrome it handles the retractable bar.
        Subtract: topbar(56px) + page-padding-top(1.4rem) + page-padding-bottom(1.4rem).
      */}
      <div style={{
        display:'flex',
        // useEffect above removes .page padding and sets it to flex-column,
        // so this container just needs flex:1 to fill the remaining height.
        flex:1,
        minHeight:400,
        borderRadius:18, overflow:'hidden',
        border:'.5px solid var(--border)',
        boxShadow:'0 8px 48px rgba(0,0,0,.09),0 2px 12px rgba(0,0,0,.05)',
        position:'relative',
        background:'var(--bg)',
        backgroundImage:'radial-gradient(rgba(13,148,136,.025) 1.5px,transparent 1.5px)',
        backgroundSize:'28px 28px',
      }}>
        <Orb w={400} h={400} t={-100} r={-80} color="radial-gradient(circle,rgba(13,148,136,.16) 0%,transparent 70%)" anim="mgOrbA 14s ease-in-out infinite"/>
        <Orb w={360} h={360} b={-80} l={-60} color="radial-gradient(circle,rgba(139,92,246,.13) 0%,transparent 70%)" anim="mgOrbB 16s ease-in-out infinite"/>

        {/* Sidebar — glass so orbs bleed through */}
        <div className="mg-sidebar-desk" style={{
          width:320, flexShrink:0, display:'flex', flexDirection:'column',
          borderRight:'.5px solid rgba(0,0,0,.07)',
          boxShadow:'2px 0 24px rgba(0,0,0,.04)',
          position:'relative', zIndex:1,
        }}>
          <ContactList contacts={filtered} loading={isLoading} totalUnread={totalUnread} search={search} onSearch={setSearch} active={active} onSelect={setActive}/>
        </div>

        {/* Chat area */}
        <div style={{flex:1,display:'flex',flexDirection:'column',minWidth:0,position:'relative',zIndex:1,overflow:'hidden'}}>
          {active===null?(
            <div className="mg-feed" style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:24}}>
              {/* Decorative rings */}
              <div style={{position:'relative',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <div style={{position:'absolute',width:120,height:120,borderRadius:'50%',border:'1px solid rgba(13,148,136,.1)',animation:'mgOrbA 6s ease-in-out infinite'}}/>
                <div style={{position:'absolute',width:96,height:96,borderRadius:'50%',border:'1px solid rgba(13,148,136,.15)',animation:'mgOrbA 8s ease-in-out infinite reverse'}}/>
                <div style={{width:80,height:80,borderRadius:26,background:'linear-gradient(145deg,rgba(13,148,136,.12),rgba(139,92,246,.08))',border:'1px solid rgba(13,148,136,.16)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 12px 48px rgba(13,148,136,.12)',backdropFilter:'blur(16px)'}}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.3"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                </div>
                <div style={{position:'absolute',top:-4,right:-4,width:24,height:24,borderRadius:'50%',background:'linear-gradient(145deg,#8b5cf6,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 12px rgba(139,92,246,.55)'}}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </div>
              </div>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:20,fontWeight:900,color:'var(--txt)',fontFamily:'var(--font2)',letterSpacing:-.5,marginBottom:8}}>Select a conversation</div>
                <div style={{fontSize:13.5,color:'var(--txt3)',lineHeight:1.75}}>Choose a contact to send a direct message<br/>or open Announcements to broadcast to all staff</div>
              </div>
              {contacts.length>0&&(
                <div style={{display:'flex',gap:10,marginTop:4}}>
                  {contacts.slice(0,5).map(c=>{
                    const[cc,cc2]=pal(c.name)
                    return(
                      <button key={c.id} onClick={()=>setActive(c)} title={c.name} style={{width:46,height:46,borderRadius:'50%',border:'none',cursor:'pointer',background:`linear-gradient(145deg,${cc},${cc2})`,color:'#fff',fontSize:13,fontWeight:900,fontFamily:'var(--font2)',boxShadow:`0 4px 14px ${cc}44`,transition:'transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .18s',WebkitTapHighlightColor:'transparent'}}
                        onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.16) translateY(-2px)';e.currentTarget.style.boxShadow=`0 8px 24px ${cc}55`}}
                        onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.boxShadow=`0 4px 14px ${cc}44`}}>
                        {ini(c.name)}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ):active==='announcements'?<AnnsPanel/>:<Thread contact={active as Contact}/>}
        </div>
      </div>
    </>
  )
}
