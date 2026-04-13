import { Routes, Route, Link, useLocation } from 'react-router-dom'
import SubmitPage from './pages/SubmitPage.jsx'
import ArticleListPage from './pages/ArticleListPage.jsx'

export default function App() {
  const location = useLocation()

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fafaf8' }}>
      <nav className="border-b border-stone-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <span className="text-lg font-semibold text-stone-800">Mycelium</span>
          <div className="flex gap-6 text-sm">
            <Link
              to="/"
              className={location.pathname === '/' ? 'text-stone-900 font-medium' : 'text-stone-500 hover:text-stone-800'}
            >
              Add Article
            </Link>
            <Link
              to="/articles"
              className={location.pathname === '/articles' ? 'text-stone-900 font-medium' : 'text-stone-500 hover:text-stone-800'}
            >
              Articles
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <Routes>
          <Route path="/" element={<SubmitPage />} />
          <Route path="/articles" element={<ArticleListPage />} />
        </Routes>
      </main>
    </div>
  )
}
