#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod platform;
mod server;

use std::{
    collections::{HashMap, HashSet},
    net::{Ipv4Addr, TcpListener},
    sync::Mutex,
};

use serde::Serialize;
use server::ServerEvent;
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, Monitor, RunEvent, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent, Wry,
};

const STYLES: [(&str, &str); 4] = [
    ("constellation", "Constellation"),
    ("garden", "Garden"),
    ("fisheye", "Fisheye"),
    ("codestyle", "Codestyle"),
];
const FRAME_ORDER: [&str; 5] = ["track", "theme", "settings", "lyrics", "clock"];
const IDLE_LABEL: &str = "idle";
const PLAYER_LABEL: &str = "player";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct View {
    show_lyrics: bool,
    style: Option<String>,
}

struct Shared {
    frames: Mutex<HashMap<String, String>>,
    view: Mutex<View>,
    overlay_on: Mutex<bool>,
    displays: Mutex<HashSet<String>>,
    style_items: Mutex<Vec<(Option<String>, CheckMenuItem<Wry>)>>,
}

#[tauri::command]
fn snapshot(state: tauri::State<'_, Shared>) -> Vec<String> {
    let frames = state.frames.lock().unwrap();
    FRAME_ORDER
        .iter()
        .filter_map(|kind| frames.get(*kind).cloned())
        .collect()
}

#[tauri::command]
fn view_state(state: tauri::State<'_, Shared>) -> View {
    state.view.lock().unwrap().clone()
}

// Async so closing a window never runs on the UI thread that services it.
#[tauri::command]
async fn close_idle(app: AppHandle) {
    if let Some(window) = app.get_webview_window(IDLE_LABEL) {
        let _ = window.close();
    }
}

fn monitor_key(monitor: &Monitor, index: usize) -> String {
    monitor
        .name()
        .cloned()
        .unwrap_or_else(|| format!("Display {}", index + 1))
}

fn place(window: &WebviewWindow, monitor: &Monitor) -> tauri::Result<()> {
    window.set_position(*monitor.position())?;
    window.set_size(*monitor.size())
}

fn create_overlay(app: &AppHandle, label: &str, monitor: &Monitor) -> tauri::Result<()> {
    let window = WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .title("Bountiful Glow")
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .shadow(false)
        .resizable(false)
        .focused(false)
        .visible(false)
        .initialization_script("window.__BL_MODE__ = 'overlay';")
        .build()?;
    place(&window, monitor)?;
    window.set_ignore_cursor_events(true)?;
    window.show()
}

fn sync_overlays(app: &AppHandle) {
    let state = app.state::<Shared>();
    let enabled = *state.overlay_on.lock().unwrap();
    let selected = state.displays.lock().unwrap().clone();
    let monitors = app.available_monitors().unwrap_or_default();
    for (index, monitor) in monitors.iter().enumerate() {
        let label = format!("overlay-{index}");
        let wanted = enabled && selected.contains(&monitor_key(monitor, index));
        match (wanted, app.get_webview_window(&label)) {
            (true, None) => {
                if let Err(error) = create_overlay(app, &label, monitor) {
                    eprintln!("overlay {label} failed: {error}");
                }
            }
            (false, Some(window)) => {
                let _ = window.close();
            }
            _ => {}
        }
    }
}

/// The main window: a normal, movable, resizable app window showing the lyrics.
fn open_player(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(PLAYER_LABEL) {
        return raise(&window);
    }
    let window = WebviewWindowBuilder::new(app, PLAYER_LABEL, WebviewUrl::App("index.html".into()))
        .title("Bountiful Lyrics")
        .inner_size(1100.0, 680.0)
        .min_inner_size(480.0, 300.0)
        .resizable(true)
        .center()
        .visible(false)
        .initialization_script("window.__BL_MODE__ = 'player';")
        .build()?;
    raise(&window)
}

