# Plataforma de Gestão de Gastos

Plataforma web completa para controle e análise de finanças pessoais, com recursos de categorização, metas, transações recorrentes e relatórios detalhados.

## Tecnologias:

### Ambiente de execução:
- Node.js v20.20.2
- npm v10.8.2

### Dependências:
- **express** ^5.2.1 - Framework web
- **@prisma/client** ^7.7.0 - ORM para banco de dados
- **@prisma/adapter-pg** ^7.7.0 - Adaptador PostgreSQL para Prisma
- **prisma** ^7.7.0 - CLI do Prisma
- **bcrypt** ^6.0.0 - Hash de senhas
- **jsonwebtoken** ^9.0.3 - Autenticação JWT
- **dotenv** ^17.4.1 - Variáveis de ambiente
- **multer** ^2.1.1 - Upload de arquivos

---

## API Endpoints

### 🔐 Autenticação

#### Login por Email/Senha
```
POST /api/login
```
Realiza login do usuário com email e senha.

**Body:**
```json
{
  "email": "usuario@example.com",
  "senha": "senha123"
}
```

**Resposta (200):**
```json
{
  "success": true,
  "token": "jwt_token_aqui",
  "usuario": {
    "id": 1,
    "nome": "João",
    "email": "usuario@example.com"
  }
}
```

#### Login por Telefone
```
POST /api/login/telefone
```
Alternative login method using phone number.

**Body:**
```json
{
  "telefone": "11999999999",
  "senha": "senha123"
}
```

#### Tema (Público)
```
GET /api/tema
```
Retorna configurações de tema da aplicação (sem autenticação).

#### Fontes (Público)
```
GET /api/fontes
```
Retorna lista de fontes disponíveis (sem autenticação).

---

### 👥 Usuários

#### Listar Usuários
```
GET /api/usuarios
```
Lista todos os usuários (apenas admin).

**Requer:** Autenticação + Permissão Admin

**Resposta (200):**
```json
{
  "success": true,
  "usuarios": [
    {
      "id": 1,
      "nome": "João",
      "email": "joao@example.com",
      "telefone": "11999999999",
      "permissao_id": 1
    }
  ]
}
```

#### Listar Usuários (Select)
```
GET /api/usuarios/select
```
Retorna usuários em formato simplificado para select (apenas admin).

**Requer:** Autenticação + Permissão Admin

#### Criar Usuário
```
POST /api/usuarios
```
Cria novo usuário (apenas admin).

**Requer:** Autenticação + Permissão Admin

**Body:**
```json
{
  "nome": "Maria",
  "email": "maria@example.com",
  "telefone": "11888888888",
  "senha": "senhaSegura123",
  "permissao_id": 2
}
```

#### Deletar Usuário
```
DELETE /api/usuarios/:id
```
Remove um usuário (apenas admin).

**Requer:** Autenticação + Permissão Admin

#### Buscar Usuário por Email
```
GET /api/usuarios/email/:email
```
Busca um usuário pelo email (apenas admin).

**Requer:** Autenticação + Permissão Admin

#### Redefinir Senha
```
POST /api/usuarios/:id/redefinir-senha
```
Admin redefine a senha de um usuário.

**Requer:** Autenticação + Permissão Admin

#### Obter Usuário
```
GET /api/usuarios/:id
```
Obtém dados de um usuário específico. Usuários normais podem acessar apenas seus próprios dados.

**Requer:** Autenticação

**Resposta (200):**
```json
{
  "success": true,
  "usuario": {
    "id": 1,
    "nome": "João",
    "email": "joao@example.com",
    "telefone": "11999999999",
    "permissao_id": 1
  }
}
```

#### Atualizar Usuário
```
PUT /api/usuarios/:id
```
Atualiza dados de um usuário. Usuários normais podem editar apenas seus próprios dados.

**Requer:** Autenticação

**Body:**
```json
{
  "nome": "João Silva",
  "telefone": "11999999999"
}
```

#### Alterar Senha
```
POST /api/usuarios/:id/alterar-senha
```
Usuário altera sua própria senha (com autenticação).

**Requer:** Autenticação

