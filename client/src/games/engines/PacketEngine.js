/**
 * AFIT Packet Router - Network Sorting Engine
 * Implements packet routing and IP filtering
 */
export const PACKET_TYPES = {
  HTTP: { port: 80, protocol: 'TCP', name: 'HTTP', color: '#3b82f6' },
  HTTPS: { port: 443, protocol: 'TCP', name: 'HTTPS', color: '#10b981' },
  SSH: { port: 22, protocol: 'TCP', name: 'SSH', color: '#f59e0b' },
  DNS: { port: 53, protocol: 'UDP', name: 'DNS', color: '#8b5cf6' },
  FTP: { port: 21, protocol: 'TCP', name: 'FTP', color: '#ec4899' },
  SMTP: { port: 25, protocol: 'TCP', name: 'SMTP', color: '#ef4444' },
  MALICIOUS: { port: 0, protocol: 'TCP', name: 'MALICIOUS', color: '#dc2626' }
};

export const ROUTER_PORTS = {
  NORTH: 'north',
  SOUTH: 'south',
  EAST: 'east',
  WEST: 'west'
};

export class Packet {
  constructor(config = {}) {
    this.id = config.id || Math.random().toString(36).substr(2, 9);
    this.destinationIP = config.destinationIP || this.generateIP();
    this.port = config.port || 80;
    this.protocol = config.protocol || 'TCP';
    this.type = config.type || this.identifyType();
    this.x = config.x || 0;
    this.y = config.y || 0;
    this.speed = config.speed || 1;
    this.color = this.type.color;
    this.dropped = false;
    this.delivered = false;
    this.lifetime = 0;
    this.maxLifetime = 20;
    this.malicious = config.malicious || false;
    this.subnet = config.subnet || null;
  }

  identifyType() {
    const type = Object.values(PACKET_TYPES).find(
      t => t.port === this.port && t.protocol === this.protocol
    );
    return type || PACKET_TYPES.HTTP;
  }

  generateIP() {
    const octets = [
      Math.floor(Math.random() * 223) + 1,
      Math.floor(Math.random() * 255),
      Math.floor(Math.random() * 255),
      Math.floor(Math.random() * 255)
    ];
    return octets.join('.');
  }

