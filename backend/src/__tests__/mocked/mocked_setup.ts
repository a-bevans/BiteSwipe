import { config } from "dotenv";
import path from "path";
// Import auth middleware mock
import './auth_middleware_mock';
// Load test environment variables
config({ path: path.join(__dirname, "test.env") });

// Set environment variables for test mode
process.env.NODE_ENV = 'test';
process.env.TEST_TYPE = 'mocked';



// ---------------------------------------------------------
// Mongoose
//
const mockSchema = {
  add: jest.fn(),
  index: jest.fn(),
};

const mockSchemaType = {
  ObjectId: String,
};

jest.mock("mongoose", () => {
  class ObjectId {
    private str: string;

    constructor(str: string) {
      this.str = str;
    }

    toString() {
      return this.str;
    }

    toJSON() {
      return this.str;
    }

    equals(other: unknown) {
      return other?.toString() === this.str;
    }

    static isValid = jest.fn().mockImplementation((str: string) => {
      return str !== "invalid-id";
    });
  }

  return {
    ...jest.requireActual("mongoose"),
    connect: jest.fn().mockResolvedValue({}),
    model: jest.fn().mockImplementation(() => {
      // Default model mock for other models
      return {
        findById: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
      };
    }),
    Schema: Object.assign(
      jest.fn().mockImplementation(() => mockSchema),
      { Types: mockSchemaType }
    ),
    Types: {
      ObjectId,
    },
  };
});

// ---------------------------------------------------------
// Google Maps
//
const mockGooglePlacesService = {
  searchNearby: jest.fn().mockResolvedValue([]),
  getPlaceDetails: jest.fn().mockResolvedValue({}),
  apiKey: "mock-api-key",
  baseUrl: "https://maps.googleapis.com/maps/api/place",
  getPhotoUrl: jest.fn().mockImplementation((photoReference, maxWidth) => {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=mock-api-key`;
  }),
};

jest.mock("../../services/externalAPIs/googleMaps", () => ({
  GooglePlacesService: jest
    .fn()
    .mockImplementation(() => mockGooglePlacesService),
}));

// ---------------------------------------------------------
// Firebase
//
// jest.mock("firebase-admin", () => ({
//   messaging: jest.fn().mockReturnValue({
//     send: jest.fn().mockResolvedValue("message-id"),
//   }),
//   initializeApp: jest.fn(),
// }));

// jest.mock("../../config/firebase", () => ({
//   default: {
//     apps: [],
//     messaging: jest.fn().mockReturnValue({
//       send: jest.fn().mockResolvedValue("mock-message-id"),
//     }),
//   },
//   getMessaging: jest.fn().mockReturnValue({
//     send: jest.fn().mockResolvedValue("mock-message-id"),
//     sendMulticast: jest.fn().mockResolvedValue({ responses: [{ success: true }] })
//   }),
// }));


// Export mocks
//
export { mockGooglePlacesService };
