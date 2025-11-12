// Obtener el elemento canvas del DOM y su contexto 2D para dibujar
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// Variables globales del programa
let array = [];            // Arreglo que se va a ordenar
let sorting = false;       // Bandera que indica si se está ordenando
let i = 0, j = 0;          // Índices para algoritmos de ordenamiento
let time = 0;              // Tiempo transcurrido del cronómetro
let interval = null;       // Intervalo para Bubble Sort (ejecución paso a paso)
let timeInterval = null;   // Intervalo del cronómetro
let currentAlgorithm = "bubble"; // Algoritmo actual seleccionado

// 🎵 Control de sonido
let soundEnabled = true; // Habilitar/deshabilitar efectos de sonido
// Crear contexto de audio para generar sonidos
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Función para generar sonidos durante la visualización
function playBeep(freq, duration = 0.05) {
  if (!soundEnabled) return; // Salir si el sonido está deshabilitado
  
  // Crear oscilador y nodo de ganancia (volumen)
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = "square"; // Tipo de onda cuadrada
  osc.frequency.value = freq; // Frecuencia basada en el valor del elemento
  gain.gain.setValueAtTime(0.05, audioCtx.currentTime); // Volumen bajo
  osc.start();
  osc.stop(audioCtx.currentTime + duration); // Duración del sonido
}

// Alternar entre sonido activado/desactivado
function toggleSound() {
  soundEnabled = !soundEnabled;
  document.getElementById("sound-status").textContent = soundEnabled ? "ON" : "OFF";
}

// 📐 Redimensionar canvas para que se adapte al contenedor
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect(); // Obtener dimensiones del contenedor
  canvas.width = rect.width;
  canvas.height = rect.height;
  drawArray(array); // Redibujar el arreglo con el nuevo tamaño
}

// 🧱 Dibujar el arreglo como barras en el canvas
function drawArray(arr, highlightA = -1, highlightB = -1) {
  ctx.clearRect(0, 0, canvas.width, canvas.height); // Limpiar canvas
  
  const barWidth = canvas.width / arr.length; // Ancho de cada barra
  
  // Dibujar cada elemento como una barra
  arr.forEach((value, index) => {
    const barHeight = (value / 100) * canvas.height; // Altura proporcional al valor
    
    // Colorear barras destacadas en rojo, otras en azul
    ctx.fillStyle = (index === highlightA || index === highlightB) ? "red" : "#0dcaf0";
    ctx.fillRect(index * barWidth, canvas.height - barHeight, barWidth - 1, barHeight);
  });
}

// 🔁 Bubble Sort paso a paso (para visualización por intervalos)
function bubbleSortStep() {
  if (!sorting) return; // Si no está ordenando, salir

  // Algoritmo Bubble Sort
  if (i < array.length) {
    if (j < array.length - i - 1) {
      // Reproducir sonido basado en el valor actual
      playBeep(200 + array[j] * 5);
      
      // Comparar e intercambiar elementos si es necesario
      if (array[j] > array[j + 1]) {
        [array[j], array[j + 1]] = [array[j + 1], array[j]];
        playBeep(400 + array[j] * 5, 0.1); // Sonido diferente al intercambiar
      }
      
      // Dibujar el arreglo destacando los elementos comparados
      drawArray(array, j, j + 1);
      j++; // Mover al siguiente elemento
    } else {
      // Reiniciar índice interno y avanzar índice externo
      j = 0;
      i++;
    }
  } else {
    // Ordenamiento completado
    clearInterval(interval);
    sorting = false;
    stopTimer();
  }
}

// ⚡ QuickSort visual (implementación asíncrona para visualización)
async function quickSortVisual(arr, left = 0, right = arr.length - 1) {
  if (left >= right || !sorting) return; // Caso base o si se detuvo el ordenamiento

  // Obtener índice del pivote y ordenar recursivamente
  const pivotIndex = await partition(arr, left, right);
  await quickSortVisual(arr, left, pivotIndex - 1);
  await quickSortVisual(arr, pivotIndex + 1, right);

  // Si es la llamada inicial, detener timer al terminar
  if (left === 0 && right === arr.length - 1) {
    sorting = false;
    stopTimer();
  }
}

// Función de partición para QuickSort
async function partition(arr, left, right) {
  const pivotValue = arr[right]; // Elegir último elemento como pivote
  let pivotIndex = left;

  // Mover elementos menores al pivote a la izquierda
  for (let i = left; i < right; i++) {
    playBeep(150 + arr[i] * 5); // Sonido durante comparación
    
    if (arr[i] < pivotValue) {
      // Intercambiar elementos
      [arr[i], arr[pivotIndex]] = [arr[pivotIndex], arr[i]];
      drawArray(arr, i, pivotIndex); // Actualizar visualización
      pivotIndex++;
      await sleep(40); // Pausa para visualización
    }
  }
  
  // Colocar el pivote en su posición final
  [arr[pivotIndex], arr[right]] = [arr[right], arr[pivotIndex]];
  drawArray(arr, pivotIndex, right);
  await sleep(40); // Pausa para visualización
  
  return pivotIndex;
}

