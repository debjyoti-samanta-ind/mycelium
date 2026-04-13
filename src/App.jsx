import { Routes, Route, Link, useLocation } from 'react-router-dom'
import SubmitPage from './pages/SubmitPage.jsx'
import ArticleListPage from './pages/ArticleListPage.jsx'
import GraphPage from './pages/GraphPage.jsx'
import OpinionsPage from './pages/OpinionsPage.jsx'

export default function App() {
  const location = useLocation()
  const isGraph = location.pathname === '/graph'

  const navLink = (to, label) => (
    <Link
      to={to}
      className={location.pathname === to ? 'text-stone-900 font-medium' : 'text-stone-500 hover:text-stone-800'}
    >
      {label}
    </Link>
  )

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fafaf8' }}>
      <nav className="border-b border-stone-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <span className="text-lg font-semibold text-stone-800">Mycelium</span>
          <div className="flex gap-6 text-sm">
            {navLink('/', 'Add Article')}
            {navLink('/articles', 'Articles')}
            {navLink('/graph', 'Graph')}
            {navLink('/opinions', 'Opinions')}
          </div>
        </div>
      </nav>

      {/* Graph page is full-width/full-height; other pages use the standard container */}
      {isGraph ? (
        <Routes>
          <Route path="/graph" element={<GraphPage />} />
        </Routes>
      ) : (
        <main className="max-w-4xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<SubmitPage />} />
            <Route path="/articles" element={<ArticleListPage />} />
            <Route path="/opinions" element={<OpinionsPage />} />
          </Routes>
        </main>
      )}
    </div>
  )
}
