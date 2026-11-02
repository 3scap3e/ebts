use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("invalid time {0:?}, expected HH:MM")]
    InvalidTime(String),
    #[error("unknown timezone {0:?}")]
    UnknownTimezone(String),
    #[error("unknown site {0:?}")]
    UnknownSite(String),
    #[error("unknown zone {0:?} in site {1:?}")]
    UnknownZone(String, String),
    #[error("project folder {0} has no event.json")]
    MissingProject(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("{0}")]
    Other(String),
}

pub type CoreResult<T> = Result<T, CoreError>;
