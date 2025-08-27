const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createDemoUser() {
  try {
    // Check if demo user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'demo@example.com' }
    });

    if (existingUser) {
      console.log('Demo user already exists');
      return;
    }

    // Create demo user
    const hashedPassword = await bcrypt.hash('demo123', 12);
    
    const user = await prisma.user.create({
      data: {
        name: '演示用户',
        email: 'demo@example.com',
        password: hashedPassword,
        role: 'user'
      }
    });

    console.log('Demo user created:', user.email);
  } catch (error) {
    console.error('Error creating demo user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDemoUser();