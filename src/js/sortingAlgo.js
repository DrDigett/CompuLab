const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let array = [];
let sorting = false;
let i = 0, j = 0;
let time = 0;
let interval = null;
let currentAlgorithm = "bubble";

// 🎵 Control de sonido
let soundEnabled = true;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playBeep(freq, duration = 0.05) {
  if (!soundEnabled) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = "square";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  document.getElementById("sound-status").textContent = soundEnabled ? "ON" : "OFF";
}

// 📐 Función para redimensionar canvas y redibujar
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  drawArray(array);
}

// 🧱 Dibujar arreglo
function drawArray(arr, highlightA = -1, highlightB = -1) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const barWidth = canvas.width / arr.length;
  arr.forEach((value, index) => {
    const barHeight = (value / 100) * canvas.height;
    ctx.fillStyle = (index === highlightA || index === highlightB) ? "red" : "#0dcaf0";
    ctx.fillRect(index * barWidth, canvas.height - barHeight, barWidth - 1, barHeight);
  });
}

// 🔁 Bubble Sort paso a paso
function bubbleSortStep() {
  if (!sorting) return;

  if (i < array.length) {
    if (j < array.length - i - 1) {
      playBeep(200 + array[j] * 5);
      if (array[j] > array[j + 1]) {
        [array[j], array[j + 1]] = [array[j + 1], array[j]];
        playBeep(400 + array[j] * 5, 0.1);
      }
      drawArray(array, j, j + 1);
      j++;
    } else {
      j = 0;
      i++;
    }
  } else {
    clearInterval(interval);
    sorting = false;
  }
}

// ⏱️ Control de tiempo
function updateTime() {
  if (sorting) {
    time += 0.1;
    document.getElementById("time-display").textContent = `Tiempo: ${time.toFixed(1)} s`;
  }
}

// 🎯 Seleccionar algoritmo y actualizar título
function setAlgorithm(algo) {
  currentAlgorithm = algo;
  const name = algo === "bubble" ? "Bubble Sort" :
                algo === "quick" ? "Quick Sort" : "Merge Sort";
  document.getElementById("selected-title").textContent = `Algoritmo actual: ${name}`;
  resetArray();
}

// ▶️ Iniciar ordenamiento
function startSort() {
  if (sorting) return;
  sorting = true;
  i = 0; j = 0;
  time = 0;
  document.getElementById("time-display").textContent = `Tiempo: 0.0 s`;

  if (currentAlgorithm === "bubble") {
    interval = setInterval(bubbleSortStep, 50);
  } else {
    alert("Solo Bubble Sort está implementado visualmente por ahora.");
    sorting = false;
  }

  setInterval(updateTime, 100);
}

// 🔄 Reiniciar
function resetArray() {
  sorting = false;
  clearInterval(interval);
  array = Array.from({ length: 30 }, () => Math.floor(Math.random() * 100) + 1);
  time = 0;
  document.getElementById("time-display").textContent = "Tiempo: 0.0 s";
  resizeCanvas();
}

// 🪄 Redimensionar automáticamente al cambiar el tamaño
window.addEventListener("resize", resizeCanvas);

// Inicializar
resetArray();
