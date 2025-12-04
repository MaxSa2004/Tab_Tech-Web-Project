window.Game = (function () {
    const Game = {
        init() {
            GameState.init();
            GameUI.init(GameState);
            Messages.init(GameState);
            Dice.init(GameState, Messages);
            if (typeof GameUI.updatePlayLeaveButtons === 'function') {
                GameUI.updatePlayLeaveButtons();
            }

            // initial board render
            const initialCols = GameState.getCols();
            GameUI.renderBoard(initialCols);

            // wire mode selection and play/leave/throw/pass buttons

            GameUI.onPlay(async ({ mode, aiLevel, humanFirst }) => {
                if (mode === 'player') {
                    PVPController.init(GameState, GameUI, Messages, Dice, Network);
                } else { // AI mode
                    AIController.init(GameState, GameUI, Messages, Dice, aiLevel, humanFirst);
                }
            });
            GameUI.onLeave(() => {
                // 1. Calcular quem ganha por desistência (Forfeit)
                let winnerNum = null;

                if (GameState.vsAI) {
                    // Se for contra IA, a IA ganha (se eu for P1, AI é P2, e vice-versa)
                    winnerNum = GameState.aiPlayerNum || 2;
                } else {
                    // Se for PvP, ganha o jogador oposto ao meu
                    winnerNum = (GameState.humanPlayerNum === 1) ? 2 : 1;
                }

                // 2. Registar vitória e MOSTRAR A JANELA
                try {
                    TabStats.setWinner(winnerNum);
                    TabStats.showSummary(); // <--- É isto que faz aparecer a janela!
                } catch (e) {
                    console.warn("Erro ao mostrar stats:", e);
                }

                // 3. Limpar o estado do jogo (Reset)
                GameState.leaveGame();
                GameUI.renderBoard(GameState.getCols());
                Messages.system('msg_leave_game', { player: GameState.currentPlayer });

            });
            GameUI.onThrow(async () => {
                if (GameState.vsPlayer) {
                    PVPController.onThrow();
                } else {
                    const result = await Dice.spawnAndLaunch();
                    Rules.processDiceResult(GameState, GameUI, Messages, result);
                }
            });
            GameUI.onPass(() => {
                if (GameState.vsPlayer) {
                    PVPController.onPass();
                    try { TabStats.onPass(GameState.currentPlayer) } catch { };
                } else {
                    GameState.nextTurn();
                    try { TabStats.onPass(GameState.currentPlayer) } catch (e) { console.warn("Erro em TabStats.onPass:", e); }
                }
            });
            // board interactions
            GameUI.onCellClick((r, c, cell) => {
                if (GameState.vsPlayer) {
                    PVPController.onCellClick(r, c, cell);
                } else {
                    AIController.onCellClick(cell);
                }
            });
            // width/size change
            GameUI.onWidthChange((cols) => {
                GameState.setCols(cols);
                GameUI.renderBoard(cols);
            });
            Messages.system('select_mode');
        }
    };
    return Game;
})();

document.addEventListener('DOMContentLoaded', () => {
    Game.init();
});