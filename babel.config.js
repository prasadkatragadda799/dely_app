const path = require('path');

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module:react-native-dotenv',
      {
        // Relative ".env" breaks when Metro’s cwd ≠ project root; pin to this file’s directory.
        path: path.resolve(__dirname, '.env'),
        allowUndefined: true,
      },
    ],
  ],
};
