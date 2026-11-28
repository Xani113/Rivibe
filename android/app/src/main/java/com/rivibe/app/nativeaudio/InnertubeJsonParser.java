package com.rivibe.app.nativeaudio;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Parses YouTube Music Innertube responses (search, next/radio, browse/related, and player formats)
 * into normalized JSON track records and ranked audio stream candidates.
 */
public final class InnertubeJsonParser {

    private static final Pattern CODEC_PATTERN = Pattern.compile("codecs=\"([^\"]+)\"");
    private static final Pattern TIME_PATTERN = Pattern.compile("^\\d+(?::\\d{1,2}){1,2}$");

    private InnertubeJsonParser() {}

    public static final class StreamCandidate {
        public final int itag;
        public final String url;
        public final String signatureCipher;
        public final String cipher;
        public final String mimeType;
        public final int bitrate;
        public final int sampleRate;
        public final long approxDurationMs;

        public StreamCandidate(
                int itag,
                String url,
                String signatureCipher,
                String cipher,
                String mimeType,
                int bitrate,
                int sampleRate,
                long approxDurationMs
        ) {
            this.itag = itag;
            this.url = url;
            this.signatureCipher = signatureCipher;
            this.cipher = cipher;
            this.mimeType = mimeType;
            this.bitrate = bitrate;
            this.sampleRate = sampleRate;
            this.approxDurationMs = approxDurationMs;
        }
    }

    public static JSONArray parseSearchSongs(JSONObject root, int limit) {
        JSONArray results = new JSONArray();
        Set<String> seenVideoIds = new HashSet<>();
        collectRenderersRecursive(root, results, seenVideoIds, limit);
        return results;
    }

    public static String extractRelatedBrowseId(JSONObject nextResponse) {
        JSONObject singleCol = optObj(nextResponse, "contents", "singleColumnMusicWatchNextResultsRenderer");
        JSONObject tabbed = optObj(singleCol, "tabbedRenderer", "watchNextTabbedResultsRenderer");
        if (tabbed == null) return null;
        JSONArray tabs = tabbed.optJSONArray("tabs");
        if (tabs == null) return null;

        for (int i = 0; i < tabs.length(); i++) {
            JSONObject tabRenderer = optObj(tabs.optJSONObject(i), "tabRenderer");
            JSONObject browseEndpoint = optObj(tabRenderer, "endpoint", "browseEndpoint");
            if (browseEndpoint != null) {
                String browseId = browseEndpoint.optString("browseId", "");
                if (!browseId.isEmpty() && (browseId.startsWith("MPTRt_") || i == 2)) {
                    return browseId;
                }
            }
        }
        return null;
    }

    public static String extractAutomixPlaylistId(JSONObject nextResponse) {
        JSONArray panelContents = optArray(
                nextResponse,
                "contents",
                "singleColumnMusicWatchNextResultsRenderer",
                "tabbedRenderer",
                "watchNextTabbedResultsRenderer",
                "tabs"
        );
        if (panelContents == null || panelContents.length() == 0) return null;
        JSONObject firstTab = panelContents.optJSONObject(0);
        JSONArray queueItems = optArray(
                firstTab,
                "tabRenderer",
                "content",
                "musicQueueRenderer",
                "content",
                "playlistPanelRenderer",
                "contents"
        );
        if (queueItems == null) return null;
        for (int i = queueItems.length() - 1; i >= 0; i--) {
            JSONObject item = queueItems.optJSONObject(i);
            JSONObject watchPlaylistEndpoint = optObj(
                    item,
                    "automixPreviewVideoRenderer",
                    "content",
                    "automixPlaylistVideoRenderer",
                    "navigationEndpoint",
                    "watchPlaylistEndpoint"
            );
            if (watchPlaylistEndpoint != null) {
                String pid = watchPlaylistEndpoint.optString("playlistId", "");
                if (!pid.isEmpty()) return pid;
            }
        }
        return null;
    }

