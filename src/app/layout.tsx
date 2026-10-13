import type { Metadata } from 'next'
import { IBM_Plex_Sans } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const plex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'] })

export const metadata: Metadata = {
  title: 'Paralegal PRO — Gestão para Escritórios',
  description: 'Paralegal PRO — Sistema completo de gestão para escritórios contábeis e jurídicos',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={plex.className}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { fontSize: '14px' },
          }}
        />
      </body>
    </html>
  )
}
