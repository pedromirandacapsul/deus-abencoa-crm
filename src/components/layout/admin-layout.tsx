'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  BarChart3,
  Users,
  CheckSquare,
  Home,
  Menu,
  X,
  LogOut,
  Settings,
  Search,
  Bell,
  User,
  Kanban,
  TrendingUp,
  Flag,
  Target,
  GitBranch,
  MessageCircle,
  Zap,
  DollarSign,
  TrendingUp as Pipeline,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { hasPermission, PERMISSIONS, canAccessRoute } from '@/lib/rbac'
import { cn } from '@/lib/utils'
import { WhatsAppNotifications } from '@/components/whatsapp-notifications'

interface AdminLayoutProps {
  children: React.ReactNode
}

const navigation = [
  {
    name: 'Dashboard',
    href: '/admin',
    icon: Home,
    permission: PERMISSIONS.LEADS_VIEW,
  },
  {
    name: 'Leads',
    icon: Users,
    permission: PERMISSIONS.LEADS_VIEW,
    isExpandable: true,
    children: [
      {
        name: 'Gestão de Leads',
        href: '/admin/leads',
        icon: Users,
        permission: PERMISSIONS.LEADS_VIEW,
      },
      {
        name: 'Lead Scoring',
        href: '/admin/leads/scoring',
        icon: Target,
        permission: PERMISSIONS.LEADS_VIEW,
      },
    ],
  },
  {
    name: 'Pipeline de Vendas',
    icon: DollarSign,
    permission: PERMISSIONS.OPPORTUNITIES_VIEW,
    isExpandable: true,
    children: [
      {
        name: 'Kanban (Oportunidades)',
        href: '/admin/opportunities/kanban',
        icon: Kanban,
        permission: PERMISSIONS.OPPORTUNITIES_VIEW,
      },
      {
        name: 'Lista de Oportunidades',
        href: '/admin/opportunities',
        icon: Pipeline,
        permission: PERMISSIONS.OPPORTUNITIES_VIEW,
      },
      {
        name: 'Analytics & Forecast',
        href: '/admin/opportunities/analytics',
        icon: BarChart3,
        permission: PERMISSIONS.ANALYTICS_VIEW,
      },
    ],
  },
  {
    name: 'Tarefas',
    href: '/admin/tasks',
    icon: CheckSquare,
    permission: PERMISSIONS.TASKS_VIEW,
  },
  {
    name: 'Analytics Geral',
    href: '/admin/analytics',
    icon: BarChart3,
    permission: PERMISSIONS.ANALYTICS_VIEW,
  },
  {
    name: 'Administração',
    icon: Settings,
    permission: PERMISSIONS.USERS_VIEW,
    isExpandable: true,
    children: [
      {
        name: 'Usuários',
        href: '/admin/users',
        icon: User,
        permission: PERMISSIONS.USERS_VIEW,
      },
      {
        name: 'Configurações',
        href: '/admin/settings',
        icon: Settings,
        permission: PERMISSIONS.SYSTEM_ADMIN,
      },
      {
        name: 'Feature Flags',
        href: '/admin/feature-flags',
        icon: Flag,
        permission: PERMISSIONS.SYSTEM_ADMIN,
      },
    ],
  },
  {
    name: 'Integração',
    icon: MessageCircle,
    permission: PERMISSIONS.LEADS_VIEW,
    isExpandable: true,
    children: [
      {
        name: 'WhatsApp',
        href: '/admin/whatsapp',
        icon: MessageCircle,
        permission: PERMISSIONS.LEADS_VIEW,
      },
      {
        name: 'ZapMeow',
        href: '/admin/zapmeow',
        icon: Zap,
        permission: PERMISSIONS.LEADS_VIEW,
      },
      {
        name: 'Automação',
        href: '/whatsapp/automacao',
        icon: Zap,
        permission: PERMISSIONS.LEADS_VIEW,
      },
    ],
  },
]

