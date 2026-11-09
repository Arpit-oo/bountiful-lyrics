//! Loopback WebSocket server. Any web page can try to reach localhost, so only
//! connections carrying Spotify's exact Origin are accepted.

use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};

use futures_util::StreamExt;
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

async fn handle<F>(stream: TcpStream, generation: Arc<AtomicU64>, on_event: Arc<F>)
where
    F: Fn(ServerEvent) + Send + Sync + 'static,
{
    let config = WebSocketConfig::default()
        .max_message_size(Some(MAX_MESSAGE_BYTES))
        .max_frame_size(Some(MAX_MESSAGE_BYTES));
    let Ok(mut socket) = accept_hdr_async_with_config(stream, check_origin, Some(config)).await
    else {
        return;
    };
    // The newest connection wins, so a restarted Spotify replaces a stale socket.
    let id = generation.fetch_add(1, Ordering::SeqCst) + 1;
    while let Some(Ok(message)) = socket.next().await {
        if generation.load(Ordering::SeqCst) != id {
            return;
        }
        if let Message::Text(text) = message {
            on_event(ServerEvent::Frame(text.to_string()));
        }
    }
    if generation.load(Ordering::SeqCst) == id {
        on_event(ServerEvent::Disconnected);
    }
}

pub async fn serve<F>(listener: std::net::TcpListener, on_event: F)
where
    F: Fn(ServerEvent) + Send + Sync + 'static,
{
    let Ok(listener) = TcpListener::from_std(listener) else {
        return;
    };
    let generation = Arc::new(AtomicU64::new(0));
    let on_event = Arc::new(on_event);
    while let Ok((stream, _)) = listener.accept().await {
        tokio::spawn(handle(stream, generation.clone(), on_event.clone()));
    }
}
