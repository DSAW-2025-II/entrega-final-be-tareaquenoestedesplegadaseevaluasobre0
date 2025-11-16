/**
 * Test Helpers
 * Common utilities for integration tests
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
let memoryServer = null; // mongodb-memory-server instance (for tests)

/**
 * Connect to test database
 */
async function connectTestDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/wheels-unisabana-test';
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
  } catch (err) {
    // Fallback to in-memory MongoDB for tests when local/remote is unavailable
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    const memUri = memoryServer.getUri();
    await mongoose.connect(memUri);
  }
}

/**
 * Disconnect from test database
 */
async function disconnectTestDB() {
  await mongoose.connection.close();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

/**
 * Clear all collections in test database
 */
async function clearDatabase() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

// Note: createTestUser is implemented later to persist users in the DB for integration tests

/**
 * Generate random plate
 */
function generateRandomPlate() {
  const letters = String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
                  String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
                  String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const numbers = Math.floor(100 + Math.random() * 900);
  return `${letters}${numbers}`;
}

/**
 * Create test image file
 */
function createTestImage(filename = 'test-image.jpg') {
  const testDir = path.join(__dirname, '../test-files');
  
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // Create a small valid JPEG (1x1 pixel, red)
  const validJpeg = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01,
    0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x09, 0xFF, 0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xFF,
    0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0xD2, 0xCF, 0x20,
    0xFF, 0xD9
  ]);
  
  const imagePath = path.join(testDir, filename);
  fs.writeFileSync(imagePath, validJpeg);
  return imagePath;
}

/**
 * Create large test file (for testing size limits)
 */
