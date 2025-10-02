const STORAGE_KEY = 'fsi-expense-state-v1';
const IRS_RATE = 0.655; // 2023 IRS standard mileage rate per mile.
const MEAL_LIMITS = {
  breakfast: 10,
  lunch: 15,
  dinner: 25,
};

const EXPENSE_TYPES = [
  { value: 'maintenance_repairs', label: 'Maintenance & Repairs', account: '51020', policy: 'default' },
  { value: 'parking_storage_cogs', label: 'Parking & Storage - COGS', account: '51070', policy: 'travel', travelDefault: 'parking' },
  { value: 'vehicle_supplies', label: 'Vehicle Supplies', account: '51090', policy: 'default' },
  { value: 'state_permits', label: 'State Permits / Fees / Tolls', account: '52030', policy: 'travel', travelDefault: 'other' },
  { value: 'meals_cogs', label: 'Meals & Entertainment - COGS', account: '52070', policy: 'meal' },
  { value: 'travel_cogs', label: 'Travel - COGS', account: '52080', policy: 'travel', travelDefault: 'air_domestic' },
  { value: 'fsi_global_overhead', label: 'FSI Global Overhead', account: '56000', policy: 'default' },
  { value: 'telephone_ga', label: 'Telephone - GA', account: '62000', policy: 'default' },
  { value: 'utilities', label: 'Utilities', account: '62070', policy: 'default' },
  { value: 'it_computer', label: 'IT / Computer', account: '62080', policy: 'default' },
  { value: 'office_supplies', label: 'Office Supplies', account: '62090', policy: 'default' },
  { value: 'printing_postage', label: 'Printing & Postage', account: '62100', policy: 'default' },
  { value: 'meals_ga', label: 'Meals & Entertainment - GA', account: '64180', policy: 'meal' },
  { value: 'travel_ga', label: 'Travel - GA', account: '64190', policy: 'travel', travelDefault: 'air_domestic' },
  { value: 'fsi_global_ga', label: 'FSI Global G&A', account: '66500', policy: 'default' },
  { value: 'mileage', label: 'Mileage reimbursement (IRS rate)', account: '64190', policy: 'mileage' },
];

const DEFAULT_STATE = {
  header: {
    name: '',
    department: '',
    focus: '',
    purpose: '',
    je: '',
    dates: '',
    tripLength: '',
  },
  expenses: [],
};

const cloneDefaultState = () => JSON.parse(JSON.stringify(DEFAULT_STATE));

const headerBindings = {
  field_name: 'name',
  field_department: 'department',
  field_focus: 'focus',
  field_purpose: 'purpose',
  field_je: 'je',
  field_dates: 'dates',
  field_trip_length: 'tripLength',
};

const fmtCurrency = (value) => {
  const amount = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const parseNumber = (value) => {
  if (value === '' || value === null || value === undefined) return 0;
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
};

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefaultState();
    const parsed = JSON.parse(raw);
    return {
      header: { ...DEFAULT_STATE.header, ...(parsed.header || {}) },
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    };
  } catch (err) {
    console.warn('Unable to load saved expense state', err);
    return cloneDefaultState();
  }
};

const saveState = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Unable to persist expense state', err);
  }
};

const uuid = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
};

const state = loadState();
const expenseRows = new Map();

const elements = {
  expensesBody: document.querySelector('#expensesBody'),
  addExpense: document.querySelector('#addExpense'),
  reportPreview: document.querySelector('#reportPreview'),
  copyPreview: document.querySelector('#copyPreview'),
  copyFeedback: document.querySelector('#copyFeedback'),
  totalSubmitted: document.querySelector('#totalSubmitted'),
  totalDueEmployee: document.querySelector('#totalDueEmployee'),
  totalCompanyCard: document.querySelector('#totalCompanyCard'),
};

