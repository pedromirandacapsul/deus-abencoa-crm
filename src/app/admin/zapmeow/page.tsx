'use client'

import { useState } from 'react'

interface ZapMeowStatus {
  connected: boolean
  phone?: string
  lastSeen?: string
}

interface QRCodeData {
  qrcode: string
}

export default function ZapMeowAdminPage() {
  const [test, setTest] = useState('Hello ZapMeow!')

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">ZapMeow Admin - Teste</h1>
      <p className="text-lg">{test}</p>
      <button
        onClick={() => setTest('Estado funcionando!')}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
      >
        Testar Estado
      </button>
      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h2 className="text-xl font-semibold mb-2">Sistema ZapMeow</h2>
        <p>Esta é uma versão simplificada para testar o funcionamento básico.</p>
        <p>Backend ZapMeow: http://localhost:8900</p>
        <p>Status: ✅ Página carregando com sucesso!</p>
      </div>
    </div>
  )
}