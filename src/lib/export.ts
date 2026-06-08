export function exportToCSV(filename: string, data: any[]) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        let cell = row[header] === null || row[header] === undefined ? '' : row[header];
        if (typeof cell === 'object') cell = JSON.stringify(cell);
        
        // Escape quotes
        const cellString = String(cell).replace(/"/g, '""');
        return `"${cellString}"`;
      }).join(',')
    )
  ].join('\n');

  downloadFile(`${filename}.csv`, 'text/csv;charset=utf-8;', csvContent);
}

export function exportToJSON(filename: string, data: any) {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(`${filename}.json`, 'application/json;charset=utf-8;', jsonContent);
}

function downloadFile(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('url');
  if ((window.navigator as any).msSaveOrOpenBlob) {
    (window.navigator as any).msSaveOrOpenBlob(blob, filename);
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 0);
  }
}
