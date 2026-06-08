const fs = require('fs');
const file = 'src/pages/CalendarView.tsx';
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(
  '                          onClick={(e) => {\n                            e.stopPropagation();\n                            setSelectedTask(task);\n                            setIsModalOpen(true);\n                          }}\n                          className={cn(\n                            "text-xs px-2 py-1.5 rounded cursor-pointer truncate transition-all border",',
  '                          onDragEnd={handleDragEnd}\n                          onClick={(e) => {\n                            e.stopPropagation();\n                            setSelectedTask(task);\n                            setIsModalOpen(true);\n                          }}\n                          className={cn(\n                            "text-xs px-2 py-1.5 rounded cursor-pointer truncate transition-all border",\n                            draggingTaskId === task.id && "opacity-40",'
);

fs.writeFileSync(file, content);
