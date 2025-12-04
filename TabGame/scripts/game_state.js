window.GameState = (function () {
    // Definimos o objeto diretamente. Não há separação entre "state" e "export".
    // Usamos 'this' para referir as propriedades dentro das funções.
    const GameState = {
        rows: 4,
        cols: 9,
        
        // --- Estado do Jogo (Propriedades Públicas) ---
        currentPlayer: 1,
        gameActive: false,
        vsAI: false,
        vsPlayer: false,
        aiDifficulty: 'normal',
        aiPlayerNum: null,
        humanPlayerNum: 1,
        waitingForPair: false,

        currentServerStep: null,
        serverDiceValue: null,
        serverTurnNick: null,
        serverMustPass: false,

        redPieces: 0,
        yellowPieces: 0,
        selectedPiece: null,
        lastDiceValue: null,

        elements: {
            widthSelect: null,
            gameBoard: null,
            messagesEl: null,
            currentPlayerEl: null,
            nextTurnBtn: null,
            throwBtn: null,
            playButton: null,
            leaveButton: null,
            authForm: null,
            capturedP1: null,
            capturedP2: null,
            modeSelect: null,
            iaLevelSelect: null,
            firstToPlayCheckbox: null,
        },

        // --- Funções / Métodos ---

        init: function() {
            // Agora usamos 'this.elements'
            this.elements.widthSelect = document.getElementById('width');
            this.elements.gameBoard = document.getElementById('gameBoard');
            this.elements.messagesEl = document.getElementById('messages');
            this.elements.currentPlayerEl = document.getElementById('currentPlayer');
            this.elements.nextTurnBtn = document.getElementById('nextTurn');
            this.elements.throwBtn = document.getElementById('throwDiceBtn');
            this.elements.playButton = document.getElementById('playButton');
            this.elements.leaveButton = document.getElementById('leaveButton');
            this.elements.authForm = document.querySelector('.authForm');
            this.elements.capturedP1 = document.getElementById('capturedP1');
            this.elements.capturedP2 = document.getElementById('capturedP2');
            this.elements.modeSelect = document.getElementById('game_mode');
            this.elements.iaLevelSelect = document.getElementById('ia_lvl');
            this.elements.firstToPlayCheckbox = document.getElementById('first_to_play');
        },

        getColorForPlayerNum: function(n) {
            return n === 1 ? 'red' : 'yellow';
        },

        isHumanTurn: function() {
            return this.currentPlayer === this.humanPlayerNum;
        },

        getCols: function() {
            return this.cols;
        },

        setCols: function(v) {
            this.cols = parseInt(v, 10) || this.cols;
        },

        setConfigEnabled: function(enabled) {
            const {
                widthSelect,
                modeSelect,
                iaLevelSelect,
                firstToPlayCheckbox
            } = this.elements;

            if (widthSelect) widthSelect.disabled = !enabled;
            if (modeSelect) modeSelect.disabled = !enabled;
            if (iaLevelSelect) iaLevelSelect.disabled = !enabled;
            if (firstToPlayCheckbox) firstToPlayCheckbox.disabled = !enabled;
            
            // Lógica extra para quando mudamos para modo Jogador
            if (modeSelect && modeSelect.value === 'player') {
                if (iaLevelSelect) iaLevelSelect.disabled = true;
                if (firstToPlayCheckbox) firstToPlayCheckbox.disabled = true;
            }
        },

        nextTurn: function() {
            this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
            const { currentPlayerEl } = this.elements;
            
            if (currentPlayerEl) {
                currentPlayerEl.textContent = this.currentPlayer;
            }
            try {
                TabStats.onTurnAdvance();
            } catch (e) { /* ignore */ }
            
            Messages.system('msg_turn_of', { player: this.currentPlayer });
            
            // Nota: GameUI é global, pode ser chamado aqui
            GameUI.flipBoard(); 

            if (this.vsAI && this.currentPlayer === this.aiPlayerNum) {
                setTimeout(() => {
                    AIController.runAiTurnLoop();
                }, 200);
            } else {
                const { throwBtn } = this.elements;
                if (this.isHumanTurn() && throwBtn && !throwBtn.disabled) {
                    Messages.system('msg_dice');
                }
            }
        },

        setGameActive: function(active) {
            this.gameActive = active; // Atualiza a propriedade "verdadeira"
            this.setConfigEnabled(!active);
        },

        leaveGame: function() {
            const {
                capturedP1, capturedP2, nextTurnBtn, throwBtn, leaveButton, playButton
            } = this.elements;

            this.gameActive = false;
            this.currentPlayer = 1;
            this.selectedPiece = null;
            this.lastDiceValue = null;
            this.aiPlayerNum = null;
            this.humanPlayerNum = 1;
            this.vsAI = false;
            this.vsPlayer = false;
            this.redPieces = 0;
            this.yellowPieces = 0;

            if (capturedP1) capturedP1.textContent = '';
            if (capturedP2) capturedP2.textContent = '';
            if (nextTurnBtn) nextTurnBtn.disabled = true;
            if (throwBtn) throwBtn.disabled = true;

            this.setConfigEnabled(true);
            
            if (leaveButton) leaveButton.disabled = true;
            if (playButton) playButton.disabled = !Rules.isConfigValid(this.elements);
        }
    };

    return GameState;
})();