package com.rivibe.app.nativeaudio;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import okhttp3.HttpUrl;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException;

/**
 * Keyless native YouTube Music Innertube API client for search, radio recommendations,
 * and direct full-length audio stream resolution.
 */
public final class InnertubeMusicClient {

    private static final MediaType JSON_MEDIA_TYPE = MediaType.get("application/json; charset=utf-8");
    private static final String FILTER_SONG_PARAM = "EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D";
    private static final long FAILED_CLIENT_BACKOFF_MS = 10 * 60 * 1000L;
    private static final Pattern VISITOR_DATA_PATTERN = Pattern.compile("\"(Cg[ts][^\"]{6,})\"");

    private static final Map<String, String> MOOD_QUERY_MAP = createMoodMap();

    public static final class ResolvedStream {
        public final String streamUrl;
        public final String mimeType;
        public final int bitrate;
        public final int durationSec;
        public final String clientName;
        public final long expiresAtMs;

        public ResolvedStream(
                String streamUrl,
                String mimeType,
                int bitrate,
                int durationSec,
                String clientName,
                long expiresAtMs
        ) {
            this.streamUrl = streamUrl;
            this.mimeType = mimeType;
            this.bitrate = bitrate;
            this.durationSec = durationSec;
            this.clientName = clientName;
            this.expiresAtMs = expiresAtMs;
        }
    }

    private final OkHttpClient apiClient;
    private final OkHttpClient probeClient;
    private final ConcurrentHashMap<String, ResolvedStream> streamCache = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> failedClientsUntil = new ConcurrentHashMap<>();
    private volatile String cachedVisitorData = null;

    public InnertubeMusicClient(OkHttpClient apiClient, OkHttpClient probeClient) {
        this.apiClient = apiClient;
        this.probeClient = probeClient;
    }

    public void invalidateStream(String videoId) {
        if (videoId == null) return;
        String clean = videoId.trim();
        for (String key : streamCache.keySet()) {
            if (key.startsWith(clean + ":")) {
                streamCache.remove(key);
            }
        }
    }

    public ResolvedStream getCachedStream(String videoId) {
        if (videoId == null) return null;
        long now = System.currentTimeMillis();
        for (Map.Entry<String, ResolvedStream> entry : streamCache.entrySet()) {
            if (entry.getKey().startsWith(videoId + ":") && entry.getValue().expiresAtMs > now + 45_000L) {
                return entry.getValue();
            }
        }
        return null;
    }

    public JSONArray searchSongs(String query, int limit) throws IOException, JSONException {
        String clean = query == null ? "" : query.trim();
        if (clean.isEmpty()) return new JSONArray();
        ensureVisitorData();

        JSONObject body = new JSONObject()
                .put("context", YouTubeClientConfig.WEB_REMIX.buildContext(cachedVisitorData, null))
                .put("query", clean)
                .put("params", FILTER_SONG_PARAM);

        JSONObject res = postInnertube("search", YouTubeClientConfig.WEB_REMIX, body);
        JSONArray parsed = InnertubeJsonParser.parseSearchSongs(res, Math.max(1, limit));

        if (parsed.length() == 0) {
            // Fallback without strict song filter for broad queries
            JSONObject broadBody = new JSONObject()
                    .put("context", YouTubeClientConfig.WEB_REMIX.buildContext(cachedVisitorData, null))
                    .put("query", clean);
            JSONObject broadRes = postInnertube("search", YouTubeClientConfig.WEB_REMIX, broadBody);
            parsed = InnertubeJsonParser.parseSearchSongs(broadRes, Math.max(1, limit));
        }

        return parsed;
    }

