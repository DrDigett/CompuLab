(() => {
  // --- Estado ---
  let canvas, ctx, canvas_width, canvas_height;
  let pixel_size = 3;
  let length = 0;
  let grid = [];
  let time = 0;
  let rafId = null;
  let paused = true;

  // Parámetros LV
  let prey_reproduction = 0.4;
  let prey_death = 0.2;
  let predator_reproduction = 0.8;
  let predator_death = 0.1;
  let pred_requirement = 2;

  // Poblaciones continuas (flotantes)
  let P = 0; // presas
  let D = 0; // depredadores

  // Rango aleatorio inicial (puedes ajustar)
  const PREY_MIN = 300, PREY_MAX = 1000;
  const PRED_MIN = 200, PRED_MAX = 1500;

  // UI
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
    for (let k = 0; k < Math.min(preyCount, coords.length); k++, idx++) {
      const [i, j] = coords[idx];
      grid[i][j] = 1;
    }
    for (let k = 0; k < Math.min(predCount, coords.length - idx); k++, idx++) {
      const [i, j] = coords[idx];
      grid[i][j] = 2;
    }
  }

  function computeInteractionCoefficient() {
    const area = Math.max(1, length * length);
    return pred_requirement / area;
  }

  // ---- Runge-Kutta 4 ----
  function derivs(p, d, params) {
    const { alpha, mu, beta, delta, gamma } = params;
    const dP = (alpha - mu) * p - beta * p * d;
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

    if (P < 0) P = 0;
    if (D < 0) D = 0;
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

      const maxCells = length * length;
      const Pcells = Math.min(Math.round(P), maxCells);
      const Dcells = Math.min(Math.round(D), maxCells - Pcells);
      distributePopulations(Pcells, Dcells);
    }

    const flat = grid.flat();
    const preyDisplay = flat.filter(x => x === 2).length;
    const predDisplay = flat.filter(x => x === 1).length;

    if (prey_num_display) prey_num_display.textContent = `Presas: ${preyDisplay}  (P≈${P.toFixed(1)})`;
    if (pred_num_display) pred_num_display.textContent = `Depredadores: ${predDisplay}  (D≈${D.toFixed(1)})`;
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

  // --- inicialización con valores aleatorios ---
  function initSimulationRandom() {
    const randPrey = Math.floor(Math.random() * (PREY_MAX - PREY_MIN + 1)) + PREY_MIN;
    const randPred = Math.floor(Math.random() * (PRED_MAX - PRED_MIN + 1)) + PRED_MIN;

    P = randPrey;
    D = randPred;

    distributePopulations(
      Math.min(randPrey, length * length),
      Math.min(randPred, length * length)
    );
    time = 0;

    // Mostrar en HTML los valores iniciales
    if (prey_num_display) prey_num_display.textContent = `Presas: ${randPrey}`;
    if (pred_num_display) pred_num_display.textContent = `Depredadores: ${randPred}`;
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
    prey_rep_input.value = 0.4;
    prey_ded_input.value = 0.2;
    pred_rep_input.value = 0.8;
    pred_ded_input.value = 0.1;
    pred_req_input.value = 2;
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
    startBtn.disabled = false;
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
