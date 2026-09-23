const fs = require('fs');
const path = require('path');

const CONFIG_FILES = [
  { name: 'config.json', template: 'config-template.json' },
  { name: 'proxies.json', template: 'proxies-template.json' },
];

// Makes sure config.json and proxies.json exist in configDir, seeding any
// missing one from its template in templatesDir. Existing files are never
// touched. Templates are read with readFileSync rather than copied so this
// also works when templatesDir lives inside Electron's read-only app.asar.
function ensureConfigFiles(configDir, templatesDir) {
  fs.mkdirSync(configDir, { recursive: true });

  const created = [];
  CONFIG_FILES.forEach(({ name, template }) => {
    const target = path.join(configDir, name);
    if (fs.existsSync(target)) {
      return;
    }

    const contents = fs.readFileSync(path.join(templatesDir, template), 'utf8');
    fs.writeFileSync(target, contents, 'utf8');
    created.push(target);
  });

  return {
    configPath: path.join(configDir, 'config.json'),
    proxiesPath: path.join(configDir, 'proxies.json'),
    created,
  };
}

module.exports = {
  ensureConfigFiles,
};