// 🧩 Merge Sort visual (implementación asíncrona)
async function mergeSortVisual(arr, start = 0, end = arr.length - 1) {
  if (start >= end || !sorting) return; // Caso base
  
  // Dividir recursivamente
  const mid = Math.floor((start + end) / 2);
  await mergeSortVisual(arr, start, mid);
  await mergeSortVisual(arr, mid + 1, end);
  
  // Combinar las mitades ordenadas
  await merge(arr, start, mid, end);

  // Si es la llamada inicial, detener timer al terminar
  if (start === 0 && end === arr.length - 1) {
    sorting = false;
    stopTimer();
  }
}

// Función para combinar dos sub-arreglos ordenados
async function merge(arr, start, mid, end) {
  // Crear sub-arreglos temporales
  const left = arr.slice(start, mid + 1);
  const right = arr.slice(mid + 1, end + 1);
  
  let i = 0, j = 0, k = start; // Índices para left, right y arr

  // Combinar mientras haya elementos en ambos sub-arreglos
  while (i < left.length && j < right.length) {
    playBeep(100 + arr[k] * 5); // Sonido durante comparación
    
    if (left[i] <= right[j]) {
      arr[k++] = left[i++];
    } else {
      arr[k++] = right[j++];
    }
    
    drawArray(arr, k, start); // Actualizar visualización
    await sleep(50); // Pausa para visualización
  }

  // Copiar elementos restantes de left (si los hay)
  while (i < left.length) {
    arr[k++] = left[i++];
    drawArray(arr, k, start);
    await sleep(50);
  }

  // Copiar elementos restantes de right (si los hay)
  while (j < right.length) {
    arr[k++] = right[j++];
    drawArray(arr, k, start);
    await sleep(50);
  }
}

// Función auxiliar para pausas asíncronas
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ⏱️ Control del cronómetro
function startTimer() {
  clearInterval(timeInterval); // Limpiar intervalo previo
  time = 0; // Reiniciar tiempo
  document.getElementById("time-display").textContent = `Tiempo: 0.0 s`;
  
  // Actualizar tiempo cada 100ms
  timeInterval = setInterval(() => {
    if (sorting) {
      time += 0.1;
      document.getElementById("time-display").textContent = `Tiempo: ${time.toFixed(1)} s`;
    }
  }, 100);
}

function stopTimer() {
  clearInterval(timeInterval); // Detener el cronómetro
}

// 🎯 Seleccionar algoritmo de ordenamiento
function setAlgorithm(algo) {
  currentAlgorithm = algo;

  // Definir archivo HTML con la descripción del algoritmo
  const file = `../src/pages/${algo}.html`;

  // Cargar y mostrar la descripción del algoritmo
  fetch(file)
    .then(response => {
      if (!response.ok) throw new Error("Error al cargar el archivo");
      return response.text();
    })
    .then(html => {
      // Mostrar el contenido en el contenedor
      document.getElementById("selected-title").innerHTML = html;
    })
    .catch(error => {
      console.error("Error al cargar el archivo HTML:", error);
      document.getElementById("selected-title").textContent = "No se pudo cargar la descripción.";
    });

  resetArray(); // Reiniciar arreglo al cambiar algoritmo
}

// ▶️ Iniciar el proceso de ordenamiento
function startSort() {
  if (sorting) return; // Si ya está ordenando, no hacer nada
  
  sorting = true;
  i = 0; j = 0; // Reiniciar índices
  startTimer(); // Iniciar cronómetro

  // Ejecutar el algoritmo seleccionado
  if (currentAlgorithm === "bubble") {
    // Bubble Sort con intervalos para visualización paso a paso
    interval = setInterval(() => {
      bubbleSortStep();
      if (!sorting) stopTimer();
    }, 50);
  } 
  else if (currentAlgorithm === "quick") {
    // QuickSort asíncrono con visualización
    quickSortVisual(array).then(() => {
      sorting = false;
      stopTimer();
    });
  } 
  else if (currentAlgorithm === "merge") {
    // MergeSort asíncrono con visualización
    mergeSortVisual(array).then(() => {
      sorting = false;
      stopTimer();
    });
  } 
  else {
    // Algoritmo no implementado visualmente
    alert("Solo Bubble Sort, Quick Sort y Merge Sort están implementados visualmente por ahora.");
    sorting = false;
    stopTimer();
  }
}

// 🔄 Reiniciar el arreglo y el estado de visualización
function resetArray() {
  sorting = false; // Detener ordenamiento
  clearInterval(interval); // Limpiar intervalos
  stopTimer(); // Detener cronómetro
  
  // Generar nuevo arreglo aleatorio
  array = Array.from({ length: 30 }, () => Math.floor(Math.random() * 100) + 1);
  
  time = 0; // Reiniciar tiempo
  document.getElementById("time-display").textContent = "Tiempo: 0.0 s";
  resizeCanvas(); // Redibujar con nuevo arreglo
}

// 🪄 Redimensionar automáticamente cuando cambia el tamaño de la ventana
window.addEventListener("resize", resizeCanvas);

// Inicializar la aplicación
resetArray();