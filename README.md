# PODPAI CAST

Estúdio com oito poltronas sincronizadas, áudio WebRTC, chat expansível e moderação.

## Executar

Node.js 22 ou superior. Execute `npm ci` e `npm start`. O servidor usa `PORT` (3001 por padrão). Os testes rodam com `npm test`.

## Configuração no Render

O serviço de teste usa a branch `codex/podpai-experience`, build `npm ci` e start `npm start`.
Em **Environment**, adicione as variáveis abaixo e escolha **Save, rebuild & deploy**:

| Variável | Valor |
| --- | --- |
| `ADMIN_PASSWORD` | Uma senha forte, escolhida pelo dono da sala |
| `SUPABASE_URL` | `https://ycaronjyqdkcugtwtmdo.supabase.co` |
| `SUPABASE_SECRET_KEY` | Chave secreta do projeto PodPai, disponível em Settings → API Keys |
| `SUPABASE_EPISODES_BUCKET` | `podpai-episodes` (opcional; já é o padrão) |

Não compartilhe nem coloque as chaves no código, em prints ou no chat. A chave secreta fica apenas no servidor. O frontend recebe autorizações temporárias específicas para upload e reprodução. Nunca use a chave de outro projeto.

O projeto **PodPai**, região São Paulo, foi criado no plano Free. O bucket `podpai-episodes` é privado, aceita WebM/MP4 de áudio ou vídeo e limita cada arquivo a 45 MiB, abaixo do teto de 50 MB do Free. Não há políticas públicas de leitura ou escrita. Os replays são acessíveis somente após autenticação de administrador. Não são necessárias tabelas adicionais: a lista usa os objetos concluídos do Storage.

## Sala e administração

- O servidor atribui uma poltrona única a cada participante; todos veem a mesma ocupação. A posição é relativa ao estúdio de cada aparelho. Ao sair, a poltrona é liberada sem deslocar os demais.
- Com oito participantes, novas entradas como participante são recusadas; ainda é possível entrar como ouvinte.
- **Expandir** abre o chat sobre a sala; **Voltar à sala** ou Escape restaura a visão anterior.
- **Administrar** pede a senha. O nome “Richard” ou um avatar não concede poderes.
- **Silenciar** bloqueia o microfone nos clientes da sala e na mixagem gravada. **Liberar mic** permite que o próprio participante religue o microfone; não ativa seu microfone à distância.
- **Remover** encerra a sessão e impede que aquele identificador reconecte até reiniciar o servidor. Não é banimento por conta ou dispositivo: recarregar a página gera outra identidade.
- A sala usa P2P: a moderação de áudio é aplicada pelos navegadores oficiais, não por um servidor de mídia. Reentrada e reinício do servidor exigem nova autenticação administrativa.

## Gravação e replay

Entre como administrador e clique em **Iniciar gravação**. O padrão é vídeo do estúdio com o áudio do microfone local e dos participantes recebidos via WebRTC. Os efeitos sonoros gerados localmente pela interface não são capturados. Todos os presentes, inclusive quem entra depois, veem o aviso de gravação.

O navegador captura o canvas em 1280×720 a até 24 fps e envia partes independentes ao Supabase. Uma parte é finalizada a cada quatro minutos ou ao atingir aproximadamente 40 MiB. A captura reinicia para a próxima parte; pode haver uma pequena transição entre arquivos. O Free limita o tamanho de cada arquivo e também o armazenamento e tráfego totais; vídeos não são ilimitados.

Mantenha a aba do administrador aberta e visível, com internet, até aparecer **salva no Supabase** em todas as partes. Bloquear o aparelho, fechar a aba ou suspender o navegador pode interromper a captura. A gravação não continua no servidor quando o administrador sai. O upload usa TUS, com tentativas automáticas; em falha, há **Tentar envio novamente** e **Baixar cópia** como recuperação. Partes pendentes ficam temporariamente na memória dessa aba e não sobrevivem ao fechamento. Com quatro partes pendentes, a captura para para evitar acumular memória.

Em **Episódios gravados**, abra uma parte para assistir. A próxima parte carregada do mesmo episódio toca automaticamente. **Carregar mais** traz partes antigas. Links de reprodução expiram em uma hora; clique novamente no episódio para renovar. Replays não são publicados automaticamente nem ficam acessíveis sem a senha administrativa.

## Verificação local

`npm test` verifica permissões, ocupação, lotação, remoção, avisos de gravação e validações do armazenamento.

`node test/preview.cjs` abre uma prévia em `http://localhost:3003` com armazenamento TUS simulado em 3004. A senha **exclusiva dessa prévia** é `podpai-local-test`. O microfone é substituído por um tom sintético; **TESTE: tom remoto** cria outro tom. As partes duram oito segundos para testar rotação, envio e replay. `http://localhost:3004/verify` mede as frequências gravadas. Esse fixture não é servido pelo servidor de produção e não acessa o Supabase real.

Antes do primeiro episódio real, faça uma gravação curta após configurar o Render e confirme o replay no Supabase.
