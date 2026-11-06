const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const load = require("./helpers/remote-notifications.cjs");

// Exit animation consumes the end of the lifetime, never extending its expiry.

function fixture(onAbort, extraGlobals = {}) {
    let clock = 1000000;
    let sequence = 0;
    const jobs = new Map();
    const requests = [];
    const dom = new JSDOM('<div id="notifications"></div>', {
        pretendToBeVisual: true,
    });
    const w = dom.window;
    w.setTimeout = (fn, delay) => {
        jobs.set(++sequence, { at: clock + delay, fn });
        return sequence;
    };
    w.clearTimeout = (id) => jobs.delete(id);
    w.stbIsStandby = () => false;
    const client = load({
        Date: { now: () => clock },
        ...extraGlobals,
    }).createRemoteNotifications(w, (request, complete) => {
        const call = { aborted: false, complete, request };
        requests.push(call);
        return () => {
            call.aborted = true;
            if (onAbort) onAbort(call);
        };
    });
    function configure(
        address = "https://server.invalid/proxy/api/webhook/commands?device_id=tv",
        token = "device-token"
    ) {
        client.configure(address, token);
    }
    function poll() {
        client.poll();
        return requests.at(-1);
    }
    function item(overrides = {}) {
        return {
            duration_ms: 5000,
            expires_at: 1700000015.25,
            id: "a".repeat(32),
            message: "Door opened",
            runtime: new URL(requests.at(-1).request.url).searchParams.get(
                "runtime"
            ),
            severity: "info",
            title: "Home Assistant",
            ...overrides,
        };
    }
    function reply(notifications, overrides = {}, call = requests.at(-1)) {
        call.complete({
            body: JSON.stringify({
                notifications,
                poll_after_ms: 5000,
                server_time: 1700000000.25,
                version: 1,
                ...overrides,
            }),
            status: 200,
        });
    }
    function advance(ms, timers = false) {
        clock += ms;
        if (timers)
            for (const [id, job] of jobs)
                if (job.at <= clock) {
                    jobs.delete(id);
                    job.fn();
                }
    }
    return {
        advance,
        client,
        configure,
        dom,
        item,
        jobs,
        poll,
        reply,
        requests,
        w,
    };
}

// Local feedback shares one renderer but does not depend on remote configuration.
{
    const h = fixture();
    const display = h.w.__ottNotificationBanners;
    h.w.document.body.classList.add("booting");
    h.w.__ottStandby = {}; // Older hosts need not expose blocked().
    Object.defineProperty(h.w, "performance", { value: {} });
    const first = display.showLocal("<b>Seek +10</b>");
    assert.equal(first.element.textContent, "<b>Seek +10</b>");
    assert.equal(first.element.querySelector("b"), null);
    assert.equal(first.element.querySelector(".remote-notify-title"), null);
    assert.equal(first.element.querySelector(".remote-notify-label"), null);
    assert.equal(h.requests.length, 0);
    h.configure();
    h.client.setEnabled(false);
    h.client.stop();
    assert.equal(
        first.element.isConnected,
        true,
        "remote policy does not own local feedback"
    );
    const second = display.showLocal("Seek +20", 1000);
    assert.equal(first.element.isConnected, false);
    assert.equal(h.w.document.querySelectorAll(".remote-notify").length, 1);
    assert.equal(
        h.jobs.size,
        2,
        "replacement clears the first notice's expiry and exit"
    );
    h.advance(1000, true);
    assert.equal(second.element.isConnected, false);
    assert.equal(h.jobs.size, 0);
    Object.defineProperty(h.w.performance, "now", {
        value() {
            throw Error("host clock unavailable");
        },
    });
    assert.doesNotThrow(() => display.showLocal("Fallback clock"));
    display.clearLocal();
    h.w.__ottStandby = { blocked: () => true };
    assert.equal(display.showLocal("Hidden"), null);
}

