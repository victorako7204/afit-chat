/**
 * AFIT Logic Gate Overload - Boolean Algebra Engine
 * Implements logic gates and circuit evaluation
 */

// Gate definitions with their logic
export const GATE_TYPES = {
  AND: {
    name: 'AND',
    symbol: '∧',
    inputs: 2,
    evaluate: (inputs) => inputs[0] && inputs[1],
    color: '#3b82f6',
    description: 'Output 1 only if ALL inputs are 1'
  },
  OR: {
    name: 'OR',
    symbol: '∨',
    inputs: 2,
    evaluate: (inputs) => inputs[0] || inputs[1],
    color: '#10b981',
    description: 'Output 1 if ANY input is 1'
  },
  NOT: {
    name: 'NOT',
    symbol: '¬',
    inputs: 1,
    evaluate: (inputs) => !inputs[0],
    color: '#f59e0b',
    description: 'Inverts the input'
  },
  XOR: {
    name: 'XOR',
    symbol: '⊕',
    inputs: 2,
    evaluate: (inputs) => inputs[0] !== inputs[1],
    color: '#8b5cf6',
    description: 'Output 1 if inputs are DIFFERENT'
  },
  NAND: {
    name: 'NAND',
    symbol: '⊼',
    inputs: 2,
    evaluate: (inputs) => !(inputs[0] && inputs[1]),
    color: '#ec4899',
    description: 'NOT(AND) - Opposite of AND'
  },
  NOR: {
    name: 'NOR',
    symbol: '⊽',
    inputs: 2,
    evaluate: (inputs) => !(inputs[0] || inputs[1]),
    color: '#ef4444',
    description: 'NOT(OR) - Opposite of OR'
  }
};

export class LogicEngine {
  constructor() {
    this.gates = new Map();
    this.connections = [];
    this.inputNodes = [];
    this.outputNode = null;
    this.truthTable = [];
  }

  /**
   * Add a gate to the circuit
   */
  addGate(id, type, position = { x: 0, y: 0 }) {
    const gateType = GATE_TYPES[type];
    if (!gateType) return false;

    this.gates.set(id, {
      id,
      type,
      position,
      inputs: new Array(gateType.inputs).fill(false),
      output: false,
      connections: []
    });

    return true;
  }

  /**
   * Remove a gate
   */
  removeGate(id) {
    this.gates.delete(id);
    this.connections = this.connections.filter(
      c => c.from !== id && c.to !== id
    );
  }

  /**
   * Add connection between gates
   */
  addConnection(fromId, fromPort, toId, toPort) {
    this.connections.push({
      from: fromId,
      fromPort,
      to: toId,
      toPort,
      active: false
    });
  }

  /**
   * Set input node values
   */
  setInputs(inputValues) {
    this.inputNodes = inputValues.map((value, index) => ({
      id: `input_${index}`,
      value: Boolean(value),
      position: { x: 0, y: index * 80 }
    }));
  }

  /**
   * Set the output node
   */
  setOutput(nodeId) {
    this.outputNode = nodeId;
  }

  /**
   * Evaluate the circuit
   */
  evaluate() {
    if (this.inputNodes.length === 0) return null;

    const inputValues = this.inputNodes.map(n => n.value);
    const gateOutputs = new Map();

    for (const [id, gate] of this.gates) {
      gateOutputs.set(id, gate.type === 'NOT' ? !inputValues[0] : false);
    }

    const sortedGates = this.topologicalSort();
    
    for (const gateId of sortedGates) {
      const gate = this.gates.get(gateId);
      const gateType = GATE_TYPES[gate.type];

      const inputVals = gateType.inputs === 1 
        ? [inputValues[0]]
        : [false, false];

      for (const conn of this.connections) {
        if (conn.to === gateId) {
          if (conn.toPort === 0) inputVals[0] = gateOutputs.get(conn.from) || false;
          if (conn.toPort === 1) inputVals[1] = gateOutputs.get(conn.from) || false;
        }
      }

      gateOutputs.set(gateId, gateType.evaluate(inputVals));
      gate.output = gateOutputs.get(gateId);
    }

    for (const conn of this.connections) {
      conn.active = gateOutputs.get(conn.from) || false;
    }

    return this.outputNode ? gateOutputs.get(this.outputNode) : null;
  }

