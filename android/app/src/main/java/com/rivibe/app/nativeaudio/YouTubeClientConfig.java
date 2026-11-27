package com.rivibe.app.nativeaudio;

import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Defines YouTube/YouTube Music Innertube client profiles for catalog search,
 * recommendations, and multi-client audio stream resolution.
 */
public final class YouTubeClientConfig {

    public static final String USER_AGENT_WEB =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

    public static final String ORIGIN_YOUTUBE_MUSIC = "https://music.youtube.com";
    public static final String REFERER_YOUTUBE_MUSIC = ORIGIN_YOUTUBE_MUSIC + "/";
    public static final String API_URL_YOUTUBE_MUSIC = ORIGIN_YOUTUBE_MUSIC + "/youtubei/v1/";
    public static final String ORIGIN_YOUTUBE = "https://www.youtube.com";
    public static final String REFERER_YOUTUBE_TV = ORIGIN_YOUTUBE + "/tv";

    public static final YouTubeClientConfig WEB_REMIX = new YouTubeClientConfig(
            "WEB_REMIX", "1.20260114.01.00", "67", USER_AGENT_WEB,
            null, null, null, null, null, true, false
    );

    public static final YouTubeClientConfig IOS = new YouTubeClientConfig(
            "IOS", "19.29.1", "5",
            "com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)",
            "iOS", "17.5.1.21F90", "Apple", "iPhone16,2", null, false, false
    );

    public static final YouTubeClientConfig IOS_MUSIC = new YouTubeClientConfig(
            "IOS_MUSIC", "7.27.0", "26",
            "com.google.ios.youtubemusic/7.27.0 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)",
            "iOS", "17.5.1.21F90", "Apple", "iPhone16,2", null, false, false
    );

    public static final YouTubeClientConfig ANDROID_VR_NO_AUTH = new YouTubeClientConfig(
            "ANDROID_VR", "1.61.48", "28",
            "com.google.android.apps.youtube.vr.oculus/1.61.48 (Linux; U; Android 12; en_US; Quest 3; Build/SQ3A.220605.009.A1; Cronet/132.0.6808.3)",
            "Android", "12", "Oculus", "Quest 3", "32", false, false
    );

    public static final YouTubeClientConfig ANDROID_MUSIC = new YouTubeClientConfig(
            "ANDROID_MUSIC", "7.27.52", "21",
            "com.google.android.apps.youtube.music/7.27.52 (Linux; U; Android 15; en_US; Pixel 9 Pro; Build/AP4A.250205.002; Cronet/132.0.6834.79) gzip",
            "Android", "15", "Google", "Pixel 9 Pro", "35", true, false
    );

    public static final YouTubeClientConfig MOBILE = new YouTubeClientConfig(
            "ANDROID", "21.10.38", "3",
            "com.google.android.youtube/21.10.38 (Linux; U; Android 15; en_US; Pixel 9 Pro; Build/AP4A.250205.002; Cronet/132.0.6834.79) gzip",
            "Android", "15", "Google", "Pixel 9 Pro", "35", true, false
    );

    public static final YouTubeClientConfig ANDROID_TESTSUITE = new YouTubeClientConfig(
            "ANDROID_TESTSUITE", "1.9", "30",
            "com.google.android.youtube/1.9 (Linux; U; Android 15; en_US; Pixel 9 Pro; Build/AP4A.250205.002) gzip",
            "Android", "15", "Google", "Pixel 9 Pro", "35", false, false
    );

    public static final YouTubeClientConfig TVHTML5_SIMPLY_EMBEDDED_PLAYER = new YouTubeClientConfig(
            "TVHTML5_SIMPLY_EMBEDDED_PLAYER", "2.0", "85",
            "Mozilla/5.0 (PlayStation; PlayStation 4/12.02) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15",
            null, null, null, null, null, true, true
    );

    public static final YouTubeClientConfig VISIONOS = new YouTubeClientConfig(
            "VISIONOS", "0.1", "101",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
            "visionOS", "1.3.21O771", "Apple", "RealityDevice14,1", null, false, false
    );

    public static final YouTubeClientConfig WEB = new YouTubeClientConfig(
            "WEB", "2.20260114.00.00", "1", USER_AGENT_WEB,
            null, null, null, null, null, false, false
    );

    public static final YouTubeClientConfig[] STREAM_CLIENTS = new YouTubeClientConfig[] {
            IOS,
            ANDROID_VR_NO_AUTH,
            MOBILE,
            ANDROID_MUSIC,
            IOS_MUSIC,
            ANDROID_TESTSUITE,
            VISIONOS,
            TVHTML5_SIMPLY_EMBEDDED_PLAYER,
            WEB_REMIX,
            WEB
    };

    public final String clientName;
    public final String clientVersion;
    public final String clientId;
    public final String userAgent;
    public final String osName;
    public final String osVersion;
    public final String deviceMake;
    public final String deviceModel;
    public final String androidSdkVersion;
    public final boolean useSignatureTimestamp;
    public final boolean isEmbedded;

