import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import GraphSidePanel from '../components/GraphSidePanel.jsx'

// Load all article JSONs at server start
const articleModules = import.meta.glob('../../data/articles/*.json', { eager: true })
const articleMap = Object.fromEntries(
  Object.values(articleModules)
    .filter(m => m.default)
    .map(m => [m.default.slug, m.default])
)

const EDGE_COLOURS = {
  reinforce: '#4a7c59',
  contradict: '#c0392b',
  evolve:     '#6c5ce7',
  adjacent:   '#e17055',
}

const ALL_EDGE_TYPES = ['reinforce', 'contradict', 'evolve', 'adjacent']

const DOMAIN_BUCKETS = [
  { name: 'Tech & AI',       color: '#6366f1', keywords: ['tech', 'software', 'ai', 'digital', 'data', 'machine learning', 'computer'] },
  { name: 'Science & Mind',  color: '#0d9488', keywords: ['science', 'biology', 'physics', 'neuro', 'cognitive', 'psychology', 'complexity', 'evolutionary'] },
  { name: 'Business & Econ', color: '#d97706', keywords: ['business', 'econom', 'financ', 'marketing', 'management', 'organizational', 'organisational', 'geopolit', 'trade'] },
  { name: 'Humanities',      color: '#dc6b3f', keywords: ['philosoph', 'histor', 'sociol', 'political', 'media', 'culture', 'anthropol', 'ethics'] },
]
const DOMAIN_DEFAULT_COLOR = '#78716c'

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function getDomainColor(node) {
  const domain = (articleMap[node.id]?.domain || '').toLowerCase()
  for (const bucket of DOMAIN_BUCKETS) {
    if (bucket.keywords.some(k => domain.includes(k))) return bucket.color
  }
  return DOMAIN_DEFAULT_COLOR
}

function matchesSearch(node, query) {
  if (!query.trim()) return false
  const q = query.toLowerCase()
  const a = articleMap[node.id]
  if (!a) return node.id.toLowerCase().includes(q)
  return (
    a.title?.toLowerCase().includes(q) ||
    a.summary?.toLowerCase().includes(q) ||
    a.central_argument?.toLowerCase().includes(q) ||
    a.domain?.toLowerCase().includes(q) ||
    a.topic_tags?.some(t => t.toLowerCase().includes(q)) ||
    a.key_claims?.some(c => c.toLowerCase().includes(q)) ||
    a.key_entities?.some(e => e.toLowerCase().includes(q))
  )
}

const PRESETS = [
  { label: 'Last 7d',  days: 7 },
  { label: 'Last 30d', days: 30 },
  { label: 'Last 90d', days: 90 },
]

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