// A rapid local volume/seek notice never evicts a critical remote alert.
{
    const h = fixture();
    h.configure();
    h.poll();
    h.reply(
        [0, 1, 2].map((i) =>
            h.item({ id: String(i).repeat(32), severity: "critical" })
        )
    );
    assert.equal(h.w.__ottNotificationBanners.showLocal("Volume 20"), null);
    assert.equal(
        h.w.document.querySelectorAll(".remote-notify-critical").length,
        3
    );
    h.client.stop();
    assert.equal(h.jobs.size, 0);
}

// The heading is one measured clip, keeping message and glyph heights stable.
{
    const h = fixture();
    let height = 42.5;
    const box = h.w.HTMLElement.prototype.getBoundingClientRect;
    h.w.HTMLElement.prototype.getBoundingClientRect = function () {
        return this.classList.contains("remote-notify-heading-body")
            ? { height }
            : box.call(this);
    };
    Object.defineProperty(h.w.navigator, "deviceMemory", { value: 2 });
    h.configure();
    h.poll();
    h.reply([h.item()]);
    const banner = h.w.document.querySelector(".remote-notify");
    const heading = banner.querySelector(".remote-notify-heading");
    assert.equal(heading.style.height, "42.5px");
    assert.equal(heading.classList.contains("remote-notify-foldable"), true);
    assert.equal(
        heading.querySelectorAll(".remote-notify-heading-body > div").length,
        2
    );
    assert.equal(
        heading.contains(banner.querySelector(".remote-notify-message")),
        false
    );
    assert.equal(banner.classList.contains("remote-notify-lite"), true);
    height = 60;
    h.w.dispatchEvent(new h.w.Event("resize"));
    assert.equal(heading.style.height, "60px");
    h.w.__ottNotificationBanners.showLocal("Local feedback");
    h.client.suspend();
    assert.equal(
        h.w.document.querySelectorAll(".remote-notify-local").length,
        1,
        "remote session changes cannot remove local feedback"
    );
    h.w.__ottNotificationBanners.suspend();
    assert.equal(h.w.document.querySelectorAll(".remote-notify").length, 0);
    assert.equal(h.jobs.size, 0);
    height = 80;
    h.w.dispatchEvent(new h.w.Event("resize"));
    assert.equal(
        heading.style.height,
        "60px",
        "expiry/suspend removes geometry listeners"
    );
}

{
    const h = fixture();
    h.w.__ottNotificationBanners.showLocal("Ready");
    Object.defineProperty(h.w.document, "hidden", { value: true });
    h.w.document.dispatchEvent(new h.w.Event("visibilitychange"));
    assert.equal(h.w.document.querySelectorAll(".remote-notify").length, 0);
    assert.equal(
        h.jobs.size,
        0,
        "hidden local feedback expires without a remote transport"
    );
}

{
    const h = fixture();
    h.configure();
    h.poll();
    h.reply([h.item({ duration_ms: 1000 })]);
    const banner = h.w.document.querySelector(".remote-notify");
    h.advance(679, true);
    assert.equal(banner.classList.contains("remote-notify-out"), false);
    h.advance(1, true);
    assert.equal(banner.classList.contains("remote-notify-out"), true);
    assert.equal(banner.isConnected, true);
    h.advance(320, true);
    assert.equal(banner.isConnected, false);
    assert.equal(h.jobs.size, 0);
}

{
    const h = fixture();
    h.configure();
    h.poll();
    h.reply([h.item({ duration_ms: 1000 })]);
    h.advance(680, true);
    h.client.suspend();
    assert.equal(h.w.document.querySelector(".remote-notify"), null);
    assert.equal(h.jobs.size, 0, "suspending cancels an in-progress exit");
}

{
    const h = fixture();
    h.configure();
    h.poll();
    h.reply([h.item({ expires_at: 1700000000.35 })]);
    h.advance(101, true);
    assert.equal(h.w.document.querySelector(".remote-notify"), null);
    assert.equal(
        h.jobs.size,
        0,
        "short remaining validity wins over animation timing"
    );
}

