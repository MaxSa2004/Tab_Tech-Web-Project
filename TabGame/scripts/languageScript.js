window.currentLang = window.currentLang || 'pt'; // the window object is global and supported in all browsers; currentLang keeps track of the selected language and defaults to 'pt' (Portuguese) if not already set
const i18n = { // internationalization
  pt: { // list of id:text pairs for Portuguese
    title: 'Jogo Tâb',
    // buttons and modals
    // instructions
    myBtnInstructions: 'Ver Instruções',
    modalContentInstructions: `<h3>Como jogar Tâb</h3>
        <h4>Introdução</h4>
        <p>O Tâb é um jogo de tabuleiro para dois jogadores, de luta em corrida, jogado no Médio Oriente e Norte de África.</p>
        <p>Joga-se num tabuleiro rectangular de 4 linhas e um número ímpar de colunas (normalmente 7-15).</p>
        <p>Os dois jogadores sentam-se frente a frente; cada um começa com uma fila externa completa de peças.</p>
        <hr>
        <h4>Preparação</h4>
        <p>Escolhe um número ímpar de colunas no painel de configuração.</p>
        <p>As peças de cada jogador serão inicialmente exibidas na primeira linha (linha inferior do ponto de vista do jogador).</p>
        <hr>
        <h4>Dados</h4>
        <p>O "dado" do jogo é uma combinação de 4 paus de madeira. Cada pau tem um lado mais claro (plano) e um lado mais escuro (arredondado).</p>
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
        <p>Para mover uma peça - não apenas a primeira —, se ela ainda não tiver sido movida antes, o jogador tem de obter um tâb. A partir daí essa peça fica "convertida" e pode mover-se em qualquer lançamento.</p>
        <p>Uma peça avança exactamente o número de casas indicado pelo lançamento. O traçado do tabuleiro indica as direções permitidas.</p>
        <p>Uma peça só pode mover-se para a última linha uma vez, e só o pode fazer se não houver peças da mesma cor na primeira linha. Se isso acontecer, deves usar o botão "Skip turn" para passar a vez.</p>
        <hr>
        <h4>Captura</h4>
        <p>Se uma peça em movimento cair numa ou mais peças inimigas, essas peças inimigas são removidas do tabuleiro e vão para o lado do oponente.</p>
        <hr>
        <h4>Restrições</h4>
        <p>Nenhuma peça pode regressar à sua posição inicial depois de a ter abandonado nem à quarta fila se a peça já lá tiver entrado uma vez. Uma peça só pode entrar na quarta fila se o jogador não tiver nehuma peça dele na primeira fila.</p>
        <p></p>
        <hr>
        <h4>Fim do jogo</h4>
        <p>O jogo termina quando um jogador fica sem peças no tabuleiro; o outro jogador é o vencedor.</p> `,
    // classifications
    myBtnClassifications: 'Ver Classificações',
    modalContentClassifications: `<h3>Classificações</h3>`,
    leaderboardTitle: "Classificações",
    rank: "Posição",
    user1: "Utilizador",
    games_played: "Jogos Jogados",
    games_won: "Jogos Ganhos",
    win_ratio: "Percentagem de Vitórias",
    player1: "Jogador 1",
    easyIA: "IA (Fácil)",
    normalIA: "IA (Normal)",
    hardIA: "IA (Difícil)",
    leaderSearch: "Procurar utilizador...",
    // extra information
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
        <h4>Jogabilidade e Simbolismo</h4>
        <p>Tâb é um jogo de guerra, tipicamente jogado num tabuleiro de três ou quatro filas. Pertence a uma família mais vasta de jogos de "luta em curso" - semelhantes ao Tablan indiano e ao Daldøs escandinavo — em que as peças de cada jogador correm pelo tabuleiro em direções opostas, capturando peças inimigas quando os caminhos se cruzam.</p>
        <p>Uma característica distintiva do Tâb é a sua mecânica de conversão. Quando um jogador lança um resultado especial conhecido como tâb (frequentemente equivalente a "1" nos dados modernos), uma das suas peças é convertida de cristã (não convertida) para muçulmana (convertida). Apenas as peças convertidas podem mover-se livremente e participar nas capturas.
        Esta regra reflete provavelmente o simbolismo cultural e religioso do jogo, fundindo uma jogabilidade estratégica com metáforas retiradas do mundo islâmico medieval.</p>
        <hr>
        <h4>Declínio e Redescoberta</h4>
        <p>No final do período medieval, o Tâb tinha-se espalhado por grande parte do mundo islâmico, tornando-se um dos jogos tradicionais mais reconhecidos da região. Entrou em declínio gradual durante o século XIX, embora os viajantes e os etnógrafos continuassem a documentá-lo.</p>
        <p>No século XX, os arqueólogos redescobriram tabuleiros e referências ao Tâb por todo o Mediterrâneo oriental, confirmando as suas profundas raízes históricas. A sua persistência durante séculos em todos os continentes faz dele um raro exemplo de um jogo de tabuleiro tradicional cujas regras, terminologia e significado simbólico sobreviveram praticamente intactos tanto pela tradição oral como pelos registos escritos.</p>`,
    // configuration of board and game 
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
    // game  texts and  prompts
    prompts: "Mensagens do Jogo",
    captured_one: "Suas peças",
    captured_two: "Peças do oponente",
    toggleMute: "Som: Ligado",
    throwDiceBtn: "Lançar dado", // button to throw the dice
    current: "Jogador atual",
    nextTurn: "Passar a vez", // button to skip turn
    msg_game_started: "Jogo iniciado - Bom jogo!",
    msg_paired: "Oponente encontrado: {opponent}",
    msg_leave_game: "Jogador {player} desistiu.",
    msg_turn_of: "Agora é o turno do Jogador {player}.",
    msg_turn: "É a tua vez de jogar.",
    msg_player_won: "O JOGADOR {player} GANHOU!",
    msg_you_won: "VOCÊ GANHOU!",
    msg_you_lost: "VOCÊ PERDEU!",
    msg_drawn: "Jogo empatado!",
    msg_dice_thrown_double: "Tens outro lançamento!",
    msg_dice: "Lança o dado!",
    msg_dice_thrown: "Dado lançado - valor: {value}.",
    msg_ai_dice: "IA lançou o dado - valor: {value}",
    msg_ai_no_moves_extra: "IA não tem movimentos possíveis - mas ganhou um novo lançamento.",
    msg_ai_no_moves_pass: "IA sem movimentos possíveis - passa a vez.",
    msg_ai_extra_roll: "IA ganhou mais um lançamento.",
    msg_op_roll: "O oponente lançou o dado - valor: {value}",
    msg_capture: "Tens {n} captura(s) possível(is).",
    msg_player_can_move: "Podes mover uma peça.",
    msg_player_no_moves_extra: "Não há movimentos possíveis - mas ganhaste um novo lançamento.",
    msg_player_no_moves_pass: "Não há movimentos possíveis - passa a tua vez.",
    msg_dice_thrown_one: "Lançaste um Tâb! Podes converter uma peça.",
    red_pieces: "Peças vermelhas restantes: {count}",
    yellow_pieces: "Peças amarelas restantes: {count}",
    select_mode: "Seleciona o modo de jogo e, se for vs. IA, selecciona o nível de dificuldade antes de começares.",
    choose_destination: "Escolhe a casa de destino para a peça selecionada.",
    // pouch and dice texts
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
    // statistics and game summary
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
    summary_first_player_ai: "IA",
    // leaderboard sort
    leader_sort_desc: "Ordenar: Descendente",
    leader_sort_asc: "Ordenar: Ascendente",
    msg_roll_first: "Não podes mover uma peça sem lançar o dado.",
    msg_waiting_opponent: "A aguardar por um oponente...",
    msg_no_valid_moves: "Essa peça não tem movimentos válidos.",
    msg_base_pieces: "Movimento Inválido: Ainda tens peças na base!",
    msg_capture_you_own: "Não podes mover para cima de uma peça tua.",
    msg_hold: "Aguarda pela tua vez.",
    legend_p1: "Jogador 1",
    legend_p2: "Jogador 2",
    legend_move: "Mover",
    legend_capture: "Capturar"
  },
  en: { // list of id:text pairs for English
    title: 'Tâb Game',
    // buttons and modals
    // instructions
    myBtnInstructions: 'See Instructions',
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
        <p>No piece may return to its original home once it has left it, nor the fourth row if it has entered it once already. A piece can only enter the fourth row if there are no pieces on the player's original/first row.</p>
        <p></p>
        <hr>
        <h4>End of game</h4>
        <p>The game ends when one player has no pieces left on the board; the other player is the winner.</p>`,
    // classifications    
    myBtnClassifications: 'See Classifications',
    modalContentClassifications: `<h3>Classifications</h3>`,
    leaderboardTitle: "Leaderboard",
    rank: "Rank",
    user1: "User",
    games_played: "Games Played",
    games_won: "Games Won",
    win_ratio: "Win Ratio",
    player1: "Player 1",
    easyIA: "AI (Easy)",
    normalIA: "AI (Normal)",
    hardIA: "AI (Hard)",
    leaderSearch: "Search user...",
    // extra information
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
        <p>Following Lane's writings, scholars such as Murray, Bell, and Parlett helped to revive interest in Tâb
          during the 20th century. Archaeological evidence from the eastern Mediterranean also confirmed the game's
          widespread use among people of all social classes, from commoners to merchants and travelers.</p>
        <hr>
        <h4>Gameplay and Symbolism</h4>
        <p>Tâb is a war game, typically played on a board of three or four rows. It belongs to a broader family of
          "running fight" games-similar to the Indian Tablan and Scandinavian Daldøs-in which each player's pieces
          race around the board in opposite directions, capturing enemy pieces when paths intersect.</p>
        <p>A distinctive feature of Tâb is its conversion mechanic. When a player throws a special result known as a
          tâb (often equivalent to a "1" in modern dice), one of their pieces is converted from a Christian
          (unconverted) to a Muslim (converted). Only the converted pieces can move freely and participate in
          captures.
          This rule likely reflects the game's cultural and religious symbolism, merging strategic gameplay with
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
    // configuration of board and game
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
    // game texts and  prompts
    prompts: "Game Prompts",
    captured_one: "Your pieces",
    captured_two: "Oponnent's pieces",
    toggleMute: "Sound: On",
    throwDiceBtn: "Throw dice", // button to throw the dice
    current: "Current player: ",
    nextTurn: "Skip turn",  // button to skip turn
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
    // pouch and dice texts
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
    // statistics and game summary
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
    summary_first_player_ai: "AI",
    // leaderboard sort
    leader_sort_desc: "Sort: Descending",
    leader_sort_asc: "Sort: Ascending",
    msg_roll_first: "You can't move a piece without rolling the dice.",
    msg_waiting_opponent: "Waiting for an opponent...",
    msg_no_valid_moves: "That piece has no valid moves.",
    msg_base_pieces: "Invalid Move: You still have pieces in the base!",
    msg_capture_you_own: "You can't move onto one of your own pieces.",
    msg_paired: "Oponent found: {opponent}",
    msg_drawn: "Game drawn!",
    msg_turn: "It's your turn to play.",
    msg_you_won: "YOU WON!",
    msg_you_lost: "YOU LOST!",
    msg_choose_destination: "Choose the destination square for the selected piece.",
    msg_turn: "It's your turn to play.",
    msg_op_roll: "The oponent rolled the dice - value: {value}",
    msg_hold: "Wait for your turn.",
    msg_no_valid_moves: "That piece has no valid moves.",
    legend_p1: "Player 1",
    legend_p2: "Player 2",
    legend_move: "Move",
    legend_capture: "Capture"
  }
};

