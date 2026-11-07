/**
 * Host controller for the common playback model. The injected ports own clocks,
 * timers and effects. This private module has no access to classic player state.
 */
interface PlaybackVisit {
    archiveStart?: number;
    channelId: string;
    kind: "live" | "archive" | "vod";
    payload?: any;
    sourceId: string;
}

interface PlaybackObservation {
    archiveAvailable: boolean;
    archiveEarliest?: number;
    duration?: number;
    /** The host validates source resources even when a replacement reuses IDs. */
    isCurrent?(): boolean;
    /** Offset seeks can survive reindexing of the same owned media item. */
    isCurrentOffset?(): boolean;
    now: number;
    position?: number;
    target: PlaybackVisit | null;
}

interface PlaybackIntent {
    intent: "offset" | "absolute" | "begin" | "restart" | "go-live";
    value?: number;
}

interface PlaybackSessionPorts {
    apply(plan: any, intent: PlaybackIntent): void;
    observe(): PlaybackObservation;
    preview(intent: PlaybackIntent): void;
    schedule(callback: () => void, delay: number): any;
    unschedule(handle: any): void;
}

function createPlaybackSessionController(
    core: any,
    ports: PlaybackSessionPorts
) {
    var ownership = new core.PlaybackSessionOwnership();
    var applying = false;
    var pending: PlaybackIntent | null = null;
    var timer: any = null;
    var feedback: { value: number; observation: PlaybackObservation } | null =
        null;
    var applied: {
        position: number;
        before: number;
        observation: PlaybackObservation;
    } | null = null;

    function accepts(ticket: any): boolean {
        return ownership.accepts(ticket);
    }

    function sameTarget(
        a: PlaybackVisit | null,
        b: PlaybackVisit | null
    ): boolean {
        // Restoration may start before a channel exists. The ownership ticket
        // and host context still bind guards; request() rejects absent targets.
        if (a === null && b === null) return true;
        return (
            !!a &&
            !!b &&
            a.sourceId === b.sourceId &&
            a.channelId === b.channelId &&
            a.kind === b.kind &&
            a.archiveStart === b.archiveStart
        );
    }

    function isCurrent(
        observation: PlaybackObservation,
        offset: boolean
    ): boolean {
        var check =
            (offset && observation.isCurrentOffset) || observation.isCurrent;
        return !check || check();
    }

    function reset(start?: boolean, preserveOffset = false): any {
        // Retire callbacks and detach state before cleanup can reenter the host.
        var ticket = start ? ownership.begin() : ownership.cancel();
        var previous = timer;
        timer = null;
        pending = null;
        if (!preserveOffset) {
            feedback = null;
            applied = null;
        }
        if (previous !== null) ports.unschedule(previous);
        return ticket;
    }
    function cancel(): void {
        reset();
    }
    function complete(ticket: any): boolean {
        return accepts(ticket) && ownership.accepts(reset(true, true));
    }

    var origin: PlaybackObservation;
    function request(intent: PlaybackIntent): void {
        if (intent.intent === "offset" && !isFinite(intent.value as number))
            return;
        var previous = pending;
        var delta = intent.value || 0;
        var ticket = reset(true, intent.intent === "offset");
        if (!accepts(ticket)) return;
        var observation = ports.observe();
        if (!accepts(ticket) || !observation.target) return;
        if (
            previous &&
            intent.intent === "offset" &&
            previous.intent === "offset" &&
            sameTarget(origin.target, observation.target) &&
            isCurrent(origin, true)
        ) {
            intent = {
                intent: "offset",
                value: (previous.value || 0) + (intent.value || 0),
            };
        }
        if (!accepts(ticket)) return;
        pending = intent;
        origin = observation;
        var announcement = intent;
        if (intent.intent === "offset") {
            // The HUD lives longer than the 500ms transport debounce. Keep its
            // gesture total separate from the delta still awaiting execution.
            var continued =
                feedback &&
                observation.now >= feedback.observation.now &&
                ((previous && previous.intent === "offset") ||
                    observation.now - feedback.observation.now < 3) &&
                sameTarget(feedback.observation.target, observation.target) &&
                isCurrent(feedback.observation, true);
            if (
                applied &&
                !sameTarget(applied.observation.target, observation.target)
            )
                applied = null;
            feedback = {
                observation: observation,
                value: (continued ? feedback!.value : 0) + delta,
            };
            announcement = { intent: "offset", value: feedback.value };
        }
        function flush(): void {
            if (!accepts(ticket)) return;
            var current = ports.observe();
            if (!accepts(ticket)) return;
            var accepted =
                sameTarget(observation.target, current.target) &&
                isCurrent(observation, intent.intent === "offset");
            if (!complete(ticket) || !accepted) return;
            var position = current.position;
            // Native/browser decoders may report the pre-seek time briefly.
            // Carry the submitted target only within this owned gesture and
            // only while the report is still on the old side of that target.
            if (
                intent.intent === "offset" &&
                applied &&
                current.now >= applied.observation.now &&
                current.now - applied.observation.now < 3 &&
                sameTarget(applied.observation.target, current.target) &&
                isCurrent(applied.observation, true) &&
                typeof position === "number" &&
                ((applied.position > applied.before &&
                    position < applied.position) ||
                    (applied.position < applied.before &&
                        position > applied.position))
            )
                position = applied.position;
            var plan = core.playbackSeekPlan(current.target, {
                archiveAvailable: current.archiveAvailable,
                archiveEarliest: current.archiveEarliest,
                duration: current.duration,
                intent: intent.intent,
                now: current.now,
                position: position,
                value: intent.value,
            });
            if (plan.action === "seek" && typeof position === "number")
                applied = {
                    before: current.position!,
                    observation: current,
                    position: plan.position,
                };
            if (plan.action !== "noop") {
                if (feedback && intent.intent === "offset")
                    feedback.observation = current;
                applying = true;
                try {
                    ports.apply(plan, announcement);
                } finally {
                    applying = false;
                }
            }
        }
        if (intent.intent === "offset") {
            ports.preview(announcement);
            if (!accepts(ticket)) return;
            var scheduled = ports.schedule(flush, 500);
            if (accepts(ticket)) timer = scheduled;
            else ports.unschedule(scheduled);
        } else flush();
    }

    return {
        beforeSeek: function (value: number): (() => void) | void {
            if (applying) return;
            var ticket = reset(true);
            if (!accepts(ticket)) return;
            var observed = ports.observe();
            if (
                accepts(ticket) &&
                observed.target &&
                observed.target.kind === "vod" &&
                typeof observed.position === "number" &&
                isFinite(value) &&
                value >= 0
            ) {
                var record = {
                    before: observed.position,
                    observation: observed,
                    position: value,
                };
                applied = record;
                return function (): void {
                    if (applied === record) applied = null;
                };
            }
        },
        cancel: cancel,
        cancelAndCapture: function (): () => boolean {
            var ticket = reset(true);
            return function () {
                return accepts(ticket);
            };
        },
        dispose: cancel,
        guard: function (
            callback: (...args: any[]) => void
        ): (...args: any[]) => void {
            var ticket = reset(true);
            var observed = accepts(ticket) ? ports.observe() : null;
            function current(): boolean {
                return !!(
                    observed &&
                    accepts(ticket) &&
                    sameTarget(observed.target, ports.observe().target) &&
                    (!observed.isCurrent || observed.isCurrent()) &&
                    accepts(ticket)
                );
            }
            var guarded = function (this: any): void {
                if (!current()) return;
                if (complete(ticket)) callback.apply(this, arguments);
            };
            // UI previews can observe retirement without consuming this guard.
            (guarded as any).current = current;
            return guarded;
        },
        observePosition: function (value: number): void {
            if (
                !applying &&
                applied &&
                isFinite(value) &&
                (Math.abs(value - applied.position) < 0.05 ||
                    (applied.position >= applied.before &&
                        value >= applied.position) ||
                    (applied.position <= applied.before &&
                        value <= applied.position))
            )
                applied = null;
        },
        request: request,
        transition: function (
            current: PlaybackVisit | null,
            target: PlaybackVisit | null,
            history: PlaybackVisit[],
            position: number | undefined,
            limit: number,
            historyKinds?: string[]
        ): any {
            cancel();
            return core.playbackSessionTransition(
                current,
                target,
                history,
                position,
                limit,
                historyKinds
            );
        },
    };
}