{
    const h = fixture();
    h.configure();
    const call = h.poll();
    const url = new URL(call.request.url);
    assert.equal(url.pathname, "/proxy/api/notifications");
    assert.equal(url.searchParams.get("device_id"), "tv");
    assert.equal(url.searchParams.get("active"), "true");
    assert.equal(
        url.searchParams.has("enabled"),
        false,
        "first poll stays compatible with older servers"
    );
    assert.equal(h.client.enabled(), true);
    assert.match(url.searchParams.get("runtime"), /^[A-Za-z0-9_.:-]{1,128}$/);
    assert.equal(call.request.headers.Authorization, "Bearer device-token");
    assert.equal(call.request.timeoutMs, 8000);
    assert.equal(url.toString().includes("device-token"), false);
    const notice = h.item({
        message: '<img src=x onerror="bad()"> & نص',
        title: "<b>Home</b>",
    });
    h.reply([notice, notice]);
    const banner = h.w.document.querySelector(".remote-notify");
    assert.equal(
        banner.querySelector(".remote-notify-title").textContent,
        "<b>Home</b>"
    );
    assert.equal(
        banner.querySelector(".remote-notify-message").textContent,
        '<img src=x onerror="bad()"> & نص'
    );
    assert.equal(banner.querySelectorAll("img,b").length, 0);
    assert.equal(
        banner.querySelector(".remote-notify-label").textContent,
        "Home update"
    );
    assert.equal(
        banner.querySelector(".remote-notify-icon").getAttribute("aria-hidden"),
        "true"
    );
    assert.equal(
        banner.querySelectorAll("a,button,input,[tabindex]").length,
        0
    );
    assert.equal(banner.dir, "auto");
    assert.equal(banner.getAttribute("role"), "status");
    assert.equal(h.w.document.querySelectorAll(".remote-notify").length, 1);
    h.advance(4999);
    h.poll();
    assert.equal(h.requests.length, 1, "no early poll");
    h.advance(1);
    h.poll();
    h.reply([notice]);
    assert.equal(
        h.w.document.querySelectorAll(".remote-notify").length,
        1,
        "duplicate delivery is not rendered"
    );
    h.advance(0, true);
    assert.equal(
        h.w.document.querySelectorAll(".remote-notify").length,
        0,
        "display timer removes banner"
    );
    h.dom.window.close();
}

for (const inactive of ["standby", "blocked", "hidden", "native", "booting"]) {
    const h = fixture();
    h.configure();
    h.poll();
    const notice = h.item();
    if (inactive === "standby") h.w.stbIsStandby = () => true;
    if (inactive === "blocked") h.w.__ottStandby = { blocked: () => true };
    if (inactive === "hidden")
        Object.defineProperty(h.w.document, "hidden", {
            configurable: true,
            value: true,
        });
    if (inactive === "native") h.w.__ottScreenAwake = false;
    if (inactive === "booting") h.w.document.body.classList.add("booting");
    h.reply([notice]);
    assert.equal(
        h.w.document.querySelector(".remote-notify"),
        null,
        inactive + " while in flight drops banner"
    );
    h.advance(5000);
    const call = h.poll();
    assert.equal(new URL(call.request.url).searchParams.get("active"), "false");
    h.w.stbIsStandby = () => false;
    h.w.__ottStandby = undefined;
    Object.defineProperty(h.w.document, "hidden", {
        configurable: true,
        value: false,
    });
    h.w.__ottScreenAwake = true;
    h.w.document.body.classList.remove("booting");
    h.reply([h.item({ id: "b".repeat(32) })]);
    assert.equal(
        h.w.document.querySelector(".remote-notify"),
        null,
        "inactive poll never becomes a wake replay"
    );
    h.advance(5000);
    h.poll();
    h.reply([notice]);
    assert.equal(
        h.w.document.querySelector(".remote-notify"),
        null,
        "dropped ID remains deduplicated after wake"
    );
    h.dom.window.close();
}

{
    const h = fixture();
    h.configure();
    h.poll();
    h.reply([h.item()]);
    Object.defineProperty(h.w.document, "hidden", { value: true });
    h.w.document.dispatchEvent(new h.w.Event("visibilitychange"));
    assert.equal(
        h.w.document.querySelector(".remote-notify"),
        null,
        "hiding clears visible banners immediately"
    );
    assert.equal(h.jobs.size, 0);
    h.dom.window.close();
}