    public JSONArray fetchRelatedRecommendations(
            String videoId,
            String artist,
            String title,
            String mood,
            int limit
    ) throws IOException, JSONException {
        ensureVisitorData();
        int targetLimit = Math.max(1, Math.min(limit, 35));
        JSONArray out = new JSONArray();
        Set<String> seen = new HashSet<>();

        String cleanVid = videoId == null ? "" : videoId.replace("yt-", "").trim();
        if (!cleanVid.isEmpty()) {
            seen.add(cleanVid);

            // 1. YouTube Music Radio Mix ("RDAMVM" + videoId) returns ~20+ genuinely similar songs
            JSONObject radioBody = new JSONObject()
                    .put("context", YouTubeClientConfig.WEB_REMIX.buildContext(cachedVisitorData, null))
                    .put("videoId", cleanVid)
                    .put("playlistId", "RDAMVM" + cleanVid)
                    .put("isAudioOnly", true);
            JSONObject radioRes = safePostInnertube("next", YouTubeClientConfig.WEB_REMIX, radioBody);
            if (radioRes != null) {
                appendUnique(out, InnertubeJsonParser.parseNextQueueAndRelated(radioRes, seen, targetLimit), targetLimit);
            }

            // 2. Fallback to standard next queue, automix playlist, and related browse tab
            if (out.length() < targetLimit) {
                JSONObject nextBody = new JSONObject()
                        .put("context", YouTubeClientConfig.WEB_REMIX.buildContext(cachedVisitorData, null))
                        .put("videoId", cleanVid)
                        .put("isAudioOnly", true);

                JSONObject nextRes = safePostInnertube("next", YouTubeClientConfig.WEB_REMIX, nextBody);
                if (nextRes != null) {
                    appendUnique(out, InnertubeJsonParser.parseNextQueueAndRelated(nextRes, seen, targetLimit), targetLimit);

                    if (out.length() < targetLimit) {
                        String automixId = InnertubeJsonParser.extractAutomixPlaylistId(nextRes);
                        if (automixId != null) {
                            JSONObject mixBody = new JSONObject()
                                    .put("context", YouTubeClientConfig.WEB_REMIX.buildContext(cachedVisitorData, null))
                                    .put("playlistId", automixId)
                                    .put("isAudioOnly", true);
                            JSONObject mixRes = safePostInnertube("next", YouTubeClientConfig.WEB_REMIX, mixBody);
                            if (mixRes != null) {
                                appendUnique(out, InnertubeJsonParser.parseNextQueueAndRelated(mixRes, seen, targetLimit), targetLimit);
                            }
                        }
                    }

                    if (out.length() < targetLimit) {
                        String relatedBrowseId = InnertubeJsonParser.extractRelatedBrowseId(nextRes);
                        if (relatedBrowseId != null) {
                            JSONObject browseBody = new JSONObject()
                                    .put("context", YouTubeClientConfig.WEB_REMIX.buildContext(cachedVisitorData, null))
                                    .put("browseId", relatedBrowseId);
                            JSONObject browseRes = safePostInnertube("browse", YouTubeClientConfig.WEB_REMIX, browseBody);
                            if (browseRes != null) {
                                appendUnique(out, InnertubeJsonParser.parseNextQueueAndRelated(browseRes, seen, targetLimit), targetLimit);
                            }
                        }
                    }
                }
            }
        }

        if (out.length() < Math.min(targetLimit, 12)) {
            String fallbackQuery;
            if (artist != null && !artist.trim().isEmpty()) {
                // Use clean primary artist name so song filter returns tracks by same/similar artists
                String primaryArtist = artist.split("[,&]|(?i)\\s+(?:feat|ft)\\.?\\s+")[0].trim();
                fallbackQuery = primaryArtist.isEmpty() ? artist.trim() : primaryArtist;
            } else {
                String moodKey = mood == null ? "all" : mood.trim().toLowerCase(Locale.US);
                fallbackQuery = MOOD_QUERY_MAP.getOrDefault(moodKey, MOOD_QUERY_MAP.get("all"));
            }
            JSONArray searched = searchSongs(fallbackQuery, targetLimit);
            appendUnique(out, searched, targetLimit);
        }

        return out;
    }

