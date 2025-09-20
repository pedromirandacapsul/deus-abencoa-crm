export default function TestPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900">Página de Teste</h1>
      <p className="text-gray-600 mt-4">
        Se você consegue ver esta página, o roteamento está funcionando.
      </p>
      <div className="mt-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
        ✅ Layout funcionando corretamente!
      </div>
    </div>
  )
}