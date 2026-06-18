export const PUBLIC_USER_ID_LENGTH = 9;
export const PUBLIC_USER_ID_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const RANDOM_BYTE_LIMIT =
  Math.floor(256 / PUBLIC_USER_ID_ALPHABET.length) * PUBLIC_USER_ID_ALPHABET.length;

export type FillRandomBytes = (buffer: Uint8Array) => void;

export function generatePublicUserId(
  fillRandomBytes: FillRandomBytes = fillCryptoRandomBytes,
): string {
  let publicUserId = "";
  const randomBytes = new Uint8Array(PUBLIC_USER_ID_LENGTH);

  while (publicUserId.length < PUBLIC_USER_ID_LENGTH) {
    fillRandomBytes(randomBytes);

    for (const byte of randomBytes) {
      if (byte >= RANDOM_BYTE_LIMIT) {
        continue;
      }

      publicUserId += PUBLIC_USER_ID_ALPHABET[byte % PUBLIC_USER_ID_ALPHABET.length];

      if (publicUserId.length === PUBLIC_USER_ID_LENGTH) {
        break;
      }
    }
  }

  return publicUserId;
}

function fillCryptoRandomBytes(buffer: Uint8Array): void {
  globalThis.crypto.getRandomValues(buffer);
}
