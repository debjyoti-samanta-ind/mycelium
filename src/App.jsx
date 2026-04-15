import { useState } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import SubmitPage from './pages/SubmitPage.jsx'
import ArticleListPage from './pages/ArticleListPage.jsx'
import GraphPage from './pages/GraphPage.jsx'
import DigestsPage from './pages/DigestsPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import AgentsPage from './pages/AgentsPage.jsx'
import graphDataStatic from '../data/graph.json'

export default function App() {
  const location = useLocation()
  const isGraph = location.pathname === '/graph'

  const [graphData, setGraphData] = useState(graphDataStatic)

  function removeFromGraph(slug) {
    setGraphData(prev => ({
      nodes: prev.nodes.filter(n => n.id !== slug),
      edges: prev.edges.filter(e => e.source !== slug && e.target !== slug),
    }))
  }

  const navLink = (to, label) => {
    const active = location.pathname === to
    return (
      <Link
        to={to}
        className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
          active
            ? 'bg-stone-900 text-white font-medium'
            : 'text-stone-500 hover:text-stone-800 hover:bg-stone-100'
        }`}
      >
        {label}
      </Link>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fafaf8' }}>
      <nav className="border-b border-stone-200 px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <span className="text-base font-bold text-stone-900 tracking-tight">Mycelium</span>
          <div className="flex gap-1 text-sm">
            {navLink('/dashboard', 'Dashboard')}
            {navLink('/', 'Add Article')}
            {navLink('/articles', 'Articles')}
            {navLink('/graph', 'Graph')}
            {navLink('/digests', 'Digests')}
            {navLink('/agents', 'Agents')}
          </div>
        </div>
      </nav>

      {/* Graph page is full-width/full-height; other pages use the standard container */}
      {isGraph ? (
        <Routes>
          <Route path="/graph" element={<GraphPage graphData={graphData} />} />
        </Routes>
      ) : (
        <main className="max-w-4xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<SubmitPage />} />
            <Route path="/articles" element={<ArticleListPage onArticleDeleted={removeFromGraph} />} />
            <Route path="/digests" element={<DigestsPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/agents" element={<AgentsPage />} />
          </Routes>
        </main>
      )}
    </div>
  )
}
