import jsQR from "jsqr";
import QRCode from "qrcode";

/** Nastavení QR, se kterým appka kreslí kód na fakturu i do PDF. */
export const QR_OPTIONS = { errorCorrectionLevel: "M" } as const;
export const QR_MARGIN = 4;

/**
 * Vykreslí QR do RGBA bitmapy a přečte ho zpátky dekodérem. Testy tím ověří
 * celou cestu payload → QR → čtečka, tedy to, co udělá bankovní aplikace.
 */
export function decodeQr(payload: string, scale: number) {
  const { modules } = QRCode.create(payload, QR_OPTIONS);
  const size = (modules.size + QR_MARGIN * 2) * scale;
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);

  for (let row = 0; row < modules.size; row += 1) {
    for (let column = 0; column < modules.size; column += 1) {
      if (!modules.data[row * modules.size + column]) {
        continue;
      }

      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          const x = (column + QR_MARGIN) * scale + dx;
          const y = (row + QR_MARGIN) * scale + dy;
          const offset = (y * size + x) * 4;

          pixels[offset] = 0;
          pixels[offset + 1] = 0;
          pixels[offset + 2] = 0;
        }
      }
    }
  }

  return jsQR(pixels, size, size)?.data ?? null;
}

/** Vytáhne z payloadu hodnotu jednoho pole, např. `X-VS`. */
export function readSpaydField(payload: string, field: string) {
  return (
    payload
      .split("*")
      .find((part) => part.startsWith(`${field}:`))
      ?.slice(field.length + 1) ?? null
  );
}
