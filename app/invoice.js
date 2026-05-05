// ============================================================
// INVOICE GENERATOR V4 — Enhanced with Saved Invoices Folder
// Adds: search, filter, status tags, at-a-glance library view
// Persists across sessions via localStorage
// ============================================================
(function() {
  "use strict";

  var STORAGE_KEY = 'gw_invoices';
  var savedInvoices = [];
  var invoiceStartNum = 1115;

  try { savedInvoices = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch(e) {}

  function saveToStorage() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(savedInvoices)); } catch(e) {}
  }

  // ---- INIT ----
  window.toggleWiringSection = function() {
    var toggle = document.getElementById('invWiringToggle');
    var section = document.getElementById('wiring-section');
    if (toggle && section) {
      section.style.display = toggle.checked ? 'block' : 'none';
    }
  };

  window.initInvoice = function() {
    autoInvoiceNumber();
    updateInvoiceDueDate();
    renderInvoiceItems();
    renderSavedInvoices();
  };

  // ---- AUTO INVOICE NUMBER ----
  function autoInvoiceNumber() {
    var el = document.getElementById('invNumber');
    if (!el || el.value) return;
    var maxNum = invoiceStartNum;
    savedInvoices.forEach(function(inv) {
      var n = parseInt((inv.number || '').replace(/[^0-9]/g, ''));
      if (n >= maxNum) maxNum = n + 1;
    });
    el.value = maxNum;
  }

  // ---- DUE DATE ----
  window.updateInvoiceDueDate = function() {
    var dateEl = document.getElementById('invDate');
    var termsEl = document.getElementById('invTerms');
    var dueEl = document.getElementById('invDueDate');
    if (!dateEl || !termsEl || !dueEl) return;
    var d = new Date(dateEl.value || new Date().toISOString().split('T')[0]);
    var days = parseInt(termsEl.value) || 30;
    d.setDate(d.getDate() + days);
    dueEl.value = d.toISOString().split('T')[0];
  };

  // ---- LINE ITEMS ----
  var invoiceItems = [{ desc: '', qty: 1, rate: '', amount: 0 }];

  window.renderInvoiceItems = function() {
    var container = document.getElementById('invItemRows');
    if (!container) return;
    container.innerHTML = '';
    var total = 0;

    invoiceItems.forEach(function(item, i) {
      item.amount = (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
      total += item.amount;
      var row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:3fr 0.7fr 1fr 1fr 40px;gap:8px;margin-bottom:6px;align-items:center';
      row.innerHTML =
        '<input value="' + (item.desc||'') + '" onchange="invoiceItems['+i+'].desc=this.value" placeholder="Description" style="background:var(--input-bg);border:1px solid var(--input-border);border-radius:6px;padding:8px;color:white;font-size:13px">' +
        '<input type="number" value="' + (item.qty||1) + '" onchange="invoiceItems['+i+'].qty=this.value;renderInvoiceItems()" style="background:var(--input-bg);border:1px solid var(--input-border);border-radius:6px;padding:8px;color:white;font-size:13px;text-align:center">' +
        '<input type="number" value="' + (item.rate||'') + '" onchange="invoiceItems['+i+'].rate=this.value;renderInvoiceItems()" placeholder="$0.00" style="background:var(--input-bg);border:1px solid var(--input-border);border-radius:6px;padding:8px;color:white;font-size:13px">' +
        '<div style="text-align:right;font-weight:600;color:var(--brand-cream);font-size:14px">$' + item.amount.toFixed(2) + '</div>' +
        '<button onclick="invoiceItems.splice('+i+',1);if(!invoiceItems.length)invoiceItems.push({desc:\'\',qty:1,rate:\'\',amount:0});renderInvoiceItems()" style="background:none;border:none;color:var(--brand-gray);cursor:pointer;font-size:16px">\u2715</button>';
      container.appendChild(row);
    });

    var totalEl = document.getElementById('invTotal');
    if (totalEl) totalEl.textContent = '$' + total.toFixed(2);
  };
  window.invoiceItems = invoiceItems;

  window.addInvoiceItem = function() {
    invoiceItems.push({ desc: '', qty: 1, rate: '', amount: 0 });
    renderInvoiceItems();
  };

  // ---- SAVE INVOICE ----
  window.saveInvoice = function() {
    var inv = gatherInvoiceData();
    // Check if updating existing
    var existingIdx = -1;
    savedInvoices.forEach(function(s, i) {
      if (s.number === inv.number) existingIdx = i;
    });
    if (existingIdx >= 0) {
      savedInvoices[existingIdx] = inv;
    } else {
      savedInvoices.push(inv);
    }
    saveToStorage();
    renderSavedInvoices();
    showGlobalStatus('Invoice #' + inv.number + ' saved');
  };

  function gatherInvoiceData() {
    var wiringEnabled = document.getElementById('invWiringToggle')?.checked || false;
    return {
      number: document.getElementById('invNumber')?.value || '',
      property: document.getElementById('invProperty')?.value || '',
      clientName: document.getElementById('invClientName')?.value || '',
      clientCompany: document.getElementById('invClientCompany')?.value || '',
      clientAddress: document.getElementById('invClientAddress')?.value || '',
      clientEmail: document.getElementById('invClientEmail')?.value || '',
      date: document.getElementById('invDate')?.value || '',
      dueDate: document.getElementById('invDueDate')?.value || '',
      terms: document.getElementById('invTerms')?.value || '30',
      jobType: document.getElementById('invJobType')?.value || '',
      notes: document.getElementById('invNotes')?.value || '',
      status: document.getElementById('invStatus')?.value || 'draft',
      items: JSON.parse(JSON.stringify(invoiceItems)),
      total: invoiceItems.reduce(function(s, i) { return s + ((parseFloat(i.qty)||0) * (parseFloat(i.rate)||0)); }, 0),
      savedAt: new Date().toISOString(),
      wiring: wiringEnabled ? {
        bank: document.getElementById('invWireBank')?.value || '',
        bankAddr: document.getElementById('invWireBankAddr')?.value || '',
        acctName: document.getElementById('invWireAcctName')?.value || '',
        acctNum: document.getElementById('invWireAcctNum')?.value || '',
        routing: document.getElementById('invWireRouting')?.value || '',
        notes: document.getElementById('invWireNotes')?.value || ''
      } : null
    };
  }

  // ---- LOAD INVOICE ----
  window.loadInvoice = function(idx) {
    if (idx < 0 || idx >= savedInvoices.length) return;
    var inv = savedInvoices[idx];
    var fields = {
      invNumber: inv.number,
      invProperty: inv.property,
      invClientName: inv.clientName,
      invClientCompany: inv.clientCompany,
      invClientAddress: inv.clientAddress,
      invClientEmail: inv.clientEmail,
      invDate: inv.date,
      invDueDate: inv.dueDate,
      invTerms: inv.terms,
      invJobType: inv.jobType,
      invNotes: inv.notes,
      invStatus: inv.status || 'draft'
    };
    Object.keys(fields).forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = fields[id] || '';
    });
    invoiceItems.length = 0;
    (inv.items || []).forEach(function(it) { invoiceItems.push(it); });
    if (invoiceItems.length === 0) invoiceItems.push({ desc: '', qty: 1, rate: '', amount: 0 });
    renderInvoiceItems();
    showGlobalStatus('Loaded invoice #' + inv.number);
  };

  // ---- DELETE INVOICE ----
  window.deleteInvoice = function(idx) {
    if (idx < 0 || idx >= savedInvoices.length) return;
    var num = savedInvoices[idx].number;
    savedInvoices.splice(idx, 1);
    saveToStorage();
    renderSavedInvoices();
    showGlobalStatus('Deleted invoice #' + num);
  };

  // ---- RENDER SAVED INVOICES LIBRARY ----
  window.renderSavedInvoices = function() {
    var container = document.getElementById('savedInvoicesList');
    if (!container) return;

    // Get filters
    var searchVal = (document.getElementById('invSearchInput')?.value || '').toLowerCase();
    var filterStatus = document.getElementById('invFilterStatus')?.value || 'all';

    var filtered = savedInvoices.filter(function(inv) {
      if (filterStatus !== 'all' && inv.status !== filterStatus) return false;
      if (searchVal) {
        var haystack = ((inv.property||'') + ' ' + (inv.clientName||'') + ' ' + (inv.number||'') + ' ' + (inv.jobType||'')).toLowerCase();
        return haystack.indexOf(searchVal) !== -1;
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--brand-gray);font-size:13px">' +
        (savedInvoices.length === 0 ? 'No saved invoices yet. Create and save your first invoice above.' : 'No invoices match your search/filter.') + '</div>';
      return;
    }

    // Sort by date descending
    filtered.sort(function(a, b) { return (b.savedAt || '').localeCompare(a.savedAt || ''); });

    container.innerHTML = '';

    // Table header
    var thead = document.createElement('div');
    thead.style.cssText = 'display:grid;grid-template-columns:60px 2fr 1.5fr 1fr 80px 80px 100px;gap:8px;padding:8px 12px;border-bottom:2px solid var(--brand-blue);font-size:11px;text-transform:uppercase;font-weight:600;color:var(--brand-blue);letter-spacing:0.5px';
    thead.innerHTML = '<div>#</div><div>Property</div><div>Job Type</div><div>Date</div><div>Total</div><div>Status</div><div>Actions</div>';
    container.appendChild(thead);

    filtered.forEach(function(inv) {
      var origIdx = savedInvoices.indexOf(inv);
      var statusColors = { draft: '#888', outstanding: '#FFC107', paid: '#4CAF50' };
      var statusLabels = { draft: 'Draft', outstanding: 'Outstanding', paid: 'Paid' };
      var st = inv.status || 'draft';
      var stColor = statusColors[st] || '#888';
      var stLabel = statusLabels[st] || st;
      var dateStr = inv.date ? new Date(inv.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '\u2014';

      var row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:60px 2fr 1.5fr 1fr 80px 80px 100px;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(162,182,192,0.12);align-items:center;font-size:13px;transition:background 0.15s';
      row.onmouseover = function() { this.style.background = 'rgba(162,182,192,0.06)'; };
      row.onmouseout = function() { this.style.background = 'none'; };
      row.innerHTML =
        '<div style="font-weight:600;color:var(--brand-cream)">' + (inv.number || '\u2014') + '</div>' +
        '<div style="color:white;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (inv.property || inv.clientName || 'Untitled') + '</div>' +
        '<div style="color:var(--brand-gray);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (inv.jobType || '\u2014') + '</div>' +
        '<div style="color:var(--brand-gray)">' + dateStr + '</div>' +
        '<div style="font-weight:600;color:var(--brand-cream)">$' + (inv.total || 0).toFixed(2) + '</div>' +
        '<div><span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:' + stColor + '20;color:' + stColor + '">' + stLabel + '</span></div>' +
        '<div style="display:flex;gap:4px">' +
          '<button onclick="loadInvoice('+origIdx+')" style="background:var(--input-bg);border:1px solid var(--input-border);border-radius:4px;padding:4px 8px;color:var(--brand-blue);cursor:pointer;font-size:11px">Open</button>' +
          '<button onclick="deleteInvoice('+origIdx+')" style="background:none;border:1px solid rgba(255,107,107,0.3);border-radius:4px;padding:4px 6px;color:#ff6b6b;cursor:pointer;font-size:11px">\u2715</button>' +
        '</div>';
      container.appendChild(row);
    });

    // Summary bar
    var totalAll = savedInvoices.reduce(function(s, i) { return s + (i.total || 0); }, 0);
    var outstandingTotal = savedInvoices.filter(function(i) { return i.status === 'outstanding'; }).reduce(function(s, i) { return s + (i.total || 0); }, 0);
    var paidTotal = savedInvoices.filter(function(i) { return i.status === 'paid'; }).reduce(function(s, i) { return s + (i.total || 0); }, 0);

    var summaryBar = document.createElement('div');
    summaryBar.style.cssText = 'display:flex;gap:20px;padding:12px;margin-top:8px;background:rgba(162,182,192,0.06);border-radius:8px;font-size:12px';
    summaryBar.innerHTML =
      '<div style="color:var(--brand-gray)">Total: <strong style="color:var(--brand-cream)">$' + totalAll.toFixed(2) + '</strong></div>' +
      '<div style="color:var(--brand-gray)">Outstanding: <strong style="color:#FFC107">$' + outstandingTotal.toFixed(2) + '</strong></div>' +
      '<div style="color:var(--brand-gray)">Paid: <strong style="color:#4CAF50">$' + paidTotal.toFixed(2) + '</strong></div>' +
      '<div style="color:var(--brand-gray)">' + savedInvoices.length + ' invoice' + (savedInvoices.length !== 1 ? 's' : '') + '</div>';
    container.appendChild(summaryBar);
  };

  // ---- PRINT/DOWNLOAD ----
  window.printInvoice = function() {
    var inv = gatherInvoiceData();
    var brandNavy = '#1E2F39';
    var brandBlue = '#A2B6C0';
    var brandCream = '#E4E3D4';

    var itemsHtml = '';
    inv.items.forEach(function(it) {
      var amt = ((parseFloat(it.qty)||0) * (parseFloat(it.rate)||0));
      itemsHtml += '<tr><td style="padding:10px 12px;border-bottom:1px solid #eee">' + (it.desc||'') + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:center">' + (it.qty||1) + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right">$' + (parseFloat(it.rate)||0).toFixed(2) + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600">$' + amt.toFixed(2) + '</td></tr>';
    });

    var html = '<!DOCTYPE html><html><head><title>Invoice #' + inv.number + '</title>' +
      '<style>@page{margin:0.5in}body{font-family:Montserrat,Arial,sans-serif;color:#333;margin:0;padding:40px}' +
      '.header{background:' + brandNavy + ';color:white;padding:30px;margin:-40px -40px 30px;display:flex;justify-content:space-between;align-items:center}' +
      '.header h1{margin:0;font-size:28px;letter-spacing:2px;font-family:Georgia,serif}' +
      '.header .inv-num{font-size:16px;color:' + brandBlue + '}' +
      'table{width:100%;border-collapse:collapse}th{text-align:left;padding:10px 12px;background:' + brandNavy + ';color:white;font-size:12px;text-transform:uppercase;letter-spacing:0.5px}' +
      '.total-row{font-size:18px;font-weight:700}.meta{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:30px}' +
      '.meta-section{font-size:13px;line-height:1.8}.label{font-weight:600;color:' + brandNavy + ';font-size:11px;text-transform:uppercase;letter-spacing:0.5px}</style></head><body>' +
      '<div class="header"><div><h1>GATEWAY</h1><div style="font-size:12px;margin-top:4px">Real Estate Advisors</div></div><div style="text-align:right"><div class="inv-num">INVOICE #' + inv.number + '</div><div style="font-size:13px;margin-top:4px;color:' + brandCream + '">' + (inv.date||'') + '</div></div></div>' +
      '<div class="meta"><div class="meta-section"><div class="label">Bill To</div>' +
      '<div style="font-weight:600;font-size:15px">' + (inv.clientName||'') + '</div>' +
      '<div>' + (inv.clientCompany||'') + '</div>' +
      '<div>' + (inv.clientAddress||'') + '</div>' +
      '<div>' + (inv.clientEmail||'') + '</div></div>' +
      '<div class="meta-section" style="text-align:right"><div class="label">Details</div>' +
      '<div><strong>Property:</strong> ' + (inv.property||'') + '</div>' +
      '<div><strong>Job Type:</strong> ' + (inv.jobType||'') + '</div>' +
      '<div><strong>Terms:</strong> Net ' + (inv.terms||30) + '</div>' +
      '<div><strong>Due Date:</strong> ' + (inv.dueDate||'') + '</div></div></div>' +
      '<table><thead><tr><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead><tbody>' +
      itemsHtml +
      '<tr class="total-row"><td colspan="3" style="padding:16px 12px;text-align:right;border-top:3px solid ' + brandNavy + '">TOTAL</td><td style="padding:16px 12px;text-align:right;border-top:3px solid ' + brandNavy + ';color:' + brandNavy + '">$' + inv.total.toFixed(2) + '</td></tr></tbody></table>' +
      (inv.notes ? '<div style="margin-top:30px;padding:16px;background:#f5f5f0;border-radius:8px;font-size:13px"><div class="label" style="margin-bottom:4px">Notes</div>' + inv.notes + '</div>' : '') +
      (inv.wiring ? '<div style="margin-top:24px;padding:20px;border:2px solid ' + brandNavy + ';border-radius:8px;font-size:13px">' +
        '<div style="font-family:Georgia,serif;font-size:16px;font-weight:700;color:' + brandNavy + ';letter-spacing:1px;margin-bottom:14px;text-align:center;border-bottom:1px solid #ccc;padding-bottom:10px">WIRING INSTRUCTIONS</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;line-height:2">' +
        '<div><span class="label">Bank Name: </span>' + (inv.wiring.bank||'') + '</div>' +
        '<div><span class="label">Bank Address: </span>' + (inv.wiring.bankAddr||'') + '</div>' +
        '<div><span class="label">Account Name: </span>' + (inv.wiring.acctName||'') + '</div>' +
        '<div><span class="label">Account Number: </span>' + (inv.wiring.acctNum||'') + '</div>' +
        '<div><span class="label">Routing Number: </span>' + (inv.wiring.routing||'') + '</div>' +
        (inv.wiring.notes ? '<div><span class="label">Notes: </span>' + inv.wiring.notes + '</div>' : '') +
        '</div></div>' : '') +
      '<div style="margin-top:40px;text-align:center;color:#999;font-size:11px;border-top:1px solid #eee;padding-top:16px">Gateway Real Estate Advisors \u2022 Sioux City, IA</div>' +
      '</body></html>';

    var w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    setTimeout(function() { w.print(); }, 500);
  };

  // Expose savedInvoices for tests
  window.savedInvoices = savedInvoices;

})();
