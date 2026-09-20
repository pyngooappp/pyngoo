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
      let original = content;

      // Patch call.reject("msg") -> call.reject("msg", nil, nil, nil)
      content = content.replace(/call\.reject\(([^,\)]+)\)/g, (match, p1) => {
        return `call.reject(${p1}, nil, nil, nil)`;
      });

      // Patch call.getString("key") -> call.getString("key", nil)
      content = content.replace(/call\.getString\(([^,\)]+)\)/g, (match, p1) => {
        return `call.getString(${p1}, nil)`;
      });

      // Patch call.getBool("key") -> call.getBool("key", nil)
      content = content.replace(/call\.getBool\(([^,\)]+)\)/g, (match, p1) => {
        return `call.getBool(${p1}, nil)`;
      });

      // Patch call.getInt("key") -> call.getInt("key", nil)
      content = content.replace(/call\.getInt\(([^,\)]+)\)/g, (match, p1) => {
        return `call.getInt(${p1}, nil)`;
      });

      // Patch call.getFloat("key") -> call.getFloat("key", nil)
      content = content.replace(/call\.getFloat\(([^,\)]+)\)/g, (match, p1) => {
        return `call.getFloat(${p1}, nil)`;
      });

      // Patch call.getObject("key") -> call.getObject("key", nil)
      content = content.replace(/call\.getObject\(([^,\)]+)\)/g, (match, p1) => {
        return `call.getObject(${p1}, nil)`;
      });

      // Patch call.getArray("key") -> call.getArray("key", nil)
      content = content.replace(/call\.getArray\(([^,\)]+)\)/g, (match, p1) => {
        return `call.getArray(${p1}, nil)`;
      });

      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log('Patched:', path.relative(__dirname, fullPath));
      }
    }
  }
}

const targetDir = path.join(__dirname, '..', 'node_modules', '@capacitor-community', 'admob', 'ios', 'Sources', 'AdMobPlugin');
if (fs.existsSync(targetDir)) {
  processDir(targetDir);
} else {
  console.log('Target directory not found:', targetDir);
}
