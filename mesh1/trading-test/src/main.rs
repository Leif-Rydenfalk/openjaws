// trading-test/src/main.rs
use cell_protocol_example1_rs::{CellConfig, RheoCell, Signal, TraceResult};
use serde::{Deserialize, Serialize};
use std::{
    sync::Arc,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tokio::time::sleep;
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    pub test_name: String,
    pub passed: bool,
    pub duration_ms: u64,
    pub details: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestReport {
    pub timestamp: u64,
    pub cell_under_test: String,
    pub tests_run: usize,
    pub tests_passed: usize,
    pub tests_failed: usize,
    pub results: Vec<TestResult>,
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

async fn test_connectivity(cell: Arc<RheoCell>) -> TestResult {
    let start = Instant::now();
    let result = cell.ask_mesh("mesh/ping", ()).await;
    let duration = start.elapsed().as_millis() as u64;

    TestResult {
        test_name: "connectivity".to_string(),
        passed: result.ok,
        duration_ms: duration,
        details: if result.ok {
            Some("Mesh ping succeeded".to_string())
        } else {
            None
        },
        error: result.error.map(|e| e.message),
    }
}

async fn test_place_order(cell: Arc<RheoCell>) -> TestResult {
    let start = Instant::now();

    let order = serde_json::json!({
        "symbol": "BTC-USD",
        "side": "Buy",
        "price": 45000.0,
        "quantity": 1.0,
        "order_type": "Limit",
        "client_id": "test-001"
    });

    let result: TraceResult = cell.ask_mesh("trading/place_order", order).await;
    let duration = start.elapsed().as_millis() as u64;

    TestResult {
        test_name: "place_order".to_string(),
        passed: result.ok,
        duration_ms: duration,
        details: if result.ok {
            Some("Order placed via mesh".to_string())
        } else {
            None
        },
        error: result.error.map(|e| e.message),
    }
}

async fn test_risk_limits(cell: Arc<RheoCell>) -> TestResult {
    let start = Instant::now();

    let oversized = serde_json::json!({
        "symbol": "BTC-USD",
        "side": "Buy",
        "price": 45000.0,
        "quantity": 999999.0,
        "order_type": "Limit",
        "client_id": "risk-test"
    });

    let result: TraceResult = cell.ask_mesh("trading/place_order", oversized).await;
    let duration = start.elapsed().as_millis() as u64;

    // Check if the order was actually rejected in the response value
    let was_rejected = if let Some(val) = &result.value {
        let status = val.get("status");
        // Check if status is the string "Rejected" OR an object containing "Rejected" (Enum with data)
        status
            .map(|s| {
                s.as_str()
                    .map(|str| str.contains("Rejected"))
                    .unwrap_or(false)
                    || s.is_object() && s.get("Rejected").is_some()
            })
            .unwrap_or(false)
    } else {
        false
    };

    // Also check if the error message mentions rejection
    let error_says_rejected = result
        .error
        .as_ref()
        .map(|e| e.message.contains("rejected") || e.message.contains("exceeds"))
        .unwrap_or(false);

    let passed = was_rejected || error_says_rejected;

    TestResult {
        test_name: "risk_limits".to_string(),
        passed,
        duration_ms: duration,
        details: Some(format!(
            "Response status: {:?}, Error: {:?}",
            result.value.as_ref().and_then(|v| v.get("status")),
            result.error.as_ref().map(|e| &e.message)
        )),
        error: if passed {
            None
        } else {
            Some("Expected rejection for oversized order".to_string())
        },
    }
}

async fn run_tests(cell: Arc<RheoCell>) -> TestReport {
    info!("🧪 Running tests via mesh");
    let mut results = vec![];

    results.push(test_connectivity(cell.clone()).await);
    sleep(Duration::from_millis(100)).await;
    results.push(test_place_order(cell.clone()).await);
    sleep(Duration::from_millis(100)).await;
    results.push(test_risk_limits(cell.clone()).await);

    let passed = results.iter().filter(|r| r.passed).count();

    TestReport {
        timestamp: now_millis(),
        cell_under_test: "mesh".to_string(),
        tests_run: results.len(),
        tests_passed: passed,
        tests_failed: results.len() - passed,
        results,
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_env_filter("info").init();

    let args: Vec<String> = std::env::args().collect();
    let auto_mode = args.contains(&"--auto".to_string());

    info!("🧪 Rheo Mesh Test Cell");

    let cell = RheoCell::new(CellConfig {
        id: "trading-test".to_string(),
        port: 0,
        seed: std::env::var("RHEO_SEED").ok(),
        ..Default::default()
    });

    let cell_for_shutdown = cell.clone();
    let cell_for_tests = cell.clone();

    // Register handler BEFORE listen() takes ownership
    let c = cell_for_tests.clone();
    cell.clone()
        .provide("test/run", move |_args: (), _signal: Signal| {
            let c2 = c.clone();
            Box::pin(async move {
                let report = run_tests(c2).await;
                Ok(serde_json::json!(report))
            })
        });

    let addr = cell.listen().await.expect("Failed to start");
    info!("🟢 Test Cell online @ {}", addr);

    if auto_mode {
        sleep(Duration::from_millis(1000)).await;

        let report = run_tests(cell_for_tests).await;

        println!("\n{}", "=".repeat(60));
        println!("TEST REPORT");
        println!("{}", "=".repeat(60));
        println!("Tests: {}/{} passed", report.tests_passed, report.tests_run);

        for r in &report.results {
            let status = if r.passed { "✅ PASS" } else { "❌ FAIL" };
            println!("{} {} ({}ms)", status, r.test_name, r.duration_ms);
            if let Some(e) = &r.error {
                println!("   Error: {}", e);
            }
        }

        cell_for_shutdown.shutdown().await;
        std::process::exit(if report.tests_failed > 0 { 1 } else { 0 });
    } else {
        tokio::signal::ctrl_c().await.expect("Failed to listen");
        cell_for_shutdown.shutdown().await;
    }
}
