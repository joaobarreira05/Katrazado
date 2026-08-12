# 🚀 Guia de Alojamento Online Gratuito — Katrazado

O **Katrazado** utiliza **Node.js + Socket.IO (WebSockets em tempo real)**. Para jogar com amigos remotos a partir de qualquer dispositivo (telemóvel ou PC), podes alojar gratuitamente numa das seguintes plataformas:

---

## Opção 1: Render (Recomendada — Gratuito 24/7)

1. Cria uma conta gratuita no [Render.com](https://render.com).
2. Liga a tua conta do GitHub ao Render.
3. Cria um novo repositório no GitHub com os ficheiros do teu projeto `katrazado`.
4. No Render, clica em **New +** → **Blueprint** e seleciona o teu repositório.
5. O Render detetará o ficheiro `render.yaml` automaticamente e fará o deploy!
6. No final, terás um link público (ex: `https://katrazado.onrender.com`) para partilhar com os teus amigos.

*Nota:* Em contas gratuitas no Render, o servidor entra em suspensão se estiver 15 minutos sem visitas, e acorda automaticamente quando alguém acede ao link (~30 segundos no primeiro acesso).

---

## Opção 2: Railway

1. Cria uma conta no [Railway.app](https://railway.app).
2. Clica em **New Project** → **Deploy from GitHub repo**.
3. Seleciona o repositório do `katrazado`.
4. O Railway detetará o `Dockerfile` ou Node.js e disponibilizará o link público em segundos.

---

## Opção 3: Koyeb / Fly.io

O projeto já contém o ficheiro `Dockerfile` padrão, permitindo o deploy direto em qualquer uma destas plataformas sem qualquer alteração de código.

---

## ⚡ Solução Instantânea para Testar Agora sem Fazer Deploy:

Se quiseres testar **agora mesmo** com os teus amigos enquanto estás a rodar o projeto localmente no teu computador:

1. No terminal do teu projeto, executa:
   ```bash
   npx localtunnel --port 3000
   ```
2. O terminal vai gerar um link público seguro (ex: `https://katrazado-game.loca.lt`).
3. Envia esse link aos teus amigos para entrarem na tua sala imediatamente!