    public static JSONArray parseNextQueueAndRelated(JSONObject nextOrBrowseRoot, Set<String> seenVideoIds, int limit) {
        JSONArray out = new JSONArray();
        collectRenderersRecursive(nextOrBrowseRoot, out, seenVideoIds, limit);
        return out;
    }

    public static List<StreamCandidate> selectAudioCandidates(JSONObject playerResponse, String quality) {
        JSONObject streamingData = playerResponse != null ? playerResponse.optJSONObject("streamingData") : null;
        if (streamingData == null) return Collections.emptyList();

        JSONArray adaptive = streamingData.optJSONArray("adaptiveFormats");
        if (adaptive == null) return Collections.emptyList();

        List<StreamCandidate> audioFormats = new ArrayList<>();
        for (int i = 0; i < adaptive.length(); i++) {
            JSONObject f = adaptive.optJSONObject(i);
            if (f == null) continue;
            if (f.has("width") && !f.isNull("width")) continue; // video track
            String mimeType = f.optString("mimeType", "");
            if (!mimeType.toLowerCase(Locale.US).startsWith("audio/")) continue;

            int bitrate = f.optInt("bitrate", 0);
            if (bitrate <= 0) continue;

            String url = nonEmpty(f.optString("url", null));
            String sigCipher = nonEmpty(f.optString("signatureCipher", null));
            String cipher = nonEmpty(f.optString("cipher", null));
            if (url == null && sigCipher == null && cipher == null) continue;

            long approxDurationMs = 0L;
            String approxStr = f.optString("approxDurationMs", "");
            if (!approxStr.isEmpty()) {
                try {
                    approxDurationMs = Long.parseLong(approxStr);
                } catch (NumberFormatException ignored) {}
            }

            audioFormats.add(new StreamCandidate(
                    f.optInt("itag", 0),
                    url,
                    sigCipher,
                    cipher,
                    mimeType,
                    bitrate,
                    f.optInt("audioSampleRate", 44100),
                    approxDurationMs
            ));
        }

        if (audioFormats.isEmpty()) return Collections.emptyList();

        int targetBitrate;
        String q = quality == null ? "HIGHEST" : quality.trim().toUpperCase(Locale.US);
        switch (q) {
            case "LOW":
                targetBitrate = 70_000;
                break;
            case "HIGH":
                targetBitrate = 160_000;
                break;
            default:
                targetBitrate = 320_000;
                break;
        }

        Comparator<StreamCandidate> preferHigher = (a, b) -> {
            int directCmp = Boolean.compare(b.url != null, a.url != null);
            if (directCmp != 0) return directCmp;
            int bitCmp = Integer.compare(b.bitrate, a.bitrate);
            if (bitCmp != 0) return bitCmp;
            int codecCmp = Integer.compare(codecRank(b.mimeType), codecRank(a.mimeType));
            return codecCmp;
        };

        List<StreamCandidate> belowOrEqual = new ArrayList<>();
        List<StreamCandidate> aboveTarget = new ArrayList<>();
        for (StreamCandidate candidate : audioFormats) {
            if (candidate.bitrate <= targetBitrate) {
                belowOrEqual.add(candidate);
            } else {
                aboveTarget.add(candidate);
            }
        }

        if (!belowOrEqual.isEmpty()) {
            belowOrEqual.sort(preferHigher);
            return belowOrEqual;
        }
        aboveTarget.sort((a, b) -> {
            int directCmp = Boolean.compare(b.url != null, a.url != null);
            if (directCmp != 0) return directCmp;
            return Integer.compare(a.bitrate, b.bitrate);
        });
        return aboveTarget;
    }

    public static boolean isLikelyPreview(StreamCandidate candidate, long expectedDurationMs) {
        if (expectedDurationMs < 90_000L || candidate.approxDurationMs <= 0L) return false;
        long cap = Math.min(90_000L, (expectedDurationMs * 9L) / 10L);
        return candidate.approxDurationMs >= 1L && candidate.approxDurationMs <= cap;
    }

    public static String toHighResThumbnail(String url) {
        if (url == null || url.isEmpty()) return "";
        if (url.contains("googleusercontent.com") && url.contains("=")) {
            return url.substring(0, url.indexOf('=')) + "=w540-h540-l90-rj";
        }
        // Keep hqdefault.jpg instead of rewriting to maxresdefault.jpg, which 404s on many tracks
        return url;
    }

