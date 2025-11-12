(() => {
  // --- Estado ---
  let canvas, ctx, canvas_width, canvas_height;
  let pixel_size = 3;
  let length = 0;
  let grid = [];
  let time = 0;
  let rafId = null;
  let paused = true;

  // Parámetros LV CLÁSICOS
  let prey_reproduction = 1;   // alpha - tasa de crecimiento de presas
  let prey_death = 0.0;         // mu - CERO en modelo clásico
  let predator_reproduction = 0.2; // delta - eficiencia de conversión
  let predator_death = 0.2;     // gamma - tasa de muerte depredadores
  let pred_requirement = 2;     // beta - tasa de depredación

  // Poblaciones continuas
  let P = 0;
  let D = 0;

  // Rangos aleatorios iniciales
  const PREY_MIN = 50, PREY_MAX = 600;
  const PRED_MIN = 10, PRED_MAX = 300;

  // UI elementos
  let prey_num_display, pred_num_display, time_display;
  let prey_rep_input, prey_ded_input, pred_rep_input, pred_ded_input, pred_req_input;
  let prey_rep_display, prey_ded_display, pred_rep_display, pred_ded_display, pred_req_display;
  let startBtn, pauseBtn, resetBtn;

  // --- utilidades ---
  
  function newGrid() {
    return Array.from({ length }, () => Array(length).fill(0));
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function distributePopulations(preyCount, predCount) {
    grid = newGrid();
    const coords = [];
    
    for (let i = 0; i < length; i++) for (let j = 0; j < length; j++) coords.push([i, j]);
    
    shuffle(coords);
    let idx = 0;
    
    // Colocar presas
    for (let k = 0; k < Math.min(preyCount, coords.length); k++, idx++) {
      const [i, j] = coords[idx];
      grid[i][j] = 1;
    }
    
    // Colocar depredadores
    for (let k = 0; k < Math.min(predCount, coords.length - idx); k++, idx++) {
      const [i, j] = coords[idx];
      grid[i][j] = 2;
    }
  }

  // COEFICIENTE DE INTERACCIÓN MÁS SIMPLE - sin división por área
  function computeInteractionCoefficient() {
    return pred_requirement * 0.01; // Escala simple y constante
  }

  // ---- Runge-Kutta 4 - MODELO CLÁSICO ----
  
  function derivs(p, d, params) {
    const { alpha, beta, delta, gamma } = params;
    
    // MODELO LOTKA-VOLTERRA CLÁSICO (sin muerte natural de presas)
    const dP = alpha * p - beta * p * d;
    const dD = delta * beta * p * d - gamma * d;
    
    return [dP, dD];
  }

  function rk4Step(dt) {
    const beta = computeInteractionCoefficient();
    const params = {
      alpha: prey_reproduction,
      beta: beta,
      delta: predator_reproduction,
      gamma: predator_death
      // NOTA: prey_death (mu) no se usa en el modelo clásico
    };

    // Runge-Kutta 4
    const [k1P, k1D] = derivs(P, D, params);
    const [k2P, k2D] = derivs(P + 0.5 * dt * k1P, D + 0.5 * dt * k1D, params);
    const [k3P, k3D] = derivs(P + 0.5 * dt * k2P, D + 0.5 * dt * k2D, params);
    const [k4P, k4D] = derivs(P + dt * k3P, D + dt * k3D, params);

    P = P + (dt / 6) * (k1P + 2 * k2P + 2 * k3P + k4P);
    D = D + (dt / 6) * (k1D + 2 * k2D + 2 * k3D + k4D);

    // Solo prevenir valores negativos, NO forzar D < P artificialmente
    if (P < 0) P = 0;
    if (D < 0) D = 0;
    
    // EXTINCIÓN NATURAL: si no hay presas, depredadores se extinguen
    if (P <= 0 && D > 0) {
      D = 0;
    }
  }

  // --- render ---
  
  function render() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas_width, canvas_height);

    for (let i = 0; i < length; i++) {
      for (let j = 0; j < length; j++) {
        const v = grid[i][j];
        if (v === 1) ctx.fillStyle = "#40ff00";
        else if (v === 2) ctx.fillStyle = "#ff4444";
        else continue;
        
        ctx.fillRect(i * pixel_size, j * pixel_size, pixel_size, pixel_size);
      }
    }
  }

  // --- loop principal ---
  const dt = 0.1;
  
  function step() {
    if (!paused) {
      rk4Step(dt);
      time += dt;

      // Conversión a representación visual - MÁS FIEL a las poblaciones reales
      const maxCells = length * length;
      
      // Usar una fracción mayor para mejor representación
      const maxOccupancyFraction = 0.3; // 30% en lugar de 12%
      const totalDesiredCells = Math.max(1, Math.min(
        Math.round(maxCells * maxOccupancyFraction), 
        Math.round(P + D) || 1
      ));

      // Distribución PROPORCIONAL a las poblaciones reales
      let Pcells = 0, Dcells = 0;
      if (P + D > 0.0001) {
        Pcells = Math.round((P / (P + D)) * totalDesiredCells);
        Dcells = totalDesiredCells - Pcells;
      } else {
        Pcells = 0; 
        Dcells = 0;
      }

      // Asegurar límites físicos
      Pcells = Math.min(Pcells, maxCells);
      Dcells = Math.min(Dcells, Math.max(0, maxCells - Pcells));

      distributePopulations(Pcells, Dcells);
    }

    // Actualizar displays
    const flat = grid.flat();
    const preyDisplay = flat.filter(x => x === 1).length;
    const predDisplay = flat.filter(x => x === 2).length;

    if (prey_num_display) prey_num_display.textContent = `Presas (celdas): ${preyDisplay} — P≈${P.toFixed(1)}`;
    if (pred_num_display) pred_num_display.textContent = `Depredadores (celdas): ${predDisplay} — D≈${D.toFixed(1)}`;
    if (time_display) time_display.textContent = `Tiempo: ${time.toFixed(1)}`;

    render();
    rafId = requestAnimationFrame(step);
  }

  // --- manejo de parámetros ---
  
  function updateParams(variable) {
    if (variable === "prey-rep") {
      prey_reproduction = parseFloat(prey_rep_input.value) || 0;
      prey_rep_display.textContent = `Reproducción de presas: ${prey_reproduction}`;
    //}else if (variable === "prey-ded") {
      //prey_death = parseFloat(prey_ded_input.value) || 0;
      //prey_ded_display.textContent = `Muerte de presas: ${prey_death}`;
    } else if (variable === "pred-rep") {
      predator_reproduction = parseFloat(pred_rep_input.value) || 0;
      pred_rep_display.textContent = `Reproducción de depredadores: ${predator_reproduction}`;
    } else if (variable === "pred-ded") {
      predator_death = parseFloat(pred_ded_input.value) || 0;
      pred_ded_display.textContent = `Muerte de depredadores: ${predator_death}`;
    } else if (variable === "pred-req") {
      pred_requirement = parseFloat(pred_req_input.value) || 0;
      pred_req_display.textContent = `Predación (coef.): ${pred_requirement}`;
    }
  }

  // --- inicialización ---
  function initSimulationRandom() {
    // Valores iniciales similares a tu ejemplo
    P = 188;  // Presas iniciales
    D = 34;   // Depredadores iniciales

    // Distribución visual inicial
    const maxCells = length * length;
    const occupancyFrac = 0.3;
    const totalDesiredCells = Math.max(1, Math.min(
      Math.round(maxCells * occupancyFrac), 
      Math.round(P + D) || 1
    ));
    
    let Pcells = Math.round((P / (P + D)) * totalDesiredCells);
    let Dcells = totalDesiredCells - Pcells;

    distributePopulations(Math.min(Pcells, maxCells), Math.min(Dcells, Math.max(0, maxCells - Pcells)));
    time = 0;

    // Actualizar displays
    if (prey_num_display) prey_num_display.textContent = `Presas (celdas): ${Pcells} — P≈${P.toFixed(1)}`;
    if (pred_num_display) pred_num_display.textContent = `Depredadores (celdas): ${Dcells} — D≈${D.toFixed(1)}`;
  }

  function initParams() {
    pixel_size = 3;
    length = Math.max(1, Math.floor(canvas_width / pixel_size));
    grid = newGrid();

    updateParams("prey-rep");
    updateParams("prey-ded");
    updateParams("pred-rep");
    updateParams("pred-ded");
    updateParams("pred-req");

    initSimulationRandom();
    paused = false;
    if (pauseBtn) {
      pauseBtn.disabled = false;
      pauseBtn.textContent = "Pausar";
    }
  }

  function defaultParams() {
    // PARÁMETROS CLÁSICOS - muerte de presas en CERO
    if (prey_rep_input) prey_rep_input.value = 1;
    if (prey_ded_input) prey_ded_input.value = 0.0;  // ← CLAVE: Cero en modelo clásico
    if (pred_rep_input) pred_rep_input.value = 0.2;
    if (pred_ded_input) pred_ded_input.value = 0.2;
    if (pred_req_input) pred_req_input.value = 2;
    
    updateParams("prey-rep");
    updateParams("prey-ded");
    updateParams("pred-rep");
    updateParams("pred-ded");
    updateParams("pred-req");
  }

  function startSimulation() {
    if (rafId) cancelAnimationFrame(rafId);
    paused = false;
    if (startBtn) startBtn.disabled = true;
    rafId = requestAnimationFrame(step);
  }

  function pauseToggle() {
    paused = !paused;
    if (pauseBtn) pauseBtn.textContent = paused ? "Reanudar" : "Pausar";
  }

  function resetSimulation() {
    if (rafId) cancelAnimationFrame(rafId);
    if (startBtn) startBtn.disabled = false;
    paused = true;
    time = 0;
    initSimulationRandom();
    render();
    if (pauseBtn) {
      pauseBtn.disabled = true;
      pauseBtn.textContent = "Pausar";
    }
  }

  // --- DOM ---
  document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d");

    const screen_width = window.innerWidth;
    canvas_width = screen_width < 768 ? 0.9 * screen_width : 0.35 * screen_width;
    canvas_height = canvas_width;
    canvas.width = canvas_width;
    canvas.height = canvas_height;

    // Obtener referencias UI (igual que antes)
    prey_num_display = document.getElementById("prey-num");
    pred_num_display = document.getElementById("pred-num");
    time_display = document.getElementById("time-display");

    prey_rep_input = document.getElementById("prey-rep-input");
    prey_ded_input = document.getElementById("prey-ded-input");
    pred_rep_input = document.getElementById("pred-rep-input");
    pred_ded_input = document.getElementById("pred-ded-input");
    pred_req_input = document.getElementById("pred-req-input");

    prey_rep_display = document.getElementById("prey-rep-display");
    prey_ded_display = document.getElementById("prey-ded-display");
    pred_rep_display = document.getElementById("pred-rep-display");
    pred_ded_display = document.getElementById("pred-ded-display");
    pred_req_display = document.getElementById("pred-req-display");

    startBtn = document.getElementById("start-button");
    pauseBtn = document.getElementById("pause-button");
    resetBtn = document.getElementById("reset-button");

    // Event listeners
    if (prey_rep_input) prey_rep_input.addEventListener('input', () => updateParams('prey-rep'));
    if (prey_ded_input) prey_ded_input.addEventListener('input', () => updateParams('prey-ded'));
    if (pred_rep_input) pred_rep_input.addEventListener('input', () => updateParams('pred-rep'));
    if (pred_ded_input) pred_ded_input.addEventListener('input', () => updateParams('pred-ded'));
    if (pred_req_input) pred_req_input.addEventListener('input', () => updateParams('pred-req'));

    if (startBtn) startBtn.addEventListener('click', () => {
      initParams();
      startSimulation();
    });
    if (pauseBtn) {
      pauseBtn.disabled = true;
      pauseBtn.addEventListener('click', pauseToggle);
    }
    if (resetBtn) resetBtn.addEventListener('click', resetSimulation);

    // Configuración inicial
    defaultParams();
    length = Math.max(1, Math.floor(canvas_width / pixel_size));
    grid = newGrid();
    initSimulationRandom();
    render();

    if (!rafId) rafId = requestAnimationFrame(step);
  });

  window.LV_sim = {
    start: () => startBtn && startBtn.click(),
    pauseToggle: () => pauseBtn && pauseBtn.click(),
    reset: () => resetBtn ? resetBtn.click() : (startBtn && (startBtn.disabled = false, startBtn.click()))
  };
})();