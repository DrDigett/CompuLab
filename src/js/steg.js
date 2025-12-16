// steg.js
// Implementación cliente (browser) de "archivo -> imagen" y "imagen -> archivo"
// Requiere: navegador moderno con SubtleCrypto (Chrome/Firefox/Edge/Safari recientes).

// ========== CONSTANTES ==========
// Identificador mágico para validar que una imagen contiene datos codificados
const MAGIC = new TextEncoder().encode("PXIMG1");
// Longitud del salt usado en derivación de clave (16 bytes)
const SALT_LEN = 16;
// Longitud del nonce (número usado una sola vez) para AES-GCM (12 bytes)
const NONCE_LEN = 12;
// Longitud del campo que almacena el tamaño del contenido encriptado (8 bytes)
const LEN_FIELD = 8;
// Tamaño total del encabezado fijo: MAGIC + SALT + NONCE + LEN_FIELD
const HEADER_FIXED_LEN = MAGIC.length + SALT_LEN + NONCE_LEN + LEN_FIELD;

// Colores para representar bits en la imagen (formato RGBA)
const GRAY = [128, 128, 128, 255];   // Representa bit 1
const BLACK = [0, 0, 0, 255];        // Representa bit 0
const WHITE = [255, 255, 255, 255];  // Relleno para píxeles no usados

// ========== FUNCIONES CRIPTOGRÁFICAS ==========

// Deriva una clave AES-256 a partir de una contraseña usando PBKDF2
// @param passwordBytes: Uint8Array con los bytes de la contraseña
// @param salt: Uint8Array aleatorio para hacer única la derivación
// @param iterations: número de iteraciones (más = más seguro pero lento)
async function deriveKey(passwordBytes, salt, iterations = 200_000) {
  // Importar contraseña como clave base para PBKDF2
  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  // Derivar clave AES-256 final
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

// ========== FUNCIONES DE CONVERSIÓN BITS <-> BYTES ==========

// Convierte un array de bytes en un array de bits individuales
// Ejemplo: 0xFF (255) -> [1,1,1,1,1,1,1,1]
function bytesToBitsUint8(bytes) {
  const bits = new Uint8Array(bytes.length * 8); // 8 bits por byte
  let bi = 0;
  for (let i = 0; i < bytes.length; i++) {
    let byte = bytes[i];
    // Extraer cada bit de izquierda a derecha (MSB primero)
    for (let b = 7; b >= 0; b--) {
      bits[bi++] = (byte >> b) & 1; // Desplazar y aislar bit
    }
  }
  return bits;
}

// Convierte un array de bits en un array de bytes
// Ejemplo: [1,1,1,1,1,1,1,1] -> 0xFF (255)
function bitsToBytes(bitsUint8) {
  const out = new Uint8Array(Math.floor(bitsUint8.length / 8));
  let oi = 0;
  for (let i = 0; i + 7 < bitsUint8.length; i += 8) {
    let v = 0;
    // Agrupar 8 bits y construir un byte
    for (let j = 0; j < 8; j++) {
      v = (v << 1) | (bitsUint8[i + j] & 1); // Desplazar y agregar bit
    }
    out[oi++] = v;
  }
  return out;
}

// ========== FUNCIONES DE EMPAQUETADO ==========

// Empaqueta nombre de archivo + contenido del archivo en un solo buffer
// Formato: [nombre_archivo][byte_nulo][contenido_archivo]
function packPayload(filenameStr, fileBytesUint8, password) {
  const encoder = new TextEncoder();
  const filenameB = encoder.encode(filenameStr); // Convertir nombre a UTF-8
  const nullByte = new Uint8Array([0]); // Separador nombre/contenido
  
  // Combinar: nombre + null byte + contenido
  const plaintext = new Uint8Array(filenameB.length + 1 + fileBytesUint8.length);
  plaintext.set(filenameB, 0);
  plaintext.set(nullByte, filenameB.length);
  plaintext.set(fileBytesUint8, filenameB.length + 1);

  if (!password) {
    // Sin contraseña: sin encriptación (salt y nonce en ceros)
    const salt = new Uint8Array(SALT_LEN);
    const nonce = new Uint8Array(NONCE_LEN);
    const ct = plaintext; // "ct" = ciphertext (aquí es plaintext)
    return { headerSalt: salt, headerNonce: nonce, ct };
  } else {
    // Con contraseña: se encriptará después (async)
    return { plaintext };
  }
}

// Empaqueta, encripta si es necesario, y devuelve bytes listos para codificar en imagen
async function packAndEncrypt(filename, fileBytesUint8, password) {
  if (!password) {
    // ===== SIN ENCRIPTACIÓN =====
    const { headerSalt, headerNonce, ct } = packPayload(filename, fileBytesUint8, null);
    
    // Construir buffer completo: MAGIC + SALT + NONCE + LEN + CONTENIDO
    const arr = new Uint8Array(MAGIC.length + SALT_LEN + NONCE_LEN + LEN_FIELD + ct.length);
    let off = 0;
    
    arr.set(MAGIC, off); off += MAGIC.length; // Añadir identificador
    arr.set(headerSalt, off); off += SALT_LEN; // Añadir salt (ceros)
    arr.set(headerNonce, off); off += NONCE_LEN; // Añadir nonce (ceros)
    
    // Encodificar longitud del contenido como big-endian 64-bit
    const dv = new DataView(new ArrayBuffer(LEN_FIELD));
    dv.setBigUint64(0, BigInt(ct.length), false); // false = big-endian
    arr.set(new Uint8Array(dv.buffer), off); off += LEN_FIELD;
    
    arr.set(ct, off); // Añadir contenido
    return arr;
  } else {
    // ===== CON ENCRIPTACIÓN =====
    // Generar salt y nonce aleatorios
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
    const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LEN));
    
    // Derivar clave desde contraseña
    const pwdBytes = new TextEncoder().encode(password);
    const key = await deriveKey(pwdBytes, salt, 200_000);
    
    // Empaquetar plaintext (nombre + null + contenido)
    const plaintextPack = (() => {
      const encoder = new TextEncoder();
      const filenameB = encoder.encode(filename);
      const nullByte = new Uint8Array([0]);
      const p = new Uint8Array(filenameB.length + 1 + fileBytesUint8.length);
      p.set(filenameB, 0);
      p.set(nullByte, filenameB.length);
      p.set(fileBytesUint8, filenameB.length + 1);
      return p;
    })();
    
    // Encriptar con AES-GCM
    const ctBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      key,
      plaintextPack
    );
    const ct = new Uint8Array(ctBuffer);
    
    // Construir buffer final
    const arr = new Uint8Array(MAGIC.length + SALT_LEN + NONCE_LEN + LEN_FIELD + ct.length);
    let off = 0;
    arr.set(MAGIC, off); off += MAGIC.length;
    arr.set(salt, off); off += SALT_LEN;
    arr.set(nonce, off); off += NONCE_LEN;
    const dv = new DataView(new ArrayBuffer(LEN_FIELD));
    dv.setBigUint64(0, BigInt(ct.length), false);
    arr.set(new Uint8Array(dv.buffer), off); off += LEN_FIELD;
    arr.set(ct, off);
    return arr;
  }
}

