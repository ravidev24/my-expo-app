// Controller for parsing handwritten receipts, paper chits, and bill text
const parseBillText = (text) => {
  if (!text || typeof text !== 'string') return [];

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const parsedItems = [];

  // Patterns to match:
  // "Rice 5kg 90"
  // "Sugar 2 kg @ 45 = 90"
  // "Coconut 3 pcs 35"
  // "1. Milk 2pkt 60"
  // "Atta 10kg Rs. 420"
  const lineRegex = /(?:^\d+[\.\)]\s*)?([A-Za-z\s]+?)\s*(?:[-:])?\s*(\d+(?:\.\d+)?)\s*(kg|g|l|ml|pcs|pkt|packet|box|dozen|bag|bottle|nos|can)?\s*(?:[@xX*]\s*)?(?:rs\.?|₹)?\s*(\d+(?:\.\d+)?)(?:\s*=?\s*(?:rs\.?|₹)?\s*(\d+(?:\.\d+)?))?/i;

  for (const line of lines) {
    const match = line.match(lineRegex);
    if (match) {
      const name = match[1].trim();
      const qty = parseFloat(match[2]) || 1;
      const unit = (match[3] || 'pcs').toLowerCase();
      let price = parseFloat(match[4]) || 0;
      let amount = parseFloat(match[5]) || Math.round(qty * price * 100) / 100;

      // Skip common non-item lines like "Total", "Subtotal", "Date", "Bill No"
      if (/^(total|subtotal|tax|discount|cash|balance|paid|thank|invoice|bill)/i.test(name)) {
        continue;
      }

      if (name.length >= 2 && (price > 0 || amount > 0)) {
        if (price === 0 && amount > 0) {
          price = Math.round((amount / qty) * 100) / 100;
        }
        parsedItems.push({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          quantity: qty,
          unit: unit === 'pkt' ? 'packet' : unit,
          unitPrice: price,
          amount,
        });
      }
    }
  }

  return parsedItems;
};

// @desc    Parse bill / paper chit image or OCR text
// @route   POST /api/ocr/parse-bill
// @access  Private (Shop Owner / System Admin)
const parseBill = async (req, res, next) => {
  try {
    const { rawText, sampleType } = req.body;

    let textToParse = rawText || '';

    // If sample requested for quick demo
    if (!textToParse && sampleType === 'groceries') {
      textToParse = `
1. Basmati Rice 5 kg @ 90 = 450
2. Sugar 2kg 45 = 90
3. Sunflower Oil 2L 150 = 300
4. Toor Dal 1kg 135
5. Soap 4pcs 35 = 140
      `;
    }

    const items = parseBillText(textToParse);
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);

    res.json({
      success: true,
      rawText: textToParse,
      itemCount: items.length,
      items,
      subtotal: Math.round(subtotal * 100) / 100,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { parseBill };