  generateMaliciousIP() {
    return `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  update() {
    this.lifetime += 1 / 60;
    
    if (this.lifetime >= this.maxLifetime) {
      this.dropped = true;
    }

    return !this.dropped && !this.delivered;
  }

  move(dx, dy) {
    this.x += dx * this.speed;
    this.y += dy * this.speed;
  }
}

export class Router {
  constructor(id, gridX, gridY) {
    this.id = id;
    this.gridX = gridX;
    this.gridY = gridY;
    this.directions = {
      north: { dx: 0, dy: -1 },
      south: { dx: 0, dy: 1 },
      east: { dx: 1, dy: 0 },
      west: { dx: -1, dy: 0 }
    };
    this.ports = {
      north: ROUTER_PORTS.SOUTH,
      south: ROUTER_PORTS.NORTH,
      east: ROUTER_PORTS.EAST,
      west: ROUTER_PORTS.WEST
    };
    this.activePort = 'east';
    this.filters = [];
  }

  rotate() {
    const directionOrder = ['north', 'east', 'south', 'west'];
    const currentIndex = directionOrder.indexOf(this.activePort);
    const nextIndex = (currentIndex + 1) % 4;
    this.activePort = directionOrder[nextIndex];
  }

  getOutputDirection() {
    return this.activePort;
  }

  getMovement() {
    return this.directions[this.activePort];
  }

  shouldDropPacket(packet) {
    for (const filter of this.filters) {
      if (filter.type === 'subnet') {
        const ip = packet.destinationIP;
        if (ip.startsWith(filter.value)) {
          return true;
        }
      }
      if (filter.type === 'port' && packet.port === filter.value) {
        return true;
      }
    }
    return false;
  }

  addFilter(filter) {
    this.filters.push(filter);
  }

  removeFilter(filterId) {
    this.filters = this.filters.filter(f => f.id !== filterId);
  }
}

export class PacketEngine {
  constructor(config = {}) {
    this.gridWidth = config.gridWidth || 5;
    this.gridHeight = config.gridHeight || 5;
    this.packets = [];
    this.routers = [];
    this.ports = [];
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.packetSpawnRate = config.packetSpawnRate || 3;
    this.timeSinceLastSpawn = 0;
    this.spawnQueue = [];
    this.deliveredPackets = [];
    this.droppedPackets = [];
  }

  /**
   * Initialize ports (endpoints)
   */
  addPort(id, type, gridX, gridY) {
    const port = {
      id,
      type,
      gridX,
      gridY,
      x: gridX * 80 + 40,
      y: gridY * 80 + 40,
      acceptedTypes: this.getAcceptedTypes(type),
      received: 0
    };
    this.ports.push(port);
    return port;
  }

  getAcceptedTypes(portType) {
    switch (portType) {
      case 'web': return ['HTTP', 'HTTPS'];
      case 'ssh': return ['SSH'];
      case 'dns': return ['DNS'];
      case 'ftp': return ['FTP', 'SMTP'];
      default: return [];
    }
  }

  /**
   * Initialize router at position
   */
  addRouter(id, gridX, gridY) {
    const router = new Router(id, gridX, gridY);
    router.x = gridX * 80 + 40;
    router.y = gridY * 80 + 40;
    this.routers.push(router);
    return router;
  }

  /**
   * Spawn a new packet
   */
  spawnPacket(config = {}) {
    const side = config.side || this.getRandomSide();
    let x, y;

    switch (side) {
      case 'left':
        x = -20;
        y = Math.random() * this.gridHeight * 80;
        break;
      case 'right':
        x = this.gridWidth * 80 + 20;
        y = Math.random() * this.gridHeight * 80;
        break;
      case 'top':
        x = Math.random() * this.gridWidth * 80;
        y = -20;
        break;
      default:
        x = -20;
        y = Math.random() * this.gridHeight * 80;
    }

    const portTypes = ['HTTP', 'HTTPS', 'SSH', 'DNS', 'FTP', 'SMTP'];
    const weights = [30, 30, 15, 10, 10, 5];
    const maliciousChance = Math.min(0.1 + this.level * 0.05, 0.4);

    let type, malicious = false;

    if (Math.random() < maliciousChance) {
      type = PACKET_TYPES.MALICIOUS;
      malicious = true;
    } else {
      const random = Math.random() * 100;
      let cumulative = 0;
      for (let i = 0; i < portTypes.length; i++) {
        cumulative += weights[i];
        if (random < cumulative) {
          type = Object.values(PACKET_TYPES).find(t => t.name === portTypes[i]);
          break;
        }
      }
      type = type || PACKET_TYPES.HTTP;
    }

    const packet = new Packet({
      x,
      y,
      port: type.port,
      protocol: type.protocol,
      type,
      malicious,
      subnet: malicious ? '192.168' : null
    });

    packet.direction = side === 'left' ? { dx: 1, dy: 0 } : { dx: -1, dy: 0 };
    if (side === 'top') packet.direction = { dx: 0, dy: 1 };

    this.packets.push(packet);
    return packet;
  }

  getRandomSide() {
    const sides = ['left', 'right', 'top'];
    return sides[Math.floor(Math.random() * sides.length)];
  }

  /**
   * Update all packets
   */
  update(deltaTime) {
    const toRemove = [];

    for (const packet of this.packets) {
      if (!packet.update()) {
        if (packet.lifetime >= packet.maxLifetime && !packet.dropped) {
          this.lives--;
          this.droppedPackets.push(packet);
          toRemove.push(packet.id);
        }
        continue;
      }

      packet.move(packet.direction.dx, packet.direction.dy);

      const nearbyRouter = this.findNearbyRouter(packet);
      if (nearbyRouter) {
        if (nearbyRouter.shouldDropPacket(packet)) {
          packet.dropped = true;
          this.lives--;
          this.droppedPackets.push(packet);
          toRemove.push(packet.id);
          continue;
        }

        const movement = nearbyRouter.getMovement();
        packet.direction = movement;
      }

      const port = this.findNearbyPort(packet);
      if (port) {
        if (port.acceptedTypes.includes(packet.type.name)) {
          packet.delivered = true;
          port.received++;
          this.deliveredPackets.push(packet);
          this.score += packet.malicious ? 50 : 10;
          toRemove.push(packet.id);
        } else {
          packet.dropped = true;
          this.lives--;
          this.droppedPackets.push(packet);
          toRemove.push(packet.id);
        }
      }

      if (packet.x < -50 || packet.x > this.gridWidth * 80 + 50 ||
          packet.y < -50 || packet.y > this.gridHeight * 80 + 50) {
        if (!packet.delivered) {
          this.lives--;
          this.droppedPackets.push(packet);
        }
        toRemove.push(packet.id);
      }
    }

    this.packets = this.packets.filter(p => !toRemove.includes(p.id));

    return {
      packetsRemaining: this.packets.length,
      lives: this.lives,
      score: this.score,
      level: this.level,
      delivered: this.deliveredPackets.length,
      dropped: this.droppedPackets.length
    };
  }

  findNearbyRouter(packet) {
    for (const router of this.routers) {
      const dx = packet.x - router.x;
      const dy = packet.y - router.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 30) {
        return router;
      }
    }
    return null;
  }

  findNearbyPort(packet) {
    for (const port of this.ports) {
      const dx = packet.x - port.x;
      const dy = packet.y - port.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 30) {
        return port;
      }
    }
    return null;
  }

  /**
   * Generate a level
   */
  static generateLevel(level) {
    const packetRate = Math.max(1, 4 - Math.floor(level / 3));
    const packetSpeed = Math.min(1 + level * 0.2, 3);

    return {
      level,
      packetRate,
      packetSpeed,
      maliciousChance: Math.min(0.1 + level * 0.05, 0.4),
      description: `Route packets to correct servers. Drop malicious packets (red)!`,
      targetScore: 100 + level * 50
    };
  }

  /**
   * Check if level is complete
   */
  checkLevelComplete() {
    const delivered = this.deliveredPackets.length;
    const dropped = this.droppedPackets.length;
    const accuracy = delivered / (delivered + dropped || 1);

    if (this.lives <= 0) {
      return { complete: false, passed: false, reason: 'No lives remaining' };
    }

    if (accuracy >= 0.7 && this.packets.length === 0) {
      return {
        complete: true,
        passed: true,
        score: this.score,
        accuracy: Math.round(accuracy * 100)
      };
    }

    return { complete: false };
  }

  /**
   * Rotate router
   */
  rotateRouter(routerId) {
    const router = this.routers.find(r => r.id === routerId);
    if (router) {
      router.rotate();
      return router;
    }
    return null;
  }

  /**
   * Add subnet filter to router
   */
  addSubnetFilter(routerId, subnet) {
    const router = this.routers.find(r => r.id === routerId);
    if (router) {
      router.addFilter({
        id: Math.random().toString(36).substr(2, 9),
        type: 'subnet',
        value: subnet
      });
      return true;
    }
    return false;
  }

  /**
   * Reset engine
   */
  reset() {
    this.packets = [];
    this.routers = [];
    this.ports = [];
    this.score = 0;
    this.lives = 3;
    this.deliveredPackets = [];
    this.droppedPackets = [];
    this.timeSinceLastSpawn = 0;
  }
}

export default PacketEngine;
