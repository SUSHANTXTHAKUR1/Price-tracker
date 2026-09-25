import { supabase } from '../config/supabase.js';
import { memStore } from './productController.js';

/**
 * Generates and downloads a CSV of the complete scrape history matching PDF section 4.2:
 * Columns: store_product_id, product_name, selected_option, timestamp (ISO 8601 UTC), price, stock, outcome
 * Failed attempts included with price and stock left empty.
 */
export async function exportScrapeHistoryCsv(req, res) {
  try {
    let logs = [];

    if (supabase) {
      const { data, error } = await supabase
        .from('scrape_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;
      logs = data || [];
    } else {
      logs = memStore.logs.slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    // CSV Header row
    const headers = [
      'store_product_id',
      'product_name',
      'selected_option',
      'timestamp',
      'price',
      'stock',
      'outcome'
    ];

    // Build CSV rows
    const rows = logs.map(log => {
      const escapeCsv = (val) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      return [
        escapeCsv(log.store_product_id),
        escapeCsv(log.product_name),
        escapeCsv(log.selected_option),
        escapeCsv(log.timestamp),
        log.price !== null && log.price !== undefined ? log.price : '',
        log.stock !== null && log.stock !== undefined ? log.stock : '',
        escapeCsv(log.outcome)
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');

    const filename = `scrape_history_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csvContent);

  } catch (err) {
    console.error('Error generating CSV export:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}
