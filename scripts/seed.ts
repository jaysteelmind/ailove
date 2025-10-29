/**
 * Database Seed Script
 * 
 * Populates database with test data for development
 */

import { PrismaClient } from '@prisma/client';
import * as authUtils from '../src/lib/utils/auth';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create test users
  const users = await createUsers();
  console.log(`✓ Created ${users.length} test users`);

  // Create test traits
  const traits = await createTraits(users);
  console.log(`✓ Created ${traits.length} test traits`);

  console.log('🎉 Database seeded successfully!');
}

async function createUsers() {
  const passwordHash = await authUtils.hashPassword('Test123!@#');

  const testUsers = [
    {
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Johnson',
      dateOfBirth: new Date('1992-05-15'),
      gender: 'female',
      location: {
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        latitude: 37.7749,
        longitude: -122.4194,
      },
    },
    {
      email: 'bob@example.com',
      firstName: 'Bob',
      lastName: 'Smith',
      dateOfBirth: new Date('1990-08-22'),
      gender: 'male',
      location: {
        city: 'New York',
        state: 'NY',
        country: 'USA',
        latitude: 40.7128,
        longitude: -74.0060,
      },
    },
    {
      email: 'charlie@example.com',
      firstName: 'Charlie',
      lastName: 'Davis',
      dateOfBirth: new Date('1988-11-30'),
      gender: 'male',
      location: {
        city: 'Los Angeles',
        state: 'CA',
        country: 'USA',
        latitude: 34.0522,
        longitude: -118.2437,
      },
    },
    {
      email: 'diana@example.com',
      firstName: 'Diana',
      lastName: 'Martinez',
      dateOfBirth: new Date('1995-03-10'),
      gender: 'female',
      location: {
        city: 'Chicago',
        state: 'IL',
        country: 'USA',
        latitude: 41.8781,
        longitude: -87.6298,
      },
    },
  ];

  const createdUsers = [];

  for (const userData of testUsers) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        ...userData,
        passwordHash,
      },
    });
    createdUsers.push(user);
  }

  return createdUsers;
}

async function createTraits(users: any[]) {
  const traits = [];

  // Alice's traits
  traits.push(
    ...(await createUserTraits(users[0].id, [
      { dimension: 'values', trait: 'family_oriented', value: 0.9, confidence: 0.85 },
      { dimension: 'values', trait: 'career_driven', value: 0.8, confidence: 0.80 },
      { dimension: 'interests', trait: 'hiking', value: 0.85, confidence: 0.90 },
      { dimension: 'interests', trait: 'cooking', value: 0.75, confidence: 0.85 },
      { dimension: 'communication', trait: 'direct', value: 0.70, confidence: 0.80 },
      { dimension: 'lifestyle', trait: 'active', value: 0.85, confidence: 0.88 },
      { dimension: 'goals', trait: 'marriage_minded', value: 0.90, confidence: 0.85 },
    ]))
  );

  // Bob's traits
  traits.push(
    ...(await createUserTraits(users[1].id, [
      { dimension: 'values', trait: 'adventure_seeking', value: 0.85, confidence: 0.82 },
      { dimension: 'values', trait: 'intellectual', value: 0.80, confidence: 0.85 },
      { dimension: 'interests', trait: 'travel', value: 0.90, confidence: 0.88 },
      { dimension: 'interests', trait: 'photography', value: 0.75, confidence: 0.80 },
      { dimension: 'communication', trait: 'thoughtful', value: 0.80, confidence: 0.83 },
      { dimension: 'lifestyle', trait: 'spontaneous', value: 0.75, confidence: 0.80 },
      { dimension: 'goals', trait: 'relationship_focused', value: 0.85, confidence: 0.82 },
    ]))
  );

  // Charlie's traits
  traits.push(
    ...(await createUserTraits(users[2].id, [
      { dimension: 'values', trait: 'health_conscious', value: 0.90, confidence: 0.87 },
      { dimension: 'values', trait: 'environmental', value: 0.85, confidence: 0.83 },
      { dimension: 'interests', trait: 'yoga', value: 0.85, confidence: 0.85 },
      { dimension: 'interests', trait: 'meditation', value: 0.80, confidence: 0.82 },
      { dimension: 'communication', trait: 'empathetic', value: 0.88, confidence: 0.85 },
      { dimension: 'lifestyle', trait: 'balanced', value: 0.82, confidence: 0.80 },
      { dimension: 'goals', trait: 'personal_growth', value: 0.90, confidence: 0.88 },
    ]))
  );

  // Diana's traits
  traits.push(
    ...(await createUserTraits(users[3].id, [
      { dimension: 'values', trait: 'creativity', value: 0.92, confidence: 0.90 },
      { dimension: 'values', trait: 'social_justice', value: 0.88, confidence: 0.85 },
      { dimension: 'interests', trait: 'art', value: 0.90, confidence: 0.88 },
      { dimension: 'interests', trait: 'music', value: 0.85, confidence: 0.83 },
      { dimension: 'communication', trait: 'expressive', value: 0.85, confidence: 0.82 },
      { dimension: 'lifestyle', trait: 'social', value: 0.88, confidence: 0.85 },
      { dimension: 'goals', trait: 'community_building', value: 0.85, confidence: 0.83 },
    ]))
  );

  return traits;
}

async function createUserTraits(userId: string, traitData: any[]) {
  const traits = [];

  for (const data of traitData) {
    const trait = await prisma.userTrait.create({
      data: {
        userId,
        dimension: data.dimension,
        trait: data.trait,
        value: data.value,
        confidence: data.confidence,
        source: 'explicit',
        extractedAt: new Date(),
      },
    });
    traits.push(trait);
  }

  return traits;
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
