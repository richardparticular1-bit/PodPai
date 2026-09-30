# PODPAI CAST

Estúdio com até oito participantes, movimento sincronizado, áudio WebRTC, chat expansível e moderação.

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

O projeto **PodPai**, região São Paulo, foi criado no plano Free. O bucket `podpai-episodes` é privado, aceita WebM/MP4 de áudio ou vídeo e limita cada arquivo a 45 MiB, abaixo do teto de 50 MB do Free. Não há políticas públicas de leitura ou escrita. Os replays são acessíveis somente após autenticação de administrador. As tabelas privadas podpai_episodes e podpai_episode_parts guardam títulos e duração. O esquema está em episode-schema.sql e já foi aplicado ao projeto PodPai. RLS sem políticas públicas é intencional: somente o servidor autenticado acessa esses dados.

## Sala e administração

- O servidor atribui uma posição inicial a cada participante. Use WASD, setas ou o joystick para andar. A posição é transmitida como proporção do estúdio, com limites para manter o avatar visível em celulares e computadores. Digitar no chat ou abrir diálogos pausa o movimento. Todos os participantes devem atualizar a página após esta mudança de protocolo.
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

Em **Episódios gravados**, edite o título e clique em **Reproduzir episódio**. Todas as partes são carregadas e reproduzidas em sequência; uma parte ausente interrompe a sequência com aviso. Gravações antigas podem não ter duração disponível. **Carregar mais** traz episódios antigos. Links de reprodução expiram em uma hora; clique novamente no episódio para renovar. Replays não são publicados automaticamente nem ficam acessíveis sem a senha administrativa.

## Verificação local

`npm test` verifica permissões, ocupação, lotação, remoção, avisos de gravação e validações do armazenamento.

`node test/preview.cjs` abre uma prévia em `http://localhost:3003` com armazenamento TUS simulado em 3004. A senha **exclusiva dessa prévia** é `podpai-local-test`. O microfone é substituído por um tom sintético; **TESTE: tom remoto** cria outro tom. As partes duram oito segundos para testar rotação, envio e replay. `http://localhost:3004/verify` mede as frequências gravadas. Esse fixture não é servido pelo servidor de produção e não acessa o Supabase real.

Antes do primeiro episódio real, faça uma gravação curta após configurar o Render e confirme o replay no Supabase.

Para recuperar uma cópia baixada após falha, entre em **Administrar → Enviar gravação salva** e selecione o WebM/MP4 de até 45 MB. O nome original da cópia preserva a identificação do episódio e da parte. Aguarde a confirmação antes de fechar a aba.

## Novos controles do estúdio

Clique em uma poltrona livre ou escolha o número e use **Sentar**. **Levantar**, WASD, setas ou joystick liberam o lugar. A ocupação é confirmada pelo servidor.

**Pedir a palavra** entra na fila do painel do apresentador. O administrador pode liberar o microfone solicitado, silenciar todos os participantes ou moderar individualmente. Liberar não ativa o microfone automaticamente. O halo e o medidor acompanham áudio detectado, não apenas o estado do botão.

No celular, joystick, microfone e chat ficam abaixo da área do estúdio.

## Entrada e saída lateral

Participantes chegam em pé junto à porta esquerda. Caminhe com os controles ou escolha uma poltrona para sentar. A poltrona ocupada continua visível, com postura sentada. Para sair, volte à porta e clique nela ou em **Sair do podcast**. Passar perto não desconecta. A saída desliga o microfone e volta à tela inicial; gravações e envios pendentes devem ser concluídos primeiro.

### Movimento e presença

A chegada distribui os convidados em posições distintas perto da porta. Toque no piso para caminhar ao redor da mesa ou numa poltrona livre para caminhar até ela e sentar. Teclado e joystick interrompem o caminho automático.

Braços e pernas acompanham os passos, com respiração em repouso e gestos ao falar, rir, aplaudir ou pedir a palavra. A preferência do aparelho por movimentos reduzidos é respeitada. Pedidos aparecem sobre o avatar e notificam o administrador. O estado do áudio aparece na lista de participantes; quando o navegador bloqueia a reprodução, toque no aviso para ouvir.

O vídeo usa uma composição fixa de 1280 × 720, com título e nomes, independentemente do tamanho da tela que está gravando.
