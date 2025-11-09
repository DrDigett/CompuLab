const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let array = [];
let sorting = false;
let i = 0, j = 0;
let time = 0;
let interval = null;       // Intervalo para Bubble Sort
let timeInterval = null;   // Intervalo del cronómetro
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

// 📐 Redimensionar canvas
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
    stopTimer();
  }
}

// ⚡ QuickSort visual (asíncrono)
async function quickSortVisual(arr, left = 0, right = arr.length - 1) {
  if (left >= right || !sorting) return;

  const pivotIndex = await partition(arr, left, right);
  await quickSortVisual(arr, left, pivotIndex - 1);
  await quickSortVisual(arr, pivotIndex + 1, right);

  if (left === 0 && right === arr.length - 1) {
    sorting = false;
    stopTimer();
  }
}

async function partition(arr, left, right) {
  const pivotValue = arr[right];
  let pivotIndex = left;
  for (let i = left; i < right; i++) {
    playBeep(150 + arr[i] * 5);
    if (arr[i] < pivotValue) {
      [arr[i], arr[pivotIndex]] = [arr[pivotIndex], arr[i]];
      drawArray(arr, i, pivotIndex);
      pivotIndex++;
      await sleep(40);
    }
  }
  [arr[pivotIndex], arr[right]] = [arr[right], arr[pivotIndex]];
  drawArray(arr, pivotIndex, right);
  await sleep(40);
  return pivotIndex;
}

// 🧩 Merge Sort visual (asíncrono)
async function mergeSortVisual(arr, start = 0, end = arr.length - 1) {
  if (start >= end || !sorting) return;
  const mid = Math.floor((start + end) / 2);
  await mergeSortVisual(arr, start, mid);
  await mergeSortVisual(arr, mid + 1, end);
  await merge(arr, start, mid, end);

  if (start === 0 && end === arr.length - 1) {
    sorting = false;
    stopTimer();
  }
}

async function merge(arr, start, mid, end) {
  const left = arr.slice(start, mid + 1);
  const right = arr.slice(mid + 1, end + 1);
  let i = 0, j = 0, k = start;

  while (i < left.length && j < right.length) {
    playBeep(100 + arr[k] * 5);
    if (left[i] <= right[j]) {
      arr[k++] = left[i++];
    } else {
      arr[k++] = right[j++];
    }
    drawArray(arr, k, start);
    await sleep(50);
  }

  while (i < left.length) {
    arr[k++] = left[i++];
    drawArray(arr, k, start);
    await sleep(50);
  }

  while (j < right.length) {
    arr[k++] = right[j++];
    drawArray(arr, k, start);
    await sleep(50);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ⏱️ Control de tiempo
function startTimer() {
  clearInterval(timeInterval);
  time = 0;
  document.getElementById("time-display").textContent = `Tiempo: 0.0 s`;
  timeInterval = setInterval(() => {
    if (sorting) {
      time += 0.1;
      document.getElementById("time-display").textContent = `Tiempo: ${time.toFixed(1)} s`;
    }
  }, 100);
}

function stopTimer() {
  clearInterval(timeInterval);
}

// 🎯 Seleccionar algoritmo
function setAlgorithm(algo) {
  currentAlgorithm = algo;

  // ✅ Solo dejamos una línea para definir el archivo
  const file = `../src/pages/${algo}.html`;

  // Cargar el contenido del archivo HTML y mostrarlo
  fetch(file)
    .then(response => {
      if (!response.ok) throw new Error("Error al cargar el archivo");
      return response.text();
    })
    .then(html => {
      // Mostrar el contenido en un contenedor
      document.getElementById("selected-title").innerHTML = html;
    })
    .catch(error => {
      console.error("Error al cargar el archivo HTML:", error);
      document.getElementById("selected-title").textContent = "No se pudo cargar la descripción.";
    });

  // Reiniciar el array
  resetArray();
}


// ▶️ Iniciar ordenamiento
function startSort() {
  if (sorting) return;
  sorting = true;
  i = 0; j = 0;
  startTimer();

  if (currentAlgorithm === "bubble") {
    interval = setInterval(() => {
      bubbleSortStep();
      if (!sorting) stopTimer();
    }, 50);
  } 
  else if (currentAlgorithm === "quick") {
    quickSortVisual(array).then(() => {
      sorting = false;
      stopTimer();
    });
  } 
  else if (currentAlgorithm === "merge") {
    mergeSortVisual(array).then(() => {
      sorting = false;
      stopTimer();
    });
  } 
  else {
    alert("Solo Bubble Sort, Quick Sort y Merge Sort están implementados visualmente por ahora.");
    sorting = false;
    stopTimer();
  }
}

// 🔄 Reiniciar
function resetArray() {
  sorting = false;
  clearInterval(interval);
  stopTimer();
  array = Array.from({ length: 30 }, () => Math.floor(Math.random() * 100) + 1);
  time = 0;
  document.getElementById("time-display").textContent = "Tiempo: 0.0 s";
  resizeCanvas();
}

// 🪄 Redimensionar automáticamente
window.addEventListener("resize", resizeCanvas);

// Inicializar
resetArray();
