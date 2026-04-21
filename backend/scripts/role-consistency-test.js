/**
 * Role Consistency Test
 * ─────────────────────
 * Verifies that admin and salesperson see consistent shared data,
 * sensitive fields are stripped on the backend, and all authorization
 * boundaries enforce the correct HTTP status codes.
 *
 * Uses the DEV database (MONGO_URI from .env).
 * All test data uses the prefix "testcheck-" and is deleted when done.
 *
 * Prerequisites: Backend server must be running on port 5000.
 *   cd backend && npm run dev
 *
 * Usage:
 *   node scripts/role-consistency-test.js          # run + clean up
 *   node scripts/role-consistency-test.js --keep   # run, leave test data in DB
 */

'use strict';

const http = require('http');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const User     = require('../models/User');
const Laptop   = require('../models/Laptop');
const Sale     = require('../models/Sale');
const Customer = require('../models/Customer');

const KEEP = process.argv.includes('--keep');

// ── ANSI helpers ─────────────────────────────────────────────────────────────
const G = (s) => `\x1b[32m${s}\x1b[0m`;
const R = (s) => `\x1b[31m${s}\x1b[0m`;
const Y = (s) => `\x1b[33m${s}\x1b[0m`;
const C = (s) => `\x1b[36m${s}\x1b[0m`;
const B = (s) => `\x1b[1m${s}\x1b[0m`;
const D = (s) => `\x1b[2m${s}\x1b[0m`;

// ── HTTP helper (built-in http module, no extra deps) ────────────────────────
function call(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const bodyStr = body != null ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: 5000,
      path: `/api${path}`,
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        ...(cookie && { Cookie: cookie }),
        ...(bodyStr && { 'Content-Length': Buffer.byteLength(bodyStr) }),
      },
    };
    const req = http.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        const setCookie = [].concat(res.headers['set-cookie'] || []);
        const tokenCookie = setCookie.find((c) => c.startsWith('token='));
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        resolve({ status: res.statusCode, cookie: tokenCookie ? tokenCookie.split(';')[0] : null, body: parsed });
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// Per-role client
function client(cookie) {
  return {
    get:    (path)        => call('GET',    path, null,  cookie),
    post:   (path, body)  => call('POST',   path, body,  cookie),
    patch:  (path, body)  => call('PATCH',  path, body,  cookie),
    delete: (path)        => call('DELETE', path, null,  cookie),
  };
}

// ── Result tracker ───────────────────────────────────────────────────────────
const results = [];

function assert(id, condition, note = '') {
  const pass = !!condition;
  const sym  = pass ? G('✓ PASS') : R('✗ FAIL');
  console.log(`  ${sym}  ${id.padEnd(5)} ${note ? D(note) : ''}`);
  results.push({ id, pass, note });
  return pass;
}