function isoOffset(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export default function GraphPage({ graphData }) {
  const [selectedNode, setSelectedNode]   = useState(null)
  const [selectedLink, setSelectedLink]   = useState(null)
  const [hoveredNode,  setHoveredNode]    = useState(null)
  const [searchQuery,  setSearchQuery]    = useState('')
  const [activeFilters, setActiveFilters] = useState(new Set(ALL_EDGE_TYPES))
  const [dateFrom, setDateFrom]           = useState('')
  const [dateTo,   setDateTo]             = useState('')
  const [appliedFrom, setAppliedFrom]     = useState('')
  const [appliedTo,   setAppliedTo]       = useState('')
  const containerRef = useRef(null)
  const [dimensions, setDimensions]       = useState({ width: 800, height: 600 })

  // Measure container and update on resize
  useEffect(() => {
    function measure() {
      if (containerRef.current) {
        setDimensions({
          width:  containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        })
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Adjacency map: nodeId → Set of directly connected nodeIds
  const adjacency = useMemo(() => {
    const map = new Map()
    graphData.edges?.forEach(edge => {
      if (!map.has(edge.source)) map.set(edge.source, new Set())
      if (!map.has(edge.target)) map.set(edge.target, new Set())
      map.get(edge.source).add(edge.target)
      map.get(edge.target).add(edge.source)
    })
    return map
  }, [graphData])

  // Nodes with no connections
  const islandNodes = useMemo(() => {
    const connected = new Set()
    graphData.edges?.forEach(e => { connected.add(e.source); connected.add(e.target) })
    return new Set(graphData.nodes?.map(n => n.id).filter(id => !connected.has(id)))
  }, [graphData])

  // Graph data filtered by active edge type filters and optional date range
  const fgData = useMemo(() => {
    let nodes = (graphData.nodes || []).map(n => ({ id: n.id, article: articleMap[n.id] }))

    if (appliedFrom || appliedTo) {
      nodes = nodes.filter(n => {
        const added = n.article?.date_added
        if (!added) return true  // keep nodes with no date info
        if (appliedFrom && added < appliedFrom) return false
        if (appliedTo   && added > appliedTo)   return false
        return true
      })
    }

    const visibleIds = new Set(nodes.map(n => n.id))
    const links = (graphData.edges || [])
      .filter(e => activeFilters.has(e.type) && visibleIds.has(e.source) && visibleIds.has(e.target))
      .map(e => ({ source: e.source, target: e.target, type: e.type, explanation: e.explanation, claim_a: e.claim_a, claim_b: e.claim_b }))

    return { nodes, links }
  }, [activeFilters, appliedFrom, appliedTo])

  // Node colour based on interaction state
  const getNodeColor = useCallback((node) => {
    const domainColor  = getDomainColor(node)
    const isSearchMode = searchQuery.trim().length > 0
    const isHoverMode  = !!hoveredNode

    if (isSearchMode) {
      return matchesSearch(node, searchQuery) ? domainColor : 'rgba(120,113,108,0.08)'
    }
    if (isHoverMode) {
      const connected = adjacency.get(hoveredNode.id) || new Set()
      const isRelevant = node.id === hoveredNode.id || connected.has(node.id)
      return isRelevant ? domainColor : 'rgba(120,113,108,0.08)'
    }
    return islandNodes.has(node.id) ? hexToRgba(domainColor, 0.4) : domainColor
  }, [searchQuery, hoveredNode, adjacency, islandNodes])

  // Link colour based on interaction state
  const getLinkColor = useCallback((link) => {
    const srcId = typeof link.source === 'object' ? link.source.id : link.source
    const tgtId = typeof link.target === 'object' ? link.target.id : link.target

    if (hoveredNode) {
      const isConnected = srcId === hoveredNode.id || tgtId === hoveredNode.id
      if (!isConnected) return 'rgba(0,0,0,0.05)'
    }
    return EDGE_COLOURS[link.type] || '#B4B2A9'
  }, [hoveredNode])

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node)
    setSelectedLink(null)
  }, [])

  const handleLinkClick = useCallback((link) => {
    setSelectedLink(link)
    setSelectedNode(null)
  }, [])

  const handleNodeHover = useCallback((node) => {
    setHoveredNode(node || null)
    document.body.style.cursor = node ? 'pointer' : 'default'
  }, [])

  function toggleFilter(type) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(type) && next.size > 1) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  const hasNodes = (graphData.nodes || []).length > 0

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 57px)' }}>

      {/* Controls bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-stone-200 bg-white flex-shrink-0">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search nodes…"
          className="w-48 px-3 py-1.5 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-400 bg-white"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs text-stone-400 hover:text-stone-600"
          >
            Clear
          </button>
        )}

        {/* Time filter */}
        <div className="flex items-center gap-1.5 ml-4">
          <span className="text-xs text-stone-400">Date:</span>
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => {
                const from = isoOffset(p.days)
                const to = isoToday()
                setDateFrom(from)
                setDateTo(to)
                setAppliedFrom(from)
                setAppliedTo(to)
              }}
              className="text-xs px-2 py-1 rounded border border-stone-200 text-stone-500 hover:border-stone-400 hover:text-stone-700 transition-colors"
            >
              {p.label}
            </button>
          ))}
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="text-xs px-2 py-1 border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-stone-400"
            title="From date"
          />
          <span className="text-xs text-stone-300">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="text-xs px-2 py-1 border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-stone-400"
            title="To date"
          />
          <button
            onClick={() => { setAppliedFrom(dateFrom); setAppliedTo(dateTo) }}
            className="text-xs px-2.5 py-1 bg-stone-800 text-white rounded hover:bg-stone-700 transition-colors"
          >
            Apply
          </button>
          {(appliedFrom || appliedTo) && (
            <button
              onClick={() => {
                setDateFrom(''); setDateTo('')
                setAppliedFrom(''); setAppliedTo('')
              }}
              className="text-xs text-stone-400 hover:text-stone-600"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-stone-400 mr-1">Filter:</span>
          {ALL_EDGE_TYPES.map(type => (
            <button
              key={type}
              onClick={() => toggleFilter(type)}
              className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${
                activeFilters.has(type)
                  ? 'text-white border-transparent'
                  : 'bg-white text-stone-400 border-stone-200'
              }`}
              style={activeFilters.has(type) ? { backgroundColor: EDGE_COLOURS[type] } : {}}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Graph canvas */}
      <div className="flex flex-1 overflow-hidden">

      {/* Graph canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {!hasNodes ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-stone-500 text-sm">No articles in the graph yet.</p>
              <p className="text-stone-400 text-xs mt-2 leading-relaxed">
                Add articles via the <strong className="text-stone-500">Add Article</strong> tab.
                <br />
                Connections appear automatically after at least 2 articles are ingested.
              </p>
            </div>
          </div>
        ) : (
          <ForceGraph2D
            graphData={fgData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="#fafaf8"
            nodeColor={getNodeColor}
            nodeVal={node => Math.max(4, 4 + ((adjacency.get(node.id) || new Set()).size) * 2)}
            nodeRelSize={4}
            nodeLabel={node => node.article?.title || node.id}
            linkColor={getLinkColor}
            linkWidth={1.5}
            linkDirectionalArrowLength={0}
            onNodeClick={handleNodeClick}
            onLinkClick={handleLinkClick}
            onNodeHover={handleNodeHover}
            cooldownTicks={120}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
          />
        )}

        {/* Domain color legend */}
        {hasNodes && (
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2.5 border border-stone-200 space-y-1.5">
            {[...DOMAIN_BUCKETS, { name: 'Other', color: DOMAIN_DEFAULT_COLOR }].map(b => (
              <div key={b.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                <span className="text-xs text-stone-600">{b.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Side panel — overlays the graph on the right */}
        {(selectedNode || selectedLink) && (
          <GraphSidePanel
            node={selectedNode}
            link={selectedLink}
            articleMap={articleMap}
            edgeColours={EDGE_COLOURS}
            onClose={() => { setSelectedNode(null); setSelectedLink(null) }}
          />
        )}
      </div>

      </div> {/* end flex row */}
    </div>
  )
}
