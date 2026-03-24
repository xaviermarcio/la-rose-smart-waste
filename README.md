# 🍎 La Rose Smart Waste (PWA)
> **Enterprise Resource Planning (ERP) focado em automação de perdas e Business Intelligence.**

![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=for-the-badge&logo=Firebase&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=progressive-web-apps&logoColor=white)
![JS](https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

## 📖 1. Contextualização e Problema
No cenário operacional do **Hortifruti La Rose**, a gestão de quebras (perdas de mercadoria por danos ou maturação) era realizada através de registros manuais em papel. 

### O Desafio Técnico:
* **Entropia de Dados:** Caligrafia ilegível e erros em pesos fracionados (ex: 0,326kg).
* **Gargalo Administrativo:** Necessidade de somar manualmente dezenas de lançamentos repetidos para gerar uma única nota fiscal.
* **Volatilidade de Custo:** Dificuldade em calcular o prejuízo real, já que o preço de custo no hortifruti flutua diariamente.
* **Falta de Auditabilidade:** Inexistência de logs sobre qual operador realizou o lançamento.

---

## 🏗️ 2. Arquitetura da Solução
O sistema utiliza uma arquitetura **Serverless (BaaS)**, garantindo escalabilidade, segurança de nível enterprise e custo zero de infraestrutura inicial.

* **Frontend:** Single Page Application (SPA) responsiva com **Tailwind CSS** (Design System Premium).
* **Backend:** **Firebase Firestore** (NoSQL Real-time) e **Firebase Auth**.
* **PWA:** Service Workers para suporte **Offline-first**, garantindo operação mesmo em zonas de Wi-Fi instável no estoque.
* **Engine de BI:** Algoritmo de redução (`.reduce()`) para consolidação de dados e integração com **Chart.js** para visualização de perdas financeiras.

---

## 📂 3. Estrutura de Pastas
```text
la-rose-smart-waste/
├── firebase.json           # Configurações de deploy do Firebase
├── firestore.rules         # Regras de segurança (Quem pode ler/gravar)
├── firestore.indexes.json  # Índices para buscas rápidas
├── .gitignore              # Arquivos que o Git deve ignorar
└── /public                 # <-- PASTA PÚBLICA (Tudo aqui vai para a web)
    ├── index.html          # Splash Screen e Seleção de Loja/Admin
    ├── lancamento.html     # Painel do Operador (Lindomar, Amanda, etc)
    ├── dashboard.html      # Seu Painel Admin (Soma de lotes e PDF)
    ├── manifest.json       # Configuração para instalar como App (PWA)
    ├── sw.js               # Service Worker (Motor do modo Offline)
    │
    ├── /assets             # Logos e ícones da La Rose
    │
    ├── /css
    │   └── style.css       # Estilos (Tailwind ou CSS customizado)
    │
    └── /js                 # Lógica do Sistema
        ├── firebase-config.js # Conexão com Firebase e Persistência Offline
        ├── data.js         # Master List de Produtos e Config de Lojas
        ├── auth.js         # Controle de acesso e UID do Márcio
        ├── app.js          # Lógica de Lançamento e Rascunho
        └── admin.js        # Algoritmo de Soma e Fechamento de Lote          # Para não subir lixo para o seu GitHub