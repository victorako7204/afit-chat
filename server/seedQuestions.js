const mongoose = require('mongoose');
const Question = require('./models/Question');
require('dotenv').config();

const pastQuestionsData = [
  // ==========================================
  // GENERAL PHYSICS II (PHY 102) DATA REPOSITORY
  // ==========================================
  {
    courseCode: 'PHY102',
    topic: 'Alternating Current (AC) Circuits',
    questionText: 'Joseph designed a series RLC circuit that has a resistance of $12\\Omega$, an inductance of $0.15\\text{H}$ and a capacitor of $100\\mu\\text{F}$ connected in series across a $100\\text{V}$, $50\\text{Hz}$ supply. Calculate the total circuit impedance.',
    options: ['19\\Omega', '15\\Omega', '9\\Omega', '5\\Omega'],
    correctOption: 'C'
  },
  {
    courseCode: 'PHY102',
    topic: 'Current Electricity & Internal Resistance',
    questionText: 'Halimat designed a cell that supplies a current of $2000\\text{mA}$ and $1500\\text{mA}$ through a $2\\Omega$ and a $6\\Omega$ resistor respectively. Calculate the internal resistance of the cell.',
    options: ['10.0\\Omega', '13.0\\Omega', '12.0\\Omega', '14.0\\Omega'],
    correctOption: 'A'
  },
  {
    courseCode: 'PHY102',
    topic: 'Electromagnetic Induction',
    questionText: 'Abubakar designed a circuit where the magnetic flux passes perpendicular to the plane of the circuit and is directed into a sheet of paper. If the magnetic flux varies with respect to time according to the relation: $\\Phi_B = (2t^3 + 3t^2 + 8t + 5)\\text{ mWb}$, what is the magnitude of the induced E.M.F in the loop when $t = 3\\text{s}$?',
    options: ['80V', '80Wb', '80mV', '80mWb'],
    correctOption: 'C'
  },
  {
    courseCode: 'PHY102',
    topic: 'Alternating Current (AC) Circuits',
    questionText: 'A capacitor which has an internal resistance of $10\\Omega$ and a capacitance value of $10\\mu\\text{F}$ is connected to a supply voltage given as $V(t) = 100\\sin(314t)$. What is the Root Mean Square (RMS) of the Current?',
    options: ['0.701A', '10A', '0.995A', '7.071A'],
    correctOption: 'A'
  },
  {
    courseCode: 'PHY102',
    topic: 'Modern Physics & Mass Defect',
    questionText: 'If $4 \\times 10^{16}\\text{ J}$ of energy is released in a nuclear reaction, calculate the mass defect, $\\Delta m$.',
    options: ['0.22kg', '0.44kg', '0.66kg', '0.88kg'],
    correctOption: 'B'
  },
  {
    courseCode: 'PHY102',
    topic: 'Atomic Structure & Spectroscopy',
    questionText: 'In the spectral emission lines of a Hydrogen atom, emissions terminating at the energy line $n = 2$ are known as which series?',
    options: ['Paschen Series', 'Lyman Series', 'Balmer Series', 'Hydrogen Series'],
    correctOption: 'C'
  },
  {
    courseCode: 'PHY102',
    topic: 'Alternating Current (AC) Circuits',
    questionText: 'Chijioke designed an RLC series circuit that consists of a $100\\Omega$ resistor, a coil of $0.9\\text{H}$ and a $20\\mu\\text{F}$ capacitor, connected across a $110\\text{V}$, $60\\text{Hz}$ power source. Calculate the total circuit impedance to the nearest significant figure.',
    options: ['196\\Omega', '16,859\\Omega', '230\\Omega', '133\\Omega'],
    correctOption: 'C'
  },
  {
    courseCode: 'PHY102',
    topic: 'Capacitor Networks',
    questionText: 'Determine the total capacitance across the circuit endpoints A and B for a network composed of three $20\\mu\\text{F}$ capacitors connected in a series-parallel arrangement alongside an isolated $10\\mu\\text{F}$ lane factor.',
    options: ['20.0 \\mu F', '70 \\mu F', '4.0 \\mu F', '50 \\mu F'],
    correctOption: 'C'
  },
  {
    courseCode: 'PHY102',
    topic: 'Magnetic Fields & Solenoids',
    questionText: 'Musa designed a solenoid that has 300 turns wound around a cylinder of diameter $1.20\\text{ cm}$ and length $14.0\\text{ cm}$. If the current through the coils is $0.410\\text{ A}$, what is the magnitude of the magnetic field inside and near the middle of the solenoid?',
    options: ['5.1 \\times 10^{-2} T', '1.1 \\times 10^{-2} T', '1.1 \\times 10^{3} T', '1.1 \\times 10^{-3} T'],
    correctOption: 'D'
  },
  {
    courseCode: 'PHY102',
    topic: 'Nuclear Physics & Radioactivity',
    questionText: 'Calculate the fraction of the atoms of a radioactive material that will be left after $80\\text{ years}$ if the half-life of the material is $20\\text{ years}$.',
    options: ['31/32', '15/16', '1/16', '1/32'],
    correctOption: 'C'
  },

  // ==========================================
  // MATHEMATICS II (MTH 102) DATA REPOSITORY
  // ==========================================
  {
    courseCode: 'MTH102',
    topic: 'Functions & Limits',
    questionText: 'Evaluate the following limit expression establishing baseline real number function limits: $\\lim_{x \\to 3} \\frac{x^2 - 9}{x - 3}$.',
    options: ['0', '3', '6', 'Undefined'],
    correctOption: 'C'
  },
  {
    courseCode: 'MTH102',
    topic: 'Differentiation',
    questionText: 'Find the first derivative of the dynamic polynomial tracking equation: $f(x) = 4x^3 - 5x^2 + 7x - 2$.',
    options: ['12x^2 - 10x + 7', '4x^2 - 5x + 7', '12x^3 - 10x^2', '12x^2 - 10x'],
    correctOption: 'A'
  },
  {
    courseCode: 'MTH102',
    topic: 'Integration',
    questionText: 'Evaluate the definite integral bounding functional surface areas: $\\int_{1}^{3} (3x^2 + 2x) \\, dx$.',
    options: ['18', '26', '32', '34'],
    correctOption: 'D'
  },
  {
    courseCode: 'MTH102',
    topic: 'Differentiation',
    questionText: 'Utilize the chain rule process to determine $\\frac{dy}{dx}$ given the composite trigonometric mapping: $y = \\sin(3x^2 + 2)$.',
    options: ['\\cos(3x^2 + 2)', '6x \\cdot \\cos(3x^2 + 2)', '6x \\cdot \\sin(3x^2 + 2)', '-6x \\cdot \\cos(3x^2 + 2)'],
    correctOption: 'B'
  },
  {
    courseCode: 'MTH102',
    topic: 'Integration',
    questionText: 'Find the indefinite integral string representing inverse differential functions: $\\int e^{5x} \\, dx$.',
    options: ['e^{5x} + C', '5e^{5x} + C', '\\frac{1}{5}e^{5x} + C', '\\frac{1}{5}e^{x} + C'],
    correctOption: 'C'
  }
];

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB. Purging stale question pools...');

    await Question.deleteMany({});

    await Question.insertMany(pastQuestionsData);
    console.log('Successfully seeded PHY 102 and MTH 102 questions collection!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding process error:', error);
    process.exit(1);
  }
};

seedDatabase();
