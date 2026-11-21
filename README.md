# CRM Equipe Elevate

Registro diário de demandas da equipe Elevate: login, demandas do dia com status e justificativa, virada automática para o dia seguinte, painel de acompanhamento e estrelas por dia perfeito.

Site estático (HTML/CSS/JS, sem build) + Supabase (login e banco).

## Configuração do Supabase (uma vez só)

1. **Banco**: no Supabase abra *SQL Editor → New query*, cole todo o conteúdo de `sql/schema.sql` e clique em **Run**.
2. **Confirmação de e-mail**: em *Authentication → Sign In / Providers → Email*, **desligue "Confirm email"** e salve. Assim, quem o admin cadastra já consegue entrar.
3. **Primeiro administrador**: em *Authentication → Users → Add user → Create new user*, crie seu e-mail e senha (marque *Auto Confirm User*). Depois rode no SQL Editor:
   ```sql
   update public.profiles set role = 'admin', name = 'Seu Nome' where email = 'seu@email.com';
   ```
4. Entre no site com esse e-mail. Pela aba **Equipe** você (ou a gestora) cadastra as demais pessoas com nome, e-mail, senha inicial e cargo.

## Regras

- **Admin e gestora de projetos**: criam tarefas para qualquer pessoa, cadastram equipe e clientes, veem o painel do time, o fluxo de conteúdo e a energia do time.
- **Social media**: além das próprias demandas, vê e move o **fluxo de conteúdo**.
- **Designer / Editor e Gestor de tráfego**: criam tarefas só para si e marcam o status das próprias demandas.
- Status do dia: *finalizada*, *incompleta* ou *não realizada* (as duas últimas pedem justificativa e voltam no dia seguinte). Tarefa esquecida sem marcar vira *não realizada*.
- **Fluxo de conteúdo**: A fazer → Revisão interna → Revisão do cliente → Agendamento → Concluído. Ao marcar *finalizada*, a peça entra na revisão interna. Se a revisão (interna ou do cliente) pedir ajuste, a peça volta como **Em alteração** para a lista do dia de quem fez, com o comentário.
- **Estrela**: 1 por dia perfeito (todas as demandas do dia finalizadas até o prazo). No ranking, os bichinhos correm: quem tem mais estrelas vai na frente.
- **Jeremias**: a cada 2 horas pergunta "Tudo certo com as demandas?" (menos para admin e gestora). As respostas aparecem em *Energia do time*.
- Tarefas aceitam **links** e **arquivos/imagens** anexados. Cada pessoa pode subir uma **foto de perfil** e escolher um **bichinho**.
- Tempos do carrossel e do Jeremias: `js/config.js`.

## Atualizar o banco

Sempre que o `sql/schema.sql` mudar, rode o arquivo inteiro de novo no SQL Editor. Ele só cria o que falta e atualiza o que já existe, sem apagar dados.

## Aprovação do cliente (link temporário)

Quando uma peça entra em **Revisão do cliente** (pelo botão ou arrastando no fluxo), o CRM cria sozinho um link de 7 dias. No detalhe da tarefa aparecem **Copiar**, **WhatsApp** e **Abrir**. O cliente não precisa de cadastro: vê as artes em carrossel, o vídeo com play, o PDF e os links, e responde:

- **Aprovado** → a peça vai para *Agendamento*.
- **Alteração** → escreve o que mudar (e pode anexar imagens); a peça volta como *Em alteração* para quem fez.

O link deixa de funcionar depois da resposta, após 7 dias ou se a peça sair da etapa. "Gerar novo link" cria outro e encerra o anterior. A logo do cliente é enviada em *Equipe → Clientes*.

### Prévia do link no WhatsApp (opcional, via Vercel)

No GitHub Pages todos os links mostram a mesma prévia (logo da Elevate). Para cada link mostrar **a imagem do post e o nome do cliente**, publique o mesmo repositório na Vercel (gratuito):

1. Entre em vercel.com com sua conta do GitHub → **Add New… → Project** → importe `CRM-EQUIPE-ELEVATE`.
2. Framework: **Other**. Não precisa mudar mais nada → **Deploy**.
3. Use o endereço da Vercel (ex.: `crm-equipe-elevate.vercel.app`) para acessar o CRM. Os links gerados já saem com esse endereço.

A função `api/og.js` + `vercel.json` cuidam da prévia; pessoas abrem a página normal.

## Publicação automática no Instagram

O CRM publica sozinho os posts com **agendamento confirmado** pela social media, na data e hora marcadas (confere a cada 5 minutos). Funciona com feed, carrossel (2 a 10 mídias), Reels (vídeo MP4/MOV) e story. Imagens PNG/WebP são convertidas em JPG no envio.

Configuração (uma vez):
1. Meta: usuário do sistema **CRM Elevate** no portfólio da Elevate, com as contas do Instagram dos clientes atribuídas e um **token** (validade: nunca) com `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, `business_management`, `pages_show_list`, `pages_read_engagement`.
2. Supabase → *Edge Functions → Secrets*: criar `META_TOKEN` com o token.
3. Supabase → *Edge Functions → Deploy a new function → Via Editor*: publicar `ig-accounts` e `ig-publish` com o código de `supabase/functions/…/index.ts`, e desligar a verificação de JWT de cada uma.
4. Rodar `sql/cron.sql` no SQL Editor.
5. No CRM: *Equipe → Clientes →* botão do Instagram *→ Buscar contas liberadas* e escolher a conta de cada cliente.

## Testar sem banco

Abra o site com `?demo` no fim do endereço (ex.: `index.html?demo`) para navegar com dados de exemplo.

## Publicar

GitHub → *Settings → Pages* → *Deploy from a branch* → escolha a branch e a pasta `/ (root)`.
