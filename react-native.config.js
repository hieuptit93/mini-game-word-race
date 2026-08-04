let repackCommands = [];

try {
  // Re.Pack v5 uses rspack commands
  repackCommands = require('@callstack/repack/commands/rspack');
} catch (e) {
  // Re.Pack not installed yet - will be available after npm install
}

module.exports = {
  commands: repackCommands,
};
