// Inicializar (ao carregar a página)
let wins = parseInt(localStorage.getItem('wins') || '0', 10);

// Quando ganhas:
wins += 1;
localStorage.setItem('wins', String(wins));

// Ler para mostrar na UI
document.getElementById('wins-count').textContent = wins;

// Inicializar objecto
const defaultStats = { wins: 0, losses: 0, draws: 0 };
const stats = JSON.parse(localStorage.getItem('gameStats') || JSON.stringify(defaultStats));

// Atualizar
stats.wins += 1;
localStorage.setItem('gameStats', JSON.stringify(stats));

// Exportar (download ficheiro JSON)
function downloadStats() {
    const stats = localStorage.getItem('gameStats') || '{}';
    const blob = new Blob([stats], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'game-stats.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  
  // Importar (upload ficheiro JSON)
  async function uploadStats(file) {
    const text = await file.text();
    try {
      const obj = JSON.parse(text);
      localStorage.setItem('gameStats', JSON.stringify(obj));
      // atualizar UI...
    } catch (e) {
      alert('Ficheiro JSON inválido');
    }
  }
  