// ========== FUNCIONES DE IMAGEN ==========

// Convierte array de bits en una imagen PNG
// Bit 1 = gris, Bit 0 = negro, píxeles sobrantes = blanco
function makeImageFromBits(bitsUint8) {
  const nbits = bitsUint8.length;
  // Calcular dimensiones cuadradas aproximadas
  const width = Math.ceil(Math.sqrt(nbits));
  const height = Math.ceil(nbits / width);
  
  // Crear canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(width, height);
  
  // Llenar píxeles con bits de datos
  let p = 0; // Índice en array de píxeles (RGBA = 4 valores por píxel)
  for (let i = 0; i < nbits; i++) {
    const bit = bitsUint8[i];
    const color = bit ? GRAY : BLACK; // 1 = gris, 0 = negro
    imgData.data[p++] = color[0]; // R
    imgData.data[p++] = color[1]; // G
    imgData.data[p++] = color[2]; // B
    imgData.data[p++] = color[3]; // A
  }
  
  // Rellenar píxeles sobrantes con blanco
  const totalPixels = width * height;
  for (let i = nbits; i < totalPixels; i++) {
    imgData.data[p++] = WHITE[0];
    imgData.data[p++] = WHITE[1];
    imgData.data[p++] = WHITE[2];
    imgData.data[p++] = WHITE[3];
  }
  
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

// Descarga una imagen desde una URL de datos
function downloadDataURL(dataURL, filename) {
  const a = document.createElement("a");
  a.href = dataURL;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ========== FUNCIÓN PRINCIPAL: ARCHIVO -> IMAGEN ==========

// Codifica un archivo en una imagen PNG
// @param file: objeto File del input <input type="file">
// @param password: contraseña opcional para encriptación
async function encodeFileToImage(file, password = null) {
  // Leer contenido del archivo
  const arrayBuffer = await file.arrayBuffer();
  const fileBytes = new Uint8Array(arrayBuffer);
  
  // Empaquetar y encriptar (si tiene contraseña)
  const packed = await packAndEncrypt(file.name, fileBytes, password);
  
  // Convertir bytes a bits
  const bits = bytesToBitsUint8(packed);
  
  // Convertir bits a imagen
  const canvas = makeImageFromBits(bits);
  
  // Convertir canvas a URL de datos (PNG base64)
  const dataURL = canvas.toDataURL("image/png");
  
  return { dataURL, canvas, suggestedName: file.name + ".png" };
}

// ========== LECTURA DE IMAGEN ==========

// Extrae bits de una imagen PNG
// Interpreta: gris=1, negro=0, blanco/otro=0
function readBitsFromImage(img) {
  // Crear canvas y dibujar imagen en él
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  
  // Obtener datos de píxeles (RGBA)
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const n = canvas.width * canvas.height;
  const bits = new Uint8Array(n);
  
  // Convertir colores a bits
  for (let i = 0; i < n; i++) {
    const r = imgData[i * 4 + 0];
    const g = imgData[i * 4 + 1];
    const b = imgData[i * 4 + 2];
    // Comparar con gris o negro (con tolerancia)
    if (r === 128 && g === 128 && b === 128) bits[i] = 1; // Gris = 1
    else if (r === 0 && g === 0 && b === 0) bits[i] = 0;   // Negro = 0
    else bits[i] = 0; // Blanco/otro = 0
  }
  return bits;
}

// Extrae un BigUint64 big-endian de un array de bytes
function readBigUint64BEFromBytes(bytes, offset) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
  return dv.getBigUint64(0, false); // false = big-endian
}

// ========== FUNCIÓN PRINCIPAL: IMAGEN -> ARCHIVO ==========

// Desencripta (si es necesario) y extrae archivo de bytes empaquetados
// @param packedBytes: Uint8Array con MAGIC + SALT + NONCE + LEN + CONTENIDO
// @param password: contraseña si fue encriptado
async function unpackAndDecrypt(packedBytes, password = null) {
  // Validar identificador mágico
  for (let i = 0; i < MAGIC.length; i++) {
    if (packedBytes[i] !== MAGIC[i]) throw new Error("MAGIC incorrecto");
  }
  
  // Leer encabezado
  let offset = MAGIC.length;
  const salt = packedBytes.slice(offset, offset + SALT_LEN); offset += SALT_LEN;
  const nonce = packedBytes.slice(offset, offset + NONCE_LEN); offset += NONCE_LEN;
  const ct_len = Number(readBigUint64BEFromBytes(packedBytes, offset)); offset += LEN_FIELD;
  const ct = packedBytes.slice(offset, offset + ct_len);

  if (salt.every(b => b === 0)) {
    // ===== SIN ENCRIPTACIÓN =====
    const plaintext = ct;
    // Buscar byte nulo que separa nombre de contenido
    const sepIdx = plaintext.indexOf(0);
    const filename = new TextDecoder().decode(plaintext.slice(0, sepIdx));
    const fileBytes = plaintext.slice(sepIdx + 1);
    return { filename, fileBytes };
  } else {
    // ===== CON ENCRIPTACIÓN =====
    if (!password) throw new Error("La imagen está encriptada: se requiere contraseña.");
    
    // Derivar clave con mismo salt
    const key = await deriveKey(new TextEncoder().encode(password), salt, 200_000);
    
    // Desencriptar
    let plaintextBuffer;
    try {
      plaintextBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: nonce },
        key,
        ct
      );
    } catch (e) {
      throw new Error("Desencriptado fallido. Contraseña incorrecta o archivo corrupto.");
    }
    
    // Extraer nombre y contenido
    const plaintext = new Uint8Array(plaintextBuffer);
    const sepIdx = plaintext.indexOf(0);
    const filename = new TextDecoder().decode(plaintext.slice(0, sepIdx));
    const fileBytes = plaintext.slice(sepIdx + 1);
    return { filename, fileBytes };
  }
}