{
    const h = fixture();
    h.configure();
    const old = h.poll();
    const stale = h.item();
    h.configure("https://other.invalid/api/webhook/commands", "new-token");
    assert.equal(old.aborted, true);
    h.reply([stale], {}, old);
    assert.equal(h.w.document.querySelector(".remote-notify"), null);
    const current = h.poll();
    assert.notEqual(
        new URL(current.request.url).searchParams.get("runtime"),
        stale.runtime
    );
    h.reply([stale, h.item({ id: "b".repeat(32) })]);
    assert.equal(
        h.w.document.querySelectorAll(".remote-notify").length,
        1,
        "other runtime discarded"
    );
    h.client.stop();
    assert.equal(h.w.document.querySelector(".remote-notify"), null);
    assert.equal(h.jobs.size, 0);
    h.dom.window.close();
}

for (const status of [404, 405, 429, 500]) {
    const h = fixture();
    h.configure();
    h.poll().complete({ body: "", status });
    h.advance(59999);
    h.poll();
    assert.equal(h.requests.length, 1, "optional endpoint failure backs off");
    h.advance(1);
    h.poll();
    assert.equal(h.requests.length, 2);
    h.dom.window.close();
}

for (const overrides of [
    { duration_ms: 999 },
    { duration_ms: 15001 },
    { duration_ms: 1000.5 },
    { title: "x".repeat(129) },
    { message: "x".repeat(513) },
    { message: "" },
    { id: "bad" },
    { severity: "emergency" },
    { expires_at: null },
]) {
    const h = fixture();
    h.configure();
    h.poll();
    h.reply([h.item(overrides)]);
    assert.equal(
        h.w.document.querySelector(".remote-notify"),
        null,
        JSON.stringify(overrides)
    );
    h.dom.window.close();
}

{
    const h = fixture();
    h.configure();
    h.poll();
    h.advance(3000);
    h.reply([h.item({ expires_at: 1700000002.25 })]);
    assert.equal(
        h.w.document.querySelector(".remote-notify"),
        null,
        "full request time subtracted despite skewed device clock"
    );
    h.advance(5000);
    h.poll();
    h.reply(
        [0, 1, 2, 3].map((i) =>
            h.item({
                id: String(i).repeat(32),
                severity: i === 3 ? "critical" : "warning",
            })
        )
    );
    assert.equal(
        h.w.document.querySelectorAll(".remote-notify").length,
        3,
        "bounded DOM banners"
    );
    assert.equal(
        h.jobs.size,
        6,
        "eviction cancels both old animation and expiry timers"
    );
    assert.equal(
        h.w.document.querySelectorAll(".remote-notify-critical").length,
        1
    );
    h.w.stbIsStandby = () => true;
    h.advance(5000);
    h.poll();
    assert.equal(
        h.w.document.querySelectorAll(".remote-notify").length,
        0,
        "inactive heartbeat clears banners"
    );
    assert.equal(h.jobs.size, 0);
    h.dom.window.close();
}

for (const invalid of [
    { notifications: Array(5).fill({}) },
    { version: 2 },
    { server_time: 0 },
    { poll_after_ms: 1 },
    { notifications: {} },
]) {
    const h = fixture();
    h.configure();
    h.poll();
    h.reply([h.item()], invalid);
    assert.equal(h.w.document.querySelector(".remote-notify"), null);
    h.advance(5000);
    h.poll();
    assert.equal(h.requests.length, 1, "invalid envelope does not hot-loop");
    h.dom.window.close();
}

{
    const h = fixture();
    h.configure();
    h.poll();
    h.advance(500);
    h.reply([h.item({ expires_at: 1700000001.25 })]);
    assert.equal(h.w.document.querySelectorAll(".remote-notify").length, 1);
    h.advance(499, true);
    assert.equal(h.w.document.querySelectorAll(".remote-notify").length, 1);
    h.advance(1, true);
    assert.equal(
        h.w.document.querySelector(".remote-notify"),
        null,
        "display duration is clamped to remaining server lifetime"
    );
    h.advance(5000);
    h.poll();
    h.reply([h.item({ id: "b".repeat(32) })]);
    h.w.__ottRemoteNotifications.suspend();
    assert.equal(
        h.w.document.querySelector(".remote-notify"),
        null,
        "standby/native hook clears immediately without another poll"
    );
    h.advance(5000);
    h.poll();
    h.w.__ottRemoteNotifications.suspend();
    h.reply([h.item({ id: "c".repeat(32) })]);
    assert.equal(
        h.w.document.querySelector(".remote-notify"),
        null,
        "sleep then wake invalidates in-flight notifications"
    );
    h.dom.window.close();
}

