/** Compatibility edge for archive UI, provider URLs and device effects. */
var w = window as any;
var classicArchiveController: any = null;
var classicArchiveReplacing = false;
var classicArchivePublished: any = null;
var classicArchiveSchedule: ArchiveProgramme[] = [];

function classicArchiveRows(values: any): ArchiveProgramme[] {
    var result: ArchiveProgramme[] = [];
    if (Array.isArray(values))
        values.forEach(function (row: any): void {
            if (
                row &&
                typeof row.time === "number" &&
                typeof row.time_to === "number"
            )
                result.push({
                    end: row.time_to,
                    key: JSON.stringify([
                        row.time,
                        row.time_to,
                        row.id === undefined ? row.catchup_id : row.id,
                    ]),
                    payload: row,
                    start: row.time,
                });
        });
    return result;
}

function classicArchiveCapture(): ArchiveContext | null {
    if (w.__ottKiosk && w.__ottKiosk.enabled()) return null;
    var id = (w.curList || [])[w.primaryIndex];
    var channel = (w.channels || {})[id];
    if (!channel || id == null) return null;
    var context = w.__ottClassicPlayback.context();
    return {
        channelId: String(id),
        file: !!w.fileArchive,
        // Keep the renderer-facing id; c/i are private selection coordinates.
        host: { c: w.catIndex, i: w.primaryIndex, id: id },
        isCurrent: context.isCurrent,
        retention: Math.max(0, Number(channel.rec) || 0) * 3600,
        schedule:
            w.epgArray === classicArchivePublished
                ? classicArchiveSchedule
                : classicArchiveRows(w.epgArray),
        scheduleRevision: w.epgArray,
        sourceId: context.sourceId,
    };
}

