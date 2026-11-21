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

- **Admin e gestora de projetos**: criam tarefas para qualquer pessoa, cadastram e editam a equipe, veem o painel do time todo.
- **Designer, editor, social media, gestor de tráfego**: criam tarefas só para si e marcam o status das próprias demandas.
- Status: *finalizada*, *parcialmente finalizada* ou *não realizada*. As duas últimas pedem justificativa e voltam sozinhas no dia seguinte com o mesmo status. Tarefa esquecida sem marcar vira *não realizada* na virada do dia.
- **Estrela**: 1 por dia perfeito, ou seja, todas as demandas do dia finalizadas até o prazo.
- O carrossel "como funciona" aparece no primeiro acesso e depois a cada 10 minutos (ajuste em `js/config.js`).

## Testar sem banco

Abra o site com `?demo` no fim do endereço (ex.: `index.html?demo`) para navegar com dados de exemplo.

## Publicar

GitHub → *Settings → Pages* → *Deploy from a branch* → escolha a branch e a pasta `/ (root)`.