    public static int parseDurationSeconds(String text) {
        if (text == null) return 0;
        String trimmed = text.trim();
        if (!TIME_PATTERN.matcher(trimmed).matches()) return 0;
        String[] parts = trimmed.split(":");
        try {
            if (parts.length == 2) {
                return Integer.parseInt(parts[0]) * 60 + Integer.parseInt(parts[1]);
            }
            if (parts.length == 3) {
                return Integer.parseInt(parts[0]) * 3600
                        + Integer.parseInt(parts[1]) * 60
                        + Integer.parseInt(parts[2]);
            }
        } catch (NumberFormatException ignored) {}
        return 0;
    }

    private static int codecRank(String mimeType) {
        if (mimeType == null) return 0;
        Matcher m = CODEC_PATTERN.matcher(mimeType);
        String codec = m.find() ? m.group(1) : mimeType;
        String lower = codec == null ? "" : codec.toLowerCase(Locale.US);
        if (lower.contains("opus")) return 3;
        if (lower.contains("mp4a")) return 2;
        return 1;
    }

    private static void collectRenderersRecursive(
            Object node,
            JSONArray results,
            Set<String> seenIds,
            int limit
    ) {
        if (node == null || results.length() >= limit) return;
        if (node instanceof JSONObject) {
            JSONObject obj = (JSONObject) node;

            JSONObject listRenderer = obj.optJSONObject("musicResponsiveListItemRenderer");
            if (listRenderer != null) {
                JSONObject track = parseMusicResponsiveListItem(listRenderer);
                if (track != null) {
                    String vid = track.optString("youtubeVideoId", "");
                    if (!vid.isEmpty() && seenIds.add(vid)) {
                        results.put(track);
                    }
                }
                if (results.length() >= limit) return;
            }

            JSONObject panelRenderer = obj.optJSONObject("playlistPanelVideoRenderer");
            if (panelRenderer != null) {
                JSONObject track = parsePlaylistPanelVideo(panelRenderer);
                if (track != null) {
                    String vid = track.optString("youtubeVideoId", "");
                    if (!vid.isEmpty() && seenIds.add(vid)) {
                        results.put(track);
                    }
                }
                if (results.length() >= limit) return;
            }

            JSONArray names = obj.names();
            if (names != null) {
                for (int i = 0; i < names.length(); i++) {
                    String key = names.optString(i);
                    collectRenderersRecursive(obj.opt(key), results, seenIds, limit);
                    if (results.length() >= limit) return;
                }
            }
        } else if (node instanceof JSONArray) {
            JSONArray arr = (JSONArray) node;
            for (int i = 0; i < arr.length(); i++) {
                collectRenderersRecursive(arr.opt(i), results, seenIds, limit);
                if (results.length() >= limit) return;
            }
        }
    }

    private static JSONObject parseMusicResponsiveListItem(JSONObject renderer) {
        String videoId = optString(renderer, "playlistItemData", "videoId");
        if (videoId.isEmpty()) {
            videoId = optString(
                    renderer,
                    "overlay",
                    "musicItemThumbnailOverlayRenderer",
                    "content",
                    "musicPlayButtonRenderer",
                    "playNavigationEndpoint",
                    "watchEndpoint",
                    "videoId"
            );
        }
        if (videoId.isEmpty()) {
            videoId = optString(renderer, "navigationEndpoint", "watchEndpoint", "videoId");
        }
        if (videoId.isEmpty()) return null;

        JSONArray flexColumns = renderer.optJSONArray("flexColumns");
        if (flexColumns == null || flexColumns.length() == 0) return null;

        JSONArray titleRuns = optArray(
                flexColumns.optJSONObject(0),
                "musicResponsiveListItemFlexColumnRenderer",
                "text",
                "runs"
        );
        String title = (titleRuns != null && titleRuns.length() > 0 && titleRuns.optJSONObject(0) != null)
                ? titleRuns.optJSONObject(0).optString("text", "")
                : "";
        if (title.isEmpty()) return null;

        JSONArray metaRuns = flexColumns.length() > 1
                ? optArray(flexColumns.optJSONObject(1), "musicResponsiveListItemFlexColumnRenderer", "text", "runs")
                : null;

        ParsedMetadata meta = parseRunsMetadata(metaRuns);
        String thumb = extractLastThumbnail(optArray(renderer, "thumbnail", "musicThumbnailRenderer", "thumbnail", "thumbnails"));
        boolean explicit = hasExplicitBadge(renderer.optJSONArray("badges"));

        return buildTrackJson(videoId, title, meta.artist, meta.album, thumb, meta.durationSec, explicit);
    }

