const i18n = {
    pt: { 
        title: 'Tâb Game', // h1 do header
        myBtnInstructions: 'Ver Instruções',
        // div id para modal-content dentro de instructions
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
        modalContentClassifications: `<h3>Classifications</h3>
        <p>Table with rank, user and number of wins (IA included)</p>`,
        myBtnExtra: 'Mais sobre o Tâb',
        modalContentExtra: `<h3>Tâb's History</h3>
        <h4>Origins and Geographic Spread</h4>
        <p>Tâb is an ancient running-fight board game that originated in the Middle East and was once played widely across the Islamic world. Historical sources describe its spread from West Africa to Iran in the east, and from Turkey in the north to the island of Anjouan in the south.</p>
        <p>Across this vast area, numerous local variants developed: in North Africa the game was known as sîg, while in Somalia a related form called deleb was played. All these versions shared similar mechanics, involving racing and capturing pieces along intersecting paths.</p>
        <p><img src="images/board.gif" alt="tâb board" style="display: block; margin: 0 auto;"></p>
        <hr>
        <h4>Earliest Mentions and Linguistic Clues</h4>
        <p>The earliest known reference to Tâb appears in a poem from 1310, which mentions al-tâb wa-l-dukk, likely referring to an early version of the game. The exact origins are uncertain, but linguistic evidence suggests Eastern influences.</p>
        <p>The Arabic word tâb refers to the throwing sticks used to determine movement, while seega (another related term) denotes the board itself. As trade routes connected Africa, Arabia, and Asia, the game traveled with merchants and pilgrims, reaching as far east as India and as far west as Tripoli.</p>
        <hr>
        <h4>Social Context and Historical Accounts</h4>
        <p>Tâb was especially popular among the poorer classes of Egypt, where it continued to be played well into the 19th century. The English traveler Edward William Lane recorded detailed descriptions of its rules and play in the 1820s, making his work one of the most complete surviving accounts of the game.</p>
        <p>Following Lane’s writings, scholars such as Murray, Bell, and Parlett helped to revive interest in Tâb during the 20th century. Archaeological evidence from the eastern Mediterranean also confirmed the game’s widespread use among people of all social classes, from commoners to merchants and travelers.</p>
        <hr>
        <h4>Gameplay and Symbolism</h4>
        <p>Tâb is a war game, typically played on a board of three or four rows. It belongs to a broader family of “running fight” games—similar to the Indian Tablan and Scandinavian Daldøs—in which each player’s pieces race around the board in opposite directions, capturing enemy pieces when paths intersect.</p>
        <p>A distinctive feature of Tâb is its conversion mechanic. When a player throws a special result known as a tâb (often equivalent to a “1” in modern dice), one of their pieces is converted from a Christian (unconverted) to a Muslim (converted). Only the converted pieces can move freely and participate in captures.
          This rule likely reflects the game’s cultural and religious symbolism, merging strategic gameplay with metaphors drawn from the medieval Islamic world.</p>
        <hr>
        <h4>Decline and Rediscovery</h4>
        <p>By the late medieval period, Tâb had spread across much of the Islamic world, becoming one of the most recognizable traditional games of the region. It gradually declined during the 19th century, though travelers and ethnographers continued to document it.</p>
        <p>In the 20th century, archaeologists rediscovered boards and references to Tâb throughout the eastern Mediterranean, confirming its deep historical roots. Its endurance for centuries across continents makes it a rare example of a traditional board game whose rules, terminology, and symbolic meaning have survived largely intact through both oral tradition and written record.</p>`


 },
    en: { title: 'Hello, welcome!' 
}
  };

  const setLang = (lang) => {
    document.getElementById('title').textContent = i18n[lang].title;
    document.documentElement.lang = lang; // acessibilidade / SEO hint
    localStorage.setItem('siteLang', lang);
  };

  document.getElementById('langPT').addEventListener('click', (e) => { e.preventDefault(); setLang('pt'); });
  document.getElementById('langEN').addEventListener('click', (e) => { e.preventDefault(); setLang('en'); });

  setLang(localStorage.getItem('siteLang') || 'pt');