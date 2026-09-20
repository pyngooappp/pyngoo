const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (file.endsWith('.swift')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let updated = content.replace(/call\.reject\(([^,\)]+)\)/g, 'call.reject($1, nil, nil, nil)');
      if (content !== updated) {
        fs.writeFileSync(fullPath, updated, 'utf8');
        console.log('Patched:', fullPath);
      }
    }
  }
}

const targetDir = path.join(__dirname, '..', 'node_modules', '@capacitor-community', 'admob', 'ios', 'Sources', 'AdMobPlugin');
if (fs.existsSync(targetDir)) {
  processDir(targetDir);
}