    private static JSONObject parsePlaylistPanelVideo(JSONObject renderer) {
        String videoId = renderer.optString("videoId", "");
        if (videoId.isEmpty()) {
            videoId = optString(renderer, "navigationEndpoint", "watchEndpoint", "videoId");
        }
        if (videoId.isEmpty()) return null;

        JSONArray titleRuns = optArray(renderer, "title", "runs");
        String title = (titleRuns != null && titleRuns.length() > 0 && titleRuns.optJSONObject(0) != null)
                ? titleRuns.optJSONObject(0).optString("text", "")
                : "";
        if (title.isEmpty()) return null;

        JSONArray bylineRuns = optArray(renderer, "longBylineText", "runs");
        if (bylineRuns == null) {
            bylineRuns = optArray(renderer, "shortBylineText", "runs");
        }
        ParsedMetadata meta = parseRunsMetadata(bylineRuns);

        int durationSec = meta.durationSec;
        if (durationSec <= 0) {
            JSONArray lenRuns = optArray(renderer, "lengthText", "runs");
            if (lenRuns != null && lenRuns.length() > 0 && lenRuns.optJSONObject(0) != null) {
                durationSec = parseDurationSeconds(lenRuns.optJSONObject(0).optString("text", ""));
            }
        }

        String thumb = extractLastThumbnail(optArray(renderer, "thumbnail", "thumbnails"));
        boolean explicit = hasExplicitBadge(renderer.optJSONArray("badges"));

        return buildTrackJson(videoId, title, meta.artist, meta.album, thumb, durationSec, explicit);
    }

    private static final class ParsedMetadata {
        final String artist;
        final String album;
        final int durationSec;

        ParsedMetadata(String artist, String album, int durationSec) {
            this.artist = artist;
            this.album = album;
            this.durationSec = durationSec;
        }
    }

    private static ParsedMetadata parseRunsMetadata(JSONArray runs) {
        if (runs == null || runs.length() == 0) {
            return new ParsedMetadata("YouTube Music", "YouTube Music", 0);
        }

        List<List<JSONObject>> groups = new ArrayList<>();
        List<JSONObject> current = new ArrayList<>();
        for (int i = 0; i < runs.length(); i++) {
            JSONObject r = runs.optJSONObject(i);
            if (r == null) continue;
            String text = r.optString("text", "");
            if (" \u2022 ".equals(text) || "•".equals(text.trim())) {
                if (!current.isEmpty()) {
                    groups.add(current);
                    current = new ArrayList<>();
                }
            } else if (!text.trim().isEmpty()) {
                current.add(r);
            }
        }
        if (!current.isEmpty()) groups.add(current);

        int durationSec = 0;
        if (!groups.isEmpty()) {
            List<JSONObject> lastGroup = groups.get(groups.size() - 1);
            if (!lastGroup.isEmpty()) {
                int parsed = parseDurationSeconds(lastGroup.get(0).optString("text", ""));
                if (parsed > 0) {
                    durationSec = parsed;
                    groups.remove(groups.size() - 1);
                }
            }
        }

        StringBuilder artistBuilder = new StringBuilder();
        if (!groups.isEmpty()) {
            // Skip leading label like "Song" or "Video" when first group lacks navigationEndpoint
            int artistGroupIndex = 0;
            if (groups.size() > 1 && groups.get(0).size() == 1) {
                String maybeType = groups.get(0).get(0).optString("text", "").trim().toLowerCase(Locale.US);
                if ("song".equals(maybeType) || "video".equals(maybeType) || "single".equals(maybeType)) {
                    artistGroupIndex = 1;
                }
            }
            if (artistGroupIndex < groups.size()) {
                for (JSONObject r : groups.get(artistGroupIndex)) {
                    String txt = r.optString("text", "").trim();
                    if (!txt.isEmpty() && !"&".equals(txt) && !",".equals(txt)) {
                        if (artistBuilder.length() > 0) artistBuilder.append(", ");
                        artistBuilder.append(txt);
                    }
                }
            }
            String album = "YouTube Music";
            int albumGroupIndex = artistGroupIndex + 1;
            if (albumGroupIndex < groups.size() && !groups.get(albumGroupIndex).isEmpty()) {
                String candidateAlbum = groups.get(albumGroupIndex).get(0).optString("text", "").trim();
                if (!candidateAlbum.isEmpty() && !candidateAlbum.endsWith("plays")) {
                    album = candidateAlbum;
                }
            }
            String artist = artistBuilder.length() > 0 ? artistBuilder.toString() : "YouTube Music";
            return new ParsedMetadata(artist, album, durationSec);
        }

        return new ParsedMetadata("YouTube Music", "YouTube Music", durationSec);
    }

