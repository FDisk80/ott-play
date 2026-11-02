/** Archive requests own their schedule, resource identity and asynchronous work.
 * Host ports supply decoded inputs and effects; this module never reads the UI.
 */
interface ArchiveProgramme {
    end: number;
    key: string;
    payload: any;
    start: number;
}
interface ArchiveContext {
    channelId: string;
    file: boolean;
    host?: any;
    isCurrent(): boolean;
    retention: number;
    schedule: ArchiveProgramme[];
    scheduleRevision?: any;
    sourceId: string;
}
interface ArchiveView {
    changed: boolean;
    context: ArchiveContext;
    current: ArchiveProgramme | null;
    next: ArchiveProgramme | null;
    paused?: boolean;
    position: number;
    rewind?: number;
    rows: ArchiveProgramme[];
    window: { end: number; start: number };
}
interface ArchivePorts {
    authorize(context: ArchiveContext, allowed: () => void): boolean;
    capture(): ArchiveContext | null;
    epoch(): number | null;
    guide(
        context: ArchiveContext,
        done: (rows: ArchiveProgramme[]) => void
    ): void;
    now(): number;
    open(
        context: ArchiveContext,
        view: ArchiveView,
        url: string,
        offset: number,
        select: boolean
    ): ArchiveContext | null;
    pause(context: ArchiveContext, view: ArchiveView): ArchiveContext | null;
    publish(view: ArchiveView): any;
    resolve(
        context: ArchiveContext,
        view: ArchiveView,
        done: (url: string) => void
    ): void;
    seek(
        context: ArchiveContext,
        view: ArchiveView,
        offset: number
    ): ArchiveContext | null;
}