// ========== UI: CONECTAR ELEMENTOS HTML ==========

// Conecta la interfaz HTML con las funciones de codificación/decodificación
export async function wireStegUI(containerSelector) {
  const root = document.querySelector(containerSelector);
  if (!root) return;

  // Elementos para CODIFICACIÓN (archivo -> imagen)
  const inFile = root.querySelector("#steg-in-file"); // Input de archivo
  const inPass = root.querySelector("#steg-in-pass"); // Input de contraseña
  const btnEncode = root.querySelector("#steg-encode-btn"); // Botón codificar
  const outPreview = root.querySelector("#steg-preview"); // Previsualización imagen
  const downloadLink = root.querySelector("#steg-download-link"); // Link descargar

  // Elementos para DECODIFICACIÓN (imagen -> archivo)
  const inImage = root.querySelector("#steg-in-image"); // Input de imagen
  const inImagePass = root.querySelector("#steg-in-image-pass"); // Contraseña para desencriptar
  const btnDecode = root.querySelector("#steg-decode-btn"); // Botón decodificar
  const decodedInfo = root.querySelector("#steg-decoded-info"); // Info del archivo recuperado

  // === EVENT LISTENER: CODIFICAR ===
  btnEncode.addEventListener("click", async () => {
    const file = inFile.files?.[0];
    if (!file) return alert("Selecciona un archivo para codificar.");
    btnEncode.disabled = true;
    try {
      const pw = inPass.value ? inPass.value : null; // null si vacío
      // Codificar archivo a imagen
      const { dataURL, canvas, suggestedName } = await encodeFileToImage(file, pw);
      
      // Mostrar previsualización
      outPreview.innerHTML = "";
      const img = document.createElement("img");
      img.src = dataURL;
      img.style.maxWidth = "100%";
      outPreview.appendChild(img);
      
      // Configurar link de descarga
      downloadLink.href = dataURL;
      downloadLink.download = suggestedName;
      downloadLink.classList.remove("d-none"); // Mostrar botón descarga
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      btnEncode.disabled = false;
    }
  });

  // === EVENT LISTENER: DECODIFICAR ===
  btnDecode.addEventListener("click", async () => {
    const f = inImage.files?.[0];
    if (!f) return alert("Selecciona una imagen PNG para decodificar.");
    btnDecode.disabled = true;
    try {
      // Cargar imagen
      const img = new Image();
      img.crossOrigin = "anonymous";
      const objectURL = URL.createObjectURL(f);
      await new Promise((res, rej) => {
        img.onload = () => { URL.revokeObjectURL(objectURL); res(); };
        img.onerror = rej;
        img.src = objectURL;
      });
      
      // Extraer bits y desencriptar
      const bits = readBitsFromImage(img);
      const bytes = bitsToBytes(bits);
      const pw = inImagePass.value ? inImagePass.value : null;
      const { filename, fileBytes } = await unpackAndDecrypt(bytes, pw);
      
      // Descargar archivo recuperado
      const blob = new Blob([fileBytes]);
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(dlUrl);
      
      // Mostrar info
      decodedInfo.textContent = `Archivo recuperado: ${filename} (${fileBytes.length} bytes)`;
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      btnDecode.disabled = false;
    }
  });
}

