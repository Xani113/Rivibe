package com.rivibe.app.nativeaudio;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

public class InnertubeJsonParserTest {

    @Test
    public void parseSearchSongs_extractsNormalizedTracks() throws Exception {
        String sampleJson = "{"
                + "\"contents\":{\"tabbedSearchResultsRenderer\":{\"tabs\":[{\"tabRenderer\":{\"content\":{\"sectionListRenderer\":{\"contents\":[{\"musicShelfRenderer\":{\"contents\":[{"
                + "\"musicResponsiveListItemRenderer\":{"
                + "\"playlistItemData\":{\"videoId\":\"vid123abc\"},"
                + "\"flexColumns\":["
                + "{\"musicResponsiveListItemFlexColumnRenderer\":{\"text\":{\"runs\":[{\"text\":\"Afterglow\"}]}}},"
                + "{\"musicResponsiveListItemFlexColumnRenderer\":{\"text\":{\"runs\":[{\"text\":\"Troye Sivan\"},{\"text\":\" • \"},{\"text\":\"Blue Neighbourhood\"},{\"text\":\" • \"},{\"text\":\"3:35\"}]}}}"
                + "],"
                + "\"thumbnail\":{\"musicThumbnailRenderer\":{\"thumbnail\":{\"thumbnails\":[{\"url\":\"https://lh3.googleusercontent.com/art=w120-h120\"}]}}},"
                + "\"badges\":[{\"musicInlineBadgeRenderer\":{\"icon\":{\"iconType\":\"MUSIC_EXPLICIT_BADGE\"}}}]"
                + "}"
                + "}]}}]}}}}]}}}";

        JSONArray parsed = InnertubeJsonParser.parseSearchSongs(new JSONObject(sampleJson), 10);
        assertEquals(1, parsed.length());
        JSONObject t = parsed.getJSONObject(0);
        assertEquals("vid123abc", t.getString("youtubeVideoId"));
        assertEquals("Afterglow", t.getString("title"));
        assertEquals("Troye Sivan", t.getString("artist"));
        assertEquals("Blue Neighbourhood", t.getString("album"));
        assertEquals(215, t.getInt("durationSec"));
        assertTrue(t.getString("artworkUrl").contains("w540-h540-l90-rj"));
        assertTrue(t.getBoolean("explicit"));
    }

    @Test
    public void selectAudioCandidates_ranksOpusHighestWithinTargetAndFiltersPreviews() throws Exception {
        String playerJson = "{"
                + "\"streamingData\":{\"adaptiveFormats\":["
                + "{\"itag\":137,\"mimeType\":\"video/mp4; codecs=\\\"avc1\\\"\",\"bitrate\":2000000,\"width\":1920,\"url\":\"https://v.example\"},"
                + "{\"itag\":140,\"mimeType\":\"audio/mp4; codecs=\\\"mp4a.40.2\\\"\",\"bitrate\":128000,\"approxDurationMs\":\"215000\",\"url\":\"https://m4a.example\"},"
                + "{\"itag\":251,\"mimeType\":\"audio/webm; codecs=\\\"opus\\\"\",\"bitrate\":135000,\"approxDurationMs\":\"215000\",\"url\":\"https://opus.example\"},"
                + "{\"itag\":139,\"mimeType\":\"audio/mp4; codecs=\\\"mp4a.40.5\\\"\",\"bitrate\":48000,\"approxDurationMs\":\"30000\",\"url\":\"https://prev.example\"}"
                + "]}}";

        List<InnertubeJsonParser.StreamCandidate> ranked =
                InnertubeJsonParser.selectAudioCandidates(new JSONObject(playerJson), "HIGHEST");

        assertEquals(3, ranked.size());
        assertEquals(251, ranked.get(0).itag);
        assertFalse(InnertubeJsonParser.isLikelyPreview(ranked.get(0), 215_000L));
        assertTrue(InnertubeJsonParser.isLikelyPreview(ranked.get(2), 215_000L));
    }

    @Test
    public void parsePlaylistPanelVideo_usesLengthTextFallback() throws Exception {
        String nextJson = "{"
                + "\"contents\":{\"singleColumnMusicWatchNextResultsRenderer\":{\"tabbedRenderer\":{\"watchNextTabbedResultsRenderer\":{\"tabs\":[{"
                + "\"tabRenderer\":{\"content\":{\"musicQueueRenderer\":{\"content\":{\"playlistPanelRenderer\":{\"contents\":[{"
                + "\"playlistPanelVideoRenderer\":{"
                + "\"videoId\":\"rel999\","
                + "\"title\":{\"runs\":[{\"text\":\"Neon Sky\"}]},"
                + "\"longBylineText\":{\"runs\":[{\"text\":\"Porter Robinson\"}]},"
                + "\"lengthText\":{\"runs\":[{\"text\":\"4:02\"}]},"
                + "\"thumbnail\":{\"thumbnails\":[{\"url\":\"https://i.ytimg.com/vi/rel999/hqdefault.jpg\"}]}"
                + "}}]}}}}}},"
                + "{\"tabRenderer\":{\"endpoint\":{\"browseEndpoint\":{\"browseId\":\"FEmusic_lyrics\"}}}},"
                + "{\"tabRenderer\":{\"endpoint\":{\"browseEndpoint\":{\"browseId\":\"MPTRt_abc\"}}}}"
                + "]}}}}}";

        JSONObject root = new JSONObject(nextJson);
        assertEquals("MPTRt_abc", InnertubeJsonParser.extractRelatedBrowseId(root));

        Set<String> seen = new HashSet<>();
        JSONArray out = InnertubeJsonParser.parseNextQueueAndRelated(root, seen, 10);
        assertEquals(1, out.length());
        assertEquals(242, out.getJSONObject(0).getInt("durationSec"));

        String token = PoTokenGenerator.generateContentToken("Cgt123", "rel999");
        assertNotNull(token);
        assertFalse(token.isEmpty());
        assertFalse(token.contains("="));
        assertFalse(token.contains("+"));
        assertFalse(token.contains("/"));
    }
}