function bindHeaderFields() {
  Object.entries(headerBindings).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const value = state.header[key];
    if (value !== undefined) el.value = value;
    el.addEventListener('input', () => {
      let nextValue = el.value;
      if (el.type === 'number') {
        nextValue = nextValue === '' ? '' : Number(nextValue);
      }
      state.header[key] = nextValue;
      saveState(state);
      refreshAllExpenses();
      updatePreview();
    });
  });
}

const findExpenseType = (value) => EXPENSE_TYPES.find((type) => type.value === value);

function createOptions(select) {
  select.innerHTML = '';
  EXPENSE_TYPES.forEach((type) => {
    const option = document.createElement('option');
    option.value = type.value;
    option.textContent = `${type.label} (${type.account})`;
    select.append(option);
  });
}

function buildRow(expense) {
  const template = document.getElementById('expense-row-template');
  const fragment = template.content.cloneNode(true);
  const row = fragment.querySelector('tr');
  row.dataset.id = expense.id;

  const dateInput = row.querySelector('.exp-date');
  const typeSelect = row.querySelector('.exp-type');
  const accountCell = row.querySelector('.expense-account');
  const description = row.querySelector('.exp-description');
  const paymentSelect = row.querySelector('.exp-payment');
  const amountInput = row.querySelector('.exp-amount');
  const reimbCell = row.querySelector('.expense-reimbursable');
  const messagesList = row.querySelector('.policy-messages');
  const removeBtn = row.querySelector('.remove-expense');
  const mealType = row.querySelector('.exp-meal-type');
  const receipt = row.querySelector('.exp-receipt');
  const milesInput = row.querySelector('.exp-miles');
  const mileageRate = row.querySelector('.mileage-rate');
  const travelCategory = row.querySelector('.exp-travel-cat');
  const travelClass = row.querySelector('.exp-travel-class');
  const flightHours = row.querySelector('.exp-flight-hours');
  const detailBlocks = {
    meal: row.querySelector('[data-detail="meal"]'),
    mileage: row.querySelector('[data-detail="mileage"]'),
    travel: row.querySelector('[data-detail="travel"]'),
  };

  const flightOnlyBlocks = row.querySelectorAll('[data-flight-only]');

  createOptions(typeSelect);

  dateInput.value = expense.date || '';
  typeSelect.value = expense.type || EXPENSE_TYPES[0].value;
  description.value = expense.description || '';
  paymentSelect.value = expense.payment || 'personal';
  amountInput.value = expense.amount ?? '';
  reimbCell.textContent = fmtCurrency(expense.reimbursable || 0);
  mealType.value = expense.mealType || 'dinner';
  receipt.checked = expense.hasReceipt !== false;
  milesInput.value = expense.miles || '';
  travelCategory.value = expense.travelCategory || 'air_domestic';
  travelClass.value = expense.travelClass || 'coach';
  flightHours.value = expense.flightHours || '';

  mileageRate.textContent = `IRS rate $${IRS_RATE.toFixed(3)} per mile`;

  const refs = {
    row,
    dateInput,
    typeSelect,
    accountCell,
    description,
    paymentSelect,
    amountInput,
    reimbCell,
    messagesList,
    removeBtn,
    mealType,
    receipt,
    milesInput,
    mileageRate,
    travelCategory,
    travelClass,
    flightHours,
    detailBlocks,
    flightOnlyBlocks,
  };

  expenseRows.set(expense.id, refs);

  typeSelect.addEventListener('change', () => {
    expense.type = typeSelect.value;
    applyExpenseType(expense, refs);
    persistAndRefresh(expense);
  });

  dateInput.addEventListener('change', () => {
    expense.date = dateInput.value;
    persistAndRefresh(expense);
  });

  description.addEventListener('input', () => {
    expense.description = description.value;
    persistAndRefresh(expense, { previewOnly: true });
  });

  paymentSelect.addEventListener('change', () => {
    expense.payment = paymentSelect.value;
    persistAndRefresh(expense);
  });

  amountInput.addEventListener('input', () => {
    if (expense.policy === 'mileage') return;
    expense.amount = parseNumber(amountInput.value);
    persistAndRefresh(expense);
  });

  mealType.addEventListener('change', () => {
    expense.mealType = mealType.value;
    persistAndRefresh(expense);
  });

  receipt.addEventListener('change', () => {
    expense.hasReceipt = receipt.checked;
    persistAndRefresh(expense);
  });

  milesInput.addEventListener('input', () => {
    expense.miles = parseNumber(milesInput.value);
    expense.amount = expense.miles * IRS_RATE;
    amountInput.value = expense.amount ? expense.amount.toFixed(2) : '';
    persistAndRefresh(expense);
  });

  travelCategory.addEventListener('change', () => {
    expense.travelCategory = travelCategory.value;
    updateFlightFieldsVisibility(expense, refs);
    persistAndRefresh(expense);
  });

  travelClass.addEventListener('change', () => {
    expense.travelClass = travelClass.value;
    persistAndRefresh(expense);
  });

  flightHours.addEventListener('input', () => {
    expense.flightHours = flightHours.value;
    persistAndRefresh(expense);
  });

  removeBtn.addEventListener('click', () => {
    removeExpense(expense.id);
  });

  applyExpenseType(expense, refs);
  return row;
}

