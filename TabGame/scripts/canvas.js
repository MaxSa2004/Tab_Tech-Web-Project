/* scripts/confetti.js */
window.TabConfetti = (function () {
  let canvas, ctx, width, height;
  let particles = [];
  let animationId = null;
  let active = false;

  function init() {
    canvas = document.getElementById('confettiCanvas');
    if (!canvas) return false;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    return true;
  }

  function resize() {
    if (!canvas) return;
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  // Particle Class
  function Particle() {
    this.x = Math.random() * width;
    this.y = Math.random() * height - height; // start above screen
    this.size = Math.random() * 10 + 5;
    this.speedY = Math.random() * 3 + 2;
    this.speedX = Math.random() * 2 - 1;
    this.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = Math.random() * 10 - 5;
  }

  Particle.prototype.update = function () {
    this.y += this.speedY;
    this.x += this.speedX;
    this.rotation += this.rotationSpeed;

    // Reset if it goes below screen
    if (this.y > height) {
      this.y = -20;
      this.x = Math.random() * width;
    }
  };

  Particle.prototype.draw = function () {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
    ctx.restore();
  };

  function loop() {
    if (!active) return;
    ctx.clearRect(0, 0, width, height);
    
    particles.forEach(p => {
      p.update();
      p.draw();
    });

    animationId = requestAnimationFrame(loop);
  }

  function start() {
    if (!canvas && !init()) return;
    
    active = true;
    canvas.style.display = 'block';
    particles = [];
    
    // Create 150 particles
    for (let i = 0; i < 150; i++) {
      particles.push(new Particle());
    }

    if (animationId) cancelAnimationFrame(animationId);
    loop();

    // Auto-stop after 5 seconds to not be annoying
    setTimeout(stop, 5000);
  }

  function stop() {
    active = false;
    if (animationId) cancelAnimationFrame(animationId);
    if (ctx) ctx.clearRect(0, 0, width, height);
    if (canvas) canvas.style.display = 'none';
  }

  return { start, stop };
})();