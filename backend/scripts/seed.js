const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const User = require('../models/User');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');

  const existing = await User.findOne({ email: 'admin@shop.local' });
  if (existing) {
    console.log('Admin user already exists — skipping.');
    await mongoose.disconnect();
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash('Admin@123', 12);
  await User.create({
    name: 'Admin',
    email: 'admin@shop.local',
    passwordHash,
    role: 'admin',
  });

  console.log('Seeded: admin@shop.local / Admin@123');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
