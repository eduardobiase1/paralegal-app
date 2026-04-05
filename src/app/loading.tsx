import Image from 'next/image'

export default function Loading() {
  return (
    <div className="fixed inset-0 bg-[#0a0a0a] flex flex-col items-center justify-center z-50"
      style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(180,140,60,0.08) 0%, transparent 60%)' }}>

      {/* Logo */}
      <div className="relative w-52 h-52 mb-6 animate-pulse">
        <Image
          src="/logo.png"
          alt="Paralegal PRO"
          fill
          className="object-contain"
          priority
        />
      </div>

      {/* Spinner dourado */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-amber-700 border-t-amber-400 animate-spin" />
        <p className="text-gray-600 text-xs tracking-widest uppercase">Carregando...</p>
      </div>
    </div>
  )
}