{
    const h = fixture();
    let monotonic = 100;
    h.w.performance.now = () => monotonic;
    h.configure();
    h.poll();
    monotonic += 3000;
    h.advance(-10000);
    h.reply([h.item({ expires_at: 1700000002.25 })]);
    assert.equal(
        h.w.document.querySelector(".remote-notify"),
        null,
        "wall clock rollback cannot revive an expired in-flight event"
    );
    h.dom.window.close();
}

{
    const h = fixture();
    h.configure();
    h.poll();
    const beforeSleep = h.item();
    h.reply([]);
    h.client.suspend();
    h.advance(5000);
    const resumed = h.poll();
    const resumedRuntime = new URL(resumed.request.url).searchParams.get(
        "runtime"
    );
    assert.notEqual(
        resumedRuntime,
        beforeSleep.runtime,
        "fast sleep/wake retires server queue even without an inactive heartbeat"
    );
    h.reply([beforeSleep]);
    assert.equal(h.w.document.querySelector(".remote-notify"), null);
    h.configure();
    const reconnected = h.poll();
    assert.notEqual(
        new URL(reconnected.request.url).searchParams.get("runtime"),
        resumedRuntime,
        "same-credential reenable cannot replay the disconnected session's queue"
    );
    h.dom.window.close();
}

{
    const h = fixture();
    h.client.setEnabled(false);
    h.configure();
    assert.equal(
        h.client.enabled(),
        false,
        "reconnect preserves installation preference"
    );
    const off = h.poll();
    const offUrl = new URL(off.request.url);
    assert.equal(offUrl.searchParams.get("active"), "false");
    assert.equal(
        offUrl.searchParams.has("enabled"),
        false,
        "unnegotiated off heartbeat uses legacy shape"
    );
    h.reply([h.item()]);
    assert.equal(
        h.w.document.querySelector(".remote-notify"),
        null,
        "disabled gate rejects legacy-server events"
    );
    assert.equal(h.jobs.size, 0);
    h.dom.window.close();
}

{
    const h = fixture();
    h.configure();
    h.poll();
    h.reply([h.item()], { capabilities: { enabled: true } });
    assert.equal(h.w.document.querySelectorAll(".remote-notify").length, 1);
    assert.equal(h.jobs.size, 2);
    h.client.setEnabled(false);
    assert.equal(h.client.enabled(), false);
    assert.equal(
        h.w.document.querySelectorAll(".remote-notify").length,
        0,
        "off clears immediately"
    );
    assert.equal(h.jobs.size, 0, "off cancels banner timers");
    const off = h.poll();
    const offUrl = new URL(off.request.url);
    assert.equal(offUrl.searchParams.get("enabled"), "false");
    assert.equal(offUrl.searchParams.get("active"), "false");
    h.client.setEnabled(false);
    assert.equal(
        off.aborted,
        false,
        "idempotent policy application does not cancel its own heartbeat"
    );
    h.reply([], { capabilities: { enabled: true } });
    h.advance(5000);
    const again = h.poll();
    assert.equal(
        new URL(again.request.url).searchParams.get("enabled"),
        "false",
        "off does not stop notification heartbeats"
    );
    h.dom.window.close();
}