  /**
   * Topological sort for evaluation order
   */
  topologicalSort() {
    const visited = new Set();
    const result = [];

    const visit = (gateId) => {
      if (visited.has(gateId)) return;
      visited.add(gateId);

      for (const conn of this.connections) {
        if (conn.from === gateId) {
          visit(conn.to);
        }
      }

      result.push(gateId);
    };

    for (const [id] of this.gates) {
      visit(id);
    }

    return result;
  }

  /**
   * Generate truth table for circuit
   */
  generateTruthTable(inputCount) {
    const table = [];
    const numCombinations = Math.pow(2, inputCount);

    for (let i = 0; i < numCombinations; i++) {
      const inputs = [];
      for (let j = inputCount - 1; j >= 0; j--) {
        inputs.push(Boolean((i >> j) & 1));
      }

      this.setInputs(inputs);
      const output = this.evaluate();

      table.push({
        inputs,
        output
      });
    }

    this.truthTable = table;
    return table;
  }

  /**
   * Generate a puzzle level
   */
  static generatePuzzle(level) {
    const puzzles = [
      {
        name: 'Basic AND',
        description: 'Create a circuit where output is 1 only when BOTH inputs are 1',
        targetTruthTable: [
          { inputs: [0, 0], output: 0 },
          { inputs: [0, 1], output: 0 },
          { inputs: [1, 0], output: 0 },
          { inputs: [1, 1], output: 1 }
        ],
        availableGates: ['AND', 'OR', 'NOT'],
        slots: 1
      },
      {
        name: 'Basic OR',
        description: 'Create a circuit where output is 1 when ANY input is 1',
        targetTruthTable: [
          { inputs: [0, 0], output: 0 },
          { inputs: [0, 1], output: 1 },
          { inputs: [1, 0], output: 1 },
          { inputs: [1, 1], output: 1 }
        ],
        availableGates: ['AND', 'OR', 'NOT'],
        slots: 1
      },
      {
        name: 'NOT Gate',
        description: 'Invert the input - output 1 when input is 0',
        targetTruthTable: [
          { inputs: [0], output: 1 },
          { inputs: [1], output: 0 }
        ],
        availableGates: ['NOT', 'AND', 'OR'],
        slots: 1
      },
      {
        name: 'XOR Challenge',
        description: 'Output 1 when inputs are DIFFERENT',
        targetTruthTable: [
          { inputs: [0, 0], output: 0 },
          { inputs: [0, 1], output: 1 },
          { inputs: [1, 0], output: 1 },
          { inputs: [1, 1], output: 0 }
        ],
        availableGates: ['AND', 'OR', 'NOT', 'XOR', 'NAND'],
        slots: 3
      },
      {
        name: 'NAND Logic',
        description: 'Use only NAND gates to create output 0 only when both inputs are 1',
        targetTruthTable: [
          { inputs: [0, 0], output: 1 },
          { inputs: [0, 1], output: 1 },
          { inputs: [1, 0], output: 1 },
          { inputs: [1, 1], output: 0 }
        ],
        availableGates: ['NAND'],
        slots: 2
      }
    ];

    const index = (level - 1) % puzzles.length;
    return puzzles[index];
  }

  /**
   * Check if user's circuit matches target
   */
  checkSolution(targetTable) {
    if (this.truthTable.length !== targetTable.length) return false;

    for (let i = 0; i < targetTable.length; i++) {
      if (this.truthTable[i].output !== targetTable[i].output) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate score based on gates used
   */
  calculateScore(targetTable, gatesUsed) {
    if (!this.checkSolution(targetTable)) return 0;

    let score = 100;
    score -= gatesUsed * 10;
    score = Math.max(score, 20);

    return score;
  }

  /**
   * Reset circuit
   */
  reset() {
    this.gates.clear();
    this.connections = [];
    this.inputNodes = [];
    this.outputNode = null;
    this.truthTable = [];
  }
}

export default LogicEngine;
