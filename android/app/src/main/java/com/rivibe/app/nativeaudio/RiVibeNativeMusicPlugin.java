package com.rivibe.app.nativeaudio;

import android.content.ComponentName;
import android.content.Context;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.common.util.concurrent.ListenableFuture;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Capacitor plugin exposing RiVibe's native keyless YouTube Music catalog/recommendations
 * and Media3 ExoPlayer background playback service to the React frontend.
 */
@CapacitorPlugin(name = "RiVibeNativeMusic")
public final class RiVibeNativeMusicPlugin extends Plugin {

    private static final long PROGRESS_INTERVAL_MS = 350L;

    private final ExecutorService networkExecutor = Executors.newCachedThreadPool();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private ListenableFuture<MediaController> controllerFuture;
    private MediaController mediaController;

    private volatile String activeTrackId = "";
    private volatile String activeVideoId = "";
    private volatile boolean currentIsLiveStream = false;
    private volatile float currentVolume = 0.85f;
    private volatile boolean currentMuted = false;
    private volatile long switchGraceUntilMs = 0L;
    private boolean tickerRunning = false;

    private final Runnable progressTicker = new Runnable() {
        @Override
        public void run() {
            MediaController controller = mediaController;
            if (controller != null && controller.isConnected()) {
                emitPlaybackState(controller);
                boolean inSwitchGrace = System.currentTimeMillis() < switchGraceUntilMs
                        && controller.getPlayWhenReady()
                        && controller.getPlaybackState() != Player.STATE_ENDED;
                if (controller.isPlaying()
                        || controller.getPlaybackState() == Player.STATE_BUFFERING
                        || inSwitchGrace) {
                    mainHandler.postDelayed(this, PROGRESS_INTERVAL_MS);
                    return;
                }
            }
            tickerRunning = false;
        }
    };

    private final Player.Listener playerListener = new Player.Listener() {
        @Override
        public void onIsPlayingChanged(boolean isPlaying) {
            if (mediaController != null) {
                emitPlaybackState(mediaController);
            }
            if (isPlaying) {
                startProgressTicker();
            }
        }

        @Override
        public void onMediaItemTransition(MediaItem mediaItem, int reason) {
            MediaController controller = mediaController;
            if (mediaItem == null || controller == null) return;
            if (reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO) {
                String prevTrackId = activeTrackId;
                activeTrackId = mediaItem.mediaId;
                activeVideoId = extractVideoIdFromMediaItem(mediaItem);
                currentIsLiveStream = false;
                switchGraceUntilMs = System.currentTimeMillis() + 3500L;
                prewarmUpcomingControllerItem(controller);
                startProgressTicker();
                emitPlaybackState(controller);

                JSObject payload = new JSObject();
                payload.put("previousTrackId", prevTrackId);
                payload.put("trackId", activeTrackId);
                notifyListeners("trackAutoAdvanced", payload);
            }
        }

        @Override
        public void onPlaybackStateChanged(int playbackState) {
            MediaController controller = mediaController;
            if (controller == null) return;
            emitPlaybackState(controller);
            if (playbackState == Player.STATE_BUFFERING || controller.isPlaying()) {
                startProgressTicker();
            } else if (playbackState == Player.STATE_ENDED) {
                tickerRunning = false;
                JSObject ended = new JSObject();
                ended.put("trackId", activeTrackId);
                notifyListeners("playbackEnded", ended);
            }
        }

        @Override
        public void onPlayerError(@NonNull PlaybackException error) {
            tickerRunning = false;
            String vid = activeVideoId;
            if (vid != null && !vid.isEmpty()) {
                NativeStreamRegistry.getInstance().getInnertubeClient().invalidateStream(vid);
            }
            JSObject payload = new JSObject();
            payload.put("trackId", activeTrackId);
            payload.put("message", extractReadableError(error));
            payload.put("code", String.valueOf(error.errorCode));
            notifyListeners("playbackError", payload);
        }
    };