function createArchiveController(core: any, ports: ArchivePorts) {
    var generation = 0;
    var refill = 0;
    var owner: ArchiveContext | null = null;
    var rows: ArchiveProgramme[] = [];
    var active: {
        context: ArchiveContext;
        key: string;
        start: number;
        end: number;
    } | null = null;
    var shown = "";
    var fetched = "";
    var nextRefill = 0;
    var lookup = new core.BrowserGuideLookup(1, 4096);
    var schedule: any = {};
    var scheduleRevision: any = null;
    function identity(a: ArchiveContext, b: ArchiveContext): boolean {
        return a.sourceId === b.sourceId && a.channelId === b.channelId;
    }
    function adopt(context: ArchiveContext, input: ArchiveProgramme[]): void {
        owner = context;
        scheduleRevision =
            context.scheduleRevision === undefined
                ? context.schedule
                : context.scheduleRevision;
        rows = input
            .filter(function (row) {
                return (
                    isFinite(row.start) &&
                    isFinite(row.end) &&
                    row.end > row.start
                );
            })
            .slice()
            .sort(function (a, b) {
                return a.start - b.start;
            });
        schedule = {};
        lookup.clear();
    }
    function view(context: ArchiveContext, epoch: number): ArchiveView {
        var selected = lookup.lookup("archive", schedule, epoch, function () {
            return { entries: rows, metadata: null, unshifted: rows };
        });
        var current = selected.current || null;
        var window = current
            ? { end: current.end, start: current.start }
            : { end: epoch + 900, start: epoch - 3600 };
        var key = current ? current.key : "gap";
        return {
            changed: key !== shown,
            context: context,
            current: current,
            next: selected.next || null,
            position: epoch,
            rows: rows,
            window: window,
        };
    }
    function publish(model: ArchiveView): void {
        shown = model.current ? model.current.key : "gap";
        var projectedRevision = ports.publish(model);
        if (projectedRevision !== undefined)
            scheduleRevision = projectedRevision;
    }
    function valid(ticket: number, context: ArchiveContext): boolean {
        return generation === ticket && context.isCurrent();
    }
    function permit(
        ticket: number,
        context: ArchiveContext,
        action: () => void,
        admitted?: () => boolean
    ): void {
        if (admitted && !admitted()) return;
        var once = false;
        function allowed(): void {
            if (once || !valid(ticket, context) || (admitted && !admitted()))
                return;
            once = true;
            action();
        }
        if (!ports.authorize(context, allowed)) allowed();
    }
    function prepare(context: ArchiveContext, explicit = false): void {
        if (!owner || !owner.isCurrent() || !identity(owner, context)) {
            active = null;
            shown = "";
            fetched = "";
            adopt(context, context.schedule);
        } else if (
            explicit &&
            (context.scheduleRevision === undefined
                ? context.schedule
                : context.scheduleRevision) !== scheduleRevision
        ) {
            // An explicit entrypoint may supply a newer programme selection.
            // Periodic rendering cannot replace the owned schedule.
            adopt(context, context.schedule);
        }
    }
    function available(context: ArchiveContext, epoch: number): boolean {
        var fresh = ports.capture();
        return (
            !!fresh &&
            identity(context, fresh) &&
            context.isCurrent() &&
            context.file === fresh.file &&
            (!(context.retention > 0) ||
                (fresh.retention > 0 && epoch >= ports.now() - fresh.retention))
        );
    }
    function launch(
        ticket: number,
        context: ArchiveContext,
        epoch: number,
        select: boolean,
        rewind?: number,
        resolvedUrl?: string,
        admitted?: () => boolean,
        paused?: boolean
    ): boolean {
        if (
            !isFinite(epoch) ||
            epoch <= 0 ||
            !valid(ticket, context) ||
            !available(context, epoch) ||
            (admitted && !admitted())
        )
            return false;
        var opened = false;
        var model = view(context, Math.floor(epoch));
        model.rewind = rewind;
        model.paused = paused;
        var key = model.current
            ? model.current.key
            : JSON.stringify(model.window);
        var reusable =
            paused === undefined &&
            context.file &&
            active &&
            active.context.isCurrent() &&
            identity(active.context, context) &&
            active.key === key &&
            active.start === model.window.start &&
            active.end === model.window.end &&
            model.position >= active.start &&
            model.position < active.end;
        function finish(url?: string): void {
            permit(
                ticket,
                context,
                function () {
                    if (
                        !available(context, model.position) ||
                        (admitted && !admitted())
                    )
                        return;
                    var next = reusable
                        ? ports.seek(
                              context,
                              model,
                              model.position - model.window.start
                          )
                        : typeof url === "string" && url.length
                          ? ports.open(
                                context,
                                model,
                                url,
                                context.file
                                    ? model.position - model.window.start
                                    : 0,
                                select
                            )
                          : null;
                    if (!next || generation !== ticket || !next.isCurrent())
                        return;
                    opened = true;
                    owner = next;
                    active = {
                        context: next,
                        end: model.window.end,
                        key: key,
                        start: model.window.start,
                    };
                    model.context = next;
                    publish(model);
                },
                admitted
            );
        }
        permit(
            ticket,
            context,
            function () {
                if (
                    !available(context, model.position) ||
                    (admitted && !admitted())
                )
                    return;
                if (reusable) finish();
                else if (resolvedUrl !== undefined) finish(resolvedUrl);
                else {
                    var resolved = false;
                    ports.resolve(context, model, function (url) {
                        if (resolved || !valid(ticket, context)) return;
                        resolved = true;
                        finish(url);
                    });
                }
            },
            admitted
        );
        return opened;
    }
    function begin(
        action: (ticket: number, context: ArchiveContext) => void
    ): number {
        var ticket = ++generation;
        refill++;
        var captured = ports.capture();
        if (!captured) return ticket;
        var context: ArchiveContext = captured;
        prepare(context, true);
        permit(ticket, context, function () {
            action(ticket, context);
        });
        return ticket;
    }
    function fromLive(offset: number | null): void {
        begin(function (ticket, context) {
            if (!(context.retention > 0)) return;
            var replied = false;
            ports.guide(context, function (input) {
                if (replied || !valid(ticket, context)) return;
                replied = true;
                var now = ports.now();
                adopt(
                    context,
                    input.filter(function (row) {
                        return row.start > now - context.retention;
                    })
                );
                if (offset === null) {
                    permit(ticket, context, function () {
                        var model = view(context, Math.round(ports.now()));
                        if (!available(context, model.position)) return;
                        var next = ports.pause(context, model);
                        if (!next || generation !== ticket || !next.isCurrent())
                            return;
                        owner = next;
                        active = null;
                        model.context = next;
                        publish(model);
                    });
                } else {
                    var current = view(context, now).current;
                    if (offset || current)
                        launch(
                            ticket,
                            context,
                            offset ? Math.round(now) - offset : current!.start,
                            true,
                            offset
                        );
                }
            });
        });
    }
    function relativePosition() {
        var context = ports.capture();
        var from = ports.epoch();
        var now = ports.now();
        if (
            !context ||
            !context.isCurrent() ||
            typeof from !== "number" ||
            !isFinite(from) ||
            !isFinite(now) ||
            !isFinite(context.retention) ||
            !(context.retention > 0)
        )
            return null;
        // Provider archive URLs have one-second precision. Keep the entire
        // requested instant inside retention and strictly behind live TV.
        var earliest = Math.max(1, Math.ceil(now - context.retention));
        var latest = Math.floor(now) - 1;
        return earliest <= from && from <= latest && latest >= earliest
            ? {
                  context: context,
                  earliest: earliest,
                  from: from,
                  latest: latest,
              }
            : null;
    }
    return {
        cancel: function (): void {
            generation++;
            refill++;
        },
        canSeekRelative: function (): boolean {
            return !!relativePosition();
        },
        // Remote commands already resolved this exact URL. They may only
        // acknowledge a synchronous dispatch, never a pending PIN callback.
        open: function (epoch: number, url?: string): boolean {
            if (!isFinite(epoch) || epoch <= 0 || url === "") return false;
            var opened = false;
            var ticket = begin(function (ticket, context) {
                opened = launch(ticket, context, epoch, false, undefined, url);
            });
            if (url !== undefined && !opened && generation === ticket) {
                generation++;
                refill++;
            }
            return opened;
        },
        pauseLive: function (): void {
            fromLive(null);
        },
        rewind: function (offset: number): void {
            if (typeof offset === "number" && isFinite(offset) && offset >= 0)
                fromLive(offset);
        },
        seekRelative: function (
            offset: number,
            admitted: () => boolean,
            paused: boolean
        ) {
            if (
                typeof offset !== "number" ||
                !isFinite(offset) ||
                offset === 0 ||
                Math.abs(offset) > 9007199254740991 ||
                !admitted()
            )
                return null;
            var sample = relativePosition();
            if (!sample || !admitted()) return null;
            var requested = Math.floor(sample.from + offset);
            var position = Math.max(
                sample.earliest,
                Math.min(sample.latest, requested)
            );
            var ticket = ++generation;
            refill++;
            prepare(sample.context, true);
            var opened = false;
            try {
                opened = launch(
                    ticket,
                    sample.context,
                    position,
                    false,
                    undefined,
                    undefined,
                    admitted,
                    paused
                );
            } finally {
                // A rejected synchronous RPC must never resume later through
                // a provider resolution or PIN callback.
                if (!opened && generation === ticket) {
                    generation++;
                    refill++;
                }
            }
            return opened
                ? {
                      clamped: position !== requested,
                      earliest: sample.earliest,
                      from: sample.from,
                      latest: sample.latest,
                      position: position,
                      timeline: "archive",
                  }
                : null;
        },
        update: function (epoch: number): void {
            if (!isFinite(epoch) || epoch <= 0) return;
            var captured = ports.capture();
            if (!captured) return;
            var context: ArchiveContext = captured;
            prepare(context);
            var model = view(context, epoch);
            publish(model);
            var key = model.current ? model.current.key : "gap";
            if (model.next || (fetched === key && ports.now() < nextRefill))
                return;
            fetched = key;
            nextRefill = ports.now() + 60;
            var ticket = generation;
            var request = ++refill;
            var replied = false;
            ports.guide(context, function (input) {
                if (replied || request !== refill || !valid(ticket, context))
                    return;
                replied = true;
                if (!input.length) return;
                adopt(context, input);
                var currentEpoch = ports.epoch();
                if (currentEpoch !== null && context.isCurrent())
                    publish(view(context, currentEpoch));
            });
        },
    };
}

(window as any).__ottArchiveSession = { create: createArchiveController };
