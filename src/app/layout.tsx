import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Analytics } from '@/components/analytics'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as HotToaster } from 'react-hot-toast'
import { Providers } from '@/components/providers/session-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Capsul Brasil - Soluções Empresariais',
  description: 'Transforme seu negócio com nossas soluções empresariais inovadoras',
  keywords: 'consultoria, soluções empresariais, transformação digital, gestão',
  authors: [{ name: 'Capsul Brasil' }],
  robots: 'index, follow',
  openGraph: {
    title: 'Capsul Brasil - Soluções Empresariais',
    description: 'Transforme seu negócio com nossas soluções empresariais inovadoras',
    type: 'website',
    locale: 'pt_BR'
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <Providers>
          {children}
          <Analytics />
          <Toaster />
          <HotToaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                style: {
                  background: 'green',
                },
              },
              error: {
                style: {
                  background: 'red',
                },
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}