function updateFlightFieldsVisibility(expense, refs) {
  const isAir = expense.travelCategory === 'air_domestic' || expense.travelCategory === 'air_international';
  refs.flightOnlyBlocks.forEach((block) => {
    block.style.display = isAir ? '' : 'none';
  });
}

function applyExpenseType(expense, refs) {
  const meta = findExpenseType(expense.type) || EXPENSE_TYPES[0];
  expense.policy = meta.policy;
  expense.account = meta.account;
  refs.accountCell.textContent = meta.account;

  Object.entries(refs.detailBlocks).forEach(([key, block]) => {
    if (!block) return;
    block.hidden = meta.policy !== key;
  });

  if (meta.policy !== 'mileage') {
    refs.amountInput.removeAttribute('readonly');
    refs.amountInput.classList.remove('readonly');
  }

  if (meta.policy === 'mileage') {
    refs.amountInput.setAttribute('readonly', 'readonly');
    refs.amountInput.classList.add('readonly');
    if (!expense.miles) expense.miles = 0;
    refs.milesInput.value = expense.miles || '';
    expense.amount = expense.miles * IRS_RATE;
    refs.amountInput.value = expense.amount ? expense.amount.toFixed(2) : '';
  }

  if (meta.policy !== 'meal') {
    expense.mealType = expense.mealType || 'dinner';
  }

  if (meta.policy === 'travel') {
    const defaultCategory = meta.travelDefault || 'air_domestic';
    expense.travelCategory = expense.travelCategory || defaultCategory;
    refs.travelCategory.value = expense.travelCategory;
    updateFlightFieldsVisibility(expense, refs);
  }

  persistAndRefresh(expense, { previewOnly: false });
}

function persistAndRefresh(expense, { previewOnly = false } = {}) {
  evaluateExpense(expense);
  const index = state.expenses.findIndex((item) => item.id === expense.id);
  if (index !== -1) {
    state.expenses[index] = { ...state.expenses[index], ...expense };
  }
  saveState(state);
  updateRowUI(expense);
  if (!previewOnly) {
    updateTotals();
  }
  updatePreview();
}

