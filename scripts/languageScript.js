window.currentLang = window.currentLang || 'pt';
const i18n = {
  pt: {
    title: 'Jogo Tâb',
    myBtnInstructions: 'Ver Instruções',
    modalContentInstructions: `<h3>Como jogar Tâb</h3>
        <h4>Introdução</h4>
        <p>O Tâb é um jogo de tabuleiro para dois jogadores, de luta em corrida, jogado no Médio Oriente e Norte de África.</p>
        <p>Joga-se num tabuleiro rectangular de 4 linhas e um número ímpar de colunas (normalmente 7–15).</p>
        <p>Os dois jogadores sentam-se frente a frente; cada um começa com uma fila externa completa de peças.</p>
        <hr>
        <h4>Preparação</h4>
        <p>Escolhe um número ímpar de colunas no painel de configuração.</p>
        <p>As peças de cada jogador serão inicialmente exibidas na primeira linha (linha inferior do ponto de vista do jogador).</p>
        <hr>
        <h4>Dados</h4>
        <p>O «dado» do jogo é uma combinação de 4 paus de madeira. Cada pau tem um lado mais claro (plano) e um lado mais escuro (arredondado).</p>
        <p>Num lançamento conta-se o número de lados claros virados para cima. A correspondência entre esse número e o valor do movimento é a seguinte:</p>
        <ul>
          <li>0 lados claros -> 6 (Sitteh). Probabilidade: 6%</li>
          <li>1 lado claro -> 1 (Tâb). Probabilidade: 25%</li>
          <li>2 lados claros -> 2 (Itneyn). Probabilidade: 38%</li>
          <li>3 lados claros -> 3 (Teláteh). Probabilidade: 25%</li>
          <li>4 lados claros -> 4 (Arba'ah). Probabilidade: 6%</li>
        </ul>
        <p>Os lançamentos de 1, 4 e 6 dão ao jogador uma jogada extra; 2 e 3 terminam a vez do jogador.</p>
        <hr>
        <h4>Início da partida</h4>
        <p>No início da partida nenhum jogador pode mover-se até que alguém obtenha um tâb (1).</p>
        <hr>
        <h4>Movimento</h4>
        <p>Para mover uma peça — não apenas a primeira —, se ela ainda não tiver sido movida antes, o jogador tem de obter um tâb. A partir daí essa peça fica «convertida» e pode mover-se em qualquer lançamento.</p>
        <p>Uma peça avança exactamente o número de casas indicado pelo lançamento. O traçado do tabuleiro indica as direcções permitidas.</p>
        <p>Uma peça só pode mover-se para a última linha uma vez, e só o pode fazer se não houver peças da mesma cor na primeira linha. Se isso acontecer, deves usar o botão "Skip turn" para passar a vez.</p>
        <hr>
        <h4>Captura</h4>
        <p>Se uma peça em movimento cair numa ou mais peças inimigas, essas peças inimigas são removidas do tabuleiro e vão para o lado do oponente.</p>
        <hr>
        <h4>Restrições</h4>
        <p>Nenhuma peça pode regressar à sua posição inicial depois de a ter abandonado.</p>
        <p></p>
        <hr>
        <h4>Fim do jogo</h4>
        <p>O jogo termina quando um jogador fica sem peças no tabuleiro; o outro jogador é o vencedor.</p> `,
    myBtnClassifications: 'Ver Classificações',
    // div id para modal-content dentro de classifications
    modalContentClassifications: `<h3>Classificações</h3>`,
    leaderboardTitle: "Classificações",
    sortbtn: "Ordenar: Decrescente",
    rank: "Posição",
    user: "Utilizador",
    games_played: "Jogos Jogados",
    games_won: "Jogos Ganhos",
    win_ratio: "Percentagem de Vitórias",
    player1: "Jogador 1",
    easyIA: "IA (Fácil)",
    normalIA: "IA (Normal)",
    hardIA: "IA (Difícil)",
    myBtnExtra: 'Mais sobre o Tâb',
    modalContentExtra: `<h3>História do Tâb</h3>
        <h4>Origens e Distribuição Geográfica</h4>
        <p>O Tâb é um antigo jogo de tabuleiro de luta e corrida que teve origem no Médio Oriente e já foi amplamente praticado em todo o mundo islâmico. Fontes históricas descrevem a sua disseminação da África Ocidental para o Irão, a leste, e da Turquia, a norte, até à ilha de Anjouan, a sul.</p>
        <p>Nesta vasta área desenvolveram-se inúmeras variantes locais: no Norte de África, o jogo era conhecido como sîg, enquanto na Somália se jogava uma forma relacionada chamada deleb. Todas estas versões partilhavam mecânicas semelhantes, envolvendo corridas e captura de peças ao longo de caminhos que se cruzavam.</p>
        <hr>
        <h4>Menções Mais Antigas e Pistas Linguísticas</h4>
        <p>A referência mais antiga conhecida ao Tâb surge num poema de 1310, que menciona al-tâb wa-l-dukk, referindo-se provavelmente a uma versão inicial do jogo. As origens exatas são incertas, mas as evidências linguísticas sugerem influências orientais.</p>
        <p>A palavra árabe tâb refere-se aos bastões de lançamento utilizados para determinar o movimento, enquanto seega (outro termo relacionado) denota o próprio tabuleiro. À medida que as rotas comerciais ligavam África, Arábia e Ásia, o jogo viajava com mercadores e peregrinos, chegando a leste até à Índia e a oeste até Trípoli.</p>
        <hr>
        <h4>Contexto Social e Relatos Históricos</h4>
        <p>O Tab era especialmente popular entre as classes mais pobres do Egipto, onde continuou a ser jogado até ao século XIX. O viajante inglês Edward William Lane registou descrições detalhadas das suas regras e do jogo na década de 1820, fazendo da sua obra um dos relatos mais completos do jogo que chegaram até nós.</p>
        <p>Após os escritos de Lane, estudiosos como Murray, Bell e Parlett ajudaram a reavivar o interesse pelo Tab durante o século XX. As evidências arqueológicas do Mediterrâneo Oriental também confirmaram o uso generalizado do jogo entre pessoas de todas as classes sociais, desde plebeus a comerciantes e viajantes.</p>
        h4>Jogabilidade e Simbolismo</h4>
        <p>Tâb é um jogo de guerra, tipicamente jogado num tabuleiro de três ou quatro filas. Pertence a uma família mais vasta de jogos de "luta em curso" — semelhantes ao Tablan indiano e ao Daldøs escandinavo — em que as peças de cada jogador correm pelo tabuleiro em direções opostas, capturando peças inimigas quando os caminhos se cruzam.</p>
        <p>Uma característica distintiva do Tâb é a sua mecânica de conversão. Quando um jogador lança um resultado especial conhecido como tâb (frequentemente equivalente a "1" nos dados modernos), uma das suas peças é convertida de cristã (não convertida) para muçulmana (convertida). Apenas as peças convertidas podem mover-se livremente e participar nas capturas.
        Esta regra reflete provavelmente o simbolismo cultural e religioso do jogo, fundindo uma jogabilidade estratégica com metáforas retiradas do mundo islâmico medieval.</p>
        <hr>
        <h4>Declínio e Redescoberta</h4>
        <p>No final do período medieval, o Tâb tinha-se espalhado por grande parte do mundo islâmico, tornando-se um dos jogos tradicionais mais reconhecidos da região. Entrou em declínio gradual durante o século XIX, embora os viajantes e os etnógrafos continuassem a documentá-lo.</p>
        <p>No século XX, os arqueólogos redescobriram tabuleiros e referências ao Tâb por todo o Mediterrâneo oriental, confirmando as suas profundas raízes históricas. A sua persistência durante séculos em todos os continentes faz dele um raro exemplo de um jogo de tabuleiro tradicional cujas regras, terminologia e significado simbólico sobreviveram praticamente intactos tanto pela tradição oral como pelos registos escritos.</p>`,
    configTitle: "Configuração",
    width1: "Largura",
    mode: "Modo",
    optionMode: "seleciona uma opção",
    optionIA: "seleciona uma opção",
    player: "vs Jogador",
    ia: "vs IA",
    lvl: "Escolha o nível de dificuldade",
    easy: "Fácil",
    normal: "Normal",
    hard: "Difícil",
    first_to_play: "Primeiro a jogar",
    playButton: "Iniciar Jogo",
    leaveButton: "Sair do Jogo",
    prompts: "Mensagens do Jogo",
    captured_one: "Suas peças",
    captured_two: "Peças do oponente",
    toggleMute: "Som: Ligado",
    throwDiceBtn: "Lançar dado",
    current: "Jogador atual",
    nextTurn: "Passar a vez",
    msg_game_started: "Jogo iniciado - Bom jogo!",
    msg_leave_game: "Jogador {player} desistiu.",
    msg_turn_of: "Agora é o turno do Jogador {player}.",
    msg_player_won: "O JOGADOR {player} GANHOU!",
    msg_dice_thrown_double: "Tens outro lançamento!",
    msg_dice: "Lança o dado!",
    msg_dice_thrown: "Dado lançado - valor: {value}.",
    msg_ai_dice: "IA lançou o dado - valor: {value}",
    msg_ai_no_moves_extra: "IA não tem movimentos possíveis - mas ganhou um novo lançamento.",
    msg_ai_no_moves_pass: "IA sem movimentos possíveis - passa a vez.",
    msg_ai_extra_roll: "IA ganhou mais um lançamento.",
    msg_capture: "Tens {n} captura(s) possível(is).",
    msg_player_can_move: "Podes mover uma peça.",
    msg_player_no_moves_extra: "Não há movimentos possíveis - mas ganhaste um novo lançamento.",
    msg_player_no_moves_pass: "Não há movimentos possíveis - passa a tua vez.",
    msg_dice_thrown_one: "Lançaste um Tâb! Podes converter uma peça.",
    red_pieces: "Peças vermelhas restantes: {count}",
    yellow_pieces: "Peças amarelas restantes: {count}",
    select_mode: "Seleciona o modo de jogo e, se for vs. IA, selecciona o nível de dificuldade antes de começares.",
    dice_auto_hint: "Lançamento automático...",
    dice_face_up: "CIMA",
    dice_face_down: "BAIXO",
    dice_label: "{name} - paus virados para cima: {up}",
    dice_countdown: "Fechando em {secs}s",
    dice_closing: "Fechando...",
    dice_name_0: "Sitteh",
    dice_name_1: "Tâb",
    dice_name_2: "Itneyn",
    dice_name_3: "Teláteh",
    dice_name_4: "Arba'ah",
    summary_title: "Resumo do jogo",
    summary_winner: "Vencedor",
    summary_duration: "Duração",
    summary_mode: "Modo",
    summary_mode_vs_player: "vs Jogador",
    summary_mode_vs_ai: "vs IA",
    summary_difficulty: "Dificuldade",
    summary_board_cols: "Tabuleiro (colunas)",
    summary_first_player: "Quem começou",
    summary_turns: "Turnos",
    summary_moves: "Jogadas",
    summary_captures: "Capturas",
    summary_passes: "Passes",
    summary_extra_rolls: "Lançamentos extra",
    summary_dice_distribution: "Distribuição dos dados",
    summary_no_winner: "Sem vencedor",
    summary_first_player_human: "Humano",
    summary_first_player_ai: "IA"
  },
  en: {
    title: 'Tâb Game',
    myBtnInstructions: 'See Instructions',
    // div id para modal-content dentro de instructions
    modalContentInstructions: `<h3>How to play Tâb</h3>
        <h4>Introduction</h4>
        <p>Tâb is a two player running-fight board game played across the Middle East and North Africa.</p>
        <p>It's played on a rectangular board of 4 rows and an odd number of columns (typically 7-15).</p>
        <p>The two players sit opposite each other; each begins with a full outer row of pieces.</p>
        <hr>
        <h4>Setup</h4>
        <p>Choose an odd number of columns in the configuration panel.</p>
        <p>Each player's pieces will initially be displayed on the first row (bottow row from the player's
          perspective).
        </p>
        <hr>
        <h4>Dice</h4>
        <p>The game dice used is a combination of 4 wooden sticks. Each stickhas a lighter (flat) side and a darker
          (rounded) side.</p>
        <p>A throw is scored by counting the number of lighter sides facing up. The move value mapping used is the
          following.</p>
        <ul>
          <li>0 lighter -> 6 (Sitteh) Probabilidade: 6%</li>
          <li>1 lighter -> 1 (Tâb) Probabilidade: 25%</li>
          <li>2 lighter -> 2 (Itneyn) Probabilidade: 38%</li>
          <li>3 lighter -> 3 (Teláteh) Probabilidade: 25%</li>
          <li>4 lighter -> 4 (Arba'ah) Probabilidade: 6%</li>
        </ul>
        <p>Throws of 1,4 and 6 grant the player an extra throw; 2 and 3 end the player's turn.</p>
        <hr>
        <h4>Beginning of the match</h4>
        <p>At the start of the match, neither player may move until someone throws a tâb (1). </p>
        <hr>
        <h4>Movement</h4>
        <p>To move a piece, not just the first one, if it wasn't moved before, the player needs to throw a tâb. After
          that, that piece is "converted" and can move with every throw.</p>
        <p>A piece moves forward the exact number of squares shown by the throw. The board's layout indicates the
          allowed directions</p>
        <p>A piece can only move once to the last row, and can only do so if there are no pieces (with the same
          color)
          on the first row. If that happens, you skip your turn on the button "Skip turn".</p>
        <hr>
        <h4>Capturing</h4>
        <p>If a moving piece lands on one or more enemy pieces, those enemy pieces are knocked off the board and
          goes
          to
          the oponent's side.</p>
        <hr>
        <h4>Restrictions</h4>
        <p>No piece may return to its original home once it has left it.</p>
        <p></p>
        <hr>
        <h4>End of game</h4>
        <p>The game ends when one player has no pieces left on the board; the other player is the winner.</p>`,
    myBtnClassifications: 'See Classifications',
    // div id para modal-content dentro de classifications
    modalContentClassifications: `<h3>Classifications</h3>`,
    leaderboardTitle: "Leaderboard",
    sortbtn: "Sort: Descending",
    rank: "Rank",
    user: "User",
    games_played: "Games Played",
    games_won: "Games Won",
    win_ratio: "Win Ratio",
    player1: "Player 1",
    easyIA: "AI (Easy)",
    normalIA: "AI (Normal)",
    hardIA: "AI (Hard)",
    myBtnExtra: 'More about Tâb',
    modalContentExtra: `<h3>Tâb's History</h3>
        <h4>Origins and Geographic Spread</h4>
        <p>Tâb is an ancient running-fight board game that originated in the Middle East and was once played widely
          across the Islamic world. Historical sources describe its spread from West Africa to Iran in the east, and
          from Turkey in the north to the island of Anjouan in the south.</p>
        <p>Across this vast area, numerous local variants developed: in North Africa the game was known as sîg, while
          in Somalia a related form called deleb was played. All these versions shared similar mechanics, involving
          racing and capturing pieces along intersecting paths.</p>
        <hr>
        <h4>Earliest Mentions and Linguistic Clues</h4>
        <p>The earliest known reference to Tâb appears in a poem from 1310, which mentions al-tâb wa-l-dukk, likely
          referring to an early version of the game. The exact origins are uncertain, but linguistic evidence suggests
          Eastern influences.</p>
        <p>The Arabic word tâb refers to the throwing sticks used to determine movement, while seega (another related
          term) denotes the board itself. As trade routes connected Africa, Arabia, and Asia, the game traveled with
          merchants and pilgrims, reaching as far east as India and as far west as Tripoli.</p>
        <hr>
        <h4>Social Context and Historical Accounts</h4>
        <p>Tâb was especially popular among the poorer classes of Egypt, where it continued to be played well into the
          19th century. The English traveler Edward William Lane recorded detailed descriptions of its rules and play
          in the 1820s, making his work one of the most complete surviving accounts of the game.</p>
        <p>Following Lane’s writings, scholars such as Murray, Bell, and Parlett helped to revive interest in Tâb
          during the 20th century. Archaeological evidence from the eastern Mediterranean also confirmed the game’s
          widespread use among people of all social classes, from commoners to merchants and travelers.</p>
        <hr>
        <h4>Gameplay and Symbolism</h4>
        <p>Tâb is a war game, typically played on a board of three or four rows. It belongs to a broader family of
          “running fight” games—similar to the Indian Tablan and Scandinavian Daldøs—in which each player’s pieces
          race around the board in opposite directions, capturing enemy pieces when paths intersect.</p>
        <p>A distinctive feature of Tâb is its conversion mechanic. When a player throws a special result known as a
          tâb (often equivalent to a “1” in modern dice), one of their pieces is converted from a Christian
          (unconverted) to a Muslim (converted). Only the converted pieces can move freely and participate in
          captures.
          This rule likely reflects the game’s cultural and religious symbolism, merging strategic gameplay with
          metaphors drawn from the medieval Islamic world.</p>
        <hr>
        <h4>Decline and Rediscovery</h4>
        <p>By the late medieval period, Tâb had spread across much of the Islamic world, becoming one of the most
          recognizable traditional games of the region. It gradually declined during the 19th century, though
          travelers and ethnographers continued to document it.</p>
        <p>In the 20th century, archaeologists rediscovered boards and references to Tâb throughout the eastern
          Mediterranean, confirming its deep historical roots. Its endurance for centuries across continents makes it
          a rare example of a traditional board game whose rules, terminology, and symbolic meaning have survived
          largely intact through both oral tradition and written record.</p>`,
    configTitle: "Configuration",
    width1: "Width",
    mode: "Mode",
    optionMode: "select an option",
    optionIA: "select an option",
    player: "vs Player",
    ia: "vs AI",
    lvl: "Choose a level of difficulty",
    easy: "Easy",
    normal: "Normal",
    hard: "Hard",
    first_to_play: "First to Play",
    playButton: "Start Game",
    leaveButton: "Leave Game",
    prompts: "Game Prompts",
    captured_one: "Your pieces",
    captured_two: "Oponnent's pieces",
    toggleMute: "Sound: On",
    throwDiceBtn: "Throw dice",
    current: "Current player: ",
    nextTurn: "Skip turn",
    msg_game_started: "Game started - Have fun!",
    msg_leave_game: "Player {player} gave up.",
    msg_turn_of: "It's Player {player}'s turn.",
    msg_player_won: "PLAYER {player} WINS!",
    msg_dice_thrown_double: "You get another throw!",
    msg_dice_thrown: "Dice thrown - value: {value}.",
    msg_dice: "Throw the dice!",
    msg_ai_dice: "AI rolled the dice - value: {value}",
    msg_ai_no_moves_extra: "AI has no possible moves - but earned a new throw.",
    msg_ai_no_moves_pass: "AI has no possible moves - skips turn.",
    msg_ai_extra_roll: "AI gets another throw.",
    msg_capture: "You have {n} capture(s) available.",
    msg_player_can_move: "You can move a piece.",
    msg_player_no_moves_extra: "You have no possible moves - but earned a new throw.",
    msg_player_no_moves_pass: "You have no possible moves - skip your turn.",
    msg_dice_thrown_one: "You rolled a Tâb! You can convert a piece.",
    red_pieces: "Red pieces remaining: {count}",
    yellow_pieces: "Yellow pieces remaining: {count}",
    select_mode: "Select the game mode and, if it's vs IA, select the difficulty level before you start.",
    dice_auto_hint: "Auto throwing...",
    dice_face_up: "UP",
    dice_face_down: "DOWN",
    dice_label: "{name} - sticks facing up: {up}",
    dice_countdown: "Closing in {secs}s",
    dice_closing: "Closing...",
    dice_name_0: "Sitteh",
    dice_name_1: "Tâb",
    dice_name_2: "Itneyn",
    dice_name_3: "Teláteh",
    dice_name_4: "Arba'ah",
    summary_title: "Game summary",
    summary_winner: "Winner",
    summary_duration: "Duration",
    summary_mode: "Mode",
    summary_mode_vs_player: "vs Player",
    summary_mode_vs_ai: "vs AI",
    summary_difficulty: "Difficulty",
    summary_board_cols: "Board (columns)",
    summary_first_player: "First to play",
    summary_turns: "Turns",
    summary_moves: "Moves",
    summary_captures: "Captures",
    summary_passes: "Passes",
    summary_extra_rolls: "Extra throws",
    summary_dice_distribution: "Dice distribution",
    summary_no_winner: "No winner",
    summary_first_player_human: "Human",
    summary_first_player_ai: "AI"

  }
};

