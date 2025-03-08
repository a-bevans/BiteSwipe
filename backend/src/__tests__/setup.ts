import { config } from 'dotenv';
import path from 'path';

// Load test environment variables
config({ path: path.join(__dirname, 'test.env') });

// Mock mongoose
const mockSchema = {
  add: jest.fn(),
  index: jest.fn()
};

const mockSchemaType = {
  ObjectId: String
};

jest.mock('mongoose', () => {
  return {
    connect: jest.fn().mockResolvedValue({}),
    model: jest.fn().mockReturnValue({
      findById: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn()
    }),
    Schema: Object.assign(
      jest.fn().mockImplementation(() => mockSchema),
      { Types: mockSchemaType }
    )
  };
});

// Mock external services
jest.mock('../services/externalAPIs/googleMaps', () => ({
  GooglePlacesService: jest.fn().mockImplementation(() => ({
    searchNearby: jest.fn().mockResolvedValue([]),
    getPlaceDetails: jest.fn().mockResolvedValue({})
  }))
}));

jest.mock('../config/firebase', () => ({
  firebaseAdmin: {
    messaging: () => ({
      send: jest.fn().mockResolvedValue('message-id')
    })
  }
}));

// Mock singleton services
const mockRestaurantService = {
  getRestaurants: jest.fn()
};

const mockUserService = {
  getUserById: jest.fn(),
  createUser: jest.fn(),
  getUserByEmail: jest.fn()
};

const mockSessionManager = {
  createSession: jest.fn(),
  getSession: jest.fn(),
  sessionSwiped: jest.fn()
};

// Create mock implementations
jest.mock('../services/userService', () => ({
  UserService: jest.fn().mockImplementation(() => mockUserService)
}));

jest.mock('../services/sessionManager', () => ({
  SessionManager: jest.fn().mockImplementation(() => mockSessionManager)
}));

jest.mock('../services/restaurantService', () => ({
  RestaurantService: jest.fn().mockImplementation(() => mockRestaurantService)
}));

// Export mocks for use in tests
export {
  mockUserService,
  mockSessionManager,
  mockRestaurantService
};
