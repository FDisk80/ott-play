// Same IPC/event bridge as screenshot-smoke; commands are production handlers.
window.runWindowControlsSmokeInvoke = async function (
    event,
    label,
    command,
    args
) {
    var reply;
    try {
        reply = {
            ok: true,
            value: await window.__TAURI__.core.invoke(command, args),
        };
    } catch (error) {
        reply = { error: String(error), ok: false };
    }
    await window.__TAURI__.event.emitTo(label, event, reply);
};
