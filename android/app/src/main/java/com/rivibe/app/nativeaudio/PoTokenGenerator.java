package com.rivibe.app.nativeaudio;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;

/**
 * Generates deterministic cold-start Proof-of-Origin tokens from visitorData and videoId
 * when a web-type Innertube client requires a serviceIntegrityDimensions token.
 */
public final class PoTokenGenerator {

    private static final byte TOKEN_VERSION = 0x22;
    private static final byte MAGIC_HEADER = 0x0A;
    private static final byte INNER_TAG = 0x38;
    private static final byte TIMESTAMP_TAG = 0x02;
    private static final char[] URL_SAFE_ALPHABET =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private PoTokenGenerator() {}

    public static String generateContentToken(String identifier, String videoId) {
        String safeId = (identifier == null || identifier.isEmpty()) ? "dummy_visitor_data_for_token" : identifier;
        String safeState = (videoId == null) ? "" : videoId;

        byte[] idBytes = safeId.getBytes(StandardCharsets.UTF_8);
        byte[] stateBytes = safeState.getBytes(StandardCharsets.UTF_8);
        byte[] keyBytes = new byte[16];
        RANDOM.nextBytes(keyBytes);

        byte[] encryptedId = new byte[idBytes.length];
        for (int i = 0; i < idBytes.length; i++) {
            encryptedId[i] = (byte) (idBytes[i] ^ keyBytes[i % keyBytes.length]);
        }

        byte[] tsBytes = encodeLong(System.currentTimeMillis());

        ByteArrayOutputStream inner = new ByteArrayOutputStream();
        inner.write(INNER_TAG);
        writeVarInt(inner, stateBytes.length);
        inner.write(stateBytes, 0, stateBytes.length);
        inner.write(TIMESTAMP_TAG);
        writeVarInt(inner, tsBytes.length);
        inner.write(tsBytes, 0, tsBytes.length);
        byte[] innerBytes = inner.toByteArray();

        ByteArrayOutputStream payload = new ByteArrayOutputStream();
        payload.write(MAGIC_HEADER);
        writeVarInt(payload, keyBytes.length);
        payload.write(keyBytes, 0, keyBytes.length);
        payload.write(TOKEN_VERSION);
        writeVarInt(payload, encryptedId.length);
        payload.write(encryptedId, 0, encryptedId.length);
        payload.write(innerBytes, 0, innerBytes.length);

        return encodeUrlSafeNoPad(payload.toByteArray());
    }

    static String encodeUrlSafeNoPad(byte[] data) {
        StringBuilder sb = new StringBuilder(((data.length + 2) / 3) * 4);
        int i = 0;
        while (i < data.length) {
            int b0 = data[i++] & 0xFF;
            boolean hasB1 = i < data.length;
            int b1 = hasB1 ? (data[i++] & 0xFF) : 0;
            boolean hasB2 = i < data.length;
            int b2 = hasB2 ? (data[i++] & 0xFF) : 0;

            sb.append(URL_SAFE_ALPHABET[b0 >>> 2]);
            sb.append(URL_SAFE_ALPHABET[((b0 & 0x03) << 4) | (b1 >>> 4)]);
            if (hasB1) {
                sb.append(URL_SAFE_ALPHABET[((b1 & 0x0F) << 2) | (b2 >>> 6)]);
            }
            if (hasB2) {
                sb.append(URL_SAFE_ALPHABET[b2 & 0x3F]);
            }
        }
        return sb.toString();
    }

    private static byte[] encodeLong(long value) {
        byte[] buf = new byte[8];
        long v = value;
        for (int i = 0; i < 8; i++) {
            buf[i] = (byte) (v & 0xFF);
            v >>>= 8;
        }
        int len = 8;
        while (len > 1 && buf[len - 1] == 0) {
            len--;
        }
        byte[] out = new byte[len];
        System.arraycopy(buf, 0, out, 0, len);
        return out;
    }

    private static void writeVarInt(ByteArrayOutputStream out, int value) {
        int v = value;
        while (v >= 0x80) {
            out.write((v | 0x80) & 0xFF);
            v >>>= 7;
        }
        out.write(v & 0xFF);
    }
}
