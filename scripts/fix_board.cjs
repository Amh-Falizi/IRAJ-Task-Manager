const fs = require('fs');
const file = 'src/pages/Board.tsx';
let content = fs.readFileSync(file, 'utf-8');

// The hack was:
/*
                        const target = e.currentTarget as HTMLElement;
                        const clone = target.cloneNode(true) as HTMLElement;
                        clone.style.position = 'absolute';
                        clone.style.top = '-1000px';
                        clone.style.left = '-1000px';
                        clone.style.boxShadow = '0 8px 16px rgba(0,0,0,0.15)';
                        clone.style.opacity = '1';
                        clone.style.backgroundColor = getComputedStyle(target).backgroundColor;
                        clone.style.border = getComputedStyle(target).border;
                        clone.style.borderRadius = getComputedStyle(target).borderRadius;
                        clone.style.padding = getComputedStyle(target).padding;
                        clone.style.width = target.offsetWidth + 'px';
                        document.body.appendChild(clone);
                        e.dataTransfer.setDragImage(clone, 20, 20);
                        setTimeout(() => { if (document.body.contains(clone)) document.body.removeChild(clone); }, 0);
*/
// Let's just remove it automatically using regex.

content = content.replace(/ *const target = e\.currentTarget as HTMLElement;[\s\S]*?setTimeout\(\(\) => \{ if \(document\.body\.contains\(clone\)\) document\.body\.removeChild\(clone\); \}, 0\);/g, '');

fs.writeFileSync(file, content);