export function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['Pipeline de Vendas'])
  const { data: session } = useSession()
  const pathname = usePathname()

  // TEMPORÁRIO: Bypass de autenticação para testes
  const skipAuth = true

  if (!session && !skipAuth) {
    return null
  }

  const userRole = session?.user?.role || 'ADMIN'
  const filteredNavigation = navigation.filter(item =>
    hasPermission(userRole, item.permission)
  )

  const toggleMenu = (menuName: string) => {
    setExpandedMenus(prev =>
      prev.includes(menuName)
        ? prev.filter(name => name !== menuName)
        : [...prev, menuName]
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={cn(
        'fixed inset-0 z-50 lg:hidden',
        sidebarOpen ? 'block' : 'hidden'
      )}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
          <div className="flex h-16 items-center justify-between px-4 border-b">
            <Link href="/admin" className="text-xl font-bold text-blue-600">
              Capsul Brasil
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-2">
            {filteredNavigation.map((item) => (
              <div key={item.name}>
                {item.isExpandable ? (
                  <>
                    <button
                      onClick={() => toggleMenu(item.name)}
                      className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-md transition-colors text-gray-700 hover:bg-gray-100"
                    >
                      <div className="flex items-center">
                        <item.icon className="mr-3 h-5 w-5" />
                        {item.name}
                      </div>
                      {expandedMenus.includes(item.name) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    {expandedMenus.includes(item.name) && item.children && (
                      <div className="ml-4 mt-1 space-y-1">
                        {item.children.filter(child => hasPermission(userRole, child.permission)).map((child) => (
                          <Link
                            key={child.name}
                            href={child.href}
                            onClick={() => setSidebarOpen(false)}
                            className={cn(
                              'flex items-center px-3 py-2 text-sm rounded-md transition-colors',
                              pathname === child.href
                                ? 'bg-blue-100 text-blue-700 font-medium'
                                : 'text-gray-600 hover:bg-gray-50'
                            )}
                          >
                            <child.icon className="mr-3 h-4 w-4" />
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                      pathname === item.href
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          <div className="flex h-16 items-center px-6 border-b">
            <Link href="/admin" className="text-xl font-bold text-blue-600">
              Capsul Brasil
            </Link>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-2">
            {filteredNavigation.map((item) => (
              <div key={item.name}>
                {item.isExpandable ? (
                  <>
                    <button
                      onClick={() => toggleMenu(item.name)}
                      className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-md transition-colors text-gray-700 hover:bg-gray-100"
                    >
                      <div className="flex items-center">
                        <item.icon className="mr-3 h-5 w-5" />
                        {item.name}
                      </div>
                      {expandedMenus.includes(item.name) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    {expandedMenus.includes(item.name) && item.children && (
                      <div className="ml-4 mt-1 space-y-1">
                        {item.children.filter(child => hasPermission(userRole, child.permission)).map((child) => (
                          <Link
                            key={child.name}
                            href={child.href}
                            className={cn(
                              'flex items-center px-3 py-2 text-sm rounded-md transition-colors',
                              pathname === child.href
                                ? 'bg-blue-100 text-blue-700 font-medium'
                                : 'text-gray-600 hover:bg-gray-50'
                            )}
                          >
                            <child.icon className="mr-3 h-4 w-4" />
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                      pathname === item.href
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                )}
              </div>
            ))}
          </nav>
          <div className="p-4 border-t">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {session?.user?.name || 'Usuário Teste'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {session?.user?.role || 'ADMIN'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => signOut({ callbackUrl: '/' })}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>

            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="search"
                  placeholder="Buscar leads..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* <WhatsAppNotifications /> */}

              <div className="hidden lg:flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-sm">
                  <p className="font-medium text-gray-900">{session?.user?.name || 'Usuário Teste'}</p>
                  <p className="text-gray-500">{session?.user?.role || 'ADMIN'}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: '/' })}
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}