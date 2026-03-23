/* eslint-disable no-unused-vars */
/**
 * AFIT Structural Integrity - 2D Truss Analysis Engine
 * Implements Method of Joints for stress calculation
 */
export class StructuralEngine {
  constructor(config = {}) {
    this.nodes = [];
    this.beams = [];
    this.loads = [];
    this.supports = [];
    this.materialStrength = config.materialStrength || 100;
    this.gravity = config.gravity || 9.81;
    this.truckWeight = config.truckWeight || 50;
  }

  /**
   * Add a node (joint) to the structure
   */
  addNode(id, x, y, fixed = false) {
    this.nodes.push({
      id,
      x,
      y,
      fixed,
      reactions: { rx: 0, ry: 0 },
      displacement: { dx: 0, dy: 0 }
    });
    return this.nodes[this.nodes.length - 1];
  }

  /**
   * Add a beam (truss member) between two nodes
   */
  addBeam(id, nodeA, nodeB, strengthMultiplier = 1) {
    const node1 = this.nodes.find(n => n.id === nodeA);
    const node2 = this.nodes.find(n => n.id === nodeB);
    
    if (!node1 || !node2) return null;

    const dx = node2.x - node1.x;
    const dy = node2.y - node1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    const beam = {
      id,
      nodeA,
      nodeB,
      length,
      angle,
      force: 0,
      stress: 0,
      type: null,
      broken: false,
      maxLoad: this.materialStrength * strengthMultiplier,
      color: '#6b7280'
    };

    this.beams.push(beam);
    return beam;
  }

  /**
   * Add a support (pin or roller)
   */
  addSupport(nodeId, type = 'pin') {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return null;

    node.fixed = true;
    node.supportType = type;

    this.supports.push({ nodeId, type });
    return this.supports[this.supports.length - 1];
  }

  /**
   * Add a point load (truck)
   */
  addLoad(nodeId, fx = 0, fy = -50) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return null;

    const load = { nodeId, fx, fy };
    this.loads.push(load);
    node.loads = node.loads || [];
    node.loads.push(load);

