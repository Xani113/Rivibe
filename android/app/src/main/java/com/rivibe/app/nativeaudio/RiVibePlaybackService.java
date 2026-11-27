package com.rivibe.app.nativeaudio;

import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import androidx.annotation.OptIn;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.ForwardingPlayer;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DataSource;
import androidx.media3.datasource.ResolvingDataSource;
import androidx.media3.datasource.okhttp.OkHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import com.rivibe.app.MainActivity;
import java.io.IOException;

/**
 * Background Media3 foreground service managing ExoPlayer and Android MediaSession
 * for full-length background audio, lock-screen controls (Next/Previous/Play/Pause), and radio streams.
 */
@OptIn(markerClass = UnstableApi.class)
public final class RiVibePlaybackService extends MediaSessionService {

    public static final String NATIVE_TRACK_SCHEME = "rivibe";

    private ExoPlayer player;
    private MediaSession mediaSession;

    @Override
    public void onCreate() {
        super.onCreate();

        NativeStreamRegistry registry = NativeStreamRegistry.getInstance();
        OkHttpDataSource.Factory okHttpFactory = new OkHttpDataSource.Factory(registry.getMediaHttpClient());

        DataSource.Factory resolvingFactory = new ResolvingDataSource.Factory(
                okHttpFactory,
                dataSpec -> {
                    Uri uri = dataSpec.uri;
                    if (uri != null && NATIVE_TRACK_SCHEME.equals(uri.getScheme())) {
                        String videoId = uri.getLastPathSegment();
                        if (videoId == null || videoId.isEmpty()) {
                            throw new IOException("Missing videoId in native stream URI");
                        }
                        try {
                            InnertubeMusicClient.ResolvedStream resolved =
                                    registry.getInnertubeClient().resolveAudioStream(videoId, "HIGHEST");
                            return dataSpec.withUri(Uri.parse(resolved.streamUrl));
                        } catch (IOException ioEx) {
                            throw ioEx;
                        } catch (Exception ex) {
                            throw new IOException("Failed to resolve native YouTube Music stream: " + ex.getMessage(), ex);
                        }
                    }
                    return dataSpec;
                }
        );

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .build();

        player = new ExoPlayer.Builder(this)
                .setMediaSourceFactory(new DefaultMediaSourceFactory(resolvingFactory))
                .setAudioAttributes(audioAttributes, true)
                .setHandleAudioBecomingNoisy(true)
                .setWakeMode(C.WAKE_MODE_NETWORK)
                .build();

        // Expose Next/Previous commands continuously so Android lock-screen & notification always render Skip Next/Prev
        ForwardingPlayer sessionPlayer = new ForwardingPlayer(player) {
            @Override
            public Commands getAvailableCommands() {
                return super.getAvailableCommands()
                        .buildUpon()
                        .addAll(
                                COMMAND_SEEK_TO_NEXT,
                                COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
                                COMMAND_SEEK_TO_PREVIOUS,
                                COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM
                        )
                        .build();
            }

            @Override
            public boolean isCommandAvailable(int command) {
                if (command == COMMAND_SEEK_TO_NEXT
                        || command == COMMAND_SEEK_TO_NEXT_MEDIA_ITEM
                        || command == COMMAND_SEEK_TO_PREVIOUS
                        || command == COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM) {
                    return true;
                }
                return super.isCommandAvailable(command);
            }

            @Override
            public boolean hasNextMediaItem() {
                return true;
            }

            @Override
            public boolean hasPreviousMediaItem() {
                return true;
            }

            @Override
            public void seekToNext() {
                NativeStreamRegistry.getInstance().dispatchNextRequested();
            }

            @Override
            public void seekToNextMediaItem() {
                NativeStreamRegistry.getInstance().dispatchNextRequested();
            }

            @Override
            public void seekToPrevious() {
                if (!NativeStreamRegistry.getInstance().dispatchPreviousRequested()) {
                    super.seekTo(0L);
                }
            }

            @Override
            public void seekToPreviousMediaItem() {
                if (!NativeStreamRegistry.getInstance().dispatchPreviousRequested()) {
                    super.seekTo(0L);
                }
            }
        };

        Intent launchIntent = new Intent(this, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent sessionActivity = PendingIntent.getActivity(
                this,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        mediaSession = new MediaSession.Builder(this, sessionPlayer)
                .setSessionActivity(sessionActivity)
                .build();
    }

    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return mediaSession;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        if (player == null || !player.getPlayWhenReady() || player.getMediaItemCount() == 0
                || player.getPlaybackState() == Player.STATE_ENDED) {
            stopSelf();
        }
    }

    @Override
    public void onDestroy() {
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        if (player != null) {
            player.release();
            player = null;
        }
        super.onDestroy();
    }
}
