/* eslint-disable no-unused-vars */
/**
 * AFIT Vector Command - 2D Kinematics Engine
 * Implements projectile motion with wind resistance
 * Equations: x(t) = V0*cos(θ)*t, y(t) = V0*sin(θ)*t - 0.5*g*t²
 */
export class VectorEngine {
  constructor(config = {}) {
    this.g = config.gravity || 9.81;
    this.scale = config.scale || 10;
    this.canvasWidth = config.canvasWidth || 800;
    this.canvasHeight = config.canvasHeight || 600;
    this.windResistance = config.windResistance || 0;
    this.airResistance = config.airResistance || 0.01;
  }

  /**
   * Calculate position at time t
   * @param {number} v0 - Initial velocity (m/s)
   * @param {number} theta - Launch angle (degrees)
   * @param {number} t - Time (seconds)
   * @param {number} windX - Wind acceleration (m/s²)
   */
  getPosition(v0, theta, t, windX = 0) {
    const θ = (theta * Math.PI) / 180;
    const v0x = v0 * Math.cos(θ);
    const v0y = v0 * Math.sin(θ);

    const ax = windX - this.airResistance * v0x;
    const ay = -this.g;

    const x = v0x * t + 0.5 * ax * t * t;
    const y = v0y * t + 0.5 * ay * t * t;

    return { x, y };
  }

  /**
   * Calculate velocity at time t
   */
  getVelocity(v0, theta, t, windX = 0) {
    const θ = (theta * Math.PI) / 180;
    const v0x = v0 * Math.cos(θ);
    const v0y = v0 * Math.sin(θ);

    const ax = windX - this.airResistance * v0x;
    const ay = -this.g;

    const vx = v0x + ax * t;
    const vy = v0y + ay * t;

    return { vx, vy, speed: Math.sqrt(vx * vx + vy * vy) };
  }

  /**
   * Calculate time of flight for given parameters
   */
  getTimeOfFlight(v0, theta, groundY = 0, windX = 0) {
    const θ = (theta * Math.PI) / 180;
    const v0y = v0 * Math.sin(θ);
    
    const discriminant = v0y * v0y + 2 * this.g * groundY;
    if (discriminant < 0) return 0;
    
    const t1 = (v0y + Math.sqrt(discriminant)) / this.g;
    const t2 = (v0y - Math.sqrt(discriminant)) / this.g;
    
    return Math.max(t1, t2);
  }

  /**
   * Calculate maximum height
   */
  getMaxHeight(v0, theta, windX = 0) {
    const θ = (theta * Math.PI) / 180;
    const v0y = v0 * Math.sin(θ);
    
    const ay = -this.g;
    const t_peak = -v0y / ay;
    
    const h = v0y * t_peak + 0.5 * ay * t_peak * t_peak;
    return Math.max(0, h);
  }

  /**
   * Calculate range (horizontal distance)
   */
  getRange(v0, theta, groundY = 0, windX = 0) {
    const t_flight = this.getTimeOfFlight(v0, theta, groundY, windX);
    const θ = (theta * Math.PI) / 180;
    const v0x = v0 * Math.cos(θ);
    const ax = windX - this.airResistance * v0x;
    
    const x = v0x * t_flight + 0.5 * ax * t_flight * t_flight;
    return Math.max(0, x);
  }

  /**
   * Generate trajectory points for rendering
   */
  generateTrajectory(v0, theta, windX = 0, numPoints = 100) {
    const points = [];
    const t_flight = this.getTimeOfFlight(v0, theta, 0, windX);
    const dt = t_flight / numPoints;

    for (let i = 0; i <= numPoints; i++) {
      const t = i * dt;
      const pos = this.getPosition(v0, theta, t, windX);
      
      if (pos.y >= -1) {
        points.push({ t, x: pos.x, y: pos.y });
      }
    }

    return points;
  }

  /**
   * Check if trajectory hits target
   * @param {number} v0 - Initial velocity
   * @param {number} theta - Launch angle
   * @param {Object} target - Target {x, y, radius}
   * @param {number} windX - Wind acceleration
   */
  checkHit(v0, theta, target, windX = 0) {
    const trajectory = this.generateTrajectory(v0, theta, windX, 200);
    
    let minDistance = Infinity;
    let hitPoint = null;
    let landed = false;

    for (const point of trajectory) {
      const dx = point.x - target.x;
      const dy = point.y - target.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < minDistance) {
        minDistance = distance;
        hitPoint = point;
      }

      if (point.y <= 0 && !landed) {
        landed = true;
      }
    }

    const hit = minDistance <= target.radius;
    const finalPoint = trajectory[trajectory.length - 1];

    return {
      hit,
      distance: minDistance,
      hitPoint,
      finalX: finalPoint?.x || 0,
      finalY: finalPoint?.y || 0,
      maxHeight: this.getMaxHeight(v0, theta, windX),
      range: this.getRange(v0, theta, 0, windX),
      timeOfFlight: this.getTimeOfFlight(v0, theta, 0, windX)
    };
  }

  /**
   * Calculate required angle for given velocity to hit target at (x, y)
   */
  calculateRequiredAngle(v0, targetX, targetY) {
    const g = this.g;
    const cos = Math.cos;
    const sin = Math.sin;
    const sqrt = Math.sqrt;
    const PI = Math.PI;

    const v2 = v0 * v0;
    const x = targetX;
    const y = targetY;

    const discriminant = v2 * v2 - g * (g * x * x + 2 * y * v2);

    if (discriminant < 0) {
      return null;
    }

    const sqrtDisc = sqrt(discriminant);

    const theta1 = Math.atan((v2 + sqrtDisc) / (g * x));
    const theta2 = Math.atan((v2 - sqrtDisc) / (g * x));

    return {
      angle1: (theta1 * 180) / PI,
      angle2: (theta2 * 180) / PI
    };
  }

  /**
   * Generate random target position
   */
  generateTarget(level) {
    const baseRange = 50 + level * 20;
    const baseHeight = level * 10;
    
    const x = 30 + Math.random() * baseRange;
    const y = -Math.random() * baseHeight;
    const radius = Math.max(5, 15 - level);

    return { x, y, radius };
  }

  /**
   * Calculate wind based on level
   */
  generateWind(level) {
    const maxWind = Math.min(level * 0.5, 3);
    return (Math.random() - 0.5) * 2 * maxWind;
  }

  /**
   * Calculate score based on accuracy
   */
  calculateScore(hitResult, v0, theta) {
    let score = 0;

    if (hitResult.hit) {
      score = 100;
      
      if (hitResult.distance < 2) score += 50;
      else if (hitResult.distance < 5) score += 30;
      else if (hitResult.distance < hitResult.hitPoint?.radius) score += 10;

      const optimalAngle = 45;
      const angleDiff = Math.abs(theta - optimalAngle);
      if (angleDiff < 5) score += 20;
      else if (angleDiff < 15) score += 10;

      score += Math.floor(hitResult.timeOfFlight * 2);
    } else {
      score = Math.max(0, 50 - Math.floor(hitResult.distance / 5));
    }

    return score;
  }
}

export default VectorEngine;
