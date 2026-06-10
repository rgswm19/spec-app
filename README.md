# Secretária

Fale uma frase como "reunião com o João dia 20 às 15h no escritório" e o app cria o evento na sua agenda Google, com lembrete e convite para os participantes. Tudo roda no navegador, custo zero, sem servidor.

## Subir no GitHub Pages

1. Crie um repositório no GitHub e envie todos os arquivos desta pasta.
2. Em Settings > Pages, escolha a branch principal e a pasta raiz.
3. Anote a URL gerada, algo como `https://seuusuario.github.io/secretaria/`.

## Fazer o login Google funcionar (3 passos, gratuito)

1. **Criar o projeto.** Acesse [console.cloud.google.com](https://console.cloud.google.com), crie um projeto (qualquer nome). Em "APIs e serviços > Biblioteca", ative a **Google Calendar API**.

2. **Criar o OAuth Client.** Em "APIs e serviços > Credenciais", clique em "Criar credenciais > ID do cliente OAuth", tipo **Aplicativo da Web**. Em "Origens JavaScript autorizadas", adicione a URL do seu GitHub Pages (só o domínio, por exemplo `https://seuusuario.github.io`). Copie o Client ID gerado e cole na constante `GOOGLE_CLIENT_ID` no topo do arquivo `app.js`.

3. **Adicionar usuários de teste.** Em "Tela de consentimento OAuth" (ou "Público"), mantenha o app em modo "Teste" e adicione o e-mail Google de cada pessoa que vai usar o app na lista de usuários de teste. Cada uma entra com a própria conta e o app mexe só na agenda dela.

Pronto. Abra a URL no celular, toque em "Adicionar à tela inicial" e use como aplicativo.

## Sem configurar nada

Toque em "Ver demonstração sem login" na tela inicial para ver todas as telas e o fluxo completo com dados de mentira.

## Observações

- O token de acesso fica só na memória do navegador. Fechou, acabou. Ao usar de novo, o Google pode pedir um toque rápido para reconectar.
- A "agendinha" nome para e-mail fica no localStorage do aparelho. Apagar dados do site apaga os contatos.
- Fuso horário fixo: America/Sao_Paulo.
