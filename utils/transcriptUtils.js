/**
 * Utility functions for transcript formatting
 */

function generateCSV(transcripts) {
  // Add CSV Header
  let csv = 'Speaker,Text,Timestamp\n';
  
  transcripts.forEach(t => {
    // Escape double quotes by doubling them to maintain valid CSV syntax
    const text = (t.text || '').replace(/"/g, '""');
    const speaker = (t.speaker || 'Unknown').replace(/"/g, '""');
    
    csv += `"${speaker}","${text}","${t.timestamp}"\n`;
  });
  
  return csv;
}

function generateTXT(transcripts) {
  return transcripts
    .map(t => `[${t.timestamp}] ${t.speaker}: ${t.text}`)
    .join('\n');
}

// Export the functions so they can be required elsewhere
module.exports = {
  generateCSV,
  generateTXT
};