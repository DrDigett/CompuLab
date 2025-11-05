(() => {
  // --- Estado ---
  let canvas, ctx, canvas_width, canvas_height;
  let pixel_size = 3;
  let length = 0;
  let grid = [];
  let time = 0;
  let rafId = null;
  let paused = true;

  // Parámetros LV (por defecto)
  let prey_reproduction = 0.4;   // alpha
  let prey_death = 0.2;         // mu
  let predator_reproduction = 0.8; // delta (eficiencia)
  let predator_death = 0.1;     // gamma
  let pred_requirement = 2;     // coef. interacción (beta escala interna)

  // Poblaciones continuas (flotantes)
  let P = 0; // presas (continuo)
  let D = 0; // depredadores (continuo)

  // Rangos aleatorios iniciales (solo para la semilla; luego la densidad visual se controla)
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

  // Distribuye una cantidad total pequeña de posiciones en la grilla
  function distributePopulations(preyCount, predCount) {
    grid = newGrid();
    const coords = [];
    for (let i = 0; i < length; i++) for (let j = 0; j < length; j++) coords.push([i, j]);
    shuffle(coords);
    let idx = 0;
    // Colocar presas (valor 1)
    for (let k = 0; k < Math.min(preyCount, coords.length); k++, idx++) {
      const [i, j] = coords[idx];
      grid[i][j] = 1;
    }
    // Colocar depredadores (valor 2)
    for (let k = 0; k < Math.min(predCount, coords.length - idx); k++, idx++) {
      const [i, j] = coords[idx];
      grid[i][j] = 2;
    }
  }

  // Calcula coeficiente de interacción beta escalado al área
  function computeInteractionCoefficient() {
    const area = Math.max(1, length * length);
    // pred_requirement ya es una especie de "intensidad" — la dividimos por el area para que el producto p*d tenga sentido
    return pred_requirement / area;
  }

  // ---- Runge-Kutta 4 ----
  function derivs(p, d, params) {
    const { alpha, mu, beta, delta, gamma } = params;
    // Ecuaciones Lotka-Volterra con términos naturales:
    // dP/dt = alpha * P - beta * P * D - mu * P
    // dD/dt = delta * beta * P * D - gamma * D
    const dP = alpha * p - beta * p * d - mu * p;
    const dD = delta * beta * p * d - gamma * d;
    return [dP, dD];
  }

  function rk4Step(dt) {
    const beta = computeInteractionCoefficient();
    const params = {
      alpha: prey_reproduction,
      mu: prey_death,
      beta,
      delta: predator_reproduction,
      gamma: predator_death
    };

    const [k1P, k1D] = derivs(P, D, params);
    const [k2P, k2D] = derivs(P + 0.5 * dt * k1P, D + 0.5 * dt * k1D, params);
    const [k3P, k3D] = derivs(P + 0.5 * dt * k2P, D + 0.5 * dt * k2D, params);
    const [k4P, k4D] = derivs(P + dt * k3P, D + dt * k3D, params);

    P = P + (dt / 6) * (k1P + 2 * k2P + 2 * k3P + k4P);
    D = D + (dt / 6) * (k1D + 2 * k2D + 2 * k3D + k4D);

    // No permitimos negativos
    if (P < 0) P = 0;
    if (D < 0) D = 0;

    // Garantizar que siempre haya más presas que depredadores en los valores continuos:
    // Si D >= P, forzamos D a ser ligeramente menor que P (manteniendo dinámica pero respetando tu requerimiento).
    if (P <= 0 && D > 0) {
      // si no hay presas, depredadores deben extinguirse
      D = 0;
    } else if (D >= P) {
      // reduce D a P - epsilon (al menos 1 individuo en la representación continua si P>=1)
      const eps = Math.max(0.5, 0.01 * P);
      D = Math.max(0, P - eps);
    }
  }

  // --- render ---
  function render() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas_width, canvas_height);

    for (let i = 0; i < length; i++) {
      for (let j = 0; j < length; j++) {
        const v = grid[i][j];
        if (v === 1) ctx.fillStyle = "#40ff00";        // presas
        else if (v === 2) ctx.fillStyle = "#ff4444";   // depredadores
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

      // Convertir las abundancias continuas P y D a una distribución visual reducida
      const maxCells = length * length;

      // Queremos dibujar poca densidad para que se vean "menos números" en el canvas:
      const maxOccupancyFraction = 0.12; // 12% de celdas como máximo ocupadas (ajusta aquí)
      const totalDesiredCells = Math.max(1, Math.min(Math.round(maxCells * maxOccupancyFraction), Math.round(P + D) || 1));

      // Si P+D es muy grande, escalamos proporcionalmente:
      let Pcells = 0, Dcells = 0;
      if (P + D > 0.0001) {
        Pcells = Math.round((P / (P + D)) * totalDesiredCells);
        Dcells = totalDesiredCells - Pcells;
      } else {
        Pcells = 0; Dcells = 0;
      }

      // Garantizar que siempre haya más celdas de presas que de depredadores visualmente:
      if (Pcells <= Dcells) {
        // Aseguramos Pcells >= Dcells + 1 cuando sea posible
        const need = (Dcells + 1) - Pcells;
        Pcells += need;
        // reducir total si excede capacidad
        if (Pcells + Dcells > maxCells) {
          const overflow = Pcells + Dcells - maxCells;
          // reducir ambos proporcionalmente
          const reducePred = Math.min(Dcells, overflow);
          Dcells -= reducePred;
          if (Pcells + Dcells > maxCells) {
            Pcells = Math.max(0, maxCells - Dcells);
          }
        }
      }

      // Asegurar límites
      Pcells = Math.min(Pcells, maxCells);
      Dcells = Math.min(Dcells, Math.max(0, maxCells - Pcells));

      distributePopulations(Pcells, Dcells);
    }

    // corregir conteos: en grid 1=presa, 2=depredador
    const flat = grid.flat();
    const preyDisplay = flat.filter(x => x === 1).length;
    const predDisplay = flat.filter(x => x === 2).length;

    if (prey_num_display) prey_num_display.textContent = `Presas (celdas): ${preyDisplay}  — P≈${P.toFixed(1)}`;
    if (pred_num_display) pred_num_display.textContent = `Depredadores (celdas): ${predDisplay}  — D≈${D.toFixed(1)}`;
    if (time_display) time_display.textContent = `Tiempo: ${time.toFixed(1)}`;

    render();
    rafId = requestAnimationFrame(step);
  }

  // --- manejo de parámetros ---
  function updateParams(variable) {
    if (variable === "prey-rep") {
      prey_reproduction = parseFloat(prey_rep_input.value) || 0;
      prey_rep_display.textContent = `Reproducción de presas: ${prey_reproduction}`;
    } else if (variable === "prey-ded") {
      prey_death = parseFloat(prey_ded_input.value) || 0;
      prey_ded_display.textContent = `Muerte de presas: ${prey_death}`;
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

  // --- inicialización con valores aleatorios (y garantizando P > D) ---
  function initSimulationRandom() {
    // Semilla aleatoria
    const randPrey = Math.floor(Math.random() * (PREY_MAX - PREY_MIN + 1)) + PREY_MIN;
    // Aseguramos depredadores menores que presas al inicio
    const maxPredStart = Math.min(randPrey - 1, PRED_MAX);
    const minPredStart = Math.min(PRED_MIN, Math.max(0, maxPredStart));
    let randPred = 0;
    if (maxPredStart > minPredStart) {
      randPred = Math.floor(Math.random() * (maxPredStart - minPredStart + 1)) + minPredStart;
    } else {
      randPred = Math.floor(Math.random() * (Math.max(1, Math.floor(randPrey * 0.5)))); // fallback
    }

    P = Math.max(1, randPrey);
    D = Math.max(0, randPred);

    // Distribución visual inicial: usamos reglas de densidad baja
    const maxCells = length * length;
    const occupancyFrac = 0.12; // 12% como máximo
    const totalDesiredCells = Math.max(1, Math.min(Math.round(maxCells * occupancyFrac), Math.round(P + D) || 1));
    let Pcells = Math.round((P / (P + D || 1)) * totalDesiredCells);
    let Dcells = totalDesiredCells - Pcells;
    if (Pcells <= Dcells) {
      Pcells = Dcells + 1;
      if (Pcells + Dcells > maxCells) {
        Pcells = Math.max(1, Math.floor(maxCells * 0.08));
        Dcells = Math.max(0, Math.floor(maxCells * 0.02));
      }
    }

    distributePopulations(Math.min(Pcells, maxCells), Math.min(Dcells, Math.max(0, maxCells - Pcells)));
    time = 0;

    if (prey_num_display) prey_num_display.textContent = `Presas (celdas): ${Math.min(P, maxCells)}  — P≈${P.toFixed(1)}`;
    if (pred_num_display) pred_num_display.textContent = `Depredadores (celdas): ${D}  — D≈${D.toFixed(1)}`;
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
    // Actualiza inputs (si existen en DOM)
    if (prey_rep_input) prey_rep_input.value = 0.4;
    if (prey_ded_input) prey_ded_input.value = 0.2;
    if (pred_rep_input) pred_rep_input.value = 0.8;
    if (pred_ded_input) pred_ded_input.value = 0.1;
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
