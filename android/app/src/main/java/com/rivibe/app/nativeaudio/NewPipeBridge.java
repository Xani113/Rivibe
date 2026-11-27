package com.rivibe.app.nativeaudio;

import java.io.IOException;
import java.io.InterruptedIOException;
import java.net.SocketTimeoutException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import androidx.annotation.NonNull;
import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.RequestBody;
import org.schabi.newpipe.extractor.NewPipe;
import org.schabi.newpipe.extractor.downloader.Downloader;
import org.schabi.newpipe.extractor.downloader.Request;
import org.schabi.newpipe.extractor.downloader.Response;
import org.schabi.newpipe.extractor.exceptions.ParsingException;
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException;
import org.schabi.newpipe.extractor.services.youtube.YoutubeJavaScriptPlayerManager;

/**
 * Bridges RiVibe's Android layer with NewPipeExtractor for YouTube JS player signature
 * timestamp extraction, signature cipher decryption, and throttling parameter deobfuscation.
 */
public final class NewPipeBridge {

    private static volatile boolean initialized = false;

    private NewPipeBridge() {}

    public static synchronized void ensureInitialized(OkHttpClient baseClient) {
        if (initialized) return;
        NewPipe.init(new OkHttpNewPipeDownloader(baseClient));
        initialized = true;
    }

    public static Integer getSignatureTimestampOrNull(OkHttpClient client, String videoId) {
        ensureInitialized(client);
        try {
            return YoutubeJavaScriptPlayerManager.getSignatureTimestamp(videoId);
        } catch (Exception ignored) {
            return null;
        }
    }

    public static String resolveStreamUrl(
            OkHttpClient httpClient,
            InnertubeJsonParser.StreamCandidate candidate,
            String videoId,
            YouTubeClientConfig clientConfig,
            String poToken
    ) throws Exception {
        ensureInitialized(httpClient);

        String rawUrl = candidate.url;
        if (rawUrl == null || rawUrl.isEmpty()) {
            String cipherStr = candidate.signatureCipher != null
                    ? candidate.signatureCipher
                    : candidate.cipher;
            if (cipherStr == null || cipherStr.isEmpty()) {
                throw new ParsingException("Missing stream url and cipher");
            }
            Map<String, String> params = parseFormEncoded(cipherStr);
            String obfuscatedSig = params.get("s");
            String sigParam = params.getOrDefault("sp", "signature");
            String cipherUrl = params.get("url");
            if (obfuscatedSig == null || cipherUrl == null) {
                throw new ParsingException("Malformed signatureCipher parameters");
            }
            String clearSig = YoutubeJavaScriptPlayerManager.deobfuscateSignature(videoId, obfuscatedSig);
            HttpUrl parsed = HttpUrl.parse(cipherUrl);
            if (parsed == null) {
                throw new ParsingException("Invalid cipher base URL");
            }
            rawUrl = parsed.newBuilder()
                    .setQueryParameter(sigParam, clearSig)
                    .build()
                    .toString();
        }

        String deobfuscated = deobfuscateThrottlingWithRetry(videoId, rawUrl);

        HttpUrl parsedFinal = HttpUrl.parse(deobfuscated);
        if (parsedFinal != null) {
            HttpUrl.Builder builder = parsedFinal.newBuilder();
            if (clientConfig != null && parsedFinal.queryParameter("cver") != null) {
                builder.setQueryParameter("cver", clientConfig.clientVersion);
            }
            if (poToken != null && !poToken.isEmpty() && parsedFinal.queryParameter("pot") == null) {
                builder.addQueryParameter("pot", poToken);
            }
            deobfuscated = builder.build().toString();
        }

        return deobfuscated;
    }

    private static String deobfuscateThrottlingWithRetry(String videoId, String url) {
        long delayMs = 250L;
        for (int attempt = 0; attempt < 3; attempt++) {
            try {
                return YoutubeJavaScriptPlayerManager.getUrlWithThrottlingParameterDeobfuscated(videoId, url);
            } catch (Exception ex) {
                boolean retryable = ex instanceof SocketTimeoutException
                        || ex instanceof InterruptedIOException
                        || (ex.getCause() instanceof IOException);
                if (!retryable || attempt == 2) {
                    return url;
                }
                try {
                    Thread.sleep(delayMs);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return url;
                }
                delayMs = Math.min(delayMs * 2L, 2_000L);
            }
        }
        return url;
    }

    private static Map<String, String> parseFormEncoded(String raw) {
        Map<String, String> out = new LinkedHashMap<>();
        if (raw == null || raw.isEmpty()) return out;
        String[] pairs = raw.split("&");
        for (String pair : pairs) {
            int eq = pair.indexOf('=');
            if (eq <= 0) continue;
            try {
                String k = URLDecoder.decode(pair.substring(0, eq), StandardCharsets.UTF_8.name());
                String v = URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8.name());
                out.put(k, v);
            } catch (Exception ignored) {}
        }
        return out;
    }

    private static final class OkHttpNewPipeDownloader extends Downloader {

        private final OkHttpClient client;

        OkHttpNewPipeDownloader(OkHttpClient client) {
            this.client = client;
        }

        @Override
        public Response execute(@NonNull Request request) throws IOException, ReCaptchaException {
            String method = request.httpMethod();
            String url = request.url();
            byte[] data = request.dataToSend();

            okhttp3.Request.Builder builder = new okhttp3.Request.Builder().url(url);
            RequestBody body = null;
            if ("POST".equalsIgnoreCase(method) || "PUT".equalsIgnoreCase(method) || "PATCH".equalsIgnoreCase(method)) {
                body = RequestBody.create(data != null ? data : new byte[0], null);
            }
            builder.method(method, body);

            boolean hasUserAgent = false;
            Map<String, List<String>> headers = request.headers();
            if (headers != null) {
                for (Map.Entry<String, List<String>> entry : headers.entrySet()) {
                    String name = entry.getKey();
                    List<String> values = entry.getValue();
                    if (values == null || values.isEmpty()) continue;
                    if ("User-Agent".equalsIgnoreCase(name)) {
                        hasUserAgent = true;
                    }
                    builder.removeHeader(name);
                    for (String val : values) {
                        builder.addHeader(name, val);
                    }
                }
            }
            if (!hasUserAgent) {
                builder.header("User-Agent", YouTubeClientConfig.USER_AGENT_WEB);
            }

            try (okhttp3.Response res = client.newCall(builder.build()).execute()) {
                if (res.code() == 429) {
                    throw new ReCaptchaException("reCaptcha Challenge requested", url);
                }
                String resBody = res.body() != null ? res.body().string() : "";
                String latestUrl = res.request().url().toString();
                return new Response(
                        res.code(),
                        res.message(),
                        res.headers().toMultimap(),
                        resBody,
                        latestUrl
                );
            }
        }
    }
}
