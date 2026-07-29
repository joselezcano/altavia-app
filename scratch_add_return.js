const fs = require('fs');
const file = 'src/app/(admin)/templates/add.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/<TextInput/g, '<TextInput returnKeyType="done"');
fs.writeFileSync(file, content);