function evaluateExpense(expense) {
  const messages = [];
  let reimbursable = parseNumber(expense.amount);
  const policy = expense.policy;

  if (policy === 'meal') {
    const mealKey = expense.mealType || 'dinner';
    const cap = MEAL_LIMITS[mealKey];
    if (!expense.hasReceipt) {
      if (reimbursable > cap) {
        messages.push({ type: 'warning', text: `No receipt: reimbursement capped at ${fmtCurrency(cap)} for ${mealKey}.` });
      }
      reimbursable = Math.min(reimbursable, cap);
    } else if (cap && reimbursable > cap) {
      messages.push({ type: 'info', text: `Above guideline amount (${fmtCurrency(cap)}). Ensure business justification is noted.` });
    }
  }

  if (policy === 'mileage') {
    reimbursable = (parseNumber(expense.miles)) * IRS_RATE;
    expense.amount = reimbursable;
  }

  if (policy === 'travel') {
    const category = expense.travelCategory || 'air_domestic';
    const travelClass = expense.travelClass || 'coach';
    const hours = parseNumber(expense.flightHours);
    if (category === 'air_domestic') {
      if (travelClass === 'first') {
        messages.push({ type: 'warning', text: 'First-class airfare is not reimbursable.' });
      } else if (travelClass !== 'coach') {
        messages.push({ type: 'warning', text: 'Domestic airfare should be booked in coach. Upgrades are personal expense.' });
      }
    }
    if (category === 'air_international') {
      if (travelClass === 'first') {
        messages.push({ type: 'warning', text: 'First-class airfare is not reimbursable.' });
      }
      if (travelClass === 'business' && hours < 8) {
        messages.push({ type: 'warning', text: 'Business class allowed only when published flight time is eight hours or longer.' });
      }
      if (travelClass !== 'business' && travelClass !== 'coach' && travelClass !== 'premium') {
        messages.push({ type: 'warning', text: 'Select an allowable fare class.' });
      }
    }
    if (category === 'gym' && reimbursable > 15) {
      messages.push({ type: 'warning', text: 'Hotel gym fees should not exceed $15 per day.' });
    }
    if (category === 'laundry') {
      const tripLength = parseNumber(state.header.tripLength);
      if (!tripLength || tripLength < 7) {
        messages.push({ type: 'warning', text: 'Laundry reimbursed only for trips exceeding seven full days.' });
      }
    }
  }

  expense.reimbursable = reimbursable;
  expense.messages = messages;
  return expense;
}

function updateRowUI(expense) {
  const refs = expenseRows.get(expense.id);
  if (!refs) return;
  refs.reimbCell.textContent = fmtCurrency(expense.reimbursable || 0);
  if (expense.policy === 'mileage') {
    refs.amountInput.value = expense.amount ? expense.amount.toFixed(2) : '';
  }
  refs.messagesList.innerHTML = '';
  if (expense.messages && expense.messages.length) {
    expense.messages.forEach((message) => {
      const li = document.createElement('li');
      li.textContent = message.text;
      li.className = message.type;
      refs.messagesList.appendChild(li);
    });
  }
}

function updateTotals() {
  const totals = state.expenses.reduce((acc, expense) => {
    const amount = parseNumber(expense.amount);
    const reimb = parseNumber(expense.reimbursable);
    acc.submitted += amount;
    if (expense.payment === 'company') {
      acc.company += reimb;
    } else {
      acc.employee += reimb;
    }
    return acc;
  }, { submitted: 0, employee: 0, company: 0 });

  elements.totalSubmitted.textContent = fmtCurrency(totals.submitted);
  elements.totalDueEmployee.textContent = fmtCurrency(totals.employee);
  elements.totalCompanyCard.textContent = fmtCurrency(totals.company);
}