/// Windows refuses focus to background apps, so briefly pin the window on top to bring it forward.
fn raise(window: &WebviewWindow) -> tauri::Result<()> {
    // Show before un-minimising: a launcher's "start minimised" flag applies to the first show.
    window.show()?;
    window.unminimize()?;
    window.set_always_on_top(true)?;
    window.set_always_on_top(false)?;
    window.set_focus()
}

fn open_idle(app: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window(IDLE_LABEL) {
        return window.set_focus();
    }
    let window = WebviewWindowBuilder::new(app, IDLE_LABEL, WebviewUrl::App("index.html".into()))
        .title("Bountiful Idle")
        .decorations(false)
        .always_on_top(true)
        .visible(false)
        .initialization_script("window.__BL_MODE__ = 'idle';")
        .build()?;
    if let Some(monitor) = app.primary_monitor()? {
        place(&window, &monitor)?;
    }
    window.set_fullscreen(true)?;
    window.show()?;
    window.set_focus()?;
    platform::keep_awake(true);
    Ok(())
}

fn publish_view(app: &AppHandle) {
    let view = app.state::<Shared>().view.lock().unwrap().clone();
    let _ = app.emit("view", view);
}

fn select_style(app: &AppHandle, style: Option<String>) {
    let state = app.state::<Shared>();
    for (item_style, item) in state.style_items.lock().unwrap().iter() {
        let _ = item.set_checked(*item_style == style);
    }
    state.view.lock().unwrap().style = style;
    publish_view(app);
}

