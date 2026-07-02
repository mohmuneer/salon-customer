'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Clock, Calendar, Package, Layers, ArrowRight } from 'lucide-react'

interface Service  { id:string; name_ar:string; duration_min:number; price:number; gender_target?:string; cover_image_url?:string; category_name?:string; is_featured?:boolean }
interface Product  { id:string; name_ar:string; brand?:string; price:number; stock_qty?:number; image_url?:string; department_name?:string; is_featured?:boolean }
interface Dept     { id:string; name_ar:string; slug:string; image_url?:string; description_ar?:string }
interface Results  { departments:Dept[]; services:Service[]; products:Product[]; query?:string }

const SUGGESTIONS = ['حلاقة', 'شعر', 'بشرة', 'أظافر', 'مكياج', 'تصوير', 'مساج']
const gold = 'var(--gold)'

export default function SearchPage() {
  const router  = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState<Results|null>(null)
  const [loading, setLoading] = useState(false)
  const [recent,  setRecent]  = useState<string[]>([])

  useEffect(() => {
    inputRef.current?.focus()
    try { const r = JSON.parse(localStorage.getItem('search_recent')||'[]'); setRecent(r) } catch {}
  }, [])

  const saveRecent = (q:string) => {
    const r = [q, ...recent.filter(x=>x!==q)].slice(0,6)
    setRecent(r)
    localStorage.setItem('search_recent', JSON.stringify(r))
  }

  const doSearch = useCallback(async (q:string) => {
    if (!q || q.trim().length < 2) { setResults(null); return }
    setLoading(true)
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
      const d = await r.json()
      setResults(d)
    } catch {}
    setLoading(false)
  }, [])

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 400)
    return () => clearTimeout(t)
  }, [query, doSearch])

  const onSelect = (q:string) => { setQuery(q); saveRecent(q) }
  const clearSearch = () => { setQuery(''); setResults(null); inputRef.current?.focus() }

  const total = (results?.services?.length||0) + (results?.products?.length||0) + (results?.departments?.length||0)
  const hasResults = results && total > 0

  return (
    <div style={{ minHeight:'100vh', background:'#F8F7F4', paddingBottom:80 }}>

      {/* ── Search bar ── */}
      <div style={{ background:'#1A1A2E', padding:'52px 16px 16px', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(255,255,255,0.1)', borderRadius:16, padding:'0 14px', border:'1px solid rgba(255,255,255,0.15)' }}>
          <Search size={18} color="rgba(255,255,255,0.5)" style={{ flexShrink:0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e=>setQuery(e.target.value)}
            placeholder="ابحث عن خدمة أو منتج..."
            style={{ flex:1, background:'transparent', border:'none', color:'#fff', fontSize:16, outline:'none', padding:'14px 0', fontFamily:'inherit' }}
          />
          {loading && <div style={{ width:18, height:18, border:'2px solid rgba(255,255,255,0.2)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite', flexShrink:0 }} />}
          {query && !loading && <button onClick={clearSearch} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', cursor:'pointer', padding:4, display:'flex', flexShrink:0 }}><X size={18}/></button>}
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>

      <div style={{ padding:'16px 16px 0' }}>

        {/* ── Empty state / Suggestions ── */}
        {!query && (
          <>
            {/* Recent searches */}
            {recent.length > 0 && (
              <div style={{ marginBottom:24 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                  <p style={{ fontWeight:700, fontSize:15, margin:0, color:'#1A1A2E' }}>عمليات البحث الأخيرة</p>
                  <button onClick={()=>{ setRecent([]); localStorage.removeItem('search_recent') }}
                    style={{ background:'none', border:'none', color:'#9CA3AF', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>مسح الكل</button>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {recent.map((r,i)=>(
                    <button key={i} onClick={()=>onSelect(r)}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', background:'#fff', borderRadius:12, border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'right', width:'100%' }}>
                      <Clock size={16} color="#9CA3AF" style={{ flexShrink:0 }}/>
                      <span style={{ flex:1, fontSize:14, color:'#374151' }}>{r}</span>
                      <ArrowRight size={14} color="#D1D5DB" style={{ transform:'rotate(180deg)' }}/>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            <div>
              <p style={{ fontWeight:700, fontSize:15, margin:'0 0 12px', color:'#1A1A2E' }}>اقتراحات</p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {SUGGESTIONS.map(s=>(
                  <button key={s} onClick={()=>onSelect(s)}
                    style={{ padding:'8px 16px', borderRadius:20, background:'#fff', border:'1px solid #E5E7EB', color:'#374151', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── No results ── */}
        {query.length >= 2 && !loading && results && !hasResults && (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'#9CA3AF' }}>
            <div style={{ fontSize:52, marginBottom:12 }}>🔍</div>
            <p style={{ fontSize:16, fontWeight:600, color:'#374151', marginBottom:6 }}>لا توجد نتائج</p>
            <p style={{ fontSize:14, margin:0 }}>لم نجد شيئاً لـ "<strong>{query}</strong>"</p>
            <p style={{ fontSize:13, marginTop:8 }}>جرب كلمات مختلفة أو تصفح الأقسام</p>
          </div>
        )}

        {/* ── Results ── */}
        {hasResults && (
          <div>
            {/* Summary */}
            <p style={{ color:'#9CA3AF', fontSize:13, margin:'0 0 16px' }}>
              {total} نتيجة لـ "<strong style={{ color:'#374151' }}>{results.query || query}</strong>"
            </p>

            {/* Departments */}
            {(results.departments||[]).length > 0 && (
              <Section title="الأقسام" icon={<Layers size={16} color={gold}/>}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {results.departments.map(d=>(
                    <button key={d.id} onClick={()=>{ saveRecent(query); router.push(`/departments/${d.slug}`) }}
                      style={{ borderRadius:14, overflow:'hidden', height:90, position:'relative', background:'#1A1A2E', border:'none', cursor:'pointer', padding:0 }}>
                      {d.image_url && <img src={d.image_url} alt={d.name_ar} style={{ width:'100%', height:'100%', objectFit:'cover', opacity:.65 }}/>}
                      <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.8),rgba(0,0,0,0.1))' }}/>
                      <div style={{ position:'absolute', bottom:8, right:10, left:10, color:'#fff', fontWeight:700, fontSize:13, textAlign:'right' }}>{d.name_ar}</div>
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {/* Services */}
            {(results.services||[]).length > 0 && (
              <Section title="الخدمات" icon={<Calendar size={16} color={gold}/>}>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {results.services.map(s=>(
                    <button key={s.id} onClick={()=>{ saveRecent(query); router.push(`/book?service=${s.id}`) }}
                      style={{ display:'flex', alignItems:'center', gap:12, padding:14, background:'#fff', borderRadius:14, border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'right', width:'100%', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
                      {/* Image or icon */}
                      <div style={{ width:52, height:52, borderRadius:12, overflow:'hidden', flexShrink:0, background:'#F1EDE4', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {s.cover_image_url
                          ? <img src={s.cover_image_url} alt={s.name_ar} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                          : <span style={{ fontSize:22 }}>✂️</span>}
                      </div>
                      <div style={{ flex:1, textAlign:'right' }}>
                        <div style={{ fontWeight:700, fontSize:14, marginBottom:4 }}>{s.name_ar}</div>
                        <div style={{ display:'flex', gap:10, fontSize:12, color:'#9CA3AF' }}>
                          <span><Clock size={11} style={{ display:'inline', marginLeft:2 }}/>{s.duration_min} د</span>
                          {s.category_name && <span style={{ color:'#6B7280' }}>{s.category_name}</span>}
                        </div>
                      </div>
                      <div style={{ flexShrink:0, textAlign:'left' }}>
                        <div style={{ color:gold, fontWeight:800, fontSize:15 }}>{Number(s.price).toLocaleString()}</div>
                        <div style={{ color:'#9CA3AF', fontSize:11 }}>ر.س</div>
                      </div>
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {/* Products */}
            {(results.products||[]).length > 0 && (
              <Section title="المنتجات" icon={<Package size={16} color={gold}/>}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {results.products.map(p=>{
                    const inStock = p.stock_qty==null||p.stock_qty>0
                    return (
                      <div key={p.id} style={{ background:'#fff', borderRadius:14, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
                        <div style={{ height:120, background:'#F8F7F4', overflow:'hidden', position:'relative' }}>
                          {p.image_url
                            ? <img src={p.image_url} alt={p.name_ar} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                            : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36 }}>🛍️</div>}
                          {!inStock && <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ color:'#fff', fontWeight:700, fontSize:11 }}>نفذ</span></div>}
                        </div>
                        <div style={{ padding:'10px 12px 12px' }}>
                          <div style={{ fontWeight:700, fontSize:13, marginBottom:2 }}>{p.name_ar}</div>
                          {p.brand && <div style={{ fontSize:11, color:'#9CA3AF', marginBottom:4 }}>{p.brand}</div>}
                          {p.department_name && <div style={{ fontSize:11, color:gold, marginBottom:6 }}>{p.department_name}</div>}
                          <div style={{ color:gold, fontWeight:800, fontSize:14 }}>{Number(p.price).toLocaleString()} ر.س</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title:string; icon:React.ReactNode; children:React.ReactNode }) {
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
        {icon}
        <p style={{ fontWeight:700, fontSize:15, margin:0, color:'#1A1A2E' }}>{title}</p>
      </div>
      {children}
    </div>
  )
}