// languageScript.js
document.addEventListener('DOMContentLoaded', () => {
  if (typeof i18n === 'undefined') {
    console.error('i18n não encontrado. Certifica-te que translations.js é carregado antes deste script.');
    return;
  }

  // keys que contêm HTML (usar innerHTML)
  const htmlKeys = ['modalContentInstructions', 'modalContentClassifications', 'modalContentExtra'];

  // keys de texto que queremos atualizar (conforme o teu i18n)
  const textKeys = [
    'title', 'myBtnInstructions', 'myBtnClassifications', 'myBtnExtra',
    'configTitle', 'width1', 'mode', 'lvl', 'easy', 'normal', 'hard', 'optionMode', 'optionIA', 'player', 'ia',
    'first_to_play', 'playButton', 'captured_one', 'captured_two',
    'toggleMute', 'throwDiceBtn', 'current', 'nextTurn', 'prompts', 'leaveButton'
  ];

  const setLang = (lang) => {
    window.currentLang = lang;
    if (!i18n[lang]) {
      console.warn('Língua não encontrada:', lang);
      return;
    }

    // 1) atualizar textos simples / labels / botões de forma segura
    textKeys.forEach(key => {
      const value = i18n[lang][key];
      if (value === undefined) return; // nada para esta key

      const el = document.getElementById(key);

      // se não existe elemento com esse id, tenta encontrar label[for="key"]
      // (útil quando preferes usar label[for] em vez de ids nos labels)
      const labelFor = document.querySelector(`label[for="${key}"]`);

      // Caso: element exists
      if (el) {
        const tag = el.tagName;

        // Não sobrescrever SELECTs diretamente (preserva options)
        if (tag === 'SELECT') {
          // tenta traduzir label associado (label[for="selectId"]) se existir
          if (labelFor) labelFor.textContent = value;
          else {
            // se o select tem id igual ao key mas o label tem id diferente (ex: label id="width"), tenta por id
            const labelById = document.getElementById(`${key}Label`) || document.getElementById(`${key}-label`);
            if (labelById) labelById.textContent = value;
          }
          return;
        }

        // Não sobrescrever INPUT/checkbox/textarea — actualiza label ou placeholder
        if (tag === 'INPUT' || tag === 'TEXTAREA') {
          // procura label que envolva o input (ex: <label><input> Text</label>)
          const wrappingLabel = el.closest('label');
          if (wrappingLabel) {
            // 1) remover nós de texto antigos (evita duplicação)
            Array.from(wrappingLabel.childNodes).forEach(node => {
              if (node.nodeType === Node.TEXT_NODE) node.remove();
            });

            // 2) criar/atualizar um único span para o texto da label
            let textSpan = wrappingLabel.querySelector('.i18n-label-text');
            if (!textSpan) {
              textSpan = document.createElement('span');
              textSpan.className = 'i18n-label-text';
              wrappingLabel.appendChild(textSpan);
            }
            // adiciona um espaço inicial para separar do input
            textSpan.textContent = ' ' + value;
            return;
          }
          // se houver label[for], atualiza
          if (labelFor) {
            labelFor.textContent = value;
            return;
          }
          // fallback: atualiza placeholder se existir
          if ('placeholder' in el) {
            el.placeholder = value;
          } else {
            // como último recurso, não sobrescrever o input value
            console.warn(`Não actualizei input #${key} por segurança; adiciona um label[for="${key}"] para traduzir.`);
          }
          return;
        }

        // Caso: elemento é container que contém o strong #currentPlayer (ex: div id="current")
        if (key === 'current') {
          // preserva elemento #currentPlayer
          const strong = el.querySelector('#currentPlayer');
          const strongHtml = strong ? strong.outerHTML : '';
          el.innerHTML = `${value} ${strongHtml}`; // ex: "Current player: <strong id='currentPlayer'>1</strong>"
          return;
        }

        // Caso: opções individuais com id (ex: <option id="easy">)
        if (tag === 'OPTION') {
          el.textContent = value;
          return;
        }

        // Caso geral: botões, headings, divs, spans -> texto simples
        el.textContent = value;
        return;
      }

      // Se não existe elemento com id=key, talvez exista uma label[for="key"]
      if (labelFor) {
        labelFor.textContent = value;
        return;
      }

      // Se não existe nem id nem label, procura por option com esse id (ex: options com id easy/hard)
      const opt = document.getElementById(key);
      if (opt && opt.tagName === 'OPTION') {
        opt.textContent = value;
        return;
      }

    // caso não encontrado: ignora silenciosamente (podes descomentar o log para debug)
    // console.log(`(i18n) elemento para "${key}" não encontrado no DOM.`);
    });

    // 2) actualizar blocos HTML (modais, conteúdos com tags)
    htmlKeys.forEach(key => {
      const value = i18n[lang][key];
      if (value === undefined) return;
      const el = document.getElementById(key);
      if (!el) {
        // console.log(`(i18n) bloco HTML #${key} não encontrado.`);
        return;
      }
      el.innerHTML = value;
    });

    // 3) traduzir opções específicas (caso tenhas <option id="easy"> etc.)
    ['easy', 'normal', 'hard', 'player', 'ia', 'optionMode', 'optionIA'].forEach(optId => {
      const text = i18n[lang][optId];
      if (text === undefined) return;
      const optEl = document.getElementById(optId);
      if (optEl && optEl.tagName === 'OPTION') optEl.textContent = text;
    });

    // acessibilidade / SEO hint
    document.documentElement.lang = (lang === 'pt' ? 'pt-PT' : 'en');

    // guarda escolha
    localStorage.setItem('siteLang', lang);

    if (window.__refreshChat) window.__refreshChat();
    if (window.__refreshDice) window.__refreshDice();
    if (window.__refreshCaptured) window.__refreshCaptured();

  };

// listeners com guard (se os elementos não existirem, nada falha)
const elPt = document.getElementById('langPT');
const elEn = document.getElementById('langEN');
if (elPt) elPt.addEventListener('click', (e) => { e.preventDefault(); setLang('pt'); });
if (elEn) elEn.addEventListener('click', (e) => { e.preventDefault(); setLang('en'); });

// inicializar (fallback para en conforme preferes)
setLang(localStorage.getItem('siteLang') || 'en');

  // debug helper (descomenta se precisares)
  // window.__i18n = i18n;
  // console.log('i18n pronto. keys:', Object.keys(i18n));
});
