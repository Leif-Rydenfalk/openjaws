// trading/src/main.rs - Production Trading Cell for Rheo Mesh
// Provides: order management, position tracking, market data, risk controls

use cell_protocol_example1_rs::{
    trading::{RiskLimits, Side, Tick},
    CellConfig, ErrorCode, MeshError, RheoCell, Signal,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::sync::RwLock;
use tracing::info;

// ============================================================================
// TRADING-SPECIFIC TYPES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaceOrderRequest {
    pub symbol: String,
    pub side: Side,
    pub price: f64,
    pub quantity: f64,
    pub order_type: OrderType,
    pub client_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OrderType {
    Market,
    Limit,
    StopLoss,
    TakeProfit,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderResponse {
    pub order_id: String,
    pub status: OrderStatus,
    pub filled_quantity: f64,
    pub remaining_quantity: f64,
    pub avg_fill_price: f64,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OrderStatus {
    Pending,
    PartiallyFilled,
    Filled,
    Cancelled,
    Rejected(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionUpdate {
    pub symbol: String,
    pub quantity: f64,
    pub avg_entry_price: f64,
    pub unrealized_pnl: f64,
    pub realized_pnl: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketDataRequest {
    pub symbol: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskCheckRequest {
    pub symbol: String,
    pub side: Side,
    pub quantity: f64,
    pub price: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskCheckResponse {
    pub allowed: bool,
    pub reason: Option<String>,
    pub current_position: f64,
    pub position_after: f64,
    pub var_estimate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradingStats {
    pub total_orders: u64,
    pub filled_orders: u64,
    pub cancelled_orders: u64,
    pub rejected_orders: u64,
    pub total_volume: f64,
    pub total_pnl: f64,
    pub open_positions: usize,
    pub pending_orders: usize,
}

// ============================================================================
// IN-MEMORY STATE (Production would use Redis/DB)
// ============================================================================

pub struct TradingState {
    orders: RwLock<HashMap<String, OrderResponse>>,
    positions: RwLock<HashMap<String, PositionUpdate>>,
    order_history: RwLock<Vec<OrderResponse>>,
    risk_limits: RwLock<RiskLimits>,
    stats: RwLock<TradingStats>,
    market_data: RwLock<HashMap<String, Tick>>,
}

impl TradingState {
    pub fn new() -> Self {
        Self {
            orders: RwLock::new(HashMap::new()),
            positions: RwLock::new(HashMap::new()),
            order_history: RwLock::new(Vec::new()),
            risk_limits: RwLock::new(RiskLimits {
                max_position: 1000.0,
                max_order_size: 100.0,
                max_daily_loss: 10000.0,
                max_drawdown: 0.1,
            }),
            stats: RwLock::new(TradingStats {
                total_orders: 0,
                filled_orders: 0,
                cancelled_orders: 0,
                rejected_orders: 0,
                total_volume: 0.0,
                total_pnl: 0.0,
                open_positions: 0,
                pending_orders: 0,
            }),
            market_data: RwLock::new(HashMap::new()),
        }
    }
}

// ============================================================================
// HANDLER IMPLEMENTATIONS
// ============================================================================

async fn place_order(
    args: PlaceOrderRequest,
    _signal: Signal,
    state: Arc<TradingState>,
) -> Result<OrderResponse, MeshError> {
    let order_id = uuid::Uuid::new_v4().to_string();
    let timestamp = now_millis();

    info!(
        symbol = %args.symbol,
        side = ?args.side,
        quantity = %args.quantity,
        price = %args.price,
        "Placing order"
    );

    // Risk check
    let risk_limits = state.risk_limits.read().await;
    if args.quantity > risk_limits.max_order_size {
        return Ok(OrderResponse {
            order_id: order_id.clone(),
            status: OrderStatus::Rejected(format!(
                "Order size {} exceeds max {}",
                args.quantity, risk_limits.max_order_size
            )),
            filled_quantity: 0.0,
            remaining_quantity: args.quantity,
            avg_fill_price: 0.0,
            timestamp,
        });
    }

    // Check position limits
    let positions = state.positions.read().await;
    let current_pos = positions.get(&args.symbol).map(|p| p.quantity).unwrap_or(0.0);
    let position_after = match args.side {
        Side::Buy => current_pos + args.quantity,
        Side::Sell => current_pos - args.quantity,
    };

    if position_after.abs() > risk_limits.max_position {
        return Ok(OrderResponse {
            order_id: order_id.clone(),
            status: OrderStatus::Rejected(format!(
                "Position {} would exceed max {}",
                position_after, risk_limits.max_position
            )),
            filled_quantity: 0.0,
            remaining_quantity: args.quantity,
            avg_fill_price: 0.0,
            timestamp,
        });
    }
    drop(positions);
    drop(risk_limits);

    // Simulate order execution (in production, this would hit an exchange API)
    let fill_qty = match args.order_type {
        OrderType::Market => args.quantity, // Market orders fill immediately
        OrderType::Limit => {
            // Simulate partial fills for limit orders
            if rand::random::<f64>() > 0.3 {
                args.quantity
            } else {
                args.quantity * 0.5
            }
        }
        _ => 0.0, // Stop orders wait for trigger
    };

    let status = if fill_qty >= args.quantity {
        OrderStatus::Filled
    } else if fill_qty > 0.0 {
        OrderStatus::PartiallyFilled
    } else {
        OrderStatus::Pending
    };

    let response = OrderResponse {
        order_id: order_id.clone(),
        status: status.clone(),
        filled_quantity: fill_qty,
        remaining_quantity: args.quantity - fill_qty,
        avg_fill_price: args.price,
        timestamp,
    };

    // Update state
    {
        let mut orders = state.orders.write().await;
        orders.insert(order_id.clone(), response.clone());
    }

    {
        let mut history = state.order_history.write().await;
        history.push(response.clone());
    }

    // Update position if filled
    if fill_qty > 0.0 {
        update_position(&args.symbol, &args.side, fill_qty, args.price, state.clone()).await;
    }

    // Update stats
    {
        let mut stats = state.stats.write().await;
        stats.total_orders += 1;
        stats.total_volume += fill_qty * args.price;
        match status {
            OrderStatus::Filled | OrderStatus::PartiallyFilled => stats.filled_orders += 1,
            OrderStatus::Cancelled => stats.cancelled_orders += 1,
            OrderStatus::Rejected(_) => stats.rejected_orders += 1,
            _ => {}
        }
    }

    info!(order_id = %order_id, status = ?status, "Order placed");

    Ok(response)
}

async fn update_position(
    symbol: &str,
    side: &Side,
    quantity: f64,
    price: f64,
    state: Arc<TradingState>,
) {
    let mut positions = state.positions.write().await;
    let entry = positions.entry(symbol.to_string()).or_insert(PositionUpdate {
        symbol: symbol.to_string(),
        quantity: 0.0,
        avg_entry_price: 0.0,
        unrealized_pnl: 0.0,
        realized_pnl: 0.0,
    });

    match side {
        Side::Buy => {
            let new_quantity = entry.quantity + quantity;
            entry.avg_entry_price = (entry.quantity * entry.avg_entry_price + quantity * price)
                / new_quantity;
            entry.quantity = new_quantity;
        }
        Side::Sell => {
            // Calculate realized PnL
            if entry.quantity > 0.0 {
                let realized = quantity * (price - entry.avg_entry_price);
                entry.realized_pnl += realized;
            }
            entry.quantity -= quantity;
            if entry.quantity.abs() < 0.0001 {
                entry.quantity = 0.0;
                entry.avg_entry_price = 0.0;
            }
        }
    }

    // Update unrealized PnL based on current market price
    let market_data = state.market_data.read().await;
    if let Some(tick) = market_data.get(symbol) {
        let current_price = (tick.bid + tick.ask) / 2.0;
        entry.unrealized_pnl = entry.quantity * (current_price - entry.avg_entry_price);
    }
}

async fn get_position(
    args: MarketDataRequest,
    _signal: Signal,
    state: Arc<TradingState>,
) -> Result<Option<PositionUpdate>, MeshError> {
    let positions = state.positions.read().await;
    Ok(positions.get(&args.symbol).cloned())
}

async fn get_all_positions(
    _args: (),
    _signal: Signal,
    state: Arc<TradingState>,
) -> Result<Vec<PositionUpdate>, MeshError> {
    let positions = state.positions.read().await;
    Ok(positions.values().cloned().collect())
}

async fn cancel_order(
    order_id: String,
    _signal: Signal,
    state: Arc<TradingState>,
) -> Result<OrderResponse, MeshError> {
    let mut orders = state.orders.write().await;
    
    if let Some(order) = orders.get_mut(&order_id) {
        if matches!(order.status, OrderStatus::Pending | OrderStatus::PartiallyFilled) {
            order.status = OrderStatus::Cancelled;
            order.remaining_quantity = 0.0;
            
            let mut stats = state.stats.write().await;
            stats.cancelled_orders += 1;
            
            info!(order_id = %order_id, "Order cancelled");
            return Ok(order.clone());
        }
    }

    Err(MeshError::new(
        ErrorCode::NotFound,
        format!("Order {} not found or already filled", order_id),
        "trading/cancel_order",
    ))
}

async fn get_order(
    order_id: String,
    _signal: Signal,
    state: Arc<TradingState>,
) -> Result<Option<OrderResponse>, MeshError> {
    let orders = state.orders.read().await;
    Ok(orders.get(&order_id).cloned())
}

async fn get_order_history(
    limit: Option<usize>,
    _signal: Signal,
    state: Arc<TradingState>,
) -> Result<Vec<OrderResponse>, MeshError> {
    let history = state.order_history.read().await;
    let limit = limit.unwrap_or(100);
    Ok(history.iter().rev().take(limit).cloned().collect())
}

async fn update_market_data(
    tick: Tick,
    _signal: Signal,
    state: Arc<TradingState>,
) -> Result<(), MeshError> {
    let mut market_data = state.market_data.write().await;
    market_data.insert(tick.symbol.clone(), tick.clone());
    
    // Update unrealized PnL for affected positions
    drop(market_data); // Release the write lock before acquiring it again
    let mut positions = state.positions.write().await;
    if let Some(pos) = positions.get_mut(&tick.symbol) {
        let current_price = (tick.bid + tick.ask) / 2.0;
        pos.unrealized_pnl = pos.quantity * (current_price - pos.avg_entry_price);
    }
    
    Ok(())
}

async fn get_market_data(
    args: MarketDataRequest,
    _signal: Signal,
    state: Arc<TradingState>,
) -> Result<Option<Tick>, MeshError> {
    let market_data = state.market_data.read().await;
    Ok(market_data.get(&args.symbol).cloned())
}

async fn check_risk(
    args: RiskCheckRequest,
    _signal: Signal,
    state: Arc<TradingState>,
) -> Result<RiskCheckResponse, MeshError> {
    let positions = state.positions.read().await;
    let risk_limits = state.risk_limits.read().await;
    
    let current_position = positions.get(&args.symbol).map(|p| p.quantity).unwrap_or(0.0);
    let position_after = match args.side {
        Side::Buy => current_position + args.quantity,
        Side::Sell => current_position - args.quantity,
    };

    // Simple VaR estimate (would be more sophisticated in production)
    let var_estimate = position_after.abs() * args.price * 0.02; // 2% daily vol assumption

    let allowed = position_after.abs() <= risk_limits.max_position
        && args.quantity <= risk_limits.max_order_size;

    Ok(RiskCheckResponse {
        allowed,
        reason: if allowed {
            None
        } else if position_after.abs() > risk_limits.max_position {
            Some(format!("Position limit exceeded: {} > {}", position_after.abs(), risk_limits.max_position))
        } else {
            Some(format!("Order size limit exceeded: {} > {}", args.quantity, risk_limits.max_order_size))
        },
        current_position,
        position_after,
        var_estimate,
    })
}

async fn update_risk_limits(
    limits: RiskLimits,
    _signal: Signal,
    state: Arc<TradingState>,
) -> Result<RiskLimits, MeshError> {
    let mut current = state.risk_limits.write().await;
    *current = limits.clone();
    info!(?limits, "Risk limits updated");
    Ok(limits)
}

async fn get_risk_limits(
    _args: (),
    _signal: Signal,
    state: Arc<TradingState>,
) -> Result<RiskLimits, MeshError> {
    let limits = state.risk_limits.read().await;
    Ok(limits.clone())
}

async fn get_stats(
    _args: (),
    _signal: Signal,
    state: Arc<TradingState>,
) -> Result<TradingStats, MeshError> {
    let stats = state.stats.read().await;
    let positions = state.positions.read().await;
    let orders = state.orders.read().await;
    
    let mut result = stats.clone();
    result.open_positions = positions.len();
    result.pending_orders = orders.values()
        .filter(|o| matches!(o.status, OrderStatus::Pending))
        .count();
    
    Ok(result)
}

async fn simulate_market_data(
    _args: (),
    _signal: Signal,
    state: Arc<TradingState>,
) -> Result<(), MeshError> {
    // Simulate market data for common pairs
    let symbols = vec!["BTC-USD", "ETH-USD", "SOL-USD"];
    
    for symbol in symbols {
        let tick = Tick {
            symbol: symbol.to_string(),
            bid: 40000.0 + rand::random::<f64>() * 1000.0,
            ask: 41000.0 + rand::random::<f64>() * 1000.0,
            last: 40500.0 + rand::random::<f64>() * 1000.0,
            volume: 1000.0 + rand::random::<f64>() * 5000.0,
            timestamp: now_millis(),
        };
        
        let mut market_data = state.market_data.write().await;
        market_data.insert(symbol.to_string(), tick);
    }
    
    info!("Simulated market data updated");
    Ok(())
}

// ============================================================================
// MAIN
// ============================================================================

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .init();

    info!("🚀 Starting Trading Cell...");

    // Get seed from environment (set by orchestrator)
    let seed = std::env::var("RHEO_SEED").unwrap_or_default();
    
    let config = CellConfig {
        id: "trading".to_string(),
        port: 0, // Let system assign
        seed: if seed.is_empty() { None } else { Some(seed) },
        registry_dir: Some(".rheo/registry".to_string()),
        max_concurrent: 1000,
        rpc_timeout_ms: 5000,
        gossip_interval_ms: 15000,
        atlas_ttl_ms: 60000,
        enable_compression: true,
        enable_tls: false,
        log_level: tracing::Level::INFO,
    };

    // Create cell
    let cell = RheoCell::new(config);
    
    // Create shared state
    let state = Arc::new(TradingState::new());

    // Register all capabilities
    {
        let s = state.clone();
        cell.provide("trading/place_order", move |args, signal| {
            let s = s.clone();
            Box::pin(async move { place_order(args, signal, s).await })
        });
    }

    {
        let s = state.clone();
        cell.provide("trading/get_position", move |args, signal| {
            let s = s.clone();
            Box::pin(async move { get_position(args, signal, s).await })
        });
    }

    {
        let s = state.clone();
        cell.provide("trading/get_all_positions", move |args, signal| {
            let s = s.clone();
            Box::pin(async move { get_all_positions(args, signal, s).await })
        });
    }

    {
        let s = state.clone();
        cell.provide("trading/cancel_order", move |args, signal| {
            let s = s.clone();
            Box::pin(async move { cancel_order(args, signal, s).await })
        });
    }

    {
        let s = state.clone();
        cell.provide("trading/get_order", move |args, signal| {
            let s = s.clone();
            Box::pin(async move { get_order(args, signal, s).await })
        });
    }

    {
        let s = state.clone();
        cell.provide("trading/get_order_history", move |args, signal| {
            let s = s.clone();
            Box::pin(async move { get_order_history(args, signal, s).await })
        });
    }

    {
        let s = state.clone();
        cell.provide("trading/update_market_data", move |args, signal| {
            let s = s.clone();
            Box::pin(async move { update_market_data(args, signal, s).await })
        });
    }

    {
        let s = state.clone();
        cell.provide("trading/get_market_data", move |args, signal| {
            let s = s.clone();
            Box::pin(async move { get_market_data(args, signal, s).await })
        });
    }

    {
        let s = state.clone();
        cell.provide("trading/check_risk", move |args, signal| {
            let s = s.clone();
            Box::pin(async move { check_risk(args, signal, s).await })
        });
    }

    {
        let s = state.clone();
        cell.provide("trading/update_risk_limits", move |args, signal| {
            let s = s.clone();
            Box::pin(async move { update_risk_limits(args, signal, s).await })
        });
    }

    {
        let s = state.clone();
        cell.provide("trading/get_risk_limits", move |args, signal| {
            let s = s.clone();
            Box::pin(async move { get_risk_limits(args, signal, s).await })
        });
    }

    {
        let s = state.clone();
        cell.provide("trading/get_stats", move |args, signal| {
            let s = s.clone();
            Box::pin(async move { get_stats(args, signal, s).await })
        });
    }

    {
        let s = state.clone();
        cell.provide("trading/simulate_market_data", move |args, signal| {
            let s = s.clone();
            Box::pin(async move { simulate_market_data(args, signal, s).await })
        });
    }

    // Start the cell (listen takes ownership, so clone the Arc)
    let cell_for_shutdown = cell.clone();
    let addr = cell.listen().await.expect("Failed to start trading cell");
    info!(addr = ?addr, "📈 Trading Cell online");

    // Keep running
    tokio::signal::ctrl_c().await.expect("Failed to listen for ctrl-c");
    info!("Shutting down trading cell...");
    cell_for_shutdown.shutdown().await;
}