    public ResolvedStream resolveAudioStream(String rawVideoId, String quality) throws Exception {
        String videoId = rawVideoId == null ? "" : rawVideoId.replace("yt-", "").trim();
        if (videoId.isEmpty()) {
            throw new IllegalArgumentException("Missing videoId");
        }

        String normalizedQuality = (quality == null || quality.isEmpty())
                ? "HIGHEST"
                : quality.toUpperCase(Locale.US);
        String cacheKey = videoId + ":" + normalizedQuality;

        ResolvedStream cached = streamCache.get(cacheKey);
        if (cached != null && cached.expiresAtMs > System.currentTimeMillis() + 45_000L) {
            return cached;
        }

        ensureVisitorData();
        Integer signatureTimestamp = NewPipeBridge.getSignatureTimestampOrNull(apiClient, videoId);

        long expectedDurationMs = 0L;
        try {
            JSONObject metaRes = postPlayer(videoId, YouTubeClientConfig.IOS, signatureTimestamp, null);
            JSONObject details = metaRes.optJSONObject("videoDetails");
            if (details != null) {
                long lenSec = details.optLong("lengthSeconds", 0L);
                if (lenSec > 0L) expectedDurationMs = lenSec * 1000L;
            }
        } catch (Exception ignored) {}

        boolean sawBotDetection = false;
        ReCaptchaException reCaptchaError = null;
        long now = System.currentTimeMillis();

        for (YouTubeClientConfig client : YouTubeClientConfig.STREAM_CLIENTS) {
            Long blockedUntil = failedClientsUntil.get(client.clientName);
            if (blockedUntil != null && blockedUntil > now) {
                continue;
            }
            if (blockedUntil != null) {
                failedClientsUntil.remove(client.clientName);
            }

            String poToken = null;
            if (client.needsServiceIntegrity()) {
                poToken = PoTokenGenerator.generateContentToken(cachedVisitorData, videoId);
            }

            JSONObject playerRes;
            try {
                playerRes = postPlayer(videoId, client, signatureTimestamp, poToken);
            } catch (Exception ex) {
                continue;
            }

            JSONObject statusObj = playerRes.optJSONObject("playabilityStatus");
            String status = statusObj != null ? statusObj.optString("status", "") : "";
            if (!"OK".equalsIgnoreCase(status)) {
                String reason = statusObj != null ? statusObj.optString("reason", "") : "";
                if (isBotDetectionReason(reason)) {
                    sawBotDetection = true;
                    failedClientsUntil.put(client.clientName, System.currentTimeMillis() + FAILED_CLIENT_BACKOFF_MS);
                }
                continue;
            }

            List<InnertubeJsonParser.StreamCandidate> candidates =
                    InnertubeJsonParser.selectAudioCandidates(playerRes, normalizedQuality);
            if (candidates.isEmpty()) continue;

            JSONObject streamingData = playerRes.optJSONObject("streamingData");
            int expiresInSeconds = streamingData != null ? streamingData.optInt("expiresInSeconds", 18000) : 18000;
            int detailsDuration = 0;
            JSONObject videoDetails = playerRes.optJSONObject("videoDetails");
            if (videoDetails != null) {
                detailsDuration = videoDetails.optInt("lengthSeconds", 0);
            }

            int limit = Math.min(candidates.size(), 6);
            for (int i = 0; i < limit; i++) {
                InnertubeJsonParser.StreamCandidate candidate = candidates.get(i);
                if (InnertubeJsonParser.isLikelyPreview(candidate, expectedDurationMs)) {
                    continue;
                }

                String resolvedUrl;
                try {
                    resolvedUrl = NewPipeBridge.resolveStreamUrl(
                            apiClient,
                            candidate,
                            videoId,
                            client,
                            poToken
                    );
                } catch (ReCaptchaException rec) {
                    reCaptchaError = rec;
                    break;
                } catch (Exception ignored) {
                    continue;
                }

                if (validateStreamStatus(resolvedUrl, client)) {
                    int finalDurationSec = detailsDuration > 0
                            ? detailsDuration
                            : (candidate.approxDurationMs > 0 ? (int) Math.round(candidate.approxDurationMs / 1000.0) : 200);
                    ResolvedStream resolved = new ResolvedStream(
                            resolvedUrl,
                            candidate.mimeType,
                            candidate.bitrate,
                            finalDurationSec,
                            client.clientName,
                            System.currentTimeMillis() + (expiresInSeconds * 1000L)
                    );
                    streamCache.put(cacheKey, resolved);
                    return resolved;
                }
            }
            if (reCaptchaError != null) break;
        }

        if (reCaptchaError != null) {
            throw new IOException("YouTube temporarily requested human verification — please try another track.", reCaptchaError);
        }
        if (sawBotDetection) {
            throw new IOException("YouTube temporarily rate-limited stream clients from this network — please retry in a moment.");
        }
        throw new IOException("No playable audio stream found for " + videoId);
    }

    private void ensureVisitorData() {
        if (cachedVisitorData != null && !cachedVisitorData.isEmpty()) return;
        Request req = new Request.Builder()
                .url("https://music.youtube.com/sw.js_data")
                .header("User-Agent", YouTubeClientConfig.USER_AGENT_WEB)
                .header("Referer", YouTubeClientConfig.REFERER_YOUTUBE_MUSIC)
                .get()
                .build();
        try (Response res = apiClient.newCall(req).execute()) {
            if (res.isSuccessful() && res.body() != null) {
                String text = res.body().string();
                Matcher m = VISITOR_DATA_PATTERN.matcher(text);
                if (m.find()) {
                    cachedVisitorData = m.group(1);
                }
            }
        } catch (Exception ignored) {}
    }

