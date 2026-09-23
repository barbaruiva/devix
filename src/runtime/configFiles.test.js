const fs = require('fs');
const os = require('os');
const path = require('path');
const { ensureConfigFiles } = require('./configFiles');

const repoRoot = path.resolve(__dirname, '..', '..');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'devix-config-'));
}

describe('ensureConfigFiles', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('seeds both files from the templates when missing', () => {
    const configDir = path.join(tempDir, 'nested', 'userData');
    const result = ensureConfigFiles(configDir, repoRoot);

    expect(result.configPath).toBe(path.join(configDir, 'config.json'));
    expect(result.proxiesPath).toBe(path.join(configDir, 'proxies.json'));
    expect(result.created).toEqual([result.configPath, result.proxiesPath]);
    expect(fs.readFileSync(result.configPath, 'utf8')).toBe(
      fs.readFileSync(path.join(repoRoot, 'config-template.json'), 'utf8'),
    );
    expect(fs.readFileSync(result.proxiesPath, 'utf8')).toBe(
      fs.readFileSync(path.join(repoRoot, 'proxies-template.json'), 'utf8'),
    );
  });

  test('never overwrites existing files', () => {
    const existing = '{"activeRoutes":{"/mine":"prod"}}\n';
    fs.writeFileSync(path.join(tempDir, 'config.json'), existing, 'utf8');

    const result = ensureConfigFiles(tempDir, repoRoot);

    expect(fs.readFileSync(result.configPath, 'utf8')).toBe(existing);
    expect(result.created).toEqual([result.proxiesPath]);
  });

  test('throws when a needed template is missing', () => {
    const emptyTemplates = makeTempDir();
    try {
      expect(() => ensureConfigFiles(tempDir, emptyTemplates)).toThrow(/config-template\.json/);
    } finally {
      fs.rmSync(emptyTemplates, { recursive: true, force: true });
    }
  });
});
