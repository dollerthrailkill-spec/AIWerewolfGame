const fs = require('fs');
const code = fs.readFileSync('./static/app.js', 'utf8');
const lines = code.split('\n');

// 检查第 115 行
const line115 = lines[114];
console.log('Line 115 raw:', line115);

// 查找包含 "BGM" 的行
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('BGM') && lines[i].includes('catch')) {
        console.log(`Line ${i + 1}:`, lines[i]);
        console.log(`  Contains Chinese:`, /[\u4e00-\u9fa5]/.test(lines[i]));
    }
}
