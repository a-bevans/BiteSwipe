// Configuration for different environments
const configs = {
  development: {
    apiUrl: 'http://localhost:3000',  // Local development
  },
  staging: {
    apiUrl: process.env.REACT_APP_API_URL || 'http://52.175.220.156',  // Current Azure VM
  },
  production: {
    apiUrl: 'https://api.biteswipe.com',  // Production URL (when you have one)
  }
};

// Default to development if not specified
const environment = process.env.REACT_APP_ENV || 'development';

export default configs[environment];
