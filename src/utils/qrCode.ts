/**
 * Lightweight, zero-external-dependency QR Code matrix generator.
 * Encodes string (e.g. Ethereum 0x addresses) into a 2D boolean grid.
 */

// Basic Galois field tables for Reed-Solomon QR error correction
const EXP_TABLE = new Uint8Array(256);
const LOG_TABLE = new Uint8Array(256);

(function initGaloisField() {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = val;
    LOG_TABLE[val] = i;
    val = (val << 1) ^ (val >= 128 ? 0x11d : 0);
  }
  EXP_TABLE[255] = EXP_TABLE[0];
})();

function gmult(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[(LOG_TABLE[a] + LOG_TABLE[b]) % 255];
}

function polyMul(p: number[], q: number[]): number[] {
  const result = new Array(p.length + q.length - 1).fill(0);
  for (let i = 0; i < p.length; i++) {
    for (let j = 0; j < q.length; j++) {
      result[i + j] ^= gmult(p[i], q[j]);
    }
  }
  return result;
}

function rsGeneratorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    poly = polyMul(poly, [1, EXP_TABLE[i]]);
  }
  return poly;
}

function rsCompute(data: number[], ecCount: number): number[] {
  const gen = rsGeneratorPoly(ecCount);
  const msg = [...data, ...new Array(ecCount).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gmult(gen[j], coef);
      }
    }
  }
  return msg.slice(data.length);
}

/**
 * Generate QR code matrix for Ethereum address (Version 3 or 4, Byte mode, EC level M)
 */
export function generateQRMatrix(text: string): boolean[][] {
  const len = text.length;
  // Version 4 supports up to 64 bytes in Level M (42 char Ethereum address fits comfortably)
  const size = 33; // Version 4 is 33x33
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () =>
    Array(size).fill(null),
  );

  // 1. Finder patterns at 3 corners
  function placeFinder(startX: number, startY: number) {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const px = startX + x;
        const py = startY + y;
        if (px >= 0 && px < size && py >= 0 && py < size) {
          if (
            (x >= 0 && x <= 6 && (y === 0 || y === 6)) ||
            (y >= 0 && y <= 6 && (x === 0 || x === 6)) ||
            (x >= 2 && x <= 4 && y >= 2 && y <= 4)
          ) {
            matrix[py][px] = true;
          } else {
            matrix[py][px] = false;
          }
        }
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(size - 7, 0);
  placeFinder(0, size - 7);

  // 2. Alignment pattern for Version 4 at (24, 24)
  function placeAlignment(centerX: number, centerY: number) {
    for (let y = -2; y <= 2; y++) {
      for (let x = -2; x <= 2; x++) {
        const isBorder = Math.abs(x) === 2 || Math.abs(y) === 2;
        const isCenter = x === 0 && y === 0;
        matrix[centerY + y][centerX + x] = isBorder || isCenter;
      }
    }
  }
  placeAlignment(24, 24);

  // 3. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0;
    if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0;
  }

  // 4. Dark module
  matrix[size - 8][8] = true;

  // 5. Encode data stream (Mode 4: 8-bit byte)
  const bitStream: number[] = [];
  function pushBits(val: number, count: number) {
    for (let i = count - 1; i >= 0; i--) {
      bitStream.push((val >> i) & 1);
    }
  }

  pushBits(0b0100, 4); // Byte mode indicator
  pushBits(len, 8); // Character count indicator (8 bits for V1-9)
  for (let i = 0; i < len; i++) {
    pushBits(text.charCodeAt(i), 8);
  }
  // Terminator
  pushBits(0, 4);
  while (bitStream.length % 8 !== 0) bitStream.push(0);

  // Pad bytes
  const totalDataBytes = 64; // Version 4, Level M has 64 data bytes
  const pad = [0xec, 0x11];
  let padIdx = 0;
  while (bitStream.length < totalDataBytes * 8) {
    pushBits(pad[padIdx % 2], 8);
    padIdx++;
  }

  // Convert bits to byte array
  const dataBytes: number[] = [];
  for (let i = 0; i < bitStream.length; i += 8) {
    let byteVal = 0;
    for (let b = 0; b < 8; b++) {
      byteVal = (byteVal << 1) | bitStream[i + b];
    }
    dataBytes.push(byteVal);
  }

  // Calculate Reed-Solomon Error Correction (18 EC bytes for V4-M, 2 blocks)
  const ecBytes = rsCompute(dataBytes.slice(0, 32), 18);
  const ecBytes2 = rsCompute(dataBytes.slice(32, 64), 18);

  // Interleave data and EC
  const interleaved: number[] = [];
  for (let i = 0; i < 32; i++) {
    interleaved.push(dataBytes[i]);
    interleaved.push(dataBytes[32 + i]);
  }
  for (let i = 0; i < 18; i++) {
    interleaved.push(ecBytes[i]);
    interleaved.push(ecBytes2[i]);
  }

  // Convert all to final bitstream
  const finalBits: number[] = [];
  for (const b of interleaved) {
    for (let i = 7; i >= 0; i--) {
      finalBits.push((b >> i) & 1);
    }
  }

  // 6. Place data bits in matrix (columns 2 at a time, zigzag right to left)
  let bitIndex = 0;
  let upward = true;

  for (let x = size - 1; x > 0; x -= 2) {
    if (x === 6) x--; // Skip timing column
    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const y of rows) {
      for (const col of [x, x - 1]) {
        if (matrix[y][col] === null) {
          const bit = bitIndex < finalBits.length ? finalBits[bitIndex++] : 0;
          // Apply Standard Mask Pattern 0: (x + y) % 2 === 0
          const mask = (col + y) % 2 === 0;
          matrix[y][col] = (bit ^ (mask ? 1 : 0)) === 1;
        }
      }
    }
    upward = !upward;
  }

  // Fill format information (Mask 0, Level M -> 101010000010010)
  const formatInfo = 0b101010000010010;
  for (let i = 0; i < 15; i++) {
    const bit = ((formatInfo >> (14 - i)) & 1) === 1;
    if (i <= 5) matrix[8][i] = bit;
    else if (i === 6) matrix[8][7] = bit;
    else if (i <= 8) matrix[8][8 - (i - 7)] = bit;
    else matrix[14 - (i - 9)][8] = bit;
  }

  // Replace remaining nulls with false
  return matrix.map((row) => row.map((cell) => cell ?? false));
}
