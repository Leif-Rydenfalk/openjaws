use cell_protocol_example1_rs::{CellConfig, RheoCell, Signal, ErrorCode, MeshError};
use serde_json::{json, Value};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_env_filter("info").init();
    
    let config = CellConfig {
        id: "test-1-rs".to_string(),
        seed: std::env::var("RHEO_SEED").ok(),
        ..Default::default()
    };

    let cell = RheoCell::new(config);

    cell.provide("test/binary-interop", |args: Value, signal: Signal| {
        Box::pin(async move {
            let val = args.get("input").and_then(|v| v.as_str()).unwrap_or("none");
            Ok::<Value, MeshError>(json!({
                "received": val,
                "protocol_version": "NTS-1",
                "identity_verified": !signal.from.is_empty()
            }))
        })
    });

    cell.provide("test/trigger-narrative-error", |_args: Value, _signal: Signal| {
        Box::pin(async move {
            Err::<Value, MeshError>(MeshError::new(
                ErrorCode::HandlerError,
                "Intentional failure to test narrative propagation",
                "test-1-rs"
            ))
        })
    });

    cell.listen().await.expect("Failed to start Rust test cell");
    
    println!("🟢 Rust Protocol Cell Waiting for Signals...");
    tokio::signal::ctrl_c().await.expect("Failed to listen for ctrl-c");
}