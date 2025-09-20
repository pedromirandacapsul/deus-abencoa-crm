'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { AdminLayout } from '@/components/layout/admin-layout'
import { Loader2 } from 'lucide-react'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()

  // TEMPORÁRIO: Bypass total de autenticação para testes
  const skipAuth = true

  useEffect(() => {
    if (status === 'unauthenticated' && !skipAuth) {
      router.push('/auth/signin')
    }
  }, [status, router, skipAuth])

  if (status === 'loading' && !skipAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated' && !skipAuth) {
    return null
  }

  return <AdminLayout>{children}</AdminLayout>
}