function classicArchiveRuntime(): any {
    if (classicArchiveController) return classicArchiveController;
    var playback = w.__ottClassicPlayback;
    function info(mode: number): void {
        if (
            (mode !== 1 || w.sInfoRew) &&
            typeof w.showChannelInfo === "function"
        )
            w.showChannelInfo(mode, null);
    }
    function enter(
        context: ArchiveContext,
        model: ArchiveView,
        select?: boolean
    ): boolean {
        var payload = model.current && model.current.payload;
        if (select && typeof w.setCurrent === "function")
            w.setCurrent(context.host.c, context.host.i, true);
        if (
            playback.command({
                archiveStart: model.position,
                channelId: context.channelId,
                label:
                    payload && typeof payload.name === "string"
                        ? payload.name
                        : "",
                type: "archive",
            }) === false
        )
            return false;
        var target = playback.snapshot().target;
        return (
            !!target &&
            target.kind === "archive" &&
            target.sourceId === context.sourceId &&
            target.channelId === context.channelId &&
            target.archiveStart === model.position
        );
    }
    classicArchiveController = w.__ottArchiveSession.create(w.OttPlayCore, {
        authorize: function (
            context: ArchiveContext,
            allowed: () => void
        ): boolean {
            return (
                typeof w.ifParentalAccessChId === "function" &&
                w.ifParentalAccessChId(context.host.id, allowed)
            );
        },
        capture: classicArchiveCapture,
        epoch: function (): number | null {
            var state = playback.snapshot();
            return state.target &&
                state.target.kind === "archive" &&
                state.phase !== "stopped"
                ? state.target.archiveStart + state.position
                : null;
        },
        guide: function (
            context: ArchiveContext,
            done: (rows: ArchiveProgramme[]) => void
        ): void {
            if (typeof w.getChannelEpgCached === "function")
                w.getChannelEpgCached(
                    context.host.id,
                    function (_id: any, data: any): void {
                        done(classicArchiveRows(data));
                    }
                );
            else done([]);
        },
        now: function (): number {
            return Date.now() / 1000;
        },
        open: function (
            context: ArchiveContext,
            model: ArchiveView,
            url: string,
            offset: number,
            select: boolean
        ): ArchiveContext | null {
            if (!enter(context, model, select)) return null;
            if (w.sStopPlay && typeof w.stbStop === "function") {
                var current = playback.context().isCurrentSource;
                // The coordinator owns this synchronous decoder replacement.
                classicArchiveReplacing = true;
                try {
                    w.stbStop();
                } finally {
                    classicArchiveReplacing = false;
                }
                if (
                    !current() ||
                    (w.curList || [])[w.primaryIndex] !== context.host.id ||
                    w.playType !== model.position
                )
                    return null;
                playback.command({ type: "loading" });
            }
            var openCurrent = playback.context().isCurrent;
            var rewind = model.rewind;
            if (rewind !== undefined && typeof w.showShift === "function")
                w.showShift(
                    rewind
                        ? typeof w.formatSeekOffset === "function"
                            ? w.formatSeekOffset(-rewind)
                            : String(-rewind)
                        : w._
                          ? w._("Archive - begin")
                          : "Archive - begin"
                );
            info(1);
            if (!openCurrent()) return null;
            if (model.paused !== undefined) {
                // A remote archive seek replaces the source URL. Pass pause
                // intent into the new lease before asynchronous preparation.
                var backend =
                    w.__ottCoreBackendPeek && w.__ottCoreBackendPeek();
                var handle =
                    backend &&
                    backend.open({
                        paused: model.paused,
                        position: offset,
                        url: url,
                    });
                if (!handle || !handle.active()) return null;
            } else w.stbPlay(url, offset);
            return classicArchiveCapture();
        },
        pause: function (
            context: ArchiveContext,
            model: ArchiveView
        ): ArchiveContext | null {
            if (!enter(context, model)) return null;
            playback.command({ type: "pause" });
            info(2);
            if (typeof w.showShift === "function")
                w.showShift(w._ ? w._("Pause") : "Pause");
            if (typeof w.stbPause === "function") w.stbPause();
            return classicArchiveCapture();
        },
        publish: function (model: ArchiveView): any {
            var rows = model.rows;
            // The controller keeps its schedule stable between position ticks.
            // Restore that owned projection even if a view replaced epgArray.
            w.epgArray =
                classicArchiveSchedule === rows
                    ? classicArchivePublished
                    : rows.map(function (row): any {
                          return row.payload;
                      });
            w.curProg = model.current ? rows.indexOf(model.current) : -1;
            // Position ticks repaint the archive footer but do not replace
            // the live guide projection with the same schedule every second.
            if (
                classicArchiveSchedule !== rows &&
                typeof w.publishChannelProgrammeRows === "function"
            )
                w.publishChannelProgrammeRows(
                    model.context.host.id,
                    w.epgArray
                );
            if (typeof w.__ottRenderArchive === "function")
                w.__ottRenderArchive(model);
            classicArchivePublished = w.epgArray;
            classicArchiveSchedule = rows;
            return w.epgArray;
        },
        resolve: function (
            context: ArchiveContext,
            model: ArchiveView,
            done: (url: string) => void
        ): void {
            var programme = model.current
                ? model.current.payload
                : {
                      descr: "",
                      name: "",
                      time: model.window.start,
                      time_to: model.window.end,
                  };
            done(
                typeof w.getArchiveUrl === "function"
                    ? w.getArchiveUrl(
                          context.host.id,
                          model.position,
                          model.window.end,
                          programme
                      )
                    : ""
            );
        },
        seek: function (
            context: ArchiveContext,
            model: ArchiveView,
            offset: number
        ): ArchiveContext | null {
            if (!enter(context, model)) return null;
            info(1);
            w.stbSetPosTime(offset);
            return classicArchiveCapture();
        },
    });
    return classicArchiveController;
}

(window as any).__ottClassicArchive = {
    cancel: function (): void {
        if (!classicArchiveReplacing && classicArchiveController)
            classicArchiveController.cancel();
    },
    canSeekRelative: function (): boolean {
        var id = (w.curList || [])[w.primaryIndex];
        return (
            Array.isArray(w.parentalArray) &&
            !w.parentalArray.some(function (protectedId: any) {
                return (
                    String(protectedId) === String(id) &&
                    (!w.__ottParental || w.__ottParental.needs("channels"))
                );
            }) &&
            !!classicArchiveController &&
            classicArchiveController.canSeekRelative()
        );
    },
    open: function (epoch: number, url?: string): boolean {
        return classicArchiveRuntime().open(epoch, url);
    },
    pauseLive: function (): void {
        classicArchiveRuntime().pauseLive();
    },
    rewind: function (offset: number): void {
        classicArchiveRuntime().rewind(offset);
    },
    seekRelative: function (
        offset: number,
        admitted: () => boolean,
        paused: boolean
    ) {
        return classicArchiveRuntime().seekRelative(offset, admitted, paused);
    },
    update: function (epoch: number): void {
        classicArchiveRuntime().update(epoch);
    },
};