interface PlaybackStateSnapshot {
    duration?: number;
    generation: number;
    historyTarget: PlaybackVisit | null;
    phase: "idle" | "loading" | "playing" | "paused" | "stopped";
    position: number;
    target: PlaybackVisit | null;
}

/** Owned session state. Host codecs may adopt old state at an explicit boundary;
 * normal playback commands never interpret legacy mode numbers or list positions.
 */
function createPlaybackState(changed: (state: PlaybackStateSnapshot) => void) {
    var state: PlaybackStateSnapshot = {
        generation: 0,
        historyTarget: null,
        phase: "idle",
        position: 0,
        target: null,
    };
    function visit(value: PlaybackVisit | null): PlaybackVisit | null {
        return value
            ? {
                  archiveStart: value.archiveStart,
                  channelId: value.channelId,
                  kind: value.kind,
                  payload: value.payload,
                  sourceId: value.sourceId,
              }
            : null;
    }
    function snapshot(): PlaybackStateSnapshot {
        return {
            duration: state.duration,
            generation: state.generation,
            historyTarget: visit(state.historyTarget),
            phase: state.phase,
            position: state.position,
            target: visit(state.target),
        };
    }
    function position(value: number, duration?: number, notify = true): void {
        if (
            !state.target ||
            typeof value !== "number" ||
            !isFinite(value) ||
            value < 0
        )
            return;
        var nextDuration =
            typeof duration === "number" && isFinite(duration) && duration >= 0
                ? duration
                : state.duration;
        // Explicit backend reports also checkpoint a value previously sampled by
        // compatibility observation. Durable throttling belongs to the journal.
        state.position = value;
        state.duration = nextDuration;
        if (notify) changed(snapshot());
    }
    function open(
        target: PlaybackVisit | null,
        historyTarget: PlaybackVisit | null = target,
        offset = 0,
        notify = true
    ): void {
        state = {
            generation: state.generation + 1,
            historyTarget: visit(historyTarget),
            phase: target ? "loading" : "idle",
            position: 0,
            target: visit(target),
        };
        position(offset, undefined, false);
        if (notify) changed(snapshot());
    }
    function classify(
        target: PlaybackVisit,
        historyTarget: PlaybackVisit,
        duration?: number
    ): void {
        if (!state.target || state.phase === "stopped") return;
        state.target = visit(target);
        state.historyTarget = visit(historyTarget);
        position(state.position, duration, false);
        changed(snapshot());
    }
    function phase(value: PlaybackStateSnapshot["phase"], notify = true): void {
        if (!state.target || state.phase === value) return;
        // A late native event after Stop cannot revive a session without loading again.
        if (state.phase === "stopped" && value !== "loading") return;
        state.phase = value;
        if (value === "stopped") state.generation++;
        if (notify) changed(snapshot());
    }
    return {
        classify: classify,
        open: open,
        phase: phase,
        position: position,
        snapshot: snapshot,
    };
}

(window as any).__ottPlaybackSession = {
    create: createPlaybackSessionController,
    createState: createPlaybackState,
};
