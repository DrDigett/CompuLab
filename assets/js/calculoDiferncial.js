const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const functionSelect = document.getElementById("functionSelect");
const x0Slider = document.getElementById("x0Slider");
const hSlider = document.getElementById("hSlider");
const animateBtn = document.getElementById("animateBtn");
const toggleTangentBtn = document.getElementById("toggleTangentBtn");

const x0Value = document.getElementById("x0Value");
const hValue = document.getElementById("hValue");
const derivativeValue = document.getElementById("derivativeValue");

let animating = false;
let showTangent = false;

// ===== MATEMÁTICA =====
function f(x, type) {
  switch (type) {
    case "x2": return x * x;
    case "x3": return x * x * x;
    case "sin": return Math.sin(x);
  }
}

function derivativeNumerical(x0, h, type) {
  return (f(x0 + h, type) - f(x0, type)) / h;
}

// ===== COORDENADAS (ZOOM) =====
let scale = 40;

const origin = {
  x: canvas.width / 2,
  y: canvas.height / 2,
};

function toCanvasX(x) {
  return origin.x + x * scale;
}

function toCanvasY(y) {
  return origin.y - y * scale;
}

// ===== ZOOM CON RUEDA =====
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  scale *= e.deltaY < 0 ? 1.1 : 0.9;
  scale = Math.max(10, Math.min(scale, 120));
  draw();
});

// ===== DIBUJO =====
function drawAxes() {
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(0, origin.y);
  ctx.lineTo(canvas.width, origin.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(origin.x, 0);
  ctx.lineTo(origin.x, canvas.height);
  ctx.stroke();
}

function drawFunction(type) {
  ctx.strokeStyle = "#4dd0e1";
  ctx.lineWidth = 2;
  ctx.beginPath();

  let first = true;
  for (let x = -20; x <= 20; x += 0.02) {
    const y = f(x, type);
    const cx = toCanvasX(x);
    const cy = toCanvasY(y);

    if (first) {
      ctx.moveTo(cx, cy);
      first = false;
    } else {
      ctx.lineTo(cx, cy);
    }
  }
  ctx.stroke();
}

function drawSecant(x0, h, type) {
  const y0 = f(x0, type);
  const y1 = f(x0 + h, type);

  ctx.strokeStyle = "#ff7043";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(toCanvasX(x0), toCanvasY(y0));
  ctx.lineTo(toCanvasX(x0 + h), toCanvasY(y1));
  ctx.stroke();
}

// ===== RECTA TANGENTE =====
function drawTangent(x0, type) {
  if (!showTangent) return;

  const hTiny = 0.0001;
  const slope = derivativeNumerical(x0, hTiny, type);
  const y0 = f(x0, type);

  ctx.strokeStyle = "#81c784";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);

  ctx.beginPath();
  let first = true;

  for (let x = -20; x <= 20; x += 0.1) {
    const y = y0 + slope * (x - x0);
    const cx = toCanvasX(x);
    const cy = toCanvasY(y);

    if (first) {
      ctx.moveTo(cx, cy);
      first = false;
    } else {
      ctx.lineTo(cx, cy);
    }
  }

  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPoint(x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(toCanvasX(x), toCanvasY(y), 5, 0, Math.PI * 2);
  ctx.fill();
}

// ===== LOOP =====
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const type = functionSelect.value;
  const x0 = parseFloat(x0Slider.value);
  const h = parseFloat(hSlider.value);

  drawAxes();
  drawFunction(type);
  drawSecant(x0, h, type);
  drawTangent(x0, type);

  drawPoint(x0, f(x0, type), "#fff");
  drawPoint(x0 + h, f(x0 + h, type), "#ff7043");

  const d = derivativeNumerical(x0, h, type);

  x0Value.textContent = x0.toFixed(2);
  hValue.textContent = h.toFixed(3);
  derivativeValue.textContent = d.toFixed(2);
}

// ===== ANIMACIÓN =====
function animate() {
  if (!animating) return;

  let h = parseFloat(hSlider.value);
  h *= 0.95;

  if (h < 0.01) {   // ← CAMBIO CLAVE
    h = 0.001;       // ← fija el valor final exacto
    hSlider.value = h;
    animating = false;
    draw();
    return;
  }

  hSlider.value = h;
  draw();
  requestAnimationFrame(animate);
}

// ===== EVENTOS =====
[x0Slider, hSlider, functionSelect].forEach((el) =>
  el.addEventListener("input", draw)
);

animateBtn.addEventListener("click", () => {
  animating = true;
  animate();
});

toggleTangentBtn.addEventListener("click", () => {
  showTangent = !showTangent;
  toggleTangentBtn.textContent = showTangent
    ? "Ocultar recta tangente"
    : "Mostrar recta tangente";
  draw();
});

// PRIMER DIBUJO
draw();