fn on_server_event(app: &AppHandle, event: ServerEvent) {
    let state = app.state::<Shared>();
    match event {
        ServerEvent::Frame(text) => {
            let kind = serde_json::from_str::<serde_json::Value>(&text)
                .ok()
                .and_then(|v| v.get("type")?.as_str().map(str::to_owned));
            // Windows validate frames themselves. This only remembers the latest of
            // each known kind so a newly opened window can catch up.
            if kind.as_deref() == Some("open") {
                // Spotify's pop-out button: bring up the lyrics window on the UI thread.
                let handle = app.clone();
                let _ = app.run_on_main_thread(move || {
                    if let Err(error) = open_player(&handle) {
                        eprintln!("player window failed: {error}");
                    }
                });
                return;
            }
            if let Some(kind) = kind.filter(|k| FRAME_ORDER.contains(&k.as_str())) {
                state.frames.lock().unwrap().insert(kind, text.clone());
            }
            let _ = app.emit("frame", text);
        }
        ServerEvent::Disconnected => {
            state.frames.lock().unwrap().clear();
            let _ = app.emit("disconnected", ());
        }
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let state = app.state::<Shared>();
    let player = MenuItem::with_id(app, "player", "Open lyrics window", true, None::<&str>)?;
    let glow = CheckMenuItem::with_id(app, "overlay", "Glow around my screen", true, false, None::<&str>)?;
    let lyrics = CheckMenuItem::with_id(app, "lyrics", "Lyrics on overlay", true, false, None::<&str>)?;
    let idle = MenuItem::with_id(app, "idle", "Idle mode", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let follow = CheckMenuItem::with_id(app, "style:", "Follow Spotify", true, true, None::<&str>)?;
    let style_menu = Submenu::with_id(app, "styles", "Style", true)?;
    style_menu.append(&follow)?;
    let mut items = vec![(None, follow)];
    for (id, name) in STYLES {
        let item = CheckMenuItem::with_id(app, format!("style:{id}"), name, true, false, None::<&str>)?;
        style_menu.append(&item)?;
        items.push((Some(id.to_string()), item));
    }
    *state.style_items.lock().unwrap() = items;

    let display_menu = Submenu::with_id(app, "displays", "Displays", true)?;
    let primary = app.primary_monitor()?;
    let monitors = app.available_monitors()?;
    for (index, monitor) in monitors.iter().enumerate() {
        let key = monitor_key(monitor, index);
        let is_primary = primary.as_ref().and_then(|p| p.name()) == monitor.name();
        if is_primary {
            state.displays.lock().unwrap().insert(key.clone());
        }
        let label = format!("Display {} ({}x{})", index + 1, monitor.size().width, monitor.size().height);
        let item = CheckMenuItem::with_id(app, format!("display:{key}"), label, true, is_primary, None::<&str>)?;
        display_menu.append(&item)?;
    }

    let menu = Menu::with_items(
        app,
        &[
            &player,
            &PredefinedMenuItem::separator(app)?,
            &glow,
            &lyrics,
            &style_menu,
            &display_menu,
            &PredefinedMenuItem::separator(app)?,
            &idle,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("Bountiful Companion")
        .menu(&menu);
    if let Some(icon) = app.default_window_icon().cloned() {
        tray = tray.icon(icon);
    }
    let glow_item = glow.clone();
    let lyrics_item = lyrics.clone();
    tray.on_menu_event(move |app, event| {
        let id = event.id().as_ref();
        let state = app.state::<Shared>();
        match id {
            "quit" => app.exit(0),
            "player" => {
                if let Err(error) = open_player(app) {
                    eprintln!("player window failed: {error}");
                }
            }
            "idle" => {
                if let Err(error) = open_idle(app) {
                    eprintln!("idle mode failed: {error}");
                }
            }
            "overlay" => {
                *state.overlay_on.lock().unwrap() = glow_item.is_checked().unwrap_or(true);
                sync_overlays(app);
            }
            "lyrics" => {
                state.view.lock().unwrap().show_lyrics = lyrics_item.is_checked().unwrap_or(false);
                publish_view(app);
            }
            _ => {
                if let Some(style) = id.strip_prefix("style:") {
                    select_style(app, (!style.is_empty()).then(|| style.to_string()));
                } else if let Some(key) = id.strip_prefix("display:") {
                    {
                        let mut displays = state.displays.lock().unwrap();
                        if !displays.remove(key) {
                            displays.insert(key.to_string());
                        }
                    }
                    sync_overlays(app);
                }
            }
        }
    })
    .build(app)?;
    Ok(())
}

fn main() {
    let listener = match TcpListener::bind((Ipv4Addr::LOCALHOST, server::PORT)) {
        Ok(listener) => listener,
        Err(error) => {
            eprintln!("port {} unavailable, is the companion already running? {error}", server::PORT);
            std::process::exit(1);
        }
    };
    listener
        .set_nonblocking(true)
        .expect("listener must be non-blocking");

    tauri::Builder::default()
        .manage(Shared {
            frames: Mutex::new(HashMap::new()),
            view: Mutex::new(View { show_lyrics: false, style: None }),
            overlay_on: Mutex::new(false),
            displays: Mutex::new(HashSet::new()),
            style_items: Mutex::new(Vec::new()),
        })
        .invoke_handler(tauri::generate_handler![snapshot, view_state, close_idle])
        .setup(move |app| {
            let handle = app.handle().clone();
            build_tray(&handle)?;
            sync_overlays(&handle);
            if !std::env::args().any(|arg| arg == "--tray") {
                open_player(&handle)?;
            }
            if std::env::args().any(|arg| arg == "--idle") {
                open_idle(&handle)?;
            }
            let server_handle = handle.clone();
            tauri::async_runtime::spawn(server::serve(listener, move |event| {
                on_server_event(&server_handle, event);
            }));
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == IDLE_LABEL && matches!(event, WindowEvent::Destroyed) {
                platform::keep_awake(false);
            }
        })
        .build(tauri::generate_context!())
        .expect("failed to start companion")
        .run(|app, event| {
            // Closing the lyrics window quits, unless the screen glow is still running from the tray.
            if let RunEvent::ExitRequested { api, code, .. } = event {
                if code.is_none() && *app.state::<Shared>().overlay_on.lock().unwrap() {
                    api.prevent_exit();
                }
            }
        });
}
