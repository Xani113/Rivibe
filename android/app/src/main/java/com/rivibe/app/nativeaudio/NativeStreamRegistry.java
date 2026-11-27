package com.rivibe.app.nativeaudio;

import java.util.concurrent.TimeUnit;
import okhttp3.Interceptor;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

/**
 * Process-wide singleton providing shared OkHttp clients and InnertubeMusicClient
 * for both the Capacitor plugin and ExoPlayer background service.
 */
public final class NativeStreamRegistry {

    public interface MediaTransportActionListener {
        void onNextRequested();
        void onPreviousRequested();
    }

    private static volatile NativeStreamRegistry instance;

    private final OkHttpClient apiHttpClient;
    private final OkHttpClient mediaHttpClient;
    private final InnertubeMusicClient innertubeClient;
    private volatile MediaTransportActionListener transportListener;

    private NativeStreamRegistry() {
        this.apiHttpClient = new OkHttpClient.Builder()
                .connectTimeout(12, TimeUnit.SECONDS)
                .readTimeout(20, TimeUnit.SECONDS)
                .writeTimeout(15, TimeUnit.SECONDS)
                .retryOnConnectionFailure(true)
                .build();

        Interceptor youtubeHeaderInterceptor = chain -> {
            Request request = chain.request();
            String host = request.url().host();
            boolean isYtMedia = host.endsWith("googlevideo.com")
                    || host.endsWith("googleusercontent.com")
                    || host.endsWith("youtube.com")
                    || host.endsWith("youtube-nocookie.com")
                    || host.endsWith("ytimg.com");

            if (!isYtMedia) {
                return chain.proceed(request);
            }

            String clientParam = request.url().queryParameter("c");
            String ua = YouTubeClientConfig.resolveUserAgent(clientParam);
            String origin = YouTubeClientConfig.resolveOrigin(clientParam);
            String referer = YouTubeClientConfig.resolveReferer(clientParam);

            Request.Builder builder = request.newBuilder().header("User-Agent", ua);
            if (origin != null) builder.header("Origin", origin);
            if (referer != null) builder.header("Referer", referer);
            return chain.proceed(builder.build());
        };

        this.mediaHttpClient = new OkHttpClient.Builder()
                .connectTimeout(12, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .followRedirects(true)
                .followSslRedirects(true)
                .addInterceptor(youtubeHeaderInterceptor)
                .build();

        NewPipeBridge.ensureInitialized(this.apiHttpClient);
        this.innertubeClient = new InnertubeMusicClient(this.apiHttpClient, this.mediaHttpClient);
    }

    public static NativeStreamRegistry getInstance() {
        if (instance == null) {
            synchronized (NativeStreamRegistry.class) {
                if (instance == null) {
                    instance = new NativeStreamRegistry();
                }
            }
        }
        return instance;
    }

    public OkHttpClient getMediaHttpClient() {
        return mediaHttpClient;
    }

    public InnertubeMusicClient getInnertubeClient() {
        return innertubeClient;
    }

    public void setMediaTransportListener(MediaTransportActionListener listener) {
        this.transportListener = listener;
    }

    public void dispatchNextRequested() {
        MediaTransportActionListener listener = this.transportListener;
        if (listener != null) {
            listener.onNextRequested();
        }
    }

    public boolean dispatchPreviousRequested() {
        MediaTransportActionListener listener = this.transportListener;
        if (listener != null) {
            listener.onPreviousRequested();
            return true;
        }
        return false;
    }
}