**Body:**
```json
{
  "senhaAtual": "senhaAnterior123",
  "senhaNoFa": "novaSenha456"
}
```

#### Upload Foto Usuário
```
POST /api/usuarios/:id/foto
```
Faz upload da foto de perfil do usuário.

**Requer:** Autenticação + Multipart/form-data

---

### 🔑 Permissões

#### Listar Permissões
```
GET /api/permissoes
```
Lista todas as permissões (apenas admin).

**Requer:** Autenticação + Permissão Admin

#### Criar Permissão
```
POST /api/permissoes
```
Cria nova permissão.

**Requer:** Autenticação + Permissão Admin

**Body:**
```json
{
  "nome": "Gerenciador"
}
```

#### Obter Permissão
```
GET /api/permissoes/:id
```
Obtém detalhes de uma permissão específica.

**Requer:** Autenticação + Permissão Admin

#### Atualizar Permissão
```
PUT /api/permissoes/:id
```
Atualiza uma permissão existente.

**Requer:** Autenticação + Permissão Admin

#### Deletar Permissão
```
DELETE /api/permissoes/:id
```
Remove uma permissão.

**Requer:** Autenticação + Permissão Admin

---

### 💳 Pagamentos

#### Listar Pagamentos
```
GET /api/pagamentos
```
Lista todos os pagamentos (apenas admin).

**Requer:** Autenticação + Permissão Admin

#### Criar Pagamento
```
POST /api/pagamentos
```
Cria novo pagamento.

**Requer:** Autenticação + Permissão Admin

**Body:**
```json
{
  "descricao": "Pagamento mensal",
  "valor": 100.00,
  "tipo_pagamento": "mensal",
  "data_pagamento": "2026-04-15",
  "data_vencimento": "2026-04-30",
  "usuario_id": 1
}
```

#### Obter Pagamento
```
GET /api/pagamentos/:id
```
Obtém detalhes de um pagamento específico.

**Requer:** Autenticação + Permissão Admin

#### Atualizar Pagamento
```
PUT /api/pagamentos/:id
```
Atualiza um pagamento existente.

**Requer:** Autenticação + Permissão Admin

#### Deletar Pagamento
```
DELETE /api/pagamentos/:id
```
Remove um pagamento.

**Requer:** Autenticação + Permissão Admin

#### Criar Pagamento para Usuário
```
POST /api/usuarios/:id/pagamentos
```
Admin cria um pagamento para um usuário específico.

**Requer:** Autenticação + Permissão Admin

---

### ✅ Validação de Interação

#### Validar Permissão
```
GET /api/interacao/permissao
```
Valida se o usuário autenticado tem permissão para interagir com a plataforma.

**Requer:** Autenticação

---

### 💰 Transações / Movimentação Financeira

#### Listar Transações
```
GET /api/transacoes
```
Lista transações do usuário autenticado com filtros opcionais.

**Requer:** Autenticação

**Query Parameters:**
- `categoria_id` (number, opcional) - Filtrar por categoria
- `mes_movimentacao` (number, opcional) - Mês (1-12)
- `ano_movimentacao` (number, opcional) - Ano
- `search` (string, opcional) - Buscar por descrição
- `valor` (number, opcional) - Filtrar por valor exato

**Resposta (200):**
```json
{
  "success": true,
  "transacoes": [
    {
      "id": 1,
      "descricao": "Compras no mercado",
      "valor": 150.50,
      "data_movimentacao": "2026-04-10",
      "categoria_movimentacao": {
        "id": 3,
        "nome": "Gastos"
      }
    }
  ]
}
```

#### Listar Categorias de Movimentação para Transações
```
GET /api/transacoes/categorias-movimentacao
```
Retorna categorias disponíveis para transações.

**Requer:** Autenticação

#### Dashboard Resumo
```
GET /api/dashboard/resumo
```
Retorna resumo financeiro com gráficos e totais.

**Requer:** Autenticação

**Query Parameters:**
- `periodo` (string, opcional) - 'ano_atual', 'mes_atual' (padrão)
- `mes` (number, opcional)
- `ano` (number, opcional)

