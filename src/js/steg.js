    // steg.js
// Implementación cliente (browser) de "archivo -> imagen" y "imagen -> archivo"
// Requiere: navegador moderno con SubtleCrypto (Chrome/Firefox/Edge/Safari recientes).

const MAGIC = new TextEncoder().encode("PXIMG1");
const SALT_LEN = 16;
const NONCE_LEN = 12;
const LEN_FIELD = 8;
const HEADER_FIXED_LEN = MAGIC.length + SALT_LEN + NONCE_LEN + LEN_FIELD;

const GRAY = [128, 128, 128, 255];
const BLACK = [0, 0, 0, 255];
const WHITE = [255, 255, 255, 255];

async function deriveKey(passwordBytes, salt, iterations = 200_000) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    passwordBytes,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
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

function bytesToBitsUint8(bytes) {
  const bits = new Uint8Array(bytes.length * 8);
  let bi = 0;
  for (let i = 0; i < bytes.length; i++) {
    let byte = bytes[i];
    for (let b = 7; b >= 0; b--) {
      bits[bi++] = (byte >> b) & 1;
    }
  }
  return bits;
}

function bitsToBytes(bitsUint8) {
  const out = new Uint8Array(Math.floor(bitsUint8.length / 8));
  let oi = 0;
  for (let i = 0; i + 7 < bitsUint8.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) {
      v = (v << 1) | (bitsUint8[i + j] & 1);
    }
    out[oi++] = v;
  }
  return out;
}

function packPayload(filenameStr, fileBytesUint8, password) {
  const encoder = new TextEncoder();
  const filenameB = encoder.encode(filenameStr);
  const nullByte = new Uint8Array([0]);
  const plaintext = new Uint8Array(filenameB.length + 1 + fileBytesUint8.length);
  plaintext.set(filenameB, 0);
  plaintext.set(nullByte, filenameB.length);
  plaintext.set(fileBytesUint8, filenameB.length + 1);

  if (!password) {
    // salt = zeros, nonce = zeros, ct = plaintext
    const salt = new Uint8Array(SALT_LEN);
    const nonce = new Uint8Array(NONCE_LEN);
    const ct = plaintext;
    return { headerSalt: salt, headerNonce: nonce, ct };
  } else {
    // We'll encrypt later in async function (since deriveKey is async).
    return { plaintext };
  }
}

async function packAndEncrypt(filename, fileBytesUint8, password) {
  if (!password) {
    const { headerSalt, headerNonce, ct } = packPayload(filename, fileBytesUint8, null);
    const arr = new Uint8Array(MAGIC.length + SALT_LEN + NONCE_LEN + LEN_FIELD + ct.length);
    let off = 0;
    arr.set(MAGIC, off); off += MAGIC.length;
    arr.set(headerSalt, off); off += SALT_LEN;
    arr.set(headerNonce, off); off += NONCE_LEN;
    // length (8 bytes big-endian)
    const dv = new DataView(new ArrayBuffer(LEN_FIELD));
    dv.setBigUint64(0, BigInt(ct.length), false); // big-endian
    arr.set(new Uint8Array(dv.buffer), off); off += LEN_FIELD;
    arr.set(ct, off);
    return arr;
  } else {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
    const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LEN));
    const pwdBytes = new TextEncoder().encode(password);
    const key = await deriveKey(pwdBytes, salt, 200_000);
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
    const ctBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      key,
      plaintextPack
    );
    const ct = new Uint8Array(ctBuffer);
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

function makeImageFromBits(bitsUint8) {
  // bitsUint8 is Uint8Array of 0/1
  const nbits = bitsUint8.length;
  const width = Math.ceil(Math.sqrt(nbits));
  const height = Math.ceil(nbits / width);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const imgData = ctx.createImageData(width, height);
  let p = 0;
  for (let i = 0; i < nbits; i++) {
    const bit = bitsUint8[i];
    const color = bit ? GRAY : BLACK;
    imgData.data[p++] = color[0];
    imgData.data[p++] = color[1];
    imgData.data[p++] = color[2];
    imgData.data[p++] = color[3];
  }
  // fill the rest of pixels with white if any
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

function downloadDataURL(dataURL, filename) {
  const a = document.createElement("a");
  a.href = dataURL;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function encodeFileToImage(file, password = null) {
  // file: File object from <input type="file">
  const arrayBuffer = await file.arrayBuffer();
  const fileBytes = new Uint8Array(arrayBuffer);
  const packed = await packAndEncrypt(file.name, fileBytes, password);
  const bits = bytesToBitsUint8(packed);
  const canvas = makeImageFromBits(bits);
  const dataURL = canvas.toDataURL("image/png");
  return { dataURL, canvas, suggestedName: file.name + ".png" };
}

function readBitsFromImage(img) {
  // img: HTMLImageElement already loaded
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const n = canvas.width * canvas.height;
  const bits = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = imgData[i * 4 + 0];
    const g = imgData[i * 4 + 1];
    const b = imgData[i * 4 + 2];
    // compare to GRAY or BLACK approximately: exact equality should work (PNG), but allow tolerance
    if (r === 128 && g === 128 && b === 128) bits[i] = 1;
    else if (r === 0 && g === 0 && b === 0) bits[i] = 0;
    else bits[i] = 0; // white or other => assume 0 (same heuristic as Python)
  }
  return bits;
}

function readBigUint64BEFromBytes(bytes, offset) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
  return dv.getBigUint64(0, false);
}

