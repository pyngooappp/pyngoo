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

      // 1. Fix call.reject(...) calls to pass explicit typed nil for ambiguous Swift 5 overloads
      content = content.replace(/call\.reject\(([^,\)]+)\)/g, (match, p1) => {
        if (p1.includes('nil as String?')) return match;
        return `call.reject(${p1}, nil as String?, nil as Error?, nil)`;
      });

      // 2. Fix call.getString("key") calls where 2nd argument is required by JSTypes in Capacitor 8
      content = content.replace(/call\.getString\(([^,\)]+)\)/g, (match, p1) => {
        if (p1.includes(',')) return match;
        return `call.getString(${p1}, "")`;
      });

      // 3. Fix call.getBool("key") calls
      content = content.replace(/call\.getBool\(([^,\)]+)\)/g, (match, p1) => {
        if (p1.includes(',')) return match;
        return `call.getBool(${p1}, false)`;
      });

      // 4. Fix call.getInt("key") calls
      content = content.replace(/call\.getInt\(([^,\)]+)\)/g, (match, p1) => {
        if (p1.includes(',')) return match;
        return `call.getInt(${p1}, 0)`;
      });

      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Patched:', path.relative(__dirname, fullPath));
      }
    }
  }
}

const targets = [
  path.join(__dirname, '..', 'node_modules', '@capacitor-community', 'admob'),
  path.join(__dirname, '..', 'ios')
];

targets.forEach(processDir);
