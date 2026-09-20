const fs = require('fs');
const path = require('path');

function processDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (file.endsWith('.swift')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let original = content;

      // 1. Fix call.reject(...) calls to pass explicit empty dictionary for 4th parameter [String: Any]
      // Matches call.reject(...) with 1 argument or previous broken patches
      content = content.replace(/call\.reject\(([^\)]+)\)/g, (match, p1) => {
        // Extract first string parameter
        const firstArgMatch = p1.match(/^\s*("[^"]+"|\w+)/);
        if (firstArgMatch) {
          const msg = firstArgMatch[1];
          return `call.reject(${msg}, nil, nil, [:])`;
        }
        return match;
      });

      // 2. Fix call.getString("key") calls where 2nd argument is required by JSTypes in Capacitor 8
      content = content.replace(/call\.getString\(([^,\)]+)\)/g, (match, p1) => {
        return `call.getString(${p1}, "")`;
      });

      // 3. Fix call.getBool("key") calls
      content = content.replace(/call\.getBool\(([^,\)]+)\)/g, (match, p1) => {
        return `call.getBool(${p1}, false)`;
      });

      // 4. Fix call.getInt("key") calls
      content = content.replace(/call\.getInt\(([^,\)]+)\)/g, (match, p1) => {
        return `call.getInt(${p1}, 0)`;
      });

      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Patched:', path.relative(__dirname, fullPath));
      }
    }
  }
}

// Clean unpack of admob files first
const targetDir = path.join(__dirname, '..', 'node_modules', '@capacitor-community', 'admob');
if (fs.existsSync(targetDir)) {
  processDir(targetDir);
}
const iosDir = path.join(__dirname, '..', 'ios');
if (fs.existsSync(iosDir)) {
  processDir(iosDir);
}