#### Criar Transação
```
POST /api/transacoes
```
Cria nova transação/movimentação financeira.

**Requer:** Autenticação

**Body:**
```json
{
  "descricao": "Compra online",
  "valor": 250.00,
  "categoria_id": 3,
  "data_movimentacao": "2026-04-15"
}
```

#### Obter Transação
```
GET /api/transacoes/:id
```
Obtém detalhes de uma transação específica.

**Requer:** Autenticação

#### Atualizar Transação
```
PUT /api/transacoes/:id
```
Atualiza uma transação existente.

**Requer:** Autenticação

**Body:**
```json
{
  "descricao": "Compra atualizada",
  "valor": 300.00,
  "categoria_id": 3,
  "data_movimentacao": "2026-04-15"
}
```

#### Deletar Transação
```
DELETE /api/transacoes/:id
```
Remove uma transação.

**Requer:** Autenticação

---

### 📊 Relatórios

#### Relatório de Movimentação
```
GET /api/relatorio/movimentacao
```
Gera relatório detalhado de movimentação financeira com filtros.

**Requer:** Autenticação

**Query Parameters:**
- `mes` (number, 1-12, opcional) - Mês desejado. Padrão: mês atual
- `ano` (number, opcional) - Ano desejado. Padrão: ano atual
- `categoria_id` (number, opcional) - Filtrar por categoria específica

**Resposta (200):**
```json
{
  "success": true,
  "relatorio": {
    "periodo": {
      "mes": 4,
      "ano": 2026,
      "dataInicio": "2026-04-01",
      "dataFim": "2026-04-30"
    },
    "filtros": {
      "categoriaFiltrada": null
    },
    "resumo": {
      "totalGanhos": 5000.00,
      "totalGastos": 2500.00,
      "saldo": 2500.00,
      "totalMovimentacoes": 15
    },
    "saldoPorCategoria": [
      {
        "categoria": "Ganhos",
        "saldo": 5000.00
      },
      {
        "categoria": "Gastos",
        "saldo": -2500.00
      }
    ],
    "movimentacoes": [
      {
        "id": 1,
        "descricao": "Salário",
        "valor": 3000.00,
        "data_movimentacao": "2026-04-01",
        "categoria": {
          "id": 4,
          "nome": "Ganhos"
        },
        "tipo": "ganho"
      }
    ]
  }
}
```

---

### 🎯 Metas

#### Listar Metas
```
GET /api/metas
```
Lista metas do usuário autenticado.

**Requer:** Autenticação

#### Listar Categorias para Metas
```
GET /api/metas/categorias-movimentacao
```
Retorna categorias disponíveis para criar metas.

**Requer:** Autenticação

#### Listar Notificações de Metas
```
GET /api/metas/notificacoes
```
Retorna notificações sobre metas próximas de vencer ou já vencidas.

**Requer:** Autenticação

#### Criar Meta
```
POST /api/metas
```
Cria nova meta financeira.

**Requer:** Autenticação

**Body:**
```json
{
  "descricao": "Economia mensal",
  "valor": 500.00,
  "categoria_movimentacao_id": 4,
  "data_meta": "2026-04-30"
}
```

#### Obter Meta
```
GET /api/metas/:id
```
Obtém detalhes de uma meta específica.

**Requer:** Autenticação

#### Atualizar Meta
```
PUT /api/metas/:id
```
Atualiza uma meta existente.

**Requer:** Autenticação

#### Prorrogar Meta
```
PATCH /api/metas/:id/prorrogar
```
Prorroga a data de vencimento de uma meta.

**Requer:** Autenticação

**Body:**
```json
{
  "nova_data": "2026-05-31"
}
```

#### Deletar Meta
```
DELETE /api/metas/:id
```
Remove uma meta.

**Requer:** Autenticação

---

### 🎨 Customizações (Admin)

#### Listar Customizações
```
GET /api/customizacoes
```
Lista todas as customizações da plataforma.

**Requer:** Autenticação + Permissão Admin

#### Criar Customização
```
POST /api/customizacoes
```
Cria nova customização com suporte a upload de arquivo.

