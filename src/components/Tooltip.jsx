export default function Tooltip({ text }) {
  return (
    <span className="relative inline-flex items-center group ml-1.5 cursor-default">
      <span className="w-3.5 h-3.5 rounded-full bg-stone-200 text-stone-500 text-[9px] font-bold flex items-center justify-center leading-none select-none">
        ?
      </span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 bg-stone-800 text-white text-xs rounded-lg px-3 py-2 leading-relaxed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-normal">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-800" />
      </span>
    </span>
  )
}
