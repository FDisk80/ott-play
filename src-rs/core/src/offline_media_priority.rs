//! Cooperative admission for original-file I/O. Admitted OS calls always drain.
use std::{
    pin::Pin,
    sync::{Arc, Mutex},
    task::{Context, Poll},
    time::Duration,
};
use tokio::{
    io::{AsyncRead, ReadBuf},
    sync::Notify,
    time::Instant,
};

const QUIET: Duration = Duration::from_millis(50);
const FAIR: Duration = Duration::from_secs(1);
const HANDOFF: Duration = Duration::from_millis(750);

#[derive(Default)]
struct State {
    readers: usize,
    quiet_until: Option<Instant>,
    next_background: Option<Instant>,
    handoff_until: Option<Instant>,
}
impl State {
    fn idle(&self, now: Instant) -> bool {
        self.readers == 0
            && self.quiet_until.is_none_or(|until| now >= until)
            && self.handoff_until.is_none_or(|until| now >= until)
    }
    fn enter(&mut self, now: Instant) {
        if self.idle(now) || self.next_background.is_none() {
            self.next_background = Some(now + FAIR);
        }
        self.handoff_until = None;
        self.readers += 1;
    }
    fn leave(&mut self, now: Instant) {
        self.readers -= 1;
        if self.readers == 0 {
            self.quiet_until = Some(now + QUIET);
        }
    }
    fn handoff(&mut self, now: Instant) {
        // Concurrent first publications share one bounded window. They cannot
        // extend a pending handoff or the active reader's fairness deadline.
        if self.idle(now) {
            self.handoff_until = Some(now + HANDOFF);
            self.next_background = Some(now + FAIR);
        }
    }
    fn wait_until(&mut self, now: Instant) -> Option<Instant> {
        if self.idle(now) {
            self.next_background = None;
            self.handoff_until = None;
            return None;
        }
        let deadline = *self.next_background.get_or_insert(now + FAIR);
        if now >= deadline {
            // One allowance across every scanner, not one per waiter.
            self.next_background = Some(now + FAIR);
            return None;
        }
        let mut wake = deadline;
        if self.readers == 0 {
            if let Some(until) = self.quiet_until.filter(|until| *until > now) {
                wake = wake.min(until);
            }
            if let Some(until) = self.handoff_until.filter(|until| *until > now) {
                wake = wake.min(until);
            }
        }
        Some(wake)
    }
}
#[derive(Default)]
pub(super) struct Priority {
    state: Mutex<State>,
    changed: Notify,
}
impl Priority {
    pub(super) fn read(self: &Arc<Self>) -> ReadLease {
        self.state
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .enter(Instant::now());
        self.changed.notify_waiters();
        ReadLease(self.clone())
    }
    pub(super) fn handoff(&self) {
        self.state
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .handoff(Instant::now());
        self.changed.notify_waiters();
    }
    pub(super) async fn background(&self) {
        loop {
            let changed = self.changed.notified();
            tokio::pin!(changed);
            changed.as_mut().enable();
            let deadline = self
                .state
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .wait_until(Instant::now());
            let Some(deadline) = deadline else { return };
            tokio::select! {
                _ = changed => (),
                _ = tokio::time::sleep_until(deadline) => (),
            }
        }
    }
    pub(super) fn stream<R>(self: &Arc<Self>, inner: R) -> ReadStream<R> {
        ReadStream {
            inner,
            priority: self.clone(),
            active: None,
        }
    }
    #[cfg(test)]
    pub(super) fn readers(&self) -> usize {
        self.state.lock().unwrap().readers
    }
}
pub(super) struct ReadLease(Arc<Priority>);
impl Drop for ReadLease {
    fn drop(&mut self) {
        self.0
            .state
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .leave(Instant::now());
        self.0.changed.notify_waiters();
    }
}
pub(super) struct ReadStream<R> {
    inner: R,
    priority: Arc<Priority>,
    active: Option<ReadLease>,
}
impl<R: AsyncRead + Unpin> AsyncRead for ReadStream<R> {
    fn poll_read(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<std::io::Result<()>> {
        let this = self.get_mut();
        if this.active.is_none() {
            this.active = Some(this.priority.read());
        }
        let result = Pin::new(&mut this.inner).poll_read(cx, buf);
        if result.is_ready() {
            this.active = None;
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn repeated_short_reads_do_not_reset_aggregate_fairness() {
        let now = Instant::now();
        let mut state = State::default();
        state.enter(now);
        assert_eq!(state.wait_until(now), Some(now + FAIR));
        for n in 1..100 {
            let at = now + Duration::from_millis(n * 10);
            state.leave(at);
            state.enter(at);
        }
        assert_eq!(state.wait_until(now + FAIR), None);
        assert_eq!(state.wait_until(now + FAIR), Some(now + FAIR * 2));
        state.leave(now + FAIR);
        assert_eq!(state.wait_until(now + FAIR + QUIET), None);
    }
    #[test]
    fn handoff_is_bounded_and_concurrent_publications_do_not_extend_it() {
        let now = Instant::now();
        let mut state = State::default();
        state.handoff(now);
        for n in 1..75 {
            state.handoff(now + Duration::from_millis(n * 10));
        }
        assert_eq!(state.wait_until(now), Some(now + HANDOFF));
        assert_eq!(state.wait_until(now + HANDOFF), None);
        state.handoff(now + FAIR);
        state.enter(now + FAIR);
        assert!(state.handoff_until.is_none());
    }
    #[tokio::test]
    async fn parked_body_does_not_reserve_read_priority() {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let priority = Arc::new(Priority::default());
        let (input, mut output) = tokio::io::duplex(1);
        let mut body = priority.stream(input);
        priority.background().await;
        let read = tokio::spawn(async move {
            let mut byte = [0];
            body.read_exact(&mut byte).await.unwrap();
            (body, byte)
        });
        tokio::task::yield_now().await;
        assert_eq!(priority.readers(), 1);
        output.write_all(b"x").await.unwrap();
        let (body, byte) = read.await.unwrap();
        assert_eq!(byte, *b"x");
        assert_eq!(priority.readers(), 0);
        tokio::time::timeout(FAIR, priority.background())
            .await
            .unwrap();
        drop(body);
    }
    #[tokio::test]
    async fn standby_cancels_background_wait_without_admission() {
        let priority = Arc::new(Priority::default());
        let foreground = priority.read();
        let background = crate::background_work::BackgroundWork::default();
        let work = background.enter().unwrap();
        let waiter = {
            let priority = priority.clone();
            tokio::spawn(async move { work.run(priority.background()).await })
        };
        tokio::task::yield_now().await;
        background.set_standby(true);
        assert!(waiter.await.unwrap().is_err());
        drop(foreground);
        assert_eq!(background.status().pending, 0);
    }
}