    return load;
  }

  /**
   * Add distributed load (uniform load on beam)
   */
  addDistributedLoad(beamId, w) {
    const beam = this.beams.find(b => b.id === beamId);
    if (!beam) return null;

    const node1 = this.nodes.find(n => n.id === beam.nodeA);
    const node2 = this.nodes.find(n => n.id === beam.nodeB);

    const halfLoad = (w * beam.length) / 2;

    const load1 = this.addLoad(beam.nodeA, 0, -halfLoad);
    const load2 = this.addLoad(beam.nodeB, 0, -halfLoad);

    return { beamId, w, load1, load2 };
  }

  /**
   * Calculate beam forces using Method of Joints
   */
  analyze() {
    if (this.nodes.length === 0 || this.beams.length === 0) {
      return { success: false, error: 'No structure to analyze' };
    }

    const reactionForces = this.calculateReactions();
    if (!reactionForces.success) {
      return reactionForces;
    }

    const { rx, ry } = reactionForces;

    const supportNodes = this.supports.map(s => s.nodeId);
    let reactionIndex = 0;

    for (const node of this.nodes) {
      if (supportNodes.includes(node.id)) {
        const support = this.supports.find(s => s.nodeId === node.id);
        if (support.type === 'pin') {
          node.reactions.rx = rx[reactionIndex] || 0;
          node.reactions.ry = ry[reactionIndex] || 0;
          reactionIndex++;
        } else if (support.type === 'roller') {
          node.reactions.ry = ry[reactionIndex] || 0;
          reactionIndex++;
        }
      }
    }

    for (const beam of this.beams) {
      beam.force = this.calculateBeamForce(beam);
      beam.stress = beam.force / beam.length;

      if (beam.force > 0) {
        beam.type = 'tension';
        beam.color = this.getTensionColor(Math.abs(beam.stress));
      } else {
        beam.type = 'compression';
        beam.color = this.getCompressionColor(Math.abs(beam.stress));
      }

      if (Math.abs(beam.stress) > beam.maxLoad) {
        beam.broken = true;
        beam.color = '#374151';
      }
    }

    return {
      success: true,
      nodes: this.nodes,
      beams: this.beams,
      reactions: reactionForces
    };
  }

  /**
   * Calculate support reactions using equilibrium equations
   */
  calculateReactions() {
    let totalFx = 0;
    let totalFy = 0;
    let totalMoment = 0;

    for (const load of this.loads) {
      totalFx += load.fx;
      totalFy += load.fy;

      const node = this.nodes.find(n => n.id === load.nodeId);
      if (node) {
        const refPoint = this.nodes[0];
        totalMoment += -node.y * load.fx + node.x * load.fy;
      }
    }

    const pinSupports = this.supports.filter(s => s.type === 'pin').length;
    const rollerSupports = this.supports.filter(s => s.type === 'roller').length;
    const totalReactions = pinSupports + rollerSupports;

    if (totalReactions === 0) {
      return { success: false, error: 'No supports defined' };
    }

    const rx = new Array(pinSupports).fill(0);
    const ry = new Array(totalReactions).fill(0);

    const sumRx = () => rx.reduce((a, b) => a + b, 0);
    const sumRy = () => ry.reduce((a, b) => a + b, 0);

    ry[0] = -totalFy;
    rx[0] = -totalFx;

    return { success: true, rx, ry, totalFx, totalFy, totalMoment };
  }

  /**
   * Calculate force in a specific beam
   */
  calculateBeamForce(beam) {
    const nodeA = this.nodes.find(n => n.id === beam.nodeA);
    const nodeB = this.nodes.find(n => n.id === beam.nodeB);

    const dx = nodeB.x - nodeA.x;
    const dy = nodeB.y - nodeA.y;
    const L = beam.length;

    const cos = dx / L;
    const sin = dy / L;

    let totalFx = 0;
    let totalFy = 0;

    for (const load of this.loads) {
      if (load.nodeId === beam.nodeA || load.nodeId === beam.nodeB) {
        totalFx += load.fx;
        totalFy += load.fy;
      }
    }

    totalFx += nodeA.reactions.rx;
    totalFy += nodeA.reactions.ry;

    const force = -(totalFx * cos + totalFy * sin);

    return force;
  }

  /**
   * Get color for tension based on stress level
   */
  getTensionColor(stressRatio) {
    const ratio = Math.min(stressRatio / this.materialStrength, 1);
    
    if (ratio < 0.3) return '#3b82f6';
    if (ratio < 0.6) return '#60a5fa';
    if (ratio < 0.8) return '#93c5fd';
    return '#bfdbfe';
  }

  /**
   * Get color for compression based on stress level
   */
  getCompressionColor(stressRatio) {
    const ratio = Math.min(stressRatio / this.materialStrength, 1);
    
    if (ratio < 0.3) return '#ef4444';
    if (ratio < 0.6) return '#f87171';
    if (ratio < 0.8) return '#fca5a5';
    return '#fecaca';
  }

  /**
   * Break beams that exceed their limit
   */
  applyFailure() {
    const brokenBeams = [];
    
    for (const beam of this.beams) {
      if (Math.abs(beam.stress) > beam.maxLoad && !beam.broken) {
        beam.broken = true;
        beam.color = '#1f2937';
        beam.type = 'failed';
        brokenBeams.push(beam.id);
      }
    }

    if (brokenBeams.length > 0) {
      this.reanalyze();
    }

    return brokenBeams;
  }

  /**
   * Reanalyze after a beam breaks
   */
  reanalyze() {
    const intactBeams = this.beams.filter(b => !b.broken);
    const originalBeams = [...this.beams];
    this.beams = intactBeams;
    
    const result = this.analyze();
    
    this.beams = originalBeams;
    
    return result;
  }

  /**
   * Move truck across bridge and analyze
   */
  moveTruck(position) {
    const bridgeNodes = this.nodes.filter(n => n.x >= position.x - 10 && n.x <= position.x + 10);
    
    if (bridgeNodes.length === 0) return { moved: false };

    const nodeBelow = bridgeNodes.reduce((closest, node) => {
      if (node.y < closest.y) return node;
      return closest;
    }, bridgeNodes[0]);

    this.loads = this.loads.filter(l => l.isTruck);
    
    this.addLoad(nodeBelow.id, 0, -this.truckWeight);
    this.addLoad(nodeBelow.id, 0, -this.truckWeight * 0.5);

    const result = this.analyze();
    
    const broken = this.applyFailure();

    return {
      moved: true,
      atNode: nodeBelow.id,
      result,
      broken
    };
  }

  /**
   * Generate a bridge puzzle level
   */
  static generatePuzzle(level) {
    const baseStrength = 100 + level * 20;
    const truckWeight = 30 + level * 10;

    return {
      level,
      budget: 500 + level * 100,
      beamCost: 100,
      truckWeight,
      materialStrength: baseStrength,
      description: `Build a bridge that can support a ${truckWeight}kg truck. Each beam costs 100 AFIT coins.`,
      span: 5 + Math.floor(level / 2),
      supports: level < 3 ? ['pin', 'roller'] : ['pin', 'pin']
    };
  }

  /**
   * Calculate construction cost
   */
  calculateCost() {
    return this.beams.length * 100;
  }

  /**
   * Check if bridge is within budget
   */
  checkBudget(maxBudget) {
    const cost = this.calculateCost();
    return cost <= maxBudget;
  }

  /**
   * Reset structure
   */
  reset() {
    this.nodes = [];
    this.beams = [];
    this.loads = [];
    this.supports = [];
  }
}

export default StructuralEngine;