// ========== FUNCIONES ADICIONALES: ARCHIVO GRANDE -> MÚLTIPLES IMÁGENES ==========

// Divide un archivo grande en chunks y cada chunk se codifica en una imagen
// @param file: archivo a dividir
// @param chunkSize: tamaño máximo de cada chunk (por defecto 512x512 = 262144 bytes)
async function fileToImages(file, chunkSize = 512 * 512) {  
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let images = [];
  let offset = 0;

  // Procesar el archivo por chunks
  while (offset < bytes.length) {
    const slice = bytes.slice(offset, offset + chunkSize); // Extraer chunk
    const img = await chunkToImage(slice); // Convertir a imagen
    images.push(img);
    offset += chunkSize;
  }

  return images; // Lista de URLs PNG en base64
}

// Convierte un chunk de bytes en una imagen PNG
// Almacena cada byte en el canal R de un píxel
async function chunkToImage(byteArray) {
  const totalPixels = byteArray.length;
  const size = Math.ceil(Math.sqrt(totalPixels)); // Dimensión cuadrada

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;

  // Llenar píxeles: cada byte va en el canal R
  for (let i = 0; i < totalPixels; i++) {
    const b = byteArray[i];
    const idx = i * 4; // Cada píxel ocupa 4 índices (RGBA)

    data[idx] = b;       // R = byte del archivo
    data[idx + 1] = 0;   // G = 0
    data[idx + 2] = 0;   // B = 0
    data[idx + 3] = 255; // A = opaco
  }

  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL("image/png"); // Retornar como base64
}

// ========== FUNCIÓN INVERSA: MÚLTIPLES IMÁGENES -> ARCHIVO ==========

// Convierte múltiples imágenes PNG de vuelta a un archivo
// @param images: lista de URLs PNG (base64)
async function imagesToFile(images) {
  let chunks = [];

  // Procesar cada imagen y extraer bytes
  for (let url of images) {
    const chunk = await imageToChunk(url);
    chunks.push(chunk);
  }

  // Unir todos los chunks
  const totalLength = chunks.reduce((a, c) => a + c.length, 0);
  const result = new Uint8Array(totalLength);

  let offset = 0;
  for (let c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }

  return result; // Bytes del archivo original
}

// Extrae bytes de una imagen PNG
// Lee el canal R de cada píxel (donde se guardaron los datos)
async function imageToChunk(url) {
  const img = new Image();
  img.src = url;
  await img.decode(); // Esperar a que se cargue

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  // Obtener datos de píxeles
  const data = ctx.getImageData(0, 0, img.width, img.height).data;
  let bytes = [];

  // Extraer canal R de cada píxel
  for (let i = 0; i < data.length; i += 4) {
    const R = data[i];
    bytes.push(R);
  }

  return new Uint8Array(bytes);
}
