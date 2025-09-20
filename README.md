# Capsul Brasil - Local-First CRM

Sistema completo de CRM com foco em desenvolvimento local-first, permitindo que qualquer desenvolvedor suba a aplicação completa em sua máquina local usando apenas Docker + Node.js.

## 🚀 Quick Start

### Opção 1: Setup Automático (Recomendado)
```bash
# Windows
./setup-new-machine.bat

# Linux/Mac
chmod +x setup-new-machine.sh
./setup-new-machine.sh
```

### Opção 2: Setup Manual
```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar ambiente
cp .env.example .env.local

# 3. Configurar banco de dados
DATABASE_URL="file:./dev.db" npx prisma migrate dev --name init
DATABASE_URL="file:./dev.db" npx prisma db seed

# 4. Iniciar desenvolvimento
DATABASE_URL="file:./dev.db" pnpm dev
```

**Pronto!** Acesse:
- **App**: http://localhost:3000

## 📋 Pré-requisitos

- **Node.js** LTS (18+)
- **pnpm** (`npm install -g pnpm`)
- **Docker Desktop** ou Docker Engine

## 👤 Usuários de Teste

| Tipo | Email | Senha |
|------|-------|-------|
| Admin | `admin@capsul.com.br` | `admin123` |
| Gestor | `manager@capsul.com.br` | `manager123` |
| Vendas | `sales@capsul.com.br` | `sales123` |

## 🏗️ Stack Tecnológica

- **Frontend**: Next.js 14 + TypeScript + Tailwind + shadcn/ui
- **Backend**: Next.js API Routes + Prisma + SQLite (dev)
- **Auth**: NextAuth.js com RBAC
- **UI**: Kanban drag-and-drop, WhatsApp integration
- **Analytics**: Dashboard com métricas completas
- **Database**: SQLite local-first para desenvolvimento

## 📁 Estrutura do Projeto

```
capsul-brasil/
├── src/
│   ├── app/                 # Next.js App Router
│   ├── components/          # Componentes React
│   ├── lib/                 # Utilitários e configurações
│   └── types/               # Tipos TypeScript
├── prisma/                  # Schema e migrations
├── scripts/                 # Scripts de automação
├── docs/                    # Documentação
└── docker-compose.yml       # Serviços locais
```

## 🛠️ Comandos Úteis

```bash
# Desenvolvimento
pnpm dev                     # Inicia o servidor de desenvolvimento
pnpm build                   # Build de produção
pnpm start                   # Inicia servidor de produção

# Database
pnpm db:migrate              # Executa migrations
pnpm db:seed                 # Popula dados iniciais
pnpm db:studio               # Abre Prisma Studio
pnpm db:reset                # Reset completo do DB

# Docker
pnpm compose:up              # Sobe containers
pnpm compose:down            # Para containers
pnpm compose:logs            # Visualiza logs

# Qualidade
pnpm lint                    # ESLint
pnpm test                    # Testes unitários
pnpm e2e                     # Testes end-to-end
```

## 🎯 Funcionalidades

### 🌐 Landing Page
- Formulário de captação com validação
- Anti-spam (honeypot + Turnstile mock)
- Captura de UTMs e referrer
- Consentimento LGPD

### 🔐 Admin/CRM
- Login com RBAC (Admin/Gestor/Vendas)
- Dashboard com métricas
- Tabela de leads com filtros
- Kanban drag-and-drop
- Timeline de atividades
- Gestão de tarefas

### 📊 Analytics & BI
- Events mockados em dev
- Dashboard Metabase embeddado
- Métricas de funil e conversão
- KPIs de produtividade

## 📚 Documentação Completa

Para setup detalhado e troubleshooting, veja: **[docs/SetupLocal.md](docs/SetupLocal.md)**

## 🔧 Troubleshooting Rápido

**Portas ocupadas?**
```bash
# Verifique quais portas estão em uso
netstat -an | findstr ":5432\|:6379\|:3000\|:8025\|:3001"

# Ou altere as portas no docker-compose.yml
```

**Docker não sobe?**
```bash
# Verifique se o Docker está rodando
docker info

# Reset completo
docker compose down -v
docker compose up -d
```

**Database com erro?**
```bash
# Reset e recriar
pnpm db:reset
pnpm prisma migrate dev
pnpm prisma db seed
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Add: nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para detalhes.

---

**Capsul Brasil** - Transformando negócios com tecnologia 🚀