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
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;

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
    private boolean tickerRunning = false;

    private final Runnable progressTicker = new Runnable() {
        @Override
        public void run() {
            MediaController controller = mediaController;
            if (controller != null && controller.isConnected()) {
                emitPlaybackState(controller);
                if (controller.isPlaying() || controller.getPlaybackState() == Player.STATE_BUFFERING) {
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
        String cleanAudioUrl = audioUrl != null ? audioUrl.trim() : "";
        if (cleanVid.isEmpty() && cleanAudioUrl.isEmpty()) {
            call.reject("Either youtubeVideoId or audioUrl is required");
            return;
        }

        Uri mediaUri = !cleanVid.isEmpty()
                ? Uri.parse(RiVibePlaybackService.NATIVE_TRACK_SCHEME + "://yt/" + cleanVid)
                : Uri.parse(cleanAudioUrl);

        MediaMetadata.Builder metadataBuilder = new MediaMetadata.Builder()
                .setTitle(title)
                .setArtist(artist)
                .setAlbumTitle(album);
        if (artworkUrl != null && !artworkUrl.isEmpty()) {
            metadataBuilder.setArtworkUri(Uri.parse(artworkUrl));
        }

        MediaItem.Builder itemBuilder = new MediaItem.Builder()
                .setMediaId(trackId != null && !trackId.isEmpty() ? trackId : cleanVid)
                .setUri(mediaUri)
                .setMediaMetadata(metadataBuilder.build());
        if (!cleanVid.isEmpty()) {
            itemBuilder.setCustomCacheKey(cleanVid);
        }

        MediaItem mediaItem = itemBuilder.build();

        activeTrackId = trackId != null ? trackId : cleanVid;
        activeVideoId = cleanVid;
        currentIsLiveStream = isLiveStream;

        withController(call, controller -> {
            controller.setVolume(currentMuted ? 0f : currentVolume);
            controller.setMediaItem(mediaItem);
            controller.prepare();
            controller.play();
            startProgressTicker();
            call.resolve(buildSnapshot(controller));
        });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        withController(call, controller -> {
            controller.pause();
            emitPlaybackState(controller);
            call.resolve();
        });
    }

    @PluginMethod
    public void resume(PluginCall call) {
        withController(call, controller -> {
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

        JSObject snapshot = new JSObject();
        snapshot.put("trackId", activeTrackId);
        snapshot.put("isPlaying", controller.isPlaying());
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