    private YouTubeClientConfig(
            String clientName,
            String clientVersion,
            String clientId,
            String userAgent,
            String osName,
            String osVersion,
            String deviceMake,
            String deviceModel,
            String androidSdkVersion,
            boolean useSignatureTimestamp,
            boolean isEmbedded
    ) {
        this.clientName = clientName;
        this.clientVersion = clientVersion;
        this.clientId = clientId;
        this.userAgent = userAgent;
        this.osName = osName;
        this.osVersion = osVersion;
        this.deviceMake = deviceMake;
        this.deviceModel = deviceModel;
        this.androidSdkVersion = androidSdkVersion;
        this.useSignatureTimestamp = useSignatureTimestamp;
        this.isEmbedded = isEmbedded;
    }

    public boolean needsServiceIntegrity() {
        String name = clientName.toUpperCase(Locale.US);
        return "WEB".equals(name)
                || "WEB_REMIX".equals(name)
                || "MWEB".equals(name)
                || "WEB_EMBEDDED_PLAYER".equals(name)
                || "TVHTML5".equals(name)
                || "TVHTML5_SIMPLY_EMBEDDED_PLAYER".equals(name);
    }

    public JSONObject buildContext(String visitorData, String videoIdForEmbed) throws JSONException {
        Locale def = Locale.getDefault();
        String gl = def.getCountry().isEmpty() ? "US" : def.getCountry();
        String hl = def.getLanguage().isEmpty() ? "en" : def.getLanguage();

        JSONObject client = new JSONObject()
                .put("clientName", clientName)
                .put("clientVersion", clientVersion)
                .put("gl", gl)
                .put("hl", hl);
        if (osName != null) client.put("osName", osName);
        if (osVersion != null) client.put("osVersion", osVersion);
        if (deviceMake != null) client.put("deviceMake", deviceMake);
        if (deviceModel != null) client.put("deviceModel", deviceModel);
        if (androidSdkVersion != null) client.put("androidSdkVersion", androidSdkVersion);
        if (visitorData != null && !visitorData.isEmpty()) client.put("visitorData", visitorData);

        JSONObject request = new JSONObject()
                .put("internalExperimentFlags", new JSONArray())
                .put("useSsl", true);

        JSONObject user = new JSONObject().put("lockedSafetyMode", false);

        JSONObject context = new JSONObject()
                .put("client", client)
                .put("request", request)
                .put("user", user);

        if (isEmbedded && videoIdForEmbed != null && !videoIdForEmbed.isEmpty()) {
            context.put("thirdParty", new JSONObject().put("embedUrl", "https://www.youtube.com/watch?v=" + videoIdForEmbed));
        }

        return context;
    }

    public static String resolveUserAgent(String clientParam) {
        if (clientParam == null) return ANDROID_VR_NO_AUTH.userAgent;
        String c = clientParam.trim().toUpperCase(Locale.US);
        if (c.equals("WEB_REMIX") || c.equals("WEB") || c.equals("WEB_CREATOR")) {
            return USER_AGENT_WEB;
        }
        if (c.startsWith("TVHTML5")) return TVHTML5_SIMPLY_EMBEDDED_PLAYER.userAgent;
        if (c.equals("IOS_MUSIC")) return IOS_MUSIC.userAgent;
        if (c.startsWith("IOS")) return IOS.userAgent;
        if (c.startsWith("ANDROID_VR")) return ANDROID_VR_NO_AUTH.userAgent;
        if (c.equals("ANDROID_MUSIC")) return ANDROID_MUSIC.userAgent;
        if (c.equals("ANDROID_TESTSUITE")) return ANDROID_TESTSUITE.userAgent;
        if (c.startsWith("VISIONOS")) return VISIONOS.userAgent;
        if (c.startsWith("ANDROID")) return MOBILE.userAgent;
        return ANDROID_VR_NO_AUTH.userAgent;
    }

    public static String resolveOrigin(String clientParam) {
        if (clientParam == null) return null;
        String c = clientParam.trim().toUpperCase(Locale.US);
        if (c.equals("WEB_REMIX") || c.equals("WEB") || c.equals("WEB_CREATOR")) {
            return ORIGIN_YOUTUBE_MUSIC;
        }
        if (c.startsWith("TVHTML5")) {
            return ORIGIN_YOUTUBE;
        }
        return null;
    }

    public static String resolveReferer(String clientParam) {
        if (clientParam == null) return null;
        String c = clientParam.trim().toUpperCase(Locale.US);
        if (c.equals("WEB_REMIX") || c.equals("WEB") || c.equals("WEB_CREATOR")) {
            return REFERER_YOUTUBE_MUSIC;
        }
        if (c.startsWith("TVHTML5")) {
            return REFERER_YOUTUBE_TV;
        }
        return null;
    }

    public static boolean isWebLikeClient(String clientParam) {
        if (clientParam == null) return false;
        String c = clientParam.trim().toUpperCase(Locale.US);
        return c.equals("WEB")
                || c.equals("WEB_REMIX")
                || c.equals("WEB_CREATOR")
                || c.equals("MWEB")
                || c.equals("WEB_EMBEDDED_PLAYER")
                || c.startsWith("TVHTML5");
    }
}