    @Override
    public void load() {
        super.load();
        NativeStreamRegistry.getInstance().setMediaTransportListener(
                new NativeStreamRegistry.MediaTransportActionListener() {
                    @Override
                    public void onNextRequested() {
                        mainHandler.post(() -> notifyListeners("mediaNext", new JSObject()));
                    }

                    @Override
                    public void onPreviousRequested() {
                        mainHandler.post(() -> notifyListeners("mediaPrevious", new JSObject()));
                    }
                }
        );
    }

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        JSObject res = new JSObject();
        res.put("nativeAvailable", true);
        res.put("engine", "media3-exoplayer+innertube");
        res.put("innertube", true);
        res.put("media3", true);
        call.resolve(res);
    }

    @PluginMethod
    public void searchCatalog(PluginCall call) {
        String query = call.getString("query", "");
        int limit = call.getInt("limit", 12);
        if (query == null || query.trim().isEmpty()) {
            JSObject empty = new JSObject();
            empty.put("tracks", new JSArray());
            call.resolve(empty);
            return;
        }

        networkExecutor.execute(() -> {
            try {
                JSONArray tracks = NativeStreamRegistry.getInstance()
                        .getInnertubeClient()
                        .searchSongs(query, limit);
                JSObject res = new JSObject();
                res.put("tracks", new JSArray(tracks.toString()));
                call.resolve(res);
            } catch (Exception ex) {
                call.reject("Native YouTube Music search failed: " + ex.getMessage(), ex);
            }
        });
    }

    @PluginMethod
    public void getRecommendations(PluginCall call) {
        String videoId = call.getString("videoId", "");
        String artist = call.getString("artist", "");
        String title = call.getString("title", "");
        String mood = call.getString("mood", "all");
        int limit = call.getInt("limit", 16);

        networkExecutor.execute(() -> {
            try {
                JSONArray tracks = NativeStreamRegistry.getInstance()
                        .getInnertubeClient()
                        .fetchRelatedRecommendations(videoId, artist, title, mood, limit);
                JSObject res = new JSObject();
                res.put("tracks", new JSArray(tracks.toString()));
                call.resolve(res);
            } catch (Exception ex) {
                call.reject("Native recommendations failed: " + ex.getMessage(), ex);
            }
        });
    }

    @PluginMethod
    public void resolveStream(PluginCall call) {
        String videoId = call.getString("videoId", "");
        String quality = call.getString("quality", "HIGHEST");
        if (videoId == null || videoId.trim().isEmpty()) {
            call.reject("videoId is required");
            return;
        }

        networkExecutor.execute(() -> {
            try {
                InnertubeMusicClient.ResolvedStream resolved = NativeStreamRegistry.getInstance()
                        .getInnertubeClient()
                        .resolveAudioStream(videoId, quality);
                JSObject res = new JSObject();
                res.put("streamUrl", resolved.streamUrl);
                res.put("mimeType", resolved.mimeType);
                res.put("bitrate", resolved.bitrate);
                res.put("durationSec", resolved.durationSec);
                res.put("clientName", resolved.clientName);
                res.put("expiresAtMs", resolved.expiresAtMs);
                call.resolve(res);
            } catch (Exception ex) {
                call.reject(ex.getMessage() != null ? ex.getMessage() : "Stream resolution failed", ex);
            }
        });
    }

    private MediaItem buildMediaItem(
            String trackId,
            String title,
            String artist,
            String album,
            String artworkUrl,
            String youtubeVideoId,
            String audioUrl
    ) {
        String cleanVid = youtubeVideoId != null ? youtubeVideoId.replace("yt-", "").trim() : "";
        String cleanAudioUrl = audioUrl != null ? audioUrl.trim() : "";
        if (cleanVid.isEmpty() && cleanAudioUrl.isEmpty()) {
            return null;
        }

        Uri mediaUri = !cleanVid.isEmpty()
                ? Uri.parse(RiVibePlaybackService.NATIVE_TRACK_SCHEME + "://yt/" + cleanVid)
                : Uri.parse(cleanAudioUrl);

        MediaMetadata.Builder metadataBuilder = new MediaMetadata.Builder()
                .setTitle(title != null && !title.isEmpty() ? title : "RiVibe Track")
                .setArtist(artist != null && !artist.isEmpty() ? artist : "RiVibe")
                .setAlbumTitle(album != null && !album.isEmpty() ? album : "RiVibe");
        if (artworkUrl != null && !artworkUrl.isEmpty()) {
            metadataBuilder.setArtworkUri(Uri.parse(artworkUrl));
        }

        String resolvedId = (trackId != null && !trackId.isEmpty()) ? trackId : cleanVid;
        MediaItem.Builder itemBuilder = new MediaItem.Builder()
                .setMediaId(resolvedId)
                .setUri(mediaUri)
                .setMediaMetadata(metadataBuilder.build());
        if (!cleanVid.isEmpty()) {
            itemBuilder.setCustomCacheKey(cleanVid);
        }
        return itemBuilder.build();
    }

    private String extractVideoIdFromMediaItem(MediaItem item) {
        if (item == null || item.localConfiguration == null) return "";
        if (item.localConfiguration.customCacheKey != null
                && !item.localConfiguration.customCacheKey.isEmpty()) {
            return item.localConfiguration.customCacheKey;
        }
        Uri uri = item.localConfiguration.uri;
        if (uri != null && RiVibePlaybackService.NATIVE_TRACK_SCHEME.equals(uri.getScheme())) {
            String seg = uri.getLastPathSegment();
            return seg != null ? seg : "";
        }
        return "";
    }

    private void prewarmVideoStream(String videoId) {
        String clean = videoId != null ? videoId.replace("yt-", "").trim() : "";
        if (clean.isEmpty()) return;
        InnertubeMusicClient client = NativeStreamRegistry.getInstance().getInnertubeClient();
        if (client.getCachedStream(clean) != null) return;
        networkExecutor.execute(() -> {
            try {
                client.resolveAudioStream(clean, "HIGHEST");
            } catch (Exception ignored) {
                // Best-effort prefetch
            }
        });
    }

    private void prewarmUpcomingControllerItem(MediaController controller) {
        int nextIdx = controller.getCurrentMediaItemIndex() + 1;
        if (nextIdx >= 0 && nextIdx < controller.getMediaItemCount()) {
            prewarmVideoStream(extractVideoIdFromMediaItem(controller.getMediaItemAt(nextIdx)));
        }
    }

    @PluginMethod
    public void playTrack(PluginCall call) {
        String trackId = call.getString("trackId", "");
        String title = call.getString("title", "RiVibe Track");
        String artist = call.getString("artist", "RiVibe");
        String album = call.getString("album", "RiVibe");
        String artworkUrl = call.getString("artworkUrl", "");
        String youtubeVideoId = call.getString("youtubeVideoId", "");
        String audioUrl = call.getString("audioUrl", "");
        boolean isLiveStream = Boolean.TRUE.equals(call.getBoolean("isLiveStream", false));

        String cleanVid = youtubeVideoId != null ? youtubeVideoId.replace("yt-", "").trim() : "";
        MediaItem mediaItem = buildMediaItem(
                trackId,
                title,
                artist,
                album,
                artworkUrl,
                youtubeVideoId,
                audioUrl
        );
        if (mediaItem == null) {
            call.reject("Either youtubeVideoId or audioUrl is required");
            return;
        }

        activeTrackId = mediaItem.mediaId;
        activeVideoId = cleanVid;
        currentIsLiveStream = isLiveStream;

        switchGraceUntilMs = System.currentTimeMillis() + 3500L;
        withController(call, controller -> {
            controller.setVolume(currentMuted ? 0f : currentVolume);
            controller.setPlayWhenReady(true);
            controller.setMediaItem(mediaItem, true);
            controller.prepare();
            controller.play();
            startProgressTicker();
            call.resolve(buildSnapshot(controller));
        });
    }

    @PluginMethod
    public void setUpcomingQueue(PluginCall call) {
        String anchorTrackId = call.getString("anchorTrackId", "");
        JSArray rawTracks = call.getArray("tracks");
        List<MediaItem> upcomingItems = new ArrayList<>();
        String firstNextVid = "";

        if (rawTracks != null) {
            int limit = Math.min(rawTracks.length(), 10);
            for (int i = 0; i < limit; i++) {
                JSONObject obj = rawTracks.optJSONObject(i);
                if (obj == null) continue;
                String vid = obj.optString("youtubeVideoId", "");
                MediaItem item = buildMediaItem(
                        obj.optString("trackId", ""),
                        obj.optString("title", "RiVibe Track"),
                        obj.optString("artist", "RiVibe"),
                        obj.optString("album", "RiVibe"),
                        obj.optString("artworkUrl", ""),
                        vid,
                        obj.optString("audioUrl", "")
                );
                if (item != null) {
                    upcomingItems.add(item);
                    if (firstNextVid.isEmpty()) {
                        firstNextVid = vid;
                    }
                }
            }
        }

        if (!firstNextVid.isEmpty()) {
            prewarmVideoStream(firstNextVid);
        }

        withController(call, controller -> {
            if (anchorTrackId != null && !anchorTrackId.isEmpty() && !anchorTrackId.equals(activeTrackId)) {
                call.resolve();
                return;
            }
            int count = controller.getMediaItemCount();
            if (count > 0) {
                int currentIdx = Math.max(0, controller.getCurrentMediaItemIndex());
                if (count > currentIdx + 1) {
                    controller.removeMediaItems(currentIdx + 1, count);
                }
                if (!upcomingItems.isEmpty()) {
                    controller.addMediaItems(upcomingItems);
                }
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void setRepeatMode(PluginCall call) {
        String mode = call.getString("mode", "off");
        int repeatInt = "one".equals(mode) ? Player.REPEAT_MODE_ONE : Player.REPEAT_MODE_OFF;
        withController(call, controller -> {
            controller.setRepeatMode(repeatInt);
            call.resolve();
        });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        switchGraceUntilMs = 0L;
        withController(call, controller -> {
            controller.pause();
            emitPlaybackState(controller);
            call.resolve();
        });
    }

    @PluginMethod
    public void resume(PluginCall call) {
        switchGraceUntilMs = System.currentTimeMillis() + 2000L;
        withController(call, controller -> {
            controller.setPlayWhenReady(true);
            controller.play();
            startProgressTicker();
            emitPlaybackState(controller);
            call.resolve();
        });
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        Double positionSec = call.getDouble("positionSec", 0.0);
        long targetMs = Math.max(0L, Math.round((positionSec != null ? positionSec : 0.0) * 1000.0));
        withController(call, controller -> {
            controller.seekTo(targetMs);
            emitPlaybackState(controller);
            call.resolve();
        });
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        Double vol = call.getDouble("volume", 0.85);
        Boolean muted = call.getBoolean("muted", currentMuted);
        currentVolume = Math.max(0f, Math.min(1f, vol != null ? vol.floatValue() : currentVolume));
        currentMuted = Boolean.TRUE.equals(muted);

        withController(call, controller -> {
            controller.setVolume(currentMuted ? 0f : currentVolume);
            call.resolve();
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        switchGraceUntilMs = 0L;
        withController(call, controller -> {
            tickerRunning = false;
            controller.stop();
            controller.clearMediaItems();
            emitPlaybackState(controller);
            call.resolve();
        });
    }

    @PluginMethod
    public void getPlaybackState(PluginCall call) {
        withController(call, controller -> call.resolve(buildSnapshot(controller)));
    }

    @PluginMethod
    public void minimizeApp(PluginCall call) {
        mainHandler.post(() -> {
            if (getActivity() != null) {
                getActivity().moveTaskToBack(true);
            }
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        NativeStreamRegistry.getInstance().setMediaTransportListener(null);
        tickerRunning = false;
        mainHandler.removeCallbacks(progressTicker);
        if (mediaController != null) {
            mediaController.removeListener(playerListener);
            mediaController = null;
        }
        if (controllerFuture != null) {
            MediaController.releaseFuture(controllerFuture);
            controllerFuture = null;
        }
        networkExecutor.shutdownNow();
        super.handleOnDestroy();
    }

    private interface ControllerAction {
        void run(MediaController controller);
    }

    private void withController(PluginCall call, ControllerAction action) {
        mainHandler.post(() -> {
            if (mediaController != null && mediaController.isConnected()) {
                action.run(mediaController);
                return;
            }

            Context appContext = getContext().getApplicationContext();
            if (controllerFuture == null) {
                SessionToken token = new SessionToken(
                        appContext,
                        new ComponentName(appContext, RiVibePlaybackService.class)
                );
                controllerFuture = new MediaController.Builder(appContext, token).buildAsync();
            }

            ListenableFuture<MediaController> future = controllerFuture;
            future.addListener(() -> {
                try {
                    MediaController connected = future.get();
                    if (mediaController != connected) {
                        if (mediaController != null) {
                            mediaController.removeListener(playerListener);
                        }
                        mediaController = connected;
                        mediaController.addListener(playerListener);
                    }
                    action.run(connected);
                } catch (Exception ex) {
                    controllerFuture = null;
                    call.reject("Could not connect to RiVibe playback service", ex);
                }
            }, ContextCompat.getMainExecutor(appContext));
        });
    }

    private void startProgressTicker() {
        mainHandler.removeCallbacks(progressTicker);
        tickerRunning = true;
        mainHandler.postDelayed(progressTicker, PROGRESS_INTERVAL_MS);
    }

    private void emitPlaybackState(MediaController controller) {
        notifyListeners("playbackState", buildSnapshot(controller));
    }

    private JSObject buildSnapshot(MediaController controller) {
        long posMs = Math.max(0L, controller.getCurrentPosition());
        long rawDurMs = controller.getDuration();
        double durSec = currentIsLiveStream || rawDurMs == C.TIME_UNSET || rawDurMs <= 0L
                ? 0.0
                : rawDurMs / 1000.0;

        boolean inSwitchGrace = System.currentTimeMillis() < switchGraceUntilMs
                && controller.getPlaybackState() != Player.STATE_ENDED;
        boolean effectivePlaying = controller.isPlaying()
                || (controller.getPlayWhenReady()
                        && (controller.getPlaybackState() == Player.STATE_BUFFERING || inSwitchGrace));

        JSObject snapshot = new JSObject();
        snapshot.put("trackId", activeTrackId);
        snapshot.put("isPlaying", effectivePlaying);
        snapshot.put("currentTime", posMs / 1000.0);
        snapshot.put("duration", durSec);
        snapshot.put("isBuffering", controller.getPlaybackState() == Player.STATE_BUFFERING);
        return snapshot;
    }

    private static String extractReadableError(PlaybackException error) {
        Throwable cur = error.getCause();
        while (cur != null) {
            if (cur.getMessage() != null && !cur.getMessage().isEmpty()) {
                return cur.getMessage();
            }
            cur = cur.getCause();
        }
        return error.getMessage() != null ? error.getMessage() : "Audio playback failed";
    }
}
