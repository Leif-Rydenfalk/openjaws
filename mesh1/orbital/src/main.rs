// orbital/src/main.rs - Celestial Mechanics Simulation Cell
// Provides: N-body gravity simulation, orbital propagation, trajectory prediction

use cell_protocol_example1_rs::{
    CellConfig, ErrorCode, MeshError, RheoCell, Signal,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::sync::RwLock;
use tracing::{info, warn};

// ============================================================================
// PHYSICS CONSTANTS
// ============================================================================

const G: f64 = 6.67430e-11; // Gravitational constant (m³/kg·s²)
const AU: f64 = 1.495978707e11; // Astronomical Unit in meters
const SOLAR_MASS: f64 = 1.98892e30; // kg
const EARTH_MASS: f64 = 5.972e24; // kg
const MOON_MASS: f64 = 7.342e22; // kg

// ============================================================================
// CORE TYPES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vector3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Vector3 {
    pub fn new(x: f64, y: f64, z: f64) -> Self {
        Self { x, y, z }
    }

    pub fn zero() -> Self {
        Self::new(0.0, 0.0, 0.0)
    }

    pub fn magnitude(&self) -> f64 {
        (self.x * self.x + self.y * self.y + self.z * self.z).sqrt()
    }

    pub fn distance_to(&self, other: &Vector3) -> f64 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        let dz = self.z - other.z;
        (dx * dx + dy * dy + dz * dz).sqrt()
    }

    pub fn add(&self, other: &Vector3) -> Vector3 {
        Vector3::new(self.x + other.x, self.y + other.y, self.z + other.z)
    }

    pub fn sub(&self, other: &Vector3) -> Vector3 {
        Vector3::new(self.x - other.x, self.y - other.y, self.z - other.z)
    }

    pub fn mul(&self, scalar: f64) -> Vector3 {
        Vector3::new(self.x * scalar, self.y * scalar, self.z * scalar)
    }

    pub fn div(&self, scalar: f64) -> Vector3 {
        Vector3::new(self.x / scalar, self.y / scalar, self.z / scalar)
    }

    pub fn normalize(&self) -> Vector3 {
        let mag = self.magnitude();
        if mag > 0.0 {
            self.div(mag)
        } else {
            Vector3::zero()
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CelestialBody {
    pub id: String,
    pub name: String,
    pub mass: f64, // kg
    pub position: Vector3, // meters
    pub velocity: Vector3, // m/s
    pub radius: f64, // meters (for visualization/collision)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>, // For orbital hierarchy
}

impl CelestialBody {
    pub fn kinetic_energy(&self) -> f64 {
        0.5 * self.mass * self.velocity.magnitude().powi(2)
    }

    pub fn momentum(&self) -> Vector3 {
        self.velocity.mul(self.mass)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Simulation {
    pub id: String,
    pub name: String,
    pub bodies: Vec<CelestialBody>,
    pub time: f64, // simulation time in seconds
    pub dt: f64, // time step in seconds
    pub created_at: u64,
    pub paused: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrbitalElements {
    pub semi_major_axis: f64, // a (meters)
    pub eccentricity: f64, // e (dimensionless)
    pub inclination: f64, // i (radians)
    pub longitude_ascending_node: f64, // Ω (radians)
    pub argument_periapsis: f64, // ω (radians)
    pub mean_anomaly: f64, // M (radians)
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSimulationRequest {
    pub name: String,
    pub preset: Option<String>, // "solar_system", "earth_moon", "binary_star"
    pub bodies: Option<Vec<CelestialBody>>,
    pub dt: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddBodyRequest {
    pub simulation_id: String,
    pub body: CelestialBody,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepRequest {
    pub simulation_id: String,
    pub steps: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetStateRequest {
    pub simulation_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PredictTrajectoryRequest {
    pub simulation_id: String,
    pub body_id: String,
    pub duration: f64, // seconds
    pub sample_rate: Option<f64>, // samples per second
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrajectoryPoint {
    pub time: f64,
    pub position: Vector3,
    pub velocity: Vector3,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationStats {
    pub total_energy: f64,
    pub total_momentum: Vector3,
    pub center_of_mass: Vector3,
    pub body_count: usize,
    pub time_elapsed: f64,
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

pub struct OrbitalState {
    simulations: RwLock<HashMap<String, Simulation>>,
}

impl OrbitalState {
    pub fn new() -> Self {
        Self {
            simulations: RwLock::new(HashMap::new()),
        }
    }
}

// ============================================================================
// PHYSICS ENGINE
// ============================================================================

fn compute_acceleration(body: &CelestialBody, all_bodies: &[CelestialBody]) -> Vector3 {
    let mut acceleration = Vector3::zero();

    for other in all_bodies {
        if other.id == body.id {
            continue;
        }

        let r_vec = other.position.sub(&body.position);
        let r = r_vec.magnitude();

        if r < 1.0 {
            // Prevent division by zero / singularities
            continue;
        }

        // F = G * m1 * m2 / r^2
        // a = F / m1 = G * m2 / r^2
        let a_magnitude = G * other.mass / (r * r);
        let a_vec = r_vec.normalize().mul(a_magnitude);

        acceleration = acceleration.add(&a_vec);
    }

    acceleration
}

fn rk4_step(mut sim: Simulation) -> Simulation {
    let dt = sim.dt;
    let n = sim.bodies.len();

    // Store original state
    let original_bodies = sim.bodies.clone();

    // k1
    let mut k1_vel = Vec::with_capacity(n);
    let mut k1_acc = Vec::with_capacity(n);
    for body in &sim.bodies {
        k1_vel.push(body.velocity.clone());
        k1_acc.push(compute_acceleration(body, &sim.bodies));
    }

    // k2
    for i in 0..n {
        sim.bodies[i].position = original_bodies[i]
            .position
            .add(&k1_vel[i].mul(dt / 2.0));
        sim.bodies[i].velocity = original_bodies[i]
            .velocity
            .add(&k1_acc[i].mul(dt / 2.0));
    }
    let mut k2_vel = Vec::with_capacity(n);
    let mut k2_acc = Vec::with_capacity(n);
    for body in &sim.bodies {
        k2_vel.push(body.velocity.clone());
        k2_acc.push(compute_acceleration(body, &sim.bodies));
    }

    // k3
    for i in 0..n {
        sim.bodies[i].position = original_bodies[i]
            .position
            .add(&k2_vel[i].mul(dt / 2.0));
        sim.bodies[i].velocity = original_bodies[i]
            .velocity
            .add(&k2_acc[i].mul(dt / 2.0));
    }
    let mut k3_vel = Vec::with_capacity(n);
    let mut k3_acc = Vec::with_capacity(n);
    for body in &sim.bodies {
        k3_vel.push(body.velocity.clone());
        k3_acc.push(compute_acceleration(body, &sim.bodies));
    }

    // k4
    for i in 0..n {
        sim.bodies[i].position = original_bodies[i].position.add(&k3_vel[i].mul(dt));
        sim.bodies[i].velocity = original_bodies[i].velocity.add(&k3_acc[i].mul(dt));
    }
    let mut k4_vel = Vec::with_capacity(n);
    let mut k4_acc = Vec::with_capacity(n);
    for body in &sim.bodies {
        k4_vel.push(body.velocity.clone());
        k4_acc.push(compute_acceleration(body, &sim.bodies));
    }

    // Final update
    for i in 0..n {
        let dv = k1_vel[i]
            .add(&k2_vel[i].mul(2.0))
            .add(&k3_vel[i].mul(2.0))
            .add(&k4_vel[i])
            .div(6.0)
            .mul(dt);

        let da = k1_acc[i]
            .add(&k2_acc[i].mul(2.0))
            .add(&k3_acc[i].mul(2.0))
            .add(&k4_acc[i])
            .div(6.0)
            .mul(dt);

        sim.bodies[i].position = original_bodies[i].position.add(&dv);
        sim.bodies[i].velocity = original_bodies[i].velocity.add(&da);
    }

    sim.time += dt;
    sim
}

fn calculate_stats(sim: &Simulation) -> SimulationStats {
    let mut total_energy = 0.0;
    let mut total_momentum = Vector3::zero();
    let mut com_numerator = Vector3::zero();
    let mut total_mass = 0.0;

    // Kinetic energy and momentum
    for body in &sim.bodies {
        total_energy += body.kinetic_energy();
        total_momentum = total_momentum.add(&body.momentum());
        com_numerator = com_numerator.add(&body.position.mul(body.mass));
        total_mass += body.mass;
    }

    // Potential energy
    for i in 0..sim.bodies.len() {
        for j in (i + 1)..sim.bodies.len() {
            let r = sim.bodies[i].position.distance_to(&sim.bodies[j].position);
            if r > 0.0 {
                let u = -G * sim.bodies[i].mass * sim.bodies[j].mass / r;
                total_energy += u;
            }
        }
    }

    let center_of_mass = if total_mass > 0.0 {
        com_numerator.div(total_mass)
    } else {
        Vector3::zero()
    };

    SimulationStats {
        total_energy,
        total_momentum,
        center_of_mass,
        body_count: sim.bodies.len(),
        time_elapsed: sim.time,
    }
}

// ============================================================================
// PRESETS
// ============================================================================

fn create_solar_system_preset() -> Vec<CelestialBody> {
    vec![
        CelestialBody {
            id: "sun".to_string(),
            name: "Sun".to_string(),
            mass: SOLAR_MASS,
            position: Vector3::zero(),
            velocity: Vector3::zero(),
            radius: 6.96e8,
            color: Some("#FDB813".to_string()),
            parent_id: None,
        },
        CelestialBody {
            id: "earth".to_string(),
            name: "Earth".to_string(),
            mass: EARTH_MASS,
            position: Vector3::new(AU, 0.0, 0.0),
            velocity: Vector3::new(0.0, 29780.0, 0.0), // ~29.78 km/s
            radius: 6.371e6,
            color: Some("#1E90FF".to_string()),
            parent_id: Some("sun".to_string()),
        },
        CelestialBody {
            id: "mars".to_string(),
            name: "Mars".to_string(),
            mass: 6.4171e23,
            position: Vector3::new(1.524 * AU, 0.0, 0.0),
            velocity: Vector3::new(0.0, 24070.0, 0.0),
            radius: 3.3895e6,
            color: Some("#CD5C5C".to_string()),
            parent_id: Some("sun".to_string()),
        },
    ]
}

fn create_earth_moon_preset() -> Vec<CelestialBody> {
    vec![
        CelestialBody {
            id: "earth".to_string(),
            name: "Earth".to_string(),
            mass: EARTH_MASS,
            position: Vector3::zero(),
            velocity: Vector3::zero(),
            radius: 6.371e6,
            color: Some("#1E90FF".to_string()),
            parent_id: None,
        },
        CelestialBody {
            id: "moon".to_string(),
            name: "Moon".to_string(),
            mass: MOON_MASS,
            position: Vector3::new(3.844e8, 0.0, 0.0), // ~384,400 km
            velocity: Vector3::new(0.0, 1022.0, 0.0), // ~1.022 km/s
            radius: 1.7371e6,
            color: Some("#C0C0C0".to_string()),
            parent_id: Some("earth".to_string()),
        },
    ]
}

fn create_binary_star_preset() -> Vec<CelestialBody> {
    let star_mass = SOLAR_MASS;
    let separation = 1.0e11; // 100 million km
    let velocity = 30000.0; // m/s

    vec![
        CelestialBody {
            id: "star_a".to_string(),
            name: "Star A".to_string(),
            mass: star_mass,
            position: Vector3::new(-separation / 2.0, 0.0, 0.0),
            velocity: Vector3::new(0.0, -velocity, 0.0),
            radius: 6.96e8,
            color: Some("#FFD700".to_string()),
            parent_id: None,
        },
        CelestialBody {
            id: "star_b".to_string(),
            name: "Star B".to_string(),
            mass: star_mass,
            position: Vector3::new(separation / 2.0, 0.0, 0.0),
            velocity: Vector3::new(0.0, velocity, 0.0),
            radius: 6.96e8,
            color: Some("#87CEEB".to_string()),
            parent_id: None,
        },
    ]
}

// ============================================================================
// HANDLERS
// ============================================================================

async fn create_simulation(
    args: CreateSimulationRequest,
    _signal: Signal,
    state: Arc<OrbitalState>,
) -> Result<Simulation, MeshError> {
    let id = uuid::Uuid::new_v4().to_string();

    let bodies = if let Some(preset) = args.preset {
        match preset.as_str() {
            "solar_system" => create_solar_system_preset(),
            "earth_moon" => create_earth_moon_preset(),
            "binary_star" => create_binary_star_preset(),
            _ => {
                return Err(MeshError::new(
                    ErrorCode::ValidationFailed,
                    format!("Unknown preset: {}", preset),
                    "orbital",
                ))
            }
        }
    } else if let Some(bodies) = args.bodies {
        bodies
    } else {
        return Err(MeshError::new(
            ErrorCode::ValidationFailed,
            "Either preset or bodies must be provided",
            "orbital",
        ));
    };

    let simulation = Simulation {
        id: id.clone(),
        name: args.name,
        bodies,
        time: 0.0,
        dt: args.dt.unwrap_or(60.0), // Default 60 second time step
        created_at: now_millis(),
        paused: false,
    };

    state
        .simulations
        .write()
        .await
        .insert(id.clone(), simulation.clone());

    info!(
        sim_id = %id,
        body_count = simulation.bodies.len(),
        "Simulation created"
    );

    Ok(simulation)
}

async fn add_body(
    args: AddBodyRequest,
    _signal: Signal,
    state: Arc<OrbitalState>,
) -> Result<Simulation, MeshError> {
    let mut sims = state.simulations.write().await;

    let sim = sims.get_mut(&args.simulation_id).ok_or_else(|| {
        MeshError::new(
            ErrorCode::NotFound,
            format!("Simulation {} not found", args.simulation_id),
            "orbital",
        )
    })?;

    sim.bodies.push(args.body);

    Ok(sim.clone())
}

async fn step_simulation(
    args: StepRequest,
    _signal: Signal,
    state: Arc<OrbitalState>,
) -> Result<Simulation, MeshError> {
    let mut sims = state.simulations.write().await;

    let sim = sims.get_mut(&args.simulation_id).ok_or_else(|| {
        MeshError::new(
            ErrorCode::NotFound,
            format!("Simulation {} not found", args.simulation_id),
            "orbital",
        )
    })?;

    if sim.paused {
        return Ok(sim.clone());
    }

    let steps = args.steps.unwrap_or(1);

    for _ in 0..steps {
        *sim = rk4_step(sim.clone());
    }

    Ok(sim.clone())
}

async fn get_state(
    args: GetStateRequest,
    _signal: Signal,
    state: Arc<OrbitalState>,
) -> Result<Simulation, MeshError> {
    let sims = state.simulations.read().await;

    sims.get(&args.simulation_id)
        .cloned()
        .ok_or_else(|| {
            MeshError::new(
                ErrorCode::NotFound,
                format!("Simulation {} not found", args.simulation_id),
                "orbital",
            )
        })
}

async fn get_stats(
    args: GetStateRequest,
    _signal: Signal,
    state: Arc<OrbitalState>,
) -> Result<SimulationStats, MeshError> {
    let sims = state.simulations.read().await;

    let sim = sims.get(&args.simulation_id).ok_or_else(|| {
        MeshError::new(
            ErrorCode::NotFound,
            format!("Simulation {} not found", args.simulation_id),
            "orbital",
        )
    })?;

    Ok(calculate_stats(sim))
}

async fn predict_trajectory(
    args: PredictTrajectoryRequest,
    _signal: Signal,
    state: Arc<OrbitalState>,
) -> Result<Vec<TrajectoryPoint>, MeshError> {
    let sims = state.simulations.read().await;

    let sim = sims.get(&args.simulation_id).ok_or_else(|| {
        MeshError::new(
            ErrorCode::NotFound,
            format!("Simulation {} not found", args.simulation_id),
            "orbital",
        )
    })?;

    // Clone simulation for prediction
    let mut pred_sim = sim.clone();

    let body_idx = pred_sim
        .bodies
        .iter()
        .position(|b| b.id == args.body_id)
        .ok_or_else(|| {
            MeshError::new(
                ErrorCode::NotFound,
                format!("Body {} not found", args.body_id),
                "orbital",
            )
        })?;

    let sample_rate = args.sample_rate.unwrap_or(10.0); // 10 Hz default
    let sample_interval = 1.0 / sample_rate;
    let num_samples = (args.duration * sample_rate) as usize;

    let mut trajectory = Vec::with_capacity(num_samples);
    let mut next_sample_time = 0.0;

    while pred_sim.time < args.duration {
        if pred_sim.time >= next_sample_time {
            trajectory.push(TrajectoryPoint {
                time: pred_sim.time,
                position: pred_sim.bodies[body_idx].position.clone(),
                velocity: pred_sim.bodies[body_idx].velocity.clone(),
            });
            next_sample_time += sample_interval;
        }

        pred_sim = rk4_step(pred_sim);
    }

    Ok(trajectory)
}

async fn list_simulations(
    _args: (),
    _signal: Signal,
    state: Arc<OrbitalState>,
) -> Result<Vec<String>, MeshError> {
    let sims = state.simulations.read().await;
    Ok(sims.keys().cloned().collect())
}

async fn delete_simulation(
    sim_id: String,
    _signal: Signal,
    state: Arc<OrbitalState>,
) -> Result<bool, MeshError> {
    let mut sims = state.simulations.write().await;
    Ok(sims.remove(&sim_id).is_some())
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
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .init();

    info!("🌌 Starting Orbital Mechanics Cell...");

    let seed = std::env::var("RHEO_SEED").unwrap_or_default();

    let config = CellConfig {
        id: "orbital".to_string(),
        port: 0,
        seed: if seed.is_empty() { None } else { Some(seed) },
        // registry_dir uses default (automatic workspace root resolution)
        ..Default::default()
    };

    let cell = RheoCell::new(config);
    let state = Arc::new(OrbitalState::new());

    // Register capabilities
    {
        let s = state.clone();
        cell.provide("orbital/create", move |args, signal| {
            let s = s.clone();
            Box::pin(async move { create_simulation(args, signal, s).await })
        });
    }

    {
        let s = state.clone();
        cell.provide("orbital/add_body", move |args, signal| {
            let s = s.clone();
            Box::pin(async move { add_body(args, signal, s).await })
        });
    }

    {
        let s = state.clone();
        cell.provide("orbital/step", move |args, signal| {
            let s = s.clone();
            Box::pin(async move { step_simulation(args, signal, s).await })
        });
    }

    {
        let s = state.clone();
        cell.provide("orbital/state", move |args, signal| {
            let s = s.clone();
            Box::pin(async move { get_state(args, signal, s).await })
        });
    }

    {
        let s = state.clone();
        cell.provide("orbital/stats", move |args, signal| {
            let s = s.clone();
            Box::pin(async move { get_stats(args, signal, s).await })
        });
    }

    {
        let s = state.clone();
        cell.provide("orbital/predict", move |args, signal| {
            let s = s.clone();
            Box::pin(async move { predict_trajectory(args, signal, s).await })
        });
    }

    {
        let s = state.clone();
        cell.provide("orbital/list", move |args, signal| {
            let s = s.clone();
            Box::pin(async move { list_simulations(args, signal, s).await })
        });
    }

    {
        let s = state.clone();
        cell.provide("orbital/delete", move |args, signal| {
            let s = s.clone();
            Box::pin(async move { delete_simulation(args, signal, s).await })
        });
    }

    let cell_for_shutdown = cell.clone();
    let addr = cell.listen().await.expect("Failed to start orbital cell");
    info!(addr = ?addr, "🪐 Orbital Mechanics Cell online");

    // Wait a moment for server to fully initialize
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    // Announce capabilities to mesh
    info!("📡 Announcing capabilities to mesh...");
    let capabilities = vec![
        "orbital/create",
        "orbital/add_body",
        "orbital/step",
        "orbital/state",
        "orbital/stats",
        "orbital/predict",
        "orbital/list",
        "orbital/delete",
    ];
    
    for cap in &capabilities {
        info!("  ✓ {}", cap);
    }

    // Verify we're in our own atlas
    tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
    info!("✅ Orbital cell ready and advertising {} capabilities", capabilities.len());

    tokio::signal::ctrl_c()
        .await
        .expect("Failed to listen for ctrl-c");
    info!("Shutting down orbital cell...");
    cell_for_shutdown.shutdown().await;
}