    private JSONObject postPlayer(
            String videoId,
            YouTubeClientConfig client,
            Integer signatureTimestamp,
            String poToken
    ) throws IOException, JSONException {
        JSONObject body = new JSONObject()
                .put("context", client.buildContext(cachedVisitorData, videoId))
                .put("videoId", videoId)
                .put("contentCheckOk", true)
                .put("racyCheckOk", true);

        if (client.useSignatureTimestamp && signatureTimestamp != null) {
            body.put("playbackContext", new JSONObject().put(
                    "contentPlaybackContext",
                    new JSONObject().put("signatureTimestamp", signatureTimestamp)
            ));
        }
        if (poToken != null && !poToken.isEmpty()) {
            body.put("serviceIntegrityDimensions", new JSONObject().put("poToken", poToken));
        }

        return postInnertube("player", client, body);
    }

    private JSONObject safePostInnertube(String endpoint, YouTubeClientConfig client, JSONObject jsonBody) {
        try {
            return postInnertube(endpoint, client, jsonBody);
        } catch (Exception ignored) {
            return null;
        }
    }

    private JSONObject postInnertube(String endpoint, YouTubeClientConfig client, JSONObject jsonBody)
            throws IOException, JSONException {
        String url = YouTubeClientConfig.API_URL_YOUTUBE_MUSIC + endpoint + "?prettyPrint=false";
        RequestBody body = RequestBody.create(jsonBody.toString(), JSON_MEDIA_TYPE);

        Request request = new Request.Builder()
                .url(url)
                .header("Content-Type", "application/json")
                .header("X-Goog-Api-Format-Version", "1")
                .header("X-YouTube-Client-Name", client.clientId)
                .header("X-YouTube-Client-Version", client.clientVersion)
                .header("X-Origin", YouTubeClientConfig.ORIGIN_YOUTUBE_MUSIC)
                .header("Referer", YouTubeClientConfig.REFERER_YOUTUBE_MUSIC)
                .header("User-Agent", client.userAgent)
                .post(body)
                .build();

        try (Response res = apiClient.newCall(request).execute()) {
            if (!res.isSuccessful()) {
                throw new IOException("Innertube HTTP " + res.code() + " on " + endpoint);
            }
            String text = res.body() != null ? res.body().string() : "{}";
            return new JSONObject(text);
        }
    }

    private boolean validateStreamStatus(String streamUrl, YouTubeClientConfig client) {
        HttpUrl parsed = HttpUrl.parse(streamUrl);
        String cParam = parsed != null ? parsed.queryParameter("c") : null;
        String ua = (cParam != null && !cParam.isEmpty())
                ? YouTubeClientConfig.resolveUserAgent(cParam)
                : client.userAgent;
        String origin = YouTubeClientConfig.resolveOrigin(cParam);
        String referer = YouTubeClientConfig.resolveReferer(cParam);

        String[] probeRanges = YouTubeClientConfig.isWebLikeClient(cParam)
                ? new String[] { "bytes=0-0", "bytes=262144-262145" }
                : new String[] { "bytes=0-0" };

        for (String range : probeRanges) {
            Request.Builder reqBuilder = new Request.Builder()
                    .url(streamUrl)
                    .get()
                    .header("User-Agent", ua)
                    .header("Range", range);
            if (origin != null) reqBuilder.header("Origin", origin);
            if (referer != null) reqBuilder.header("Referer", referer);

            try (Response res = probeClient.newCall(reqBuilder.build()).execute()) {
                int code = res.code();
                if (code == 403) return false;
                if ((code < 200 || code >= 400) && code != 416) return false;
            } catch (Exception ignored) {
                return false;
            }
        }
        return true;
    }

    private static boolean isBotDetectionReason(String reason) {
        if (reason == null) return false;
        String lower = reason.toLowerCase(Locale.US);
        return lower.contains("sign in")
                || lower.contains("bot")
                || (lower.contains("confirm") && lower.contains("not a"))
                || (lower.contains("verify") && lower.contains("human"));
    }

    private static void appendUnique(JSONArray target, JSONArray incoming, int limit) {
        if (incoming == null) return;
        for (int i = 0; i < incoming.length() && target.length() < limit; i++) {
            JSONObject obj = incoming.optJSONObject(i);
            if (obj != null) target.put(obj);
        }
    }

    private static Map<String, String> createMoodMap() {
        Map<String, String> m = new HashMap<>();
        m.put("all", "top hits chill electronic indie");
        m.put("for-you", "indie synth pop chill mix");
        m.put("chill", "chill acoustic indie lofi");
        m.put("focus", "ambient instrumental study piano");
        m.put("late-night", "late night r&b synthwave");
        m.put("workout", "upbeat electronic dance hits");
        m.put("indie", "indie alternative dream pop");
        m.put("jazz", "modern jazz instrumental mix");
        return m;
    }
}
