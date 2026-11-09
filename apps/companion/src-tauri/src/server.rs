//! Loopback WebSocket server. Any web page can try to reach localhost, so only
//! connections carrying Spotify's exact Origin are accepted.

use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc, Mutex,
};

use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::{
    accept_hdr_async_with_config,
    tungstenite::{
        handshake::server::{ErrorResponse, Request, Response},
        http::StatusCode,
        protocol::WebSocketConfig,
        Message,
    },
};

pub const PORT: u16 = 39517;
const SPOTIFY_ORIGIN: &str = "https://xpui.app.spotify.com";
const MAX_MESSAGE_BYTES: usize = 2 * 1024 * 1024;

/// Sends text to the current Spotify connection (the newest one), if any.
pub type Outbox = Arc<Mutex<Option<mpsc::UnboundedSender<String>>>>;

pub enum ServerEvent {
    Frame(String),
    Disconnected,
}

#[allow(clippy::result_large_err)]
fn check_origin(request: &Request, response: Response) -> Result<Response, ErrorResponse> {
    let origin = request.headers().get("origin").and_then(|v| v.to_str().ok());
    if origin == Some(SPOTIFY_ORIGIN) {
        return Ok(response);
    }
    let mut rejected = ErrorResponse::new(Some("forbidden origin".to_string()));
    *rejected.status_mut() = StatusCode::FORBIDDEN;
    Err(rejected)
}

async fn handle<F>(stream: TcpStream, generation: Arc<AtomicU64>, on_event: Arc<F>, outbox: Outbox)
where
    F: Fn(ServerEvent) + Send + Sync + 'static,
{
    let config = WebSocketConfig::default()
        .max_message_size(Some(MAX_MESSAGE_BYTES))
        .max_frame_size(Some(MAX_MESSAGE_BYTES));
    let Ok(socket) = accept_hdr_async_with_config(stream, check_origin, Some(config)).await
    else {
        return;
    };
    // The newest connection wins, so a restarted Spotify replaces a stale socket.
    let id = generation.fetch_add(1, Ordering::SeqCst) + 1;
    let (mut sink, mut incoming) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();
    *outbox.lock().unwrap() = Some(tx);
    // Remote control: the companion window's buttons reach Spotify through this writer.
    let writer = tokio::spawn(async move {
        while let Some(text) = rx.recv().await {
            if sink.send(Message::Text(text.into())).await.is_err() {
                break;
            }
        }
    });
    while let Some(Ok(message)) = incoming.next().await {
        if generation.load(Ordering::SeqCst) != id {
            return;
        }
        if let Message::Text(text) = message {
            on_event(ServerEvent::Frame(text.to_string()));
        }
    }
    writer.abort();
    if generation.load(Ordering::SeqCst) == id {
        *outbox.lock().unwrap() = None;
        on_event(ServerEvent::Disconnected);
    }
}

pub async fn serve<F>(listener: std::net::TcpListener, on_event: F, outbox: Outbox)
where
    F: Fn(ServerEvent) + Send + Sync + 'static,
{
    let Ok(listener) = TcpListener::from_std(listener) else {
        return;
    };
    let generation = Arc::new(AtomicU64::new(0));
    let on_event = Arc::new(on_event);
    while let Ok((stream, _)) = listener.accept().await {
        tokio::spawn(handle(stream, generation.clone(), on_event.clone(), outbox.clone()));
    }
}