{
    const h = fixture();
    h.configure();
    const inFlight = h.poll();
    const old = h.item();
    h.client.setEnabled(false);
    assert.equal(
        inFlight.aborted,
        true,
        "off aborts the current notification request"
    );
    h.reply([old], { capabilities: { enabled: true } }, inFlight);
    assert.equal(
        h.w.document.querySelector(".remote-notify"),
        null,
        "late completion cannot repopulate cleared cards"
    );
    const disabled = h.poll();
    assert.equal(
        new URL(disabled.request.url).searchParams.has("enabled"),
        false,
        "stale completion cannot negotiate capabilities"
    );
    h.reply([], { capabilities: { enabled: true } });
    const offRuntime = new URL(disabled.request.url).searchParams.get(
        "runtime"
    );
    h.client.setEnabled(true);
    const on = h.poll();
    const onUrl = new URL(on.request.url);
    assert.equal(onUrl.searchParams.get("enabled"), "true");
    assert.equal(onUrl.searchParams.get("active"), "true");
    assert.notEqual(
        onUrl.searchParams.get("runtime"),
        offRuntime,
        "enable retires the disabled queue"
    );
    assert.notEqual(
        onUrl.searchParams.get("runtime"),
        old.runtime,
        "enable cannot replay the old active queue"
    );
    h.reply([old, h.item({ id: "c".repeat(32), message: "New event" })], {
        capabilities: { enabled: true },
    });
    assert.equal(h.w.document.querySelectorAll(".remote-notify").length, 1);
    assert.equal(
        h.w.document.querySelector(".remote-notify-message").textContent,
        "New event"
    );
    h.dom.window.close();
}

{
    const h = fixture();
    h.configure();
    h.poll();
    h.reply([], { capabilities: { enabled: true } });
    h.configure();
    let request = h.poll();
    assert.equal(
        new URL(request.request.url).searchParams.get("enabled"),
        "true",
        "same server reconnect keeps negotiation"
    );
    h.configure("https://other.invalid/api/webhook/commands", "other-token");
    request = h.poll();
    assert.equal(
        new URL(request.request.url).searchParams.has("enabled"),
        false,
        "new endpoint negotiates independently"
    );
    h.reply([], { capabilities: { enabled: true } });
    h.configure("https://other.invalid/api/webhook/commands", "rotated-token");
    request = h.poll();
    assert.equal(
        new URL(request.request.url).searchParams.has("enabled"),
        false,
        "new authority cannot inherit prior capabilities"
    );
    h.dom.window.close();
}

{
    let pendingNotice;
    const h = fixture((call) =>
        h.reply([pendingNotice], { capabilities: { enabled: true } }, call)
    );
    h.configure();
    h.poll();
    pendingNotice = h.item();
    h.client.setEnabled(false);
    assert.equal(
        h.w.document.querySelector(".remote-notify"),
        null,
        "synchronous abort completion sees retired generation"
    );
    const heartbeat = h.poll();
    assert.equal(
        new URL(heartbeat.request.url).searchParams.has("enabled"),
        false,
        "synchronous stale response cannot negotiate"
    );
    h.dom.window.close();
}

console.log(
    "Remote notifications: literal bounded banners, activity, expiry, runtime isolation and optional endpoint backoff passed"
);