function createLargeTestFile(filename = 'large-file.jpg', sizeMB = 6) {
  const testDir = path.join(__dirname, '../test-files');
  
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const buffer = Buffer.alloc(sizeMB * 1024 * 1024);
  const filePath = path.join(testDir, filename);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * Cleanup test files
 */
function cleanupTestFiles() {
  const testDir = path.join(__dirname, '../test-files');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

/**
 * Count files in uploads directory
 */
function countUploadedFiles(subfolder = 'vehicles') {
  const uploadsDir = path.join(__dirname, '../../uploads', subfolder);
  if (!fs.existsSync(uploadsDir)) {
    return 0;
  }
  return fs.readdirSync(uploadsDir).length;
}

/**
 * Cleanup uploads directory
 */
function cleanupUploads(subfolder = 'vehicles') {
  const uploadsDir = path.join(__dirname, '../../uploads', subfolder);
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    files.forEach(file => {
      fs.unlinkSync(path.join(uploadsDir, file));
    });
  }
}

  /**
   * Create a test user in database
   */
  async function createTestUser(arg = 'passenger', email = null) {
    // Accept either (role[, email]) or an object { fullName, corporateEmail, role }
    const UserModel = require('../../src/infrastructure/database/models/UserModel');
    let role = 'passenger';
    let corporateEmail = email;
    let firstName = 'Test';
    let lastName = 'Passenger';

    if (typeof arg === 'object' && arg !== null) {
      const obj = arg;
      role = obj.role || 'passenger';
      corporateEmail = obj.corporateEmail || email || `test${Math.floor(300000 + Math.random() * 99999)}@unisabana.edu.co`;
      if (obj.fullName) {
        const parts = obj.fullName.split(' ');
        firstName = parts[0] || firstName;
        lastName = parts.slice(1).join(' ') || lastName;
      }
    } else {
      role = arg || 'passenger';
      corporateEmail = email || `test${Math.floor(300000 + Math.random() * 99999)}@unisabana.edu.co`;
    }

    // Generate a semi-random phone to avoid duplicate key collisions in tests
    const phone = `+57300${Math.floor(100000 + Math.random() * 900000)}`;
    const user = await UserModel.create({
      firstName,
      lastName: role === 'driver' ? 'Driver' : lastName,
      corporateEmail,
      universityId: `U${Math.floor(100000 + Math.random() * 899999)}`,
      phone,
      password: 'hashed-password',
      role
    });

    // Return an object that resembles a Mongoose document so tests can access
    // both `_id` (ObjectId) and `id` (string) depending on their expectations.
    return {
      _id: user._id,
      id: user._id.toString(),
      corporateEmail: user.corporateEmail,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName
    };
  }

  /**
   * Login user and get JWT token
   */
  async function loginUser(email, password = 'SecurePass123!') {
    const UserModel = require('../../src/infrastructure/database/models/UserModel');
    const AuthService = require('../../src/domain/services/AuthService');

    const user = await UserModel.findOne({ corporateEmail: email });
    if (!user) {
      throw new Error(`User not found: ${email}`);
    }

    const authService = new AuthService();
    // Sign a JWT matching our middleware expectations
    return authService.signAccessToken({
      sub: user._id.toString(),
      role: user.role,
      email: user.corporateEmail
    });
  }

  /**
   * Create a test vehicle in database
   */
  async function createTestVehicle(ownerId, plate, brand = 'Toyota', model = 'Corolla', year = 2022, capacity = 4) {
    const VehicleModel = require('../../src/infrastructure/database/models/VehicleModel');
  
    const vehicle = await VehicleModel.create({
      driverId: ownerId,
      brand,
      model,
      // year and color not in schema; ensure only schema fields are set
      plate,
      capacity
    });

    return vehicle._id.toString();
  }

  /**
   * Create a test trip in database
   */
  async function createTestTrip(driverIdOrOptions, vehicleId, options = {}) {
    const TripOfferModel = require('../../src/infrastructure/database/models/TripOfferModel');

    // Support two call styles:
    //  - createTestTrip(driverId, vehicleId, options)
    //  - createTestTrip({ driverId, vehicleId, origin, destination, ... })
    let driverId = driverIdOrOptions;
    if (typeof driverIdOrOptions === 'object' && driverIdOrOptions !== null && !driverIdOrOptions._bsontype) {
      // object style
      const obj = driverIdOrOptions;
      driverId = obj.driverId;
      vehicleId = obj.vehicleId;
      options = obj;
    }

    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Normalize origin/destination if provided as string
    let origin = options.origin;
    if (typeof origin === 'string') {
      origin = { text: origin, geo: { lat: 4.8611, lng: -74.0315 } };
    }
    if (!origin) {
      origin = { text: 'Universidad de La Sabana', geo: { lat: 4.8611, lng: -74.0315 } };
    }

    let destination = options.destination;
    if (typeof destination === 'string') {
      destination = { text: destination, geo: { lat: 4.6706, lng: -74.0554 } };
    }
    if (!destination) {
      destination = { text: 'Centro Comercial Andino', geo: { lat: 4.6706, lng: -74.0554 } };
    }

    // Ensure vehicleId exists: create a test vehicle for the driver if missing
    if (!vehicleId) {
      // createTestVehicle returns a string id
      vehicleId = await createTestVehicle(driverId, generateRandomPlate());
    }

    const trip = await TripOfferModel.create({
      driverId,
      vehicleId,
      origin,
      destination,
      departureAt: options.departureAt || tomorrow,
      estimatedArrivalAt: options.estimatedArrivalAt || new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000),
      pricePerSeat: options.pricePerSeat || 15000,
      totalSeats: options.totalSeats || 3,
      status: options.status || 'published',
      notes: options.notes || ''
    });

    return trip;
  }

  /**
   * Create a test booking request in database
   */
  async function createTestBookingRequest(passengerIdOrOptions, tripId, options = {}) {
    const BookingRequestModel = require('../../src/infrastructure/database/models/BookingRequestModel');

    // Support both styles: (passengerId, tripId, options) or ({ passengerId, tripId, seats, status })
    let passengerId = passengerIdOrOptions;
    if (typeof passengerIdOrOptions === 'object' && passengerIdOrOptions !== null && !passengerIdOrOptions._bsontype) {
      const obj = passengerIdOrOptions;
      passengerId = obj.passengerId;
      tripId = obj.tripId;
      options = obj;
    }

    const booking = await BookingRequestModel.create({
      passengerId,
      tripId,
      seats: options.seats || 1,
      note: options.note || '',
      status: options.status || 'pending'
    });

    return booking;
  }

  /**
   * Cleanup all test data
   */
  async function cleanupTestData() {
    const UserModel = require('../../src/infrastructure/database/models/UserModel');
    const VehicleModel = require('../../src/infrastructure/database/models/VehicleModel');
    const TripOfferModel = require('../../src/infrastructure/database/models/TripOfferModel');
    const BookingRequestModel = require('../../src/infrastructure/database/models/BookingRequestModel');
    const SeatLedgerModel = require('../../src/infrastructure/database/models/SeatLedgerModel');

    await BookingRequestModel.deleteMany({});
    await TripOfferModel.deleteMany({});
    await VehicleModel.deleteMany({});
    await UserModel.deleteMany({ corporateEmail: /@unisabana\.edu\.co/ });
    await SeatLedgerModel.deleteMany({});
    // Ensure payment-related collections are also cleaned between tests
    try {
      const TransactionModel = require('../../src/infrastructure/database/models/TransactionModel');
      await TransactionModel.deleteMany({});
    } catch (err) {
      // If the model doesn't exist or an error occurs, ignore for test cleanup
    }
  }

module.exports = {
  connectTestDB,
  disconnectTestDB,
  clearDatabase,
  createTestUser,
  loginUser,
  createTestVehicle,
  createTestTrip,
  createTestBookingRequest,
  // Backwards compatibility aliases expected by older tests
  createTestBooking: createTestBookingRequest,
  cleanupTestData,
  // Test helpers for auth & csrf used by integration tests
  generateAuthToken: function(user) {
    // AuthService.signAccessToken is synchronous in this codebase
    const AuthService = require('../../src/domain/services/AuthService');
    const authService = new AuthService();
    const payload = {
      sub: user.id || (user._id && user._id.toString()),
      role: user.role,
      email: user.corporateEmail
    };
    const token = authService.signAccessToken(payload);
    return { token };
  },
  generateCsrfToken: function() {
    const { generateCsrfToken } = require('../../src/utils/csrf');
    return generateCsrfToken();
  },
  generateRandomPlate,
  createTestImage,
  createLargeTestFile,
  cleanupTestFiles,
  countUploadedFiles,
  cleanupUploads
};

