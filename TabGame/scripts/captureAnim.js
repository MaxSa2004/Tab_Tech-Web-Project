/* scripts/captureAnim.js */
window.CaptureAnim = (function () {
  let canvas, ctx, width, height;
  let activeAnimation = null;
  let animationId = null;

  function init() {
    canvas = document.getElementById('captureCanvas');
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

  function loop() {
    if (!activeAnimation) {
      stop();
      return;
    }

    // Clear only this canvas
    ctx.clearRect(0, 0, width, height);

    const p = activeAnimation;

    // --- UPDATE LOGIC ---
    if (p.phase === 'pop') {
      // Scale up fast
      p.scale += (2.5 - p.scale) * 0.15;
      // Tilt slightly while popping up
      p.angle += 0.1;
      if (p.scale > 2.4) p.phase = 'spin';
    } 
    else if (p.phase === 'spin') {
      // Fast Coin Flip Rotation
      p.angle += 0.4;
      p.timer++;
      if (p.timer > 40) p.phase = 'travel'; // Spin for roughly 0.6 seconds
    } 
    else if (p.phase === 'travel') {
      // Fly to target
      p.x += (p.targetX - p.x) * 0.15;
      p.y += (p.targetY - p.y) * 0.15;
      p.scale += (1 - p.scale) * 0.1; // Shrink back to normal size
      
      // Keep flipping while traveling, but maybe slower?
      p.angle += 0.25;

      // Check arrival
      const dist = Math.hypot(p.x - p.targetX, p.y - p.targetY);
      if (dist < 20) {
        // Animation Done
        if (p.onComplete) p.onComplete();
        activeAnimation = null;
        stop();
        return;
      }
    }

    // --- DRAW LOGIC ---
    ctx.save();
    ctx.translate(p.x, p.y);

    // COIN FLIP EFFECT:
    // We scale the X-axis by the Cosine of the angle. 
    // This creates the illusion of rotating around the Y-axis (like a coin).
    // We multiply by p.scale to keep the "Pop" size effect.
    const flipScale = Math.cos(p.angle);
    ctx.scale(flipScale * p.scale, p.scale);

    // Draw Piece Circle
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    
    // Draw Border
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Add an inner ring to make the rotation easier to see
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2); // Smaller circle
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; // Semi-transparent white
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();

    animationId = requestAnimationFrame(loop);
  }

  function play(colorClass, targetElement, onComplete) {
    if (!canvas && !init()) {
      if(onComplete) onComplete(); 
      return;
    }
    if (!targetElement) { if(onComplete) onComplete(); return; }

    const rect = targetElement.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;

    activeAnimation = {
      x: width / 2,
      y: height / 2,
      scale: 0.1,
      angle: 0,
      phase: 'pop',
      timer: 0,
      color: colorClass === 'red' ? '#ef4444' : '#f9ce23',
      targetX: targetX,
      targetY: targetY,
      onComplete: onComplete
    };

    canvas.style.display = 'block';
    if (animationId) cancelAnimationFrame(animationId);
    loop();
  }

  function stop() {
    if (animationId) cancelAnimationFrame(animationId);
    if(ctx) ctx.clearRect(0, 0, width, height);
    if(canvas) canvas.style.display = 'none';
    activeAnimation = null;
  }

  return { play };
})();