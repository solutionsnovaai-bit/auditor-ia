# Auditor.IA — Nova AI Solutions

Ferramenta de auditoria multimodal de ligações, WhatsApp e redes sociais via Gemini Pro.

## Estrutura

```
auditor-ia/
├── index.html          ← entry point do Vite
├── vite.config.js      ← config do Vite + plugin React
├── vercel.json         ← roteamento SPA + Edge Function
├── package.json
├── .gitignore
├── api/
│   └── analyze.js      ← proxy seguro para a API do Gemini (Edge Function)
└── src/
    ├── main.jsx
    └── App.jsx
```

## Deploy no Vercel (passo a passo)

### 1. Suba para o GitHub

```bash
git init
git add .
git commit -m "feat: auditor.ia inicial"
git remote add origin https://github.com/SEU_USUARIO/auditor-ia.git
git push -u origin main
```

### 2. Conecte no Vercel

1. Acesse [vercel.com](https://vercel.com) → **New Project**
2. Importe o repositório `auditor-ia`
3. Framework: **Vite** (detectado automaticamente)
4. Clique em **Deploy**

### 3. Configure a variável de ambiente

No painel do projeto no Vercel:
- Vá em **Settings → Environment Variables**
- Adicione:
  - **Name:** `GEMINI_API_KEY`
  - **Value:** sua chave da [Google AI Studio](https://aistudio.google.com/app/apikey)
  - **Environments:** Production, Preview, Development

4. Faça um **Redeploy** para aplicar a variável.

## Rodar localmente

```bash
npm install
```

Crie um arquivo `.env.local` na raiz:

```
GEMINI_API_KEY=sua_chave_aqui
```

```bash
npm run dev
```

> A Edge Function `/api/analyze` roda automaticamente via `vercel dev`. Para testar localmente sem o Vercel CLI, instale com `npm i -g vercel` e rode `vercel dev`.

## Como funciona

- O frontend (React + Vite) envia o áudio/texto para `/api/analyze`
- A Edge Function injeta a `GEMINI_API_KEY` do servidor e repassa para a API do Gemini
- A API key **nunca é exposta** no bundle do frontend