function mediaFixture() {
    const loads = [];
    const h = fixture(undefined, {
        notificationMedia: {
            loadNotificationMedia(w, options, complete) {
                const pending = { aborted: false, complete, options };
                loads.push(pending);
                return () => {
                    pending.aborted = true;
                };
            },
            supportsNotificationMedia: () => true,
            validNotificationMedia: (item) => item && item.kind === "image",
        },
    });
    const images = [];
    const create = h.w.document.createElement.bind(h.w.document);
    h.w.document.createElement = function (tag) {
        const node = create(tag);
        if (tag === "img") images.push(node);
        return node;
    };
    h.configure();
    h.poll();
    const media = {
        bytes: 100,
        content_type: "image/jpeg",
        height: 180,
        id: "e".repeat(32),
        kind: "image",
        width: 320,
    };
    const caps = { capabilities: { enabled: true, media: ["jpeg-v1"] } };
    return { caps, h, images, loads, media };
}
{
    const { h, loads, media, caps, images } = mediaFixture();
    h.reply([h.item({ media })], caps);
    const banner = h.w.document.querySelector(".remote-notify");
    assert.equal(banner.style.display, "none");
    assert.equal(
        banner.style.animationDuration,
        "",
        "hidden media has not started its entrance"
    );
    h.advance(2000, true);
    let revoked = 0;
    loads[0].complete({
        dispose: () => revoked++,
        height: 180,
        remainingMs: 3000,
        url: "blob:delayed-frame",
        width: 320,
    });
    h.advance(500, true);
    Object.defineProperty(images[0], "naturalWidth", { value: 320 });
    Object.defineProperty(images[0], "naturalHeight", { value: 180 });
    images[0].onload();
    assert.equal(banner.style.display, "block");
    const durations = banner.style.animationDuration.split(",").map(parseFloat);
    assert.equal(durations[0], 480);
    assert.ok(
        Math.abs(durations[1] - 1520) < 5,
        "fade uses the 2500ms actually left after fetch/decode"
    );
    h.advance(2179, true);
    assert.equal(banner.classList.contains("remote-notify-out"), false);
    h.advance(1, true);
    assert.equal(banner.classList.contains("remote-notify-out"), true);
    h.advance(320, true);
    assert.equal(
        banner.isConnected,
        false,
        "loading never extends the original 5000ms TTL"
    );
    assert.equal(revoked, 1);
    assert.equal(h.jobs.size, 0);
}
{
    const { h, loads, media, caps, images } = mediaFixture();
    h.reply([h.item({ media })], caps);
    h.advance(2000, true);
    loads[0].complete({
        dispose() {},
        height: 180,
        remainingMs: 1500,
        url: "blob:short-frame",
        width: 320,
    });
    h.advance(500, true);
    Object.defineProperty(images[0], "naturalWidth", { value: 320 });
    Object.defineProperty(images[0], "naturalHeight", { value: 180 });
    images[0].onload();
    const banner = h.w.document.querySelector(".remote-notify");
    assert.ok(parseFloat(banner.style.animationDuration.split(",")[1]) <= 20);
    h.advance(1000, true);
    assert.equal(
        banner.isConnected,
        false,
        "shorter private-media expiry wins over banner TTL"
    );
    assert.equal(h.jobs.size, 0);
}
{
    const { h, loads, media, caps } = mediaFixture();
    h.reply([h.item({ media })], caps);
    assert.equal(loads.length, 1);
    h.client.setEnabled(false);
    assert.equal(loads[0].aborted, true);
    let revoked = 0;
    loads[0].complete({
        dispose: () => revoked++,
        height: 180,
        remainingMs: 1000,
        url: "blob:stale",
        width: 320,
    });
    assert.equal(revoked, 1, "late image URL is disposed after disable");
    assert.equal(h.w.document.querySelectorAll(".remote-notify").length, 0);
}
{
    const { h, loads, media, caps } = mediaFixture();
    h.reply([h.item({ media })], caps);
    let revoked = 0;
    loads[0].complete({
        dispose: () => revoked++,
        height: 180,
        remainingMs: 1000,
        url: "blob:frame",
        width: 320,
    });
    const image = h.w.document.querySelector(".remote-notify");
    // The pending image is intentionally not inserted until decode succeeds.
    assert.equal(image.querySelector("img"), null);
    h.advance(1000, true);
    assert.equal(revoked, 1, "media expiry removes the entire media card");
    assert.equal(h.w.document.querySelectorAll(".remote-notify").length, 0);
    h.advance(4000, true);
    assert.equal(h.w.document.querySelectorAll(".remote-notify").length, 0);
}
{
    const { h, loads, media, caps } = mediaFixture();
    h.reply([h.item({ media }), h.item({ id: "b".repeat(32), media })], caps);
    assert.equal(loads.length, 2);
    assert.equal(
        loads[0].aborted,
        true,
        "only newest media request remains active"
    );
    h.client.suspend();
    assert.equal(loads[1].aborted, true);
}
{
    const { h, loads, media } = mediaFixture();
    h.reply([h.item({ media })]);
    assert.equal(
        loads.length,
        0,
        "media is never fetched without server capability"
    );
    h.advance(5000);
    const poll = h.poll();
    assert.equal(new URL(poll.request.url).searchParams.has("media"), false);
}
{
    const { h, caps } = mediaFixture();
    h.reply([], caps);
    h.advance(5000);
    const poll = h.poll();
    assert.equal(
        new URL(poll.request.url).searchParams.get("media"),
        "jpeg-v1"
    );
    poll.complete({ body: "unsupported query", status: 400 });
    h.advance(5000);
    const legacy = h.poll();
    assert.equal(
        new URL(legacy.request.url).searchParams.has("enabled"),
        false
    );
    assert.equal(new URL(legacy.request.url).searchParams.has("media"), false);
}
console.log(
    "PASS image notification gate: negotiation, one owner, expiry, stale completion and downgrade"
);

