const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Question = require('./models/Question');
require('dotenv').config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const dataPath = path.join(__dirname, 'questionsDataPool_v3.json');
    const pastQuestionsData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    await Question.deleteMany({});
    await Question.insertMany(pastQuestionsData);
    console.log(`Successfully seeded ${pastQuestionsData.length} total questions from Version 3 into MongoDB Atlas!`);
    process.exit(0);
  } catch (err) {
    console.error('Seeding crashed:', err);
    process.exit(1);
  }
};

seedDatabase();
