version += " pc2-videojs-7.21.7";
var keys = {
    ASPECT: 65,
    AUDIO: 83,
    BLUE: 86,
    CH_DOWN: 189,
    CH_LIST: 0,
    CH_UP: 187,
    DOWN: 40,
    ENTER: 13,
    EPG: 0,
    EXIT: 27,
    FAVORITES: 70,
    FF: 34,
    GREEN: 88,
    INFO: 73,
    LANG: 16,
    LEFT: 37,
    MUTE: 77,
    N0: 48,
    N1: 49,
    N2: 50,
    N3: 51,
    N4: 52,
    N5: 53,
    N6: 54,
    N7: 55,
    N8: 56,
    N9: 57,
    NEXT: 190,
    PAUSE: 80,
    PIP: 87,
    PLAY: 80,
    POWER: 81,
    PRECH: 191,
    PREV: 188,
    RANDOM: 82,
    REC: 0,
    RED: 90,
    RETURN: 8,
    RIGHT: 39,
    RW: 33,
    SETUP: 192,
    STOP: 178,
    TOOLS: 84,
    UP: 38,
    VOL_DOWN: 0,
    VOL_UP: 0,
    YELLOW: 67,
    ZOOM: 69,
};

// Optional ES5 decoder. The shared backend owns each request; Video.js owns
// the HTML5 tech and VHS. Keep player wrappers stable across source changes so
// core DOM references, layout, volume and native media events remain valid.
(function (w) {
    if (typeof w.videojs !== "function" || !w.__ottCoreTransport) return;
    var slots = {};
    // VHS needs real Workers; language polyfills cannot create that host API.
    // Retain Video.js native playback on engines without Worker support.
    if (typeof w.Worker !== "function" && w.videojs.VhsSourceHandler)
        w.videojs.VhsSourceHandler.canHandleSource = function () {
            return "";
        };
    function sourceType(url) {
        if (
            /^blob:/.test(url) &&
            w.__ottLocalMedia &&
            w.__ottLocalMedia.playbackMime
        ) {
            var mime = w.__ottLocalMedia.playbackMime(url);
            if (mime && /^video\//.test(mime)) return mime;
        }
        if (/\.mpd(?:[?#]|$)/i.test(url)) return "application/dash+xml";
        if (/\.(mp4|m4v|mov)(?:[?#]|$)/i.test(url)) return "video/mp4";
        if (/\.webm(?:[?#]|$)/i.test(url)) return "video/webm";
        if (/\.(ogg|ogv)(?:[?#]|$)/i.test(url)) return "video/ogg";
        if (/\.mp3(?:[?#]|$)/i.test(url)) return "audio/mpeg";
        if (/\.aac(?:[?#]|$)/i.test(url)) return "audio/aac";
        // IPTV providers commonly return extensionless HLS URLs.
        return "application/x-mpegURL";
    }
    function open(request, event, media) {
        var pip = request.lane === "pip";
        var lane = pip ? "pip" : "main";
        var player = slots[lane];
        if (!player) {
            player = w.videojs(media, {
                autoplay: false,
                children: ["mediaLoader", "textTrackDisplay"],
                controls: false,
                // Keep upstream native HLS/text-track detection. Forcing native
                // tracks rejects Video.js cue shims on engines without VTTCue.
                inactivityTimeout: 0,
                preload: "auto",
                techOrder: ["html5"],
            });
            player.addClass("video-js");
            slots[lane] = player;
            // Inline geometry belongs to the wrapper with the original id.
            media.style.cssText =
                "width:100%;height:100%;max-width:100%;max-height:100%;object-fit:fill;";
        }
        var tech = player.tech({ IWillNotUseThisInPlugins: true });
        var alive = true;
        var wantsPlay = request.paused !== true;
        if (!wantsPlay) media.autoplay = false;
        var sourceAttached = false;
        var backend =
            !pip && typeof w.__ottCoreBackend === "function"
                ? w.__ottCoreBackend()
                : null;
        // The public track choice belongs to the outer backend handle, not
        // this Video.js lease. Never borrow a later source's choice.
        var owner = backend && backend.current();
        var seekReady = false;
        var pendingSeek =
            request.position > 0 ? Number(request.position) : null;
        var listeners = [];
        function on(target, name, callback) {
            target.on(name, callback);
            listeners.push(function () {
                target.off(name, callback);
            });
        }
        function play() {
            if (!alive || !wantsPlay || !sourceAttached) return;
            try {
                var result = player.play();
                if (result && typeof result.then === "function")
                    result.then(undefined, function () {
                        // Autoplay policy is recoverable via the normal Play key.
                    });
            } catch (_) {}
        }
        function applySeek() {
            // Metadata precedes the first decoded/buffered frames. Seeking
            // there can abort WebKit/GStreamer's initial MSE append on resume.
            // Keep the latest request until this source can actually play.
            if (
                !alive ||
                !sourceAttached ||
                (!seekReady && player.readyState() < 3)
            )
                return;
            seekReady = true;
            if (pendingSeek === null) return;
            try {
                player.currentTime(pendingSeek);
                pendingSeek = null;
            } catch (_) {}
        }
        function trackList(kind) {
            return kind === "audio"
                ? player.audioTracks()
                : player.textTracks();
        }
        function ownsTracks() {
            return (
                alive &&
                (!owner ||
                    (backend.current() === owner &&
                        (typeof owner.active !== "function" || owner.active())))
            );
        }
        function selectTrack(kind, index) {
            if (!ownsTracks()) return;
            var tracks = trackList(kind);
            var target = kind === "audio" ? index : index - 1;
            if (kind === "audio" && (target < 0 || target >= tracks.length))
                return;
            for (var i = 0; i < tracks.length; i++) {
                if (kind === "audio") {
                    if (tracks[i].enabled !== (i === target))
                        tracks[i].enabled = i === target;
                } else if (/^(subtitles|captions)$/.test(tracks[i].kind)) {
                    var mode = i === target ? "showing" : "disabled";
                    if (tracks[i].mode !== mode) tracks[i].mode = mode;
                }
            }
        }
        function restoreTracks() {
            if (!ownsTracks() || pip) return;
            ["audio", "subtitle"].forEach(function (kind) {
                var choice =
                    owner &&
                    owner.__ottExplicitTracks &&
                    owner.__ottExplicitTracks[kind];
                if (choice) {
                    selectTrack(kind, choice - 1);
                    return;
                }
                if (typeof w.applyChannelPreference === "function")
                    w.applyChannelPreference(
                        kind === "audio" ? "aAudios" : "aSubs",
                        function (index) {
                            var selected =
                                owner &&
                                owner.__ottExplicitTracks &&
                                owner.__ottExplicitTracks[kind];
                            selectTrack(kind, selected ? selected - 1 : index);
                        }
                    );
            });
            if (typeof w.refreshAudioBadge === "function")
                w.refreshAudioBadge();
        }
        ["playing", "pause", "timeupdate", "ended", "loadedmetadata"].forEach(
            function (name) {
                on(player, name, function () {
                    if (alive) event(name);
                });
            }
        );
        on(player, "loadedmetadata", function () {
            applySeek();
            restoreTracks();
        });
        on(player, "canplay", applySeek);
        on(player, "error", function () {
            if (!alive) return;
            w.$(pip ? "#pip_buffering" : "#buffering").hide();
            if (!pip) {
                if (w.__ottPlaybackFeedback) w.__ottPlaybackFeedback.fail();
                var error = player.error();
                w.$("#video_res").text(
                    "Video.js error " + (error ? error.code : 0)
                );
            }
        });
        on(player.audioTracks(), "addtrack", restoreTracks);
        on(player.textTracks(), "addtrack", restoreTracks);
        on(player.audioTracks(), "change", restoreTracks);
        on(player.textTracks(), "change", restoreTracks);
        if (!pip) {
            w.forcePlay = wantsPlay;
            if (w.__ottPlaybackFeedback) {
                w.__ottPlaybackFeedback.bind(media);
                w.__ottPlaybackFeedback.begin(!wantsPlay);
            }
            if (w.__ottDebug && w.__ottDebug.enabled)
                w.__ottDebug.beginSession(request.url);
        }
        player.loop(w.ottplayDemoActive === true);
        if (pip) {
            player.muted(true);
            w.$("#videopip").show();
            w.setPipPosition();
        }
        player.ready(function () {
            if (!alive) return;
            // Synchronous HTML5 source-handler API avoids Video.js middleware's
            // deferred src callbacks resurrecting an already replaced request.
            player.error(null);
            var source = { src: request.url, type: sourceType(request.url) };
            player.updateSourceCaches_(source);
            try {
                tech.setSource(source);
                sourceAttached = true;
                play();
            } catch (_sourceError) {
                tech.disposeSourceHandler();
                player.error({
                    code: 4,
                    message: "Video.js playback unavailable on this device",
                });
            }
        });
        return {
            dispose: function () {
                if (!alive) return;
                alive = false;
                listeners.forEach(function (off) {
                    off();
                });
                listeners = [];
                // Player.reset() replaces the video element. Release only the
                // pinned HTML5 source handler (VHS requests/workers and tracks).
                player.pause();
                tech.disposeSourceHandler();
                tech.clearTracks("text");
                tech.reset();
                player.loop(false);
                if (pip) w.$("#videopip, #pip_buffering").hide();
                else {
                    w.forcePlay = false;
                    if (w.__ottPlaybackFeedback) w.__ottPlaybackFeedback.stop();
                    w.$("#buffering").hide();
                }
            },
            pause: function () {
                if (!alive) return;
                wantsPlay = false;
                if (!pip) {
                    w.forcePlay = false;
                    if (w.__ottPlaybackFeedback) w.__ottPlaybackFeedback.stop();
                }
                player.pause();
            },
            relativeSample: function () {
                if (
                    !alive ||
                    pip ||
                    !sourceAttached ||
                    pendingSeek !== null ||
                    media.seeking ||
                    media.ended ||
                    !media.seekable ||
                    !media.seekable.length
                )
                    return null;
                return {
                    duration: media.duration,
                    paused: media.paused,
                    position: media.currentTime,
                    ready: media.readyState,
                };
            },
            relativeSeek: function (position, paused) {
                if (
                    !alive ||
                    pip ||
                    !sourceAttached ||
                    pendingSeek !== null ||
                    media.seeking ||
                    media.ended ||
                    !media.seekable
                )
                    return false;
                var inRange = false;
                for (var i = 0; i < media.seekable.length; i++)
                    if (
                        position >= media.seekable.start(i) &&
                        position <= media.seekable.end(i)
                    )
                        inRange = true;
                if (!inRange || !alive) return false;
                wantsPlay = !paused;
                w.forcePlay = !paused;
                player.currentTime(position);
                return true;
            },
            resume: function () {
                if (!alive) return;
                var waitingForPlayback =
                    !wantsPlay || player.paused() || player.readyState() < 3;
                wantsPlay = true;
                if (!pip) {
                    w.forcePlay = true;
                    var feedback = w.__ottPlaybackFeedback;
                    if (feedback && waitingForPlayback && !feedback.visible())
                        feedback.begin(false, true);
                }
                play();
            },
            sample: function () {
                return {
                    duration: player.duration(),
                    paused: player.paused(),
                    position: player.currentTime(),
                    ready: player.readyState(),
                };
            },
            seek: function (position) {
                if (!alive || !isFinite(position) || position < 0) return;
                pendingSeek = position;
                applySeek();
            },
            selectTrack: selectTrack,
            supportsPausedStart: true,
            tracks: function (kind) {
                var rows = [];
                if (!alive) return rows;
                var tracks = trackList(kind);
                for (var i = 0; i < tracks.length; i++) {
                    var track = tracks[i];
                    if (
                        kind !== "audio" &&
                        !/^(subtitles|captions)$/.test(track.kind)
                    )
                        continue;
                    rows.push({
                        id: kind === "audio" ? i : i + 1,
                        language: track.language || "?",
                        name: track.label || "#" + (i + 1),
                        selected:
                            kind === "audio"
                                ? !!track.enabled
                                : track.mode === "showing",
                    });
                }
                return rows;
            },
        };
    }
    function countTracks(kind) {
        var owner = w.__ottCoreBackend().current();
        var tracks = owner && owner.tracks(kind);
        return tracks ? tracks.length : 0;
    }
    w.stbAudioTracksExists = function () {
        return countTracks("audio") > 1;
    };
    w.stbSubtitleExists = function () {
        return countTracks("subtitle");
    };
    w.__ottCoreTransport.configure({ engine: open, engineName: "Video.js" });
    w.addEventListener("unload", function () {
        Object.keys(slots).forEach(function (lane) {
            slots[lane].dispose();
        });
    });
})(window);

// Desktop-only gesture support is loaded outside the shared startup bundle.
if (typeof getScriptDOM === "function")
    getScriptDOM(
        (window.host || "") +
            "/dist/local-drop.js?" +
            encodeURIComponent(window.__cv || ""),
        null,
        null
    );