{
    const { h, loads, media, caps, images } = mediaFixture();
    h.reply([h.item({ media })], caps);
    let revoked = 0;
    loads[0].complete({
        dispose: () => revoked++,
        height: 180,
        remainingMs: 2000,
        url: "blob:decoded-frame",
        width: 320,
    });
    Object.defineProperty(images[0], "naturalWidth", { value: 320 });
    Object.defineProperty(images[0], "naturalHeight", { value: 180 });
    images[0].onload();
    assert.equal(h.w.document.querySelectorAll(".remote-notify img").length, 1);
    assert.equal(
        h.w.document
            .querySelector(".remote-notify")
            .classList.contains("remote-notify-with-image"),
        true
    );
    h.client.setEnabled(false);
    assert.equal(revoked, 1);
    assert.equal(images[0].getAttribute("src"), null);
    assert.equal(images[0].onload, null);
    assert.equal(h.w.document.querySelectorAll(".remote-notify img").length, 0);
}

{
    const { h, loads, media, caps, images } = mediaFixture();
    h.reply([h.item({ media })], caps);
    let revoked = 0;
    loads[0].complete({
        dispose: () => revoked++,
        height: 180,
        remainingMs: 1000,
        url: "blob:slow-decode",
        width: 320,
    });
    const onload = images[0].onload;
    Object.defineProperty(images[0], "naturalWidth", { value: 320 });
    Object.defineProperty(images[0], "naturalHeight", { value: 180 });
    h.advance(1001, false);
    onload();
    assert.equal(
        h.w.document.querySelector(".remote-notify-image"),
        null,
        "expired decode cannot attach before delayed timer runs"
    );
    assert.equal(revoked, 1);
}

{
    const { h, loads, media, caps, images } = mediaFixture();
    const events = [];
    h.w.__ottPerfSink = {
        notification: (_media, count) => ({
            phase: (name, end) => events.push({ end, phase: name }),
            stage: (name, reason) =>
                events.push({ count: count(), name, reason: reason || null }),
        }),
    };
    const item = h.item({ media, message: "PRIVATE TEXT" });
    h.reply([item, item], caps);
    assert.deepEqual(
        events.filter((e) => e.name).map((e) => e.name),
        ["received", "dom_created", "received", "dropped"]
    );
    assert.equal(events.at(-1).reason, "duplicate");
    loads[0].options.phase("fetch", false);
    loads[0].options.phase("fetch", true);
    loads[0].complete({
        dispose() {},
        height: 180,
        remainingMs: 1000,
        url: "blob:PRIVATE",
        width: 320,
    });
    images[0].decode = () => {
        throw Error("must not add decoding work");
    };
    Object.defineProperty(images[0], "naturalWidth", { value: 320 });
    Object.defineProperty(images[0], "naturalHeight", { value: 180 });
    images[0].onload();
    assert(events.some((e) => e.name === "image_loaded"));
    assert(events.some((e) => e.name === "shown"));
    assert(events.some((e) => e.name === "updated"));
    h.client.setEnabled(false);
    assert.equal(events.at(-1).name, "hidden");
    assert.equal(events.at(-1).count, 0);
    assert(!JSON.stringify(events).includes("PRIVATE"));
    h.dom.window.close();
}
{
    const { h, loads, media, caps } = mediaFixture();
    h.reply([h.item({ media })], caps);
    assert.equal(
        loads[0].options.phase,
        undefined,
        "off adds no media phase callbacks"
    );
    h.dom.window.close();
}
console.log(
    "PASS notification performance hooks: actual stages only, no extra decode, empty OFF hooks"
);
