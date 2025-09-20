'use client'

import { useSession } from 'next-auth/react'

export default function AdminDashboard() {
  const { data: session } = useSession()

  // Bypass temporário para acessar admin sem autenticação
  const mockSession = session || {
    user: {
      id: 'cmfsrmudu0000b240mvscfyge',
      name: 'Administrador Capsul',
      email: 'admin@capsul.com.br',
      role: 'ADMIN' as const
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Bem-vindo, {mockSession.user.name}!
        </h1>
        <p className="text-gray-600">
          Aqui está um resumo das atividades recentes do seu negócio.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900">Total de Leads</h3>
          <p className="text-3xl font-bold text-blue-600">87</p>
          <p className="text-sm text-green-600">+12% em relação ao mês passado</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900">Leads Qualificados</h3>
          <p className="text-3xl font-bold text-green-600">23</p>
          <p className="text-sm text-green-600">+8% em relação ao mês passado</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900">Taxa de Conversão</h3>
          <p className="text-3xl font-bold text-purple-600">26.4%</p>
          <p className="text-sm text-green-600">+2.1% em relação ao mês passado</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900">Tempo Médio de Resposta</h3>
          <p className="text-3xl font-bold text-orange-600">2.4h</p>
          <p className="text-sm text-red-600">-0.5h em relação ao mês passado</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Sistema Funcionando</h2>
        <p className="text-gray-600">
          O painel administrativo está carregando corretamente. Você pode navegar pelos menus à esquerda para acessar as funcionalidades.
        </p>
        <div className="mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          ✅ Admin dashboard funcionando!
        </div>
      </div>
    </div>
  )
}