function updatePreview() {
  const lines = [];
  const header = state.header;
  lines.push('Expense report');
  lines.push(`Name: ${header.name || ''}`);
  lines.push(`Department: ${header.department || ''}`);
  lines.push(`Expense focus: ${header.focus || ''}`);
  lines.push(`Purpose: ${header.purpose || ''}`);
  lines.push(`JE #: ${header.je || ''}`);
  lines.push(`Dates: ${header.dates || ''}`);
  if (header.tripLength) {
    lines.push(`Trip length: ${header.tripLength} day(s)`);
  }
  lines.push('');
  lines.push('Date | Type | Account | Description | Payment | Amount | Reimbursable');
  lines.push('-----|------|---------|-------------|---------|--------|-------------');
  state.expenses.forEach((expense) => {
    const meta = findExpenseType(expense.type);
    const typeLabel = meta ? meta.label : expense.type;
    const amount = fmtCurrency(parseNumber(expense.amount));
    const reimb = fmtCurrency(parseNumber(expense.reimbursable));
    lines.push([
      expense.date || '',
      typeLabel,
      expense.account || '',
      (expense.description || '').replace(/\s+/g, ' ').trim(),
      expense.payment === 'company' ? 'Company card' : 'Personal',
      amount,
      reimb,
    ].join(' | '));
    if (expense.messages && expense.messages.length) {
      expense.messages.forEach((msg) => {
        lines.push(`  - ${msg.type === 'warning' ? '⚠️' : 'ℹ️'} ${msg.text}`);
      });
    }
  });

  const totalsLine = `Totals -> Submitted: ${elements.totalSubmitted.textContent}, Due to employee: ${elements.totalDueEmployee.textContent}, Company card: ${elements.totalCompanyCard.textContent}`;
  lines.push('');
  lines.push(totalsLine);

  elements.reportPreview.value = lines.join('\n');
}

async function copyPreview() {
  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
    elements.copyFeedback.textContent = 'Clipboard unavailable. Select the text and copy manually.';
    setTimeout(() => { elements.copyFeedback.textContent = ''; }, 3000);
    return;
  }
  try {
    await navigator.clipboard.writeText(elements.reportPreview.value);
    elements.copyFeedback.textContent = 'Copied to clipboard!';
  } catch (err) {
    elements.copyFeedback.textContent = 'Unable to copy automatically. Select and copy manually.';
  }
  setTimeout(() => { elements.copyFeedback.textContent = ''; }, 3000);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    updateTotals();
    updatePreview();
  }
});

function refreshAllExpenses() {
  state.expenses.forEach((expense) => {
    evaluateExpense(expense);
    updateRowUI(expense);
  });
  updateTotals();
  updatePreview();
}

function addExpense(initial = {}) {
  const expense = {
    id: uuid(),
    date: '',
    type: EXPENSE_TYPES[0].value,
    account: EXPENSE_TYPES[0].account,
    description: '',
    payment: 'personal',
    amount: 0,
    reimbursable: 0,
    hasReceipt: true,
    mealType: 'dinner',
    miles: 0,
    travelCategory: 'air_domestic',
    travelClass: 'coach',
    flightHours: '',
    ...initial,
  };
  state.expenses.push(expense);
  const row = buildRow(expense);
  elements.expensesBody.appendChild(row);
  evaluateExpense(expense);
  updateRowUI(expense);
  updateTotals();
  updatePreview();
  saveState(state);
}

function removeExpense(id) {
  const index = state.expenses.findIndex((expense) => expense.id === id);
  if (index === -1) return;
  state.expenses.splice(index, 1);
  const refs = expenseRows.get(id);
  if (refs) {
    refs.row.remove();
    expenseRows.delete(id);
  }
  updateTotals();
  updatePreview();
  saveState(state);
}

function restoreExpenses() {
  if (!state.expenses.length) {
    addExpense();
    return;
  }
  state.expenses.forEach((expense) => {
    if (!expense.id) expense.id = uuid();
    const row = buildRow(expense);
    elements.expensesBody.appendChild(row);
    evaluateExpense(expense);
    updateRowUI(expense);
  });
  updateTotals();
  updatePreview();
}

function initCopyButton() {
  if (!elements.copyPreview) return;
  elements.copyPreview.addEventListener('click', copyPreview);
}

function initAddButton() {
  if (!elements.addExpense) return;
  elements.addExpense.addEventListener('click', () => addExpense());
}

function init() {
  bindHeaderFields();
  restoreExpenses();
  initAddButton();
  initCopyButton();
}

init();