    private static String extractLastThumbnail(JSONArray thumbs) {
        if (thumbs == null || thumbs.length() == 0) return "";
        JSONObject last = thumbs.optJSONObject(thumbs.length() - 1);
        if (last == null) return "";
        return toHighResThumbnail(last.optString("url", ""));
    }

    private static boolean hasExplicitBadge(JSONArray badges) {
        if (badges == null) return false;
        for (int i = 0; i < badges.length(); i++) {
            String iconType = optString(badges.optJSONObject(i), "musicInlineBadgeRenderer", "icon", "iconType");
            if ("MUSIC_EXPLICIT_BADGE".equals(iconType)) return true;
        }
        return false;
    }

    private static JSONObject buildTrackJson(
            String videoId,
            String title,
            String artist,
            String album,
            String artworkUrl,
            int durationSec,
            boolean explicit
    ) {
        try {
            JSONObject obj = new JSONObject();
            obj.put("id", videoId);
            obj.put("title", title.trim());
            obj.put("artist", artist.isEmpty() ? "YouTube Music" : artist);
            obj.put("album", album.isEmpty() ? "YouTube Music" : album);
            obj.put("artworkUrl", artworkUrl.isEmpty()
                    ? "https://i.ytimg.com/vi/" + videoId + "/hqdefault.jpg"
                    : artworkUrl);
            obj.put("youtubeVideoId", videoId);
            obj.put("durationSec", durationSec > 0 ? durationSec : 200);
            obj.put("source", "youtube");
            obj.put("externalUrl", "https://music.youtube.com/watch?v=" + videoId);
            obj.put("explicit", explicit);
            return obj;
        } catch (JSONException e) {
            return null;
        }
    }

    private static JSONObject optObj(JSONObject root, String... path) {
        JSONObject cur = root;
        for (String key : path) {
            if (cur == null) return null;
            cur = cur.optJSONObject(key);
        }
        return cur;
    }

    private static JSONArray optArray(JSONObject root, String... path) {
        if (root == null || path.length == 0) return null;
        JSONObject cur = root;
        for (int i = 0; i < path.length - 1; i++) {
            cur = cur.optJSONObject(path[i]);
            if (cur == null) return null;
        }
        return cur.optJSONArray(path[path.length - 1]);
    }

    private static String optString(JSONObject root, String... path) {
        if (root == null || path.length == 0) return "";
        JSONObject cur = root;
        for (int i = 0; i < path.length - 1; i++) {
            String key = path[i];
            if ("0".equals(key)) return "";
            cur = cur.optJSONObject(key);
            if (cur == null) return "";
        }
        return cur.optString(path[path.length - 1], "");
    }

    private static String nonEmpty(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