function skip(id, reason = '') {
  console.log(`  ${D('○ SKIP')}  ${id.padEnd(5)} ${D(reason)}`);
  results.push({ id, pass: null, note: reason });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(B('\n╔══════════════════════════════════════════════════╗'));
  console.log(B('║   Role Consistency Test — Laptop Shop System     ║'));
  console.log(B('╚══════════════════════════════════════════════════╝\n'));

  // Check server
  try {
    const r = await call('GET', '/health', null, null);
    if (r.status !== 200) throw new Error();
    console.log(G('  Backend server reachable ✓\n'));
  } catch {
    console.error(R('  ERROR: Backend not running on port 5000.\n  Run: cd backend && npm run dev\n'));
    process.exitCode = 1; return;
  }

  await mongoose.connect(process.env.MONGO_URI);

  // ── Test users ────────────────────────────────────────────────────────────
  const ADMIN_EMAIL = 'testadmin@check.local';
  const SALES_EMAIL = 'testsales@check.local';
  const TEST_PASS   = 'TestCheck@123';

  const hash = await bcrypt.hash(TEST_PASS, 10);

  await User.findOneAndUpdate(
    { email: ADMIN_EMAIL },
    { name: 'Test Admin', passwordHash: hash, role: 'admin', isActive: true },
    { upsert: true, new: true }
  );
  await User.findOneAndUpdate(
    { email: SALES_EMAIL },
    { name: 'Test Sales', passwordHash: hash, role: 'salesperson', isActive: true },
    { upsert: true, new: true }
  );

  // Login
  const [loginA, loginS] = await Promise.all([
    call('POST', '/auth/login', { email: ADMIN_EMAIL, password: TEST_PASS }, null),
    call('POST', '/auth/login', { email: SALES_EMAIL, password: TEST_PASS }, null),
  ]);
  if (loginA.status !== 200) { console.error(R('  Admin login failed')); process.exitCode = 1; return; }
  if (loginS.status !== 200) { console.error(R('  Sales login failed')); process.exitCode = 1; return; }

  const A = client(loginA.cookie);
  const S = client(loginS.cookie);

  // Track test data for cleanup
  let testLaptopId = null;
  let testCustomerId = null;
  const testSaleIds = [];

  // ══════════════════════════════════════════════════════════════════════
  console.log(B(C('\n── TEST A  Inventory Parity ────────────────────────────\n')));

  const [resA_admin, resA_sales] = await Promise.all([
    A.get('/laptops?limit=200'),
    S.get('/laptops?limit=200'),
  ]);

  assert('A1', resA_admin.body.total === resA_sales.body.total,
    `admin total=${resA_admin.body.total}  sales total=${resA_sales.body.total}`);

  {
    const aSkus = new Map(resA_admin.body.data.map((l) => [l.sku, l]));
    const sSkus = new Map(resA_sales.body.data.map((l) => [l.sku, l]));

    const skuSetMatch = aSkus.size === sSkus.size && [...aSkus.keys()].every((k) => sSkus.has(k));
    assert('A2', skuSetMatch, 'same set of SKUs');

    const qtyMatch = [...aSkus.entries()].every(([sku, al]) => {
      const sl = sSkus.get(sku);
      return sl && al.quantity === sl.quantity;
    });
    assert('A3', qtyMatch, 'same quantities for every SKU');

    const priceMatch = [...aSkus.entries()].every(([sku, al]) => {
      const sl = sSkus.get(sku);
      return sl && al.sellingPrice === sl.sellingPrice;
    });
    assert('A4', priceMatch, 'same sellingPrice for every SKU');

    const adminHasCost = resA_admin.body.data.some((l) => 'costPrice' in l);
    const salesNoCost  = resA_sales.body.data.every((l) => !('costPrice' in l));
    const salesNoMin   = resA_sales.body.data.every((l) => !('minSalePrice' in l));
    assert('A5', adminHasCost, 'admin response includes costPrice');
    assert('A6', salesNoCost,  'salesperson response has NO costPrice');
    assert('A7', salesNoMin,   'salesperson response has NO minSalePrice');
  }

  // ══════════════════════════════════════════════════════════════════════
  console.log(B(C('\n── TEST B  Live Update Propagation ─────────────────────\n')));

  const createLaptop = await A.post('/laptops?forceNew=true', {
    brand: 'TestBrand',
    model: 'CheckModel X1',
    modelNumber: 'TCM-001',
    condition: 'New',
    trackingMode: 'batch',
    costPrice: 100000,
    sellingPrice: 120000,
    minSalePrice: 105000,
    quantity: 5,
    specs: { processor: 'Intel i5-TEST', ram: '8GB DDR4', storage: '256GB NVMe' },
  });
  const B1 = assert('B1', createLaptop.status === 201,
    `status=${createLaptop.status}  sku=${createLaptop.body.sku}`);

  if (B1) {
    testLaptopId = createLaptop.body._id;

    const salesView = await S.get(`/laptops/${testLaptopId}`);
    assert('B2', salesView.status === 200, 'salesperson sees new laptop immediately');
    assert('B3', salesView.body.quantity === 5, `qty expected=5 got=${salesView.body.quantity}`);

    // Salesperson increments
    const incR = await S.patch(`/laptops/${testLaptopId}/quantity`, { delta: 1 });
    assert('B4', incR.status === 200, `status=${incR.status}`);

    const afterInc = await A.get(`/laptops/${testLaptopId}`);
    assert('B5', afterInc.body.quantity === 6, `admin sees qty=6 after inc, got=${afterInc.body.quantity}`);

    // Admin decrements
    const decR = await A.patch(`/laptops/${testLaptopId}/quantity`, { delta: -2 });
    assert('B6', decR.status === 200, `status=${decR.status}`);

    const afterDec = await S.get(`/laptops/${testLaptopId}`);
    assert('B7', afterDec.body.quantity === 4, `sales sees qty=4 after dec, got=${afterDec.body.quantity}`);
  } else {
    ['B2','B3','B4','B5','B6','B7'].forEach((id) => skip(id, 'B1 failed'));
  }

  // ══════════════════════════════════════════════════════════════════════
  console.log(B(C('\n── TEST C  Sale Visibility ─────────────────────────────\n')));

  if (testLaptopId) {
    // Create test customer via admin
    const custR = await A.post('/customers', { name: 'CheckCustomer C', phone: '0300-TESTCHKC' });
    testCustomerId = custR.body._id;
    assert('C0', custR.status === 201, `create customer status=${custR.status}`);

    // Salesperson creates sale (qty 1, no discount)
    const saleR = await S.post('/sales', {
      customer: { name: 'CheckCustomer C', phone: '0300-TESTCHKC', customerId: testCustomerId },
      items: [{ laptopId: testLaptopId, qty: 1, unitPrice: 120000 }],
      paymentMethod: 'Cash',
    });
    const C1 = assert('C1', saleR.status === 201, `status=${saleR.status}`);

    if (C1) {
      const saleId = saleR.body._id;
      testSaleIds.push(saleId);

      // Admin sees it in list
      const adminList = await A.get('/sales?limit=50');
      const inAdminList = adminList.body.data?.some((s) => s._id === saleId);
      assert('C2', inAdminList, 'admin sees salesperson sale in /sales list');

      const found = adminList.body.data?.find((s) => s._id === saleId);
      assert('C3', found?.grandTotal === 120000, `correct grandTotal: got=${found?.grandTotal}`);

      // Admin GET /sales/:id — has profit & costPrice
      const adminDetail = await A.get(`/sales/${saleId}`);
      assert('C4', adminDetail.body.profit !== undefined, `admin sees profit=${adminDetail.body.profit}`);
      assert('C5', adminDetail.body.totalCost !== undefined, `admin sees totalCost=${adminDetail.body.totalCost}`);
      assert('C6', adminDetail.body.items?.[0]?.costPrice !== undefined,
        `admin sees item.costPrice=${adminDetail.body.items?.[0]?.costPrice}`);

      // Salesperson GET /sales/:id — no sensitive fields
      const salesDetail = await S.get(`/sales/${saleId}`);
      assert('C7', salesDetail.status === 200, `status=${salesDetail.status}`);
      assert('C8', !('profit'    in salesDetail.body), 'no profit field');
      assert('C9', !('totalCost' in salesDetail.body), 'no totalCost field');
      assert('C10', !(salesDetail.body.items?.[0] && 'costPrice' in salesDetail.body.items[0]),
        'no item.costPrice');

      // Inventory qty decremented for both roles (was 4, now 3)
      const [adminInv, salesInv] = await Promise.all([
        A.get(`/laptops/${testLaptopId}`),
        S.get(`/laptops/${testLaptopId}`),
      ]);
      assert('C11', adminInv.body.quantity === 3, `admin qty after sale: got=${adminInv.body.quantity}`);
      assert('C12', salesInv.body.quantity === 3, `sales qty after sale: got=${salesInv.body.quantity}`);
    } else {
      ['C2','C3','C4','C5','C6','C7','C8','C9','C10','C11','C12'].forEach((id) => skip(id, 'C1 failed'));
    }
  } else {
    ['C0','C1','C2','C3','C4','C5','C6','C7','C8','C9','C10','C11','C12'].forEach((id) => skip(id, 'no test laptop'));
  }

  // ══════════════════════════════════════════════════════════════════════
  console.log(B(C('\n── TEST D  Customer Parity ─────────────────────────────\n')));

  const custD = await A.post('/customers', { name: 'CheckCustomer D', phone: '0300-TESTCHKD' });
  const D1 = assert('D1', custD.status === 201, `status=${custD.status}`);

  if (D1) {
    const custDId = custD.body._id;

    // Salesperson finds by phone search
    const searchR = await S.get('/customers?search=0300-TESTCHKD');
    const found   = searchR.body.data?.[0];
    assert('D2', !!found,                         'salesperson finds the customer');
    assert('D3', found?.phone === '0300-TESTCHKD', `same phone: got=${found?.phone}`);
    assert('D4', found?.name  === 'CheckCustomer D', `same name: got=${found?.name}`);

    // Salesperson updates phone
    const updR = await S.patch(`/customers/${custDId}`, { phone: '0300-UPDATED-D' });
    assert('D5', updR.status === 200, `update status=${updR.status}`);

    // Admin sees new phone
    const adminR = await A.get(`/customers/${custDId}`);
    assert('D6', adminR.body.phone === '0300-UPDATED-D', `admin sees updated phone: got=${adminR.body.phone}`);

    if (!KEEP) await Customer.deleteOne({ _id: custDId });
  } else {
    ['D2','D3','D4','D5','D6'].forEach((id) => skip(id, 'D1 failed'));
  }

  // ══════════════════════════════════════════════════════════════════════
  console.log(B(C('\n── TEST E  Invoice Number Sequence ─────────────────────\n')));

  if (testLaptopId) {
    const year = new Date().getFullYear();
    const latest = await Sale.findOne({ invoiceNumber: new RegExp(`^INV-${year}-`) })
      .sort({ invoiceNumber: -1 }).lean();
    const curSeq = latest ? parseInt(latest.invoiceNumber.split('-')[2], 10) : 0;

    // Salesperson creates sale → seq+1
    const saleE1 = await S.post('/sales', {
      customer: { name: 'SeqTest One', phone: '0300-SEQT1' },
      items: [{ laptopId: testLaptopId, qty: 1, unitPrice: 120000 }],
      paymentMethod: 'Cash',
    });
    const seq1 = saleE1.status === 201 ? parseInt(saleE1.body.invoiceNumber.split('-')[2], 10) : null;
    assert('E1', seq1 === curSeq + 1, `expected=${curSeq + 1} got=${seq1}`);
    if (saleE1.status === 201) testSaleIds.push(saleE1.body._id);

    // Admin creates sale → seq+2
    const saleE2 = await A.post('/sales', {
      customer: { name: 'SeqTest Two', phone: '0300-SEQT2' },
      items: [{ laptopId: testLaptopId, qty: 1, unitPrice: 120000 }],
      paymentMethod: 'Bank Transfer',
    });
    const seq2 = saleE2.status === 201 ? parseInt(saleE2.body.invoiceNumber.split('-')[2], 10) : null;
    assert('E2', seq2 === curSeq + 2, `expected=${curSeq + 2} got=${seq2}`);
    assert('E3', seq1 !== null && seq2 !== null && seq2 === seq1 + 1, 'no gaps — consecutive');
    if (saleE2.status === 201) testSaleIds.push(saleE2.body._id);
  } else {
    ['E1','E2','E3'].forEach((id) => skip(id, 'no test laptop'));
  }

  // ══════════════════════════════════════════════════════════════════════
  console.log(B(C('\n── TEST F  Snapshot Integrity ───────────────────────────\n')));

  if (testSaleIds.length > 0 && testCustomerId) {
    const saleDetail = await A.get(`/sales/${testSaleIds[0]}`);
    const origName   = saleDetail.body.customer?.name;

    // Admin renames the customer
    const renamed = 'CheckCustomer C RENAMED';
    await A.patch(`/customers/${testCustomerId}`, { name: renamed });

    // Both roles see OLD name on the existing sale
    const [adminSale, salesSale] = await Promise.all([
      A.get(`/sales/${testSaleIds[0]}`),
      S.get(`/sales/${testSaleIds[0]}`),
    ]);
    assert('F1', adminSale.body.customer?.name === origName,
      `admin: expected="${origName}" got="${adminSale.body.customer?.name}"`);
    assert('F2', salesSale.body.customer?.name === origName,
      `sales: expected="${origName}" got="${salesSale.body.customer?.name}"`);

    // Customer record reflects the new name
    const custR = await A.get(`/customers/${testCustomerId}`);
    assert('F3', custR.body.name === renamed, `customer record: got="${custR.body.name}"`);
  } else {
    ['F1','F2','F3'].forEach((id) => skip(id, 'no test sale / customer'));
  }

  // ══════════════════════════════════════════════════════════════════════
  console.log(B(C('\n── TEST G  Authorization Boundaries ────────────────────\n')));

  // G1 — import/commit
  const g1 = await S.post('/laptops/import/commit', { rows: [] });
  assert('G1', g1.status === 403, `import/commit status=${g1.status}`);

  // G2 — DELETE laptop
  const g2 = testLaptopId ? await S.delete(`/laptops/${testLaptopId}`) : { status: 403 };
  assert('G2', g2.status === 403, `DELETE laptop status=${g2.status}`);

  // G3 — GET reports/dashboard
  const g3 = await S.get('/reports/dashboard');
  assert('G3', g3.status === 403, `reports/dashboard status=${g3.status}`);

  // G4 — quantity decrement
  const g4 = testLaptopId
    ? await S.patch(`/laptops/${testLaptopId}/quantity`, { delta: -1 })
    : { status: 403 };
  assert('G4', g4.status === 403, `quantity delta:-1 status=${g4.status}`);

  // G5 — cancel sale
  const g5 = testSaleIds.length > 0
    ? await S.post(`/sales/${testSaleIds[0]}/cancel`, { reason: 'test' })
    : { status: 403 };
  assert('G5', g5.status === 403, `cancel sale status=${g5.status}`);

  // G6 — create laptop (new: salesperson cannot add inventory)
  const g6 = await S.post('/laptops', {
    brand: 'NoAccess', model: 'Test', condition: 'New',
    trackingMode: 'batch', costPrice: 1, sellingPrice: 2, quantity: 1,
  });
  assert('G6', g6.status === 403, `POST /laptops status=${g6.status}`);

  // ══════════════════════════════════════════════════════════════════════
  // CLEANUP
  if (!KEEP) {
    process.stdout.write('\n  Cleaning up test data… ');
    // Hard-delete test sales
    if (testSaleIds.length) await Sale.deleteMany({ _id: { $in: testSaleIds } });
    // Delete test laptop
    if (testLaptopId) await Laptop.deleteOne({ _id: testLaptopId });
    // Delete test customers
    if (testCustomerId) await Customer.deleteOne({ _id: testCustomerId });
    await Customer.deleteMany({
      phone: { $in: ['0300-TESTCHKC','0300-TESTCHKD','0300-UPDATED-D','0300-SEQT1','0300-SEQT2'] },
    });
    // Delete test users
    await User.deleteMany({ email: { $in: [ADMIN_EMAIL, SALES_EMAIL] } });
    console.log('done.');
  } else {
    console.log(Y('\n  --keep: test data preserved in database'));
  }

  // ══════════════════════════════════════════════════════════════════════
  // SUMMARY
  const passed  = results.filter((r) => r.pass === true).length;
  const failed  = results.filter((r) => r.pass === false).length;
  const skipped = results.filter((r) => r.pass === null).length;

  console.log(B('\n╔══════════════════════════════════════════════════╗'));
  console.log(B('║                    SUMMARY                      ║'));
  console.log(B('╚══════════════════════════════════════════════════╝\n'));

  const col = (s, w) => s.padEnd(w);
  console.log(`  ${B(col('TEST',6))} ${B(col('RESULT',8))} ${B('NOTES')}`);
  console.log('  ' + '─'.repeat(66));
  for (const r of results) {
    const result = r.pass === true  ? G('PASS')
                 : r.pass === false ? R('FAIL')
                 : D('SKIP');
    console.log(`  ${col(r.id, 6)} ${col(result, 16)} ${r.note ? D(r.note) : ''}`);
  }
  console.log('  ' + '─'.repeat(66));
  console.log(`\n  ${G(passed + ' passed')}  ${failed > 0 ? R(failed + ' failed') : D('0 failed')}  ${D(skipped + ' skipped')}\n`);

  if (failed > 0) {
    console.log(R(B('  ✗ OVERALL: FAIL\n')));
    process.exitCode = 1;
  } else {
    console.log(G(B('  ✓ OVERALL: PASS\n')));
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(R('\nFatal error: ') + err.message);
  process.exitCode = 1;
  mongoose.disconnect().catch(() => {});
});
