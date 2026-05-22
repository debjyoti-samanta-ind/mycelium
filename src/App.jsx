import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import SubmitPage from './pages/SubmitPage.jsx'
import ArticleListPage from './pages/ArticleListPage.jsx'
import GraphPage from './pages/GraphPage.jsx'
import DigestsPage from './pages/DigestsPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import AgentsPage from './pages/AgentsPage.jsx'

const EMPTY_GRAPH = { nodes: [], edges: [], evaluated_pairs: [] }
const POLL_INTERVAL = 5 * 60 * 1000

// ── Nav icons (Feather-style inline SVGs) ────────────────────────────────────
const Icon = ({ children }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    {children}
  </svg>
)

const Icons = {
  Dashboard: (
    <Icon>
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
    </Icon>
  ),
  AddArticle: (
    <Icon>
      <circle cx="12" cy="12" r="9"/>
      <line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
    </Icon>
  ),
  Articles: (
    <Icon>
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <circle cx="3.5" cy="6" r="0.5" fill="currentColor"/>
      <circle cx="3.5" cy="12" r="0.5" fill="currentColor"/>
      <circle cx="3.5" cy="18" r="0.5" fill="currentColor"/>
    </Icon>
  ),
  Graph: (
    <Icon>
      <circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/>
      <line x1="8.4" y1="13.4" x2="15.6" y2="17.6"/><line x1="15.6" y1="6.4" x2="8.4" y2="10.6"/>
    </Icon>
  ),
  Digests: (
    <Icon>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </Icon>
  ),
  Agents: (
    <Icon>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </Icon>
  ),
  ChevronLeft: (
    <Icon><polyline points="15 18 9 12 15 6"/></Icon>
  ),
  ChevronRight: (
    <Icon><polyline points="9 18 15 12 9 6"/></Icon>
  ),
}

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard',   icon: Icons.Dashboard  },
  { to: '/',          label: 'Add Article', icon: Icons.AddArticle },
  { to: '/articles',  label: 'Articles',    icon: Icons.Articles   },
  { to: '/graph',     label: 'Graph',       icon: Icons.Graph      },
  { to: '/digests',   label: 'Digests',     icon: Icons.Digests    },
  { to: '/agents',    label: 'Agents',      icon: Icons.Agents     },
]

const SIDEBAR_EXPANDED = 220
const SIDEBAR_COLLAPSED = 56

export default function App() {
  const location  = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [graphData, setGraphData] = useState(EMPTY_GRAPH)
  const graphRef = useRef(EMPTY_GRAPH)
  const isGraph = location.pathname === '/graph'

  useEffect(() => {
    async function loadGraph() {
      try {
        const res = await fetch(`/data/graph.json?t=${Date.now()}`)
        if (!res.ok) return
        const data = await res.json()
        graphRef.current = data
        setGraphData(data)
      } catch {
        // silently ignore — graph stays as last loaded state
      }
    }
    loadGraph()
    const id = setInterval(loadGraph, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [])
  const w = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED

  function removeFromGraph(slug) {
    setGraphData(prev => {
      const next = {
        ...prev,
        nodes: prev.nodes.filter(n => n.id !== slug),
        edges: prev.edges.filter(e => e.source !== slug && e.target !== slug),
      }
      graphRef.current = next
      return next
    })
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#f0e9dc' }}>

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside
        className="flex flex-col h-full shrink-0 border-r transition-[width] duration-200 overflow-hidden"
        style={{ width: w, backgroundColor: '#e2d8ca', borderColor: '#cec4b2' }}
      >
        {/* Wordmark */}
        <div className="flex items-center px-4 h-14 border-b shrink-0" style={{ borderColor: '#cec4b2' }}>
          {collapsed
            ? <span className="serif text-xl font-bold text-stone-900">M</span>
            : <span className="serif text-xl font-bold text-stone-900 tracking-tight whitespace-nowrap">Mycelium</span>
          }
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-hidden">
          {NAV_ITEMS.map(({ to, label, icon }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 rounded-lg text-sm transition-colors ${
                  collapsed ? 'px-3 py-2.5 justify-center' : 'px-3 py-2'
                } ${
                  active
                    ? 'bg-stone-900 text-white font-medium'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-black/[0.07]'
                }`}
              >
                {icon}
                {!collapsed && <span className="whitespace-nowrap">{label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="px-2 pb-3 pt-2 border-t shrink-0" style={{ borderColor: '#cec4b2' }}>
          <button
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`flex items-center gap-3 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-black/[0.07] transition-colors text-sm w-full ${
              collapsed ? 'px-3 py-2.5 justify-center' : 'px-3 py-2'
            }`}
          >
            {collapsed ? Icons.ChevronRight : Icons.ChevronLeft}
            {!collapsed && <span className="whitespace-nowrap">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────── */}
      {isGraph ? (
        <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
          <Routes>
            <Route path="/graph" element={<GraphPage graphData={graphData} />} />
          </Routes>
        </div>
      ) : (
        <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden">
          <main className="px-8 py-8">
            <Routes>
              <Route path="/"          element={<SubmitPage />} />
              <Route path="/articles"  element={<ArticleListPage onArticleDeleted={removeFromGraph} />} />
              <Route path="/digests"   element={<DigestsPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/agents"    element={<AgentsPage />} />
            </Routes>
          </main>
        </div>
      )}

    </div>
  )
}