async function unpackAndDecrypt(packedBytes, password = null) {
  // packedBytes: Uint8Array containing header+ct
  // check MAGIC
  for (let i = 0; i < MAGIC.length; i++) {
    if (packedBytes[i] !== MAGIC[i]) throw new Error("MAGIC incorrecto");
  }
  let offset = MAGIC.length;
  const salt = packedBytes.slice(offset, offset + SALT_LEN); offset += SALT_LEN;
  const nonce = packedBytes.slice(offset, offset + NONCE_LEN); offset += NONCE_LEN;
  const ct_len = Number(readBigUint64BEFromBytes(packedBytes, offset)); offset += LEN_FIELD;
  const ct = packedBytes.slice(offset, offset + ct_len);

  if (salt.every(b => b === 0)) {
    // plaintext case
    const plaintext = ct;
    const sepIdx = plaintext.indexOf(0);
    const filename = new TextDecoder().decode(plaintext.slice(0, sepIdx));
    const fileBytes = plaintext.slice(sepIdx + 1);
    return { filename, fileBytes };
  } else {
    if (!password) throw new Error("La imagen está encriptada: se requiere contraseña.");
    const key = await deriveKey(new TextEncoder().encode(password), salt, 200_000);
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
    const plaintext = new Uint8Array(plaintextBuffer);
    const sepIdx = plaintext.indexOf(0);
    const filename = new TextDecoder().decode(plaintext.slice(0, sepIdx));
    const fileBytes = plaintext.slice(sepIdx + 1);
    return { filename, fileBytes };
  }
}

// ---------- UI helper (simple) ----------
// Functions to wire to elements. The HTML snippet abajo usa estos IDs.

export async function wireStegUI(containerSelector) {
  // containerSelector: selector del contenedor donde buscar los elementos (e.g. "#steg-section")
  const root = document.querySelector(containerSelector);
  if (!root) return;

  const inFile = root.querySelector("#steg-in-file");
  const inPass = root.querySelector("#steg-in-pass");
  const btnEncode = root.querySelector("#steg-encode-btn");
  const outPreview = root.querySelector("#steg-preview");
  const downloadLink = root.querySelector("#steg-download-link");

  const inImage = root.querySelector("#steg-in-image");
  const inImagePass = root.querySelector("#steg-in-image-pass");
  const btnDecode = root.querySelector("#steg-decode-btn");
  const decodedInfo = root.querySelector("#steg-decoded-info");

  btnEncode.addEventListener("click", async () => {
    const file = inFile.files?.[0];
    if (!file) return alert("Selecciona un archivo para codificar.");
    btnEncode.disabled = true;
    try {
      const pw = inPass.value ? inPass.value : null;
      const { dataURL, canvas, suggestedName } = await encodeFileToImage(file, pw);
      outPreview.innerHTML = "";
      const img = document.createElement("img");
      img.src = dataURL;
      img.style.maxWidth = "100%";
      outPreview.appendChild(img);
      downloadLink.href = dataURL;
      downloadLink.download = suggestedName;
      downloadLink.classList.remove("d-none");
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      btnEncode.disabled = false;
    }
  });

  btnDecode.addEventListener("click", async () => {
    const f = inImage.files?.[0];
    if (!f) return alert("Selecciona una imagen PNG para decodificar.");
    btnDecode.disabled = true;
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const objectURL = URL.createObjectURL(f);
      await new Promise((res, rej) => {
        img.onload = () => { URL.revokeObjectURL(objectURL); res(); };
        img.onerror = rej;
        img.src = objectURL;
      });
      const bits = readBitsFromImage(img);
      const bytes = bitsToBytes(bits);
      const pw = inImagePass.value ? inImagePass.value : null;
      const { filename, fileBytes } = await unpackAndDecrypt(bytes, pw);
      // create blob and download
      const blob = new Blob([fileBytes]);
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(dlUrl);
      decodedInfo.textContent = `Archivo recuperado: ${filename} (${fileBytes.length} bytes)`;
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      btnDecode.disabled = false;
    }
  });
}

async function fileToImages(file, chunkSize = 512 * 512) {  
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let images = [];
  let offset = 0;

  while (offset < bytes.length) {
    const slice = bytes.slice(offset, offset + chunkSize);
    const img = await chunkToImage(slice);
    images.push(img);
    offset += chunkSize;
  }

  return images; // lista de URLs de imágenes
}

async function chunkToImage(byteArray) {
  const totalPixels = byteArray.length;
  const size = Math.ceil(Math.sqrt(totalPixels));

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  const imageData = ctx.createImageData(size, size);
  const data = imageData.data;

  for (let i = 0; i < totalPixels; i++) {
    const b = byteArray[i];
    const idx = i * 4;

    data[idx] = b;     // R = byte del archivo
    data[idx + 1] = 0; // G
    data[idx + 2] = 0; // B
    data[idx + 3] = 255; // A
  }

  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL("image/png"); // Imagen en base64
}


async function imagesToFile(images) {
  let chunks = [];

  for (let url of images) {
    const chunk = await imageToChunk(url);
    chunks.push(chunk);
  }

  // unir todos los bytes
  const totalLength = chunks.reduce((a, c) => a + c.length, 0);
  const result = new Uint8Array(totalLength);

  let offset = 0;
  for (let c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }

  return result; // bytes del archivo original
}

async function imageToChunk(url) {
  const img = new Image();
  img.src = url;
  await img.decode();

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const data = ctx.getImageData(0, 0, img.width, img.height).data;
  let bytes = [];

  for (let i = 0; i < data.length; i += 4) {
    const R = data[i];
    bytes.push(R);
  }

  return new Uint8Array(bytes);
}
