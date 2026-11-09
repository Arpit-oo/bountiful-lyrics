//! OS-specific calls live here so a macOS port only has to replace this module.

/// Must be called from the same thread for on and off: the state is per-thread.
#[cfg(windows)]
pub fn keep_awake(on: bool) {
    use windows_sys::Win32::System::Power::{
        SetThreadExecutionState, ES_CONTINUOUS, ES_DISPLAY_REQUIRED, ES_SYSTEM_REQUIRED,
    };
    let flags = if on {
        ES_CONTINUOUS | ES_DISPLAY_REQUIRED | ES_SYSTEM_REQUIRED
    } else {
        ES_CONTINUOUS
    };
    unsafe {
        SetThreadExecutionState(flags);
    }
}

#[cfg(not(windows))]
pub fn keep_awake(_on: bool) {}
