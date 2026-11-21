/**
 * وحدة الطباعة الحرارية الصامتة ESC/POS — منصة مكن (Mken SaaS)
 * تدعم الاتصال المباشر بطابعات البلوتوث والـ Serial لطباعة فواتير ZATCA الحرارية (80mm/58mm).
 */
(function () {
  'use strict';

  var _bluetoothDevice = null;
  var _characteristic = null;

  // ESC/POS Command Constants
  var ESC = '\x1B';
  var GS = '\x1D';

  var CMD = {
    INIT: ESC + '@',
    ALIGN_LEFT: ESC + 'a' + '\x00',
    ALIGN_CENTER: ESC + 'a' + '\x01',
    ALIGN_RIGHT: ESC + 'a' + '\x02',
    BOLD_ON: ESC + 'E' + '\x01',
    BOLD_OFF: ESC + 'E' + '\x00',
    TEXT_NORMAL: ESC + '!' + '\x00',
    TEXT_DOUBLE_HEIGHT: ESC + '!' + '\x10',
    TEXT_DOUBLE_WIDTH: ESC + '!' + '\x20',
    TEXT_LARGE: ESC + '!' + '\x30',
    CUT_PAPER: GS + 'V' + '\x00',
  };

  /**
   * Encodes a string into Uint8Array for ESC/POS output
   */
  function encodeText(text) {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(text);
    }
    var buffer = new Uint8Array(text.length);
    for (var i = 0; i < text.length; i++) {
      buffer[i] = text.charCodeAt(i) & 0xff;
    }
    return buffer;
  }

  /**
   * Connect to thermal Bluetooth printer via WebBluetooth API
   */
  function connectBluetooth() {
    if (!navigator.bluetooth) {
      return Promise.reject(new Error('متصفحك لا يدعم خاصية WebBluetooth. يرجى استخدام متصفح Chrome أو Edge.'));
    }

    return navigator.bluetooth
      .requestDevice({
        acceptAllDevices: true,
        optionalServices: ['00001101-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455'],
      })
      .then(function (device) {
        _bluetoothDevice = device;
        return device.gatt.connect();
      })
      .then(function (server) {
        return server.getPrimaryServices();
      })
      .then(function (services) {
        if (!services || !services.length) throw new Error('لم يتم العثور على خدمات الطباعة في جهاز البلوتوث.');
        return services[0].getCharacteristics();
      })
      .then(function (characteristics) {
        if (!characteristics || !characteristics.length) throw new Error('لا توجد خصائص إرسال في طابعة البلوتوث.');
        _characteristic = characteristics[0];
        return _bluetoothDevice;
      });
  }

  /**
   * Formats a line with left label and right value aligned for 80mm paper (approx 32 chars)
   */
  function formatLine(left, right, width) {
    width = width || 32;
    var spaceCount = width - (left.length + right.length);
    if (spaceCount < 1) spaceCount = 1;
    var spaces = new Array(spaceCount + 1).join(' ');
    return left + spaces + right + '\n';
  }

  /**
   * Builds ESC/POS Receipt bytes for a given invoice object
   */
  function buildInvoiceReceipt(invoice, tenantInfo) {
    tenantInfo = tenantInfo || {};
    var storeName = tenantInfo.brandName || tenantInfo.siteTitle || 'منصة مكِّن';
    var vatNumber = tenantInfo.vatNumber || '300000000000003';

    var chunks = [];

    function add(str) {
      chunks.push(encodeText(str));
    }

    add(CMD.INIT);
    add(CMD.ALIGN_CENTER);
    add(CMD.BOLD_ON);
    add(CMD.TEXT_DOUBLE_HEIGHT);
    add(storeName + '\n');
    add(CMD.TEXT_NORMAL);
    add(CMD.BOLD_OFF);
    add('فاتورة ضريبية مبسطة\n');
    add('ZATCA Simplified Tax Invoice\n');
    add('الرقم الضريبي: ' + vatNumber + '\n');
    add('--------------------------------\n');

    add(CMD.ALIGN_LEFT);
    add('رقم الفاتورة: ' + (invoice.number || invoice.id || '') + '\n');
    add('التاريخ: ' + (invoice.createdAt || new Date().toISOString().slice(0, 10)) + '\n');
    if (invoice.customerName) {
      add('العميل: ' + invoice.customerName + '\n');
    }
    add('--------------------------------\n');

    // Header row
    add(formatLine('البند', 'السعر (ر.س)'));
    add('--------------------------------\n');

    var items = invoice.items || [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var name = (item.title || item.name || 'خدمة / منتج').slice(0, 18);
      var price = (Number(item.total || item.price || 0)).toFixed(2);
      add(formatLine(name, price));
    }

    add('--------------------------------\n');
    add(formatLine('المجموع الفرعي:', (Number(invoice.subtotal || invoice.total || 0)).toFixed(2)));

    if (invoice.discount) {
      add(formatLine('الخصم:', '-' + (Number(invoice.discount || 0)).toFixed(2)));
    }

    var taxVal = Number(invoice.tax || invoice.vat || (invoice.total ? invoice.total * 0.15 / 1.15 : 0)).toFixed(2);
    add(formatLine('ضريبة القيمة المضافة (15%):', taxVal));
    add(CMD.BOLD_ON);
    add(formatLine('الإجمالي النهائي:', (Number(invoice.total || 0)).toFixed(2)));
    add(CMD.BOLD_OFF);
    add('--------------------------------\n');

    add(CMD.ALIGN_CENTER);
    add('شكراً لتعاملكم معنا!\n');
    add('Powered by Mken SaaS — mken.sa\n\n\n');
    add(CMD.CUT_PAPER);

    // Merge Uint8Arrays
    var totalLength = chunks.reduce(function (acc, curr) { return acc + curr.length; }, 0);
    var merged = new Uint8Array(totalLength);
    var offset = 0;
    for (var j = 0; j < chunks.length; j++) {
      merged.set(chunks[j], offset);
      offset += chunks[j].length;
    }
    return merged;
  }

  /**
   * Builds ESC/POS Receipt bytes for a given POS Queue Ticket object
   */
  function buildQueueTicket(ticketData, tenantInfo) {
    tenantInfo = tenantInfo || {};
    ticketData = ticketData || {};
    var storeName = tenantInfo.brandName || tenantInfo.siteTitle || ticketData.branch_name || 'منصة مكِّن';

    var chunks = [];
    function add(str) {
      chunks.push(encodeText(str));
    }

    add(CMD.INIT);
    add(CMD.ALIGN_CENTER);
    add(CMD.BOLD_ON);
    add(storeName + '\n');
    add(CMD.BOLD_OFF);
    add('--------------------------------\n');
    add('رقمك في الطابور / Your Number\n');
    add(CMD.BOLD_ON);
    add(CMD.TEXT_LARGE);
    add('\n  ' + (ticketData.ticket_number || 'A-001') + '  \n\n');
    add(CMD.TEXT_NORMAL);
    add(CMD.BOLD_OFF);

    if (ticketData.queue_name) {
      add('(' + ticketData.queue_name + ')\n');
    }
    if (ticketData.table_number) {
      add('🪑 طاولة: ' + ticketData.table_number + '\n');
    }
    add('--------------------------------\n');

    // بنود الطلب
    var items = ticketData.items || [];
    if (items.length > 0) {
      add(CMD.ALIGN_LEFT);
      add(CMD.BOLD_ON);
      add('تفاصيل الطلب / Order Items:\n');
      add(CMD.BOLD_OFF);
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var itName = ((it.name || it.title || 'صنف') + ' x' + (it.qty || 1)).slice(0, 20);
        var itPrice = (Number((it.price || 0) * (it.qty || 1))).toFixed(2);
        add(formatLine(itName, itPrice));
      }
      add('--------------------------------\n');
    }

    if (ticketData.total !== undefined) {
      add(CMD.BOLD_ON);
      add(formatLine('الإجمالي:', Number(ticketData.total || 0).toFixed(2) + ' ر.س'));
      add(CMD.BOLD_OFF);
      add('--------------------------------\n');
    }

    if (ticketData.eta_minutes) {
      add(CMD.ALIGN_CENTER);
      add('وقت الانتظار المتوقع: ~' + ticketData.eta_minutes + ' دقيقة\n');
    }

    var now = new Date();
    var timeStr = now.toLocaleDateString('ar-SA') + ' ' + now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    add(timeStr + '\n');

    if (ticketData.session_token) {
      add('لمتابعة دورك عبر الجوال:\n');
      add('mken.live/q/' + ticketData.ticket_number + '\n');
    }

    add('\nشكراً لاختياركم لنا!\n\n\n');
    add(CMD.CUT_PAPER);

    var totalLength = chunks.reduce(function (acc, curr) { return acc + curr.length; }, 0);
    var merged = new Uint8Array(totalLength);
    var offset = 0;
    for (var j = 0; j < chunks.length; j++) {
      merged.set(chunks[j], offset);
      offset += chunks[j].length;
    }
    return merged;
  }

  /**
   * Print queue ticket via Bluetooth printer or reject with connection error
   */
  function printQueueTicket(ticketData, tenantInfo) {
    var rawBytes = buildQueueTicket(ticketData, tenantInfo);

    if (_characteristic && _bluetoothDevice && _bluetoothDevice.gatt.connected) {
      return _characteristic.writeValue(rawBytes);
    }

    return connectBluetooth().then(function () {
      if (_characteristic) {
        return _characteristic.writeValue(rawBytes);
      }
      throw new Error('لم يتم الاتصال بالطابعة الحرارية.');
    });
  }

  /**
   * Builds ESC/POS Receipt bytes for ZATCA Tax Invoice linked with Queue Ticket
   */
  function buildZatcaTicketInvoice(invoiceData, tenantInfo) {
    tenantInfo = tenantInfo || {};
    invoiceData = invoiceData || {};
    var storeName = tenantInfo.brandName || tenantInfo.siteTitle || invoiceData.seller_name || 'منصة مكِّن';
    var vatNumber = tenantInfo.vatNumber || invoiceData.vat_number || '300000000000003';

    var chunks = [];
    function add(str) {
      chunks.push(encodeText(str));
    }

    add(CMD.INIT);
    add(CMD.ALIGN_CENTER);
    add(CMD.BOLD_ON);
    add(CMD.TEXT_DOUBLE_HEIGHT);
    add(storeName + '\n');
    add(CMD.TEXT_NORMAL);
    add(CMD.BOLD_OFF);
    add('فاتورة ضريبية مبسطة\n');
    add('Simplified Tax Invoice (ZATCA)\n');
    add('الرقم الضريبي: ' + vatNumber + '\n');
    add('--------------------------------\n');

    add(CMD.ALIGN_LEFT);
    add('رقم الفاتورة: ' + (invoiceData.invoice_ref || invoiceData.invoiceNumber || 'INV-001') + '\n');
    add(CMD.BOLD_ON);
    add('رقم الطلب / الطابور: ' + (invoiceData.ticket_number || '---') + '\n');
    add(CMD.BOLD_OFF);
    if (invoiceData.table_number) {
      add('طاولة رقم: ' + invoiceData.table_number + '\n');
    }
    var now = invoiceData.timestamp ? new Date(invoiceData.timestamp) : new Date();
    add('التاريخ: ' + now.toLocaleDateString('ar-SA') + ' ' + now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) + '\n');
    add('طريقة الدفع: ' + (invoiceData.payment_method === 'cash' ? 'نقداً (Cash)' : (invoiceData.payment_method === 'card' ? 'بطاقة مدى / فيزا' : (invoiceData.payment_method || 'مدى'))) + '\n');
    add('--------------------------------\n');

    // Header row
    add(formatLine('البند', 'السعر (ر.س)'));
    add('--------------------------------\n');

    var items = invoiceData.items || [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var name = ((item.title || item.name || 'صنف') + ' x' + (item.qty || item.quantity || 1)).slice(0, 18);
      var price = (Number((item.price || item.total || 0) * (item.qty || 1))).toFixed(2);
      add(formatLine(name, price));
    }

    add('--------------------------------\n');
    var subtotal = Number(invoiceData.subtotal || (invoiceData.total ? invoiceData.total / 1.15 : 0)).toFixed(2);
    var taxVal = Number(invoiceData.tax || invoiceData.tax_amount || (invoiceData.total ? invoiceData.total - subtotal : 0)).toFixed(2);
    var totalVal = Number(invoiceData.total || invoiceData.total_amount || 0).toFixed(2);

    add(formatLine('المجموع الخاضع للضريبة:', subtotal));
    add(formatLine('ضريبة القيمة المضافة (15%):', taxVal));
    add(CMD.BOLD_ON);
    add(CMD.TEXT_DOUBLE_HEIGHT);
    add(formatLine('الإجمالي النهائي:', totalVal + ' ر.س'));
    add(CMD.TEXT_NORMAL);
    add(CMD.BOLD_OFF);
    add('--------------------------------\n');

    if (invoiceData.zatca_qr) {
      add(CMD.ALIGN_CENTER);
      add('[ رمز الفاتورة المشفر المعتمد ZATCA QR ]\n');
      add((invoiceData.zatca_qr.slice(0, 32)) + '...\n');
    }

    add(CMD.ALIGN_CENTER);
    add('\nشكراً لزيارتكم!\n');
    add('Powered by Mken SaaS — mken.live\n\n\n');
    add(CMD.CUT_PAPER);

    var totalLength = chunks.reduce(function (acc, curr) { return acc + curr.length; }, 0);
    var merged = new Uint8Array(totalLength);
    var offset = 0;
    for (var j = 0; j < chunks.length; j++) {
      merged.set(chunks[j], offset);
      offset += chunks[j].length;
    }
    return merged;
  }

  /**
   * Print ZATCA Ticket Invoice silently via connected Bluetooth printer
   */
  function printZatcaTicketInvoice(invoiceData, tenantInfo) {
    var rawBytes = buildZatcaTicketInvoice(invoiceData, tenantInfo);

    if (_characteristic && _bluetoothDevice && _bluetoothDevice.gatt.connected) {
      return _characteristic.writeValue(rawBytes);
    }

    return connectBluetooth().then(function () {
      if (_characteristic) {
        return _characteristic.writeValue(rawBytes);
      }
      throw new Error('لم يتم الاتصال بالطابعة الحرارية.');
    });
  }

  /**
   * Print invoice silently via connected Bluetooth characteristic or web print fallback
   */
  function printInvoice(invoice, tenantInfo) {
    var rawBytes = buildInvoiceReceipt(invoice, tenantInfo);

    if (_characteristic && _bluetoothDevice && _bluetoothDevice.gatt.connected) {
      return _characteristic.writeValue(rawBytes);
    }

    // Fallback: Connect via Bluetooth then write
    return connectBluetooth().then(function () {
      if (_characteristic) {
        return _characteristic.writeValue(rawBytes);
      }
      throw new Error('لم يتم الاتصال بالطابعة الحرارية.');
    });
  }

  window.MkenEscPosPrinter = {
    connectBluetooth: connectBluetooth,
    buildInvoiceReceipt: buildInvoiceReceipt,
    printInvoice: printInvoice,
    buildQueueTicket: buildQueueTicket,
    printQueueTicket: printQueueTicket,
    buildZatcaTicketInvoice: buildZatcaTicketInvoice,
    printZatcaTicketInvoice: printZatcaTicketInvoice,
    isConnected: function () {
      return !!(_bluetoothDevice && _bluetoothDevice.gatt && _bluetoothDevice.gatt.connected);
    },
  };
})();