**Requer:** Autenticação + Permissão Admin

**Body (form-data):**
```
categoria_id: 1
valor: "texto ou arquivo"
tipo_valor: "texto" ou "imagem"
```

#### Obter Customização
```
GET /api/customizacoes/:id
```
Obtém detalhes de uma customização.

**Requer:** Autenticação + Permissão Admin

#### Atualizar Customização
```
PUT /api/customizacoes/:id
```
Atualiza uma customização.

**Requer:** Autenticação + Permissão Admin

#### Deletar Customização
```
DELETE /api/customizacoes/:id
```
Remove uma customização.

**Requer:** Autenticação + Permissão Admin

---

### 📂 Categorias de Customização (Admin)

#### Listar Categorias
```
GET /api/categorias-customizacao
```
Lista categorias de customização.

**Requer:** Autenticação + Permissão Admin

#### Criar Categoria
```
POST /api/categorias-customizacao
```
Cria nova categoria de customização.

**Requer:** Autenticação + Permissão Admin

**Body:**
```json
{
  "nome": "Logos"
}
```

#### Obter Categoria
```
GET /api/categorias-customizacao/:id
```
Obtém detalhes de uma categoria.

**Requer:** Autenticação + Permissão Admin

#### Atualizar Categoria
```
PUT /api/categorias-customizacao/:id
```
Atualiza uma categoria.

**Requer:** Autenticação + Permissão Admin

#### Deletar Categoria
```
DELETE /api/categorias-customizacao/:id
```
Remove uma categoria.

**Requer:** Autenticação + Permissão Admin

---

### 🏷️ Categorias de Movimentação (Admin)

#### Listar Categorias
```
GET /api/categorias-movimentacao
```
Lista categorias de movimentação (Gastos, Ganhos, etc).

**Requer:** Autenticação + Permissão Admin

#### Criar Categoria
```
POST /api/categorias-movimentacao
```
Cria nova categoria de movimentação.

**Requer:** Autenticação + Permissão Admin

**Body:**
```json
{
  "nome": "Alimentação"
}
```

#### Obter Categoria
```
GET /api/categorias-movimentacao/:id
```
Obtém detalhes de uma categoria.

**Requer:** Autenticação + Permissão Admin

#### Atualizar Categoria
```
PUT /api/categorias-movimentacao/:id
```
Atualiza uma categoria.

**Requer:** Autenticação + Permissão Admin

#### Deletar Categoria
```
DELETE /api/categorias-movimentacao/:id
```
Remove uma categoria.

**Requer:** Autenticação + Permissão Admin

---

### 🔄 Transações Recorrentes

#### Listar Transações Recorrentes
```
GET /api/transacoes-recorrentes
```
Lista transações recorrentes do usuário autenticado.

**Requer:** Autenticação

#### Criar Transação Recorrente
```
POST /api/transacoes-recorrentes
```
Cria nova transação recorrente (semanal, mensal, etc).

**Requer:** Autenticação

**Body:**
```json
{
  "descricao": "Aluguel mensal",
  "valor": 1200.00,
  "tipo": "gasto",
  "frequencia": "mensal",
  "data_inicio": "2026-04-01",
  "data_fim": "2027-04-01",
  "categoria_id": 3
}
```

#### Obter Transação Recorrente
```
GET /api/transacoes-recorrentes/:id
```
Obtém detalhes de uma transação recorrente.

**Requer:** Autenticação

#### Atualizar Transação Recorrente
```
PUT /api/transacoes-recorrentes/:id
```
Atualiza uma transação recorrente.

**Requer:** Autenticação

#### Deletar Transação Recorrente
```
DELETE /api/transacoes-recorrentes/:id
```
Remove uma transação recorrente.

**Requer:** Autenticação

---

## Códigos de Status HTTP

- **200** - OK
- **201** - Criado
- **400** - Requisição inválida
- **403** - Acesso negado
- **404** - Não encontrado
- **500** - Erro interno do servidor

---

## Autenticação

A API utiliza **JWT (JSON Web Tokens)** para autenticação. Envie o token no header:

```
Authorization: Bearer seu_jwt_token_aqui
```