// function to set the language based on user selection
document.addEventListener('DOMContentLoaded', () => { // the DOMContentLoaded event fires when the initial HTML document has been completely loaded and parsed, without waiting for stylesheets, images, and subframes to finish loading
  if (typeof i18n === 'undefined') { // check if i18n is defined
    console.error('i18n não encontrado. Certifica-te que translations.js é carregado antes deste script.');
    return;
  }

  // keys that contain HTML content to update
  const htmlKeys = ['modalContentInstructions', 'modalContentClassifications', 'modalContentExtra'];

  // keys that contain simple text content to update
  const textKeys = [
    'title', 'myBtnInstructions', 'myBtnClassifications', 'myBtnExtra',
    'configTitle', 'width1', 'mode', 'lvl', 'easy', 'normal', 'hard', 'optionMode', 'optionIA', 'player', 'ia',
    'first_to_play', 'playButton', 'captured_one', 'captured_two',
    'toggleMute', 'throwDiceBtn', 'current', 'nextTurn', 'prompts', 'leaveButton'
  ];
  // function to set the language
  const setLang = (lang) => {
    window.currentLang = lang; // update the global currentLang variable
    if (!i18n[lang]) { // check if the selected language exists in the i18n object
      console.warn('Língua não encontrada:', lang);
      return;
    }

    // 1) updates simple text elements
    textKeys.forEach(key => {
      const value = i18n[lang][key]; // get the translation for the key
      if (value === undefined) return; // skip if no translation available

      const el = document.getElementById(key); // try to find element by id=key

      // if it doesn't exist by id, try to find label[for=key], which is common for inputs
      const labelFor = document.querySelector(`label[for="${key}"]`);

      // if element el exists by id
      if (el) {
        const tag = el.tagName;
        // if element is SELECT, update associated label
        if (tag === 'SELECT') {
          // first try label[for=key]
          if (labelFor) labelFor.textContent = value;
          else {
            // fallback: try label by id (#keyLabel or #key-label)
            const labelById = document.getElementById(`${key}Label`) || document.getElementById(`${key}-label`);
            if (labelById) labelById.textContent = value;
          }
          return;
        }

        // if element is INPUT or TEXTAREA, update associated label or placeholder (specifies a short hint that describes the expected value of an input field)
        if (tag === 'INPUT' || tag === 'TEXTAREA') {
          // searches for wrapping label
          const wrappingLabel = el.closest('label');
          if (wrappingLabel) {
            // 1) removes existent text nodes (keeps other elements, e.g., spans/icons)
            Array.from(wrappingLabel.childNodes).forEach(node => {
              if (node.nodeType === Node.TEXT_NODE) node.remove();
            });

            // 2) creates/updates span.i18n-label-text (to keep styling/icons intact)
            let textSpan = wrappingLabel.querySelector('.i18n-label-text');
            if (!textSpan) {
              textSpan = document.createElement('span');
              textSpan.className = 'i18n-label-text';
              wrappingLabel.appendChild(textSpan);
            }
            // updates text
            textSpan.textContent = ' ' + value;
            return;
          }
          // if no wrapping label, tries label[for=key]
          if (labelFor) {
            labelFor.textContent = value;
            return;
          }
          // fallback: updates placeholder (if exists)
          if ('placeholder' in el) {
            el.placeholder = value;
          } else {
            // last resource: does not update for security reasons (to avoid misleading labels)
            console.warn(`Não actualizei input #${key} por segurança; adiciona um label[for="${key}"] para traduzir.`);
          }
          return;
        }

        // in case the key is 'current' (current player display)
        if (key === 'current') {
          // preserves element <strong id="currentPlayer">X</strong> inside the text
          const strong = el.querySelector('#currentPlayer');
          const strongHtml = strong ? strong.outerHTML : '';
          el.innerHTML = `${value} ${strongHtml}`; // ex: "Current player: <strong id='currentPlayer'>1</strong>"
          return;
        }

        // in case the element is OPTION, the value goes to textContent (the value is the translated text, and the textContent is what is shown to the user, so it's like we substitute the text by the translated one)
        if (tag === 'OPTION') {
          el.textContent = value;
          return;
        }

        // in general, updates textContent, just like in OPTION case
        el.textContent = value;
        return;
      }

      // if element not found by id, but found label[for=key]
      if (labelFor) {
        labelFor.textContent = value;
        return;
      }

      // else look for option by id (for cases like <option id="easy"> etc.)
      const opt = document.getElementById(key);
      if (opt && opt.tagName === 'OPTION') {
        opt.textContent = value;
        return;
      }

      // if not found, skip

    });

    // 2) update html blocks, like modals
    htmlKeys.forEach(key => {
      const value = i18n[lang][key]; // get the translation for the key
      if (value === undefined) return; // skip if no translation available
      const el = document.getElementById(key); // try to find element by id=key
      if (!el) {
        // if not found, skip
        return;
      }
      el.innerHTML = value; // update innerHTML with the translated content
    });

    // 3) translate specific options in selects (by id)
    ['easy', 'normal', 'hard', 'player', 'ia', 'optionMode', 'optionIA'].forEach(optId => {
      const text = i18n[lang][optId]; // get the translation for the option
      if (text === undefined) return; // skip if no translation available
      const optEl = document.getElementById(optId); // try to find option element by id
      if (optEl && optEl.tagName === 'OPTION') optEl.textContent = text; // update textContent if it's an OPTION
    });

    // update document language attribute (for accessibility)
    document.documentElement.lang = (lang === 'pt' ? 'pt-PT' : 'en');

    // saves choice in localStorage
    localStorage.setItem('siteLang', lang);

    if (window.__refreshChat) window.__refreshChat(); // custom function to refresh chat texts
    if (window.__refreshDice) window.__refreshDice(); // custom function to refresh dice texts
    if (window.__refreshCaptured) window.__refreshCaptured(); // custom function to refresh captured pieces texts
    if (window.__refreshLeaderboard) window.__refreshLeaderboard(); // custom function to refresh leaderboard texts

  };

  // attach event listeners to language switch buttons/links -> set the language on click
  const elPt = document.getElementById('langPT'); // get the Portuguese language button/link by its id
  const elEn = document.getElementById('langEN'); // get the English language button/link by its id
  if (elPt) elPt.addEventListener('click', (e) => { e.preventDefault(); setLang('pt'); }); // if we click on the Portuguese language button/link, set language to 'pt'
  if (elEn) elEn.addEventListener('click', (e) => { e.preventDefault(); setLang('en'); }); // if we click on the English language button/link, set language to 'en'

  // initialization on page load: set language from localStorage or default to 'en'
  setLang(localStorage.getItem('siteLang') || 'en');

});
