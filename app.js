/* ============ Kharcha Tracker - App Logic ============ */

// ================== DATA ==================
var DB_KEY = 'kharcha_db_v1';
var SETTINGS_KEY = 'kharcha_settings_v1';
var BANNER_KEY = 'kharcha_banner_skipped_v1';

function emptyProfile() {
  return { money: null, expenses: [], incomes: [], presets: [], budgets: {}, udhaar: [], shopping: [], festivals: [] };
}

function loadDB() {
  try {
    var raw = localStorage.getItem(DB_KEY);
    if (raw) {
      var db = JSON.parse(raw);
      if (db && db.profiles && Object.keys(db.profiles).length > 0) return db;
    }
  } catch (e) {}
  var oldExp = [], oldMoney = null;
  try { oldExp = JSON.parse(localStorage.getItem('kharcha_tracker_v1') || '[]') || []; } catch (e) { oldExp = []; }
  try {
    oldMoney = parseFloat(localStorage.getItem('kharcha_money_v1'));
    if (isNaN(oldMoney) || oldMoney < 0) oldMoney = null;
  } catch (e) {}
  var p = emptyProfile();
  p.money = oldMoney;
  p.expenses = Array.isArray(oldExp) ? oldExp : [];
  return { active: 'Main', profiles: { 'Main': p } };
}

function loadSettings() {
  try {
    var s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    var out = {
      theme: (s.theme === 'dark' || s.theme === 'light') ? s.theme : 'light',
      accent: ['purple', 'blue', 'green', 'pink'].indexOf(s.accent) >= 0 ? s.accent : 'purple',
      lang: s.lang === 'en' ? 'en' : 'hi',
      customCats: [],
      pin: null,
      cloud: null,
      autoCloud: false,
      cycleDay: 1,
      recurring: []
    };
    if (Array.isArray(s.customCats)) out.customCats = s.customCats.filter(function (c) { return c && c.id && c.name; });
    if (typeof s.pin === 'string' && /^\d{4}$/.test(s.pin)) out.pin = s.pin;
    if (s.cloud && typeof s.cloud === 'object' && s.cloud.dbUrl && s.cloud.code) out.cloud = s.cloud;
    if (s.autoCloud === true) out.autoCloud = true;
    if (s.cycleDay >= 2 && s.cycleDay <= 28) out.cycleDay = s.cycleDay;
    if (Array.isArray(s.recurring)) out.recurring = s.recurring.filter(function (r) { return r && r.name && r.amount > 0 && r.day >= 1 && r.day <= 28; });
    return out;
  } catch (e) { return { theme: 'light', accent: 'purple', lang: 'hi', customCats: [], pin: null, cloud: null }; }
}

function applySettings() {
  document.documentElement.setAttribute('data-theme', settings.theme);
  document.documentElement.setAttribute('data-accent', settings.accent);
}

var db = loadDB();
var settings = loadSettings();
if (!db.active || !db.profiles[db.active]) {
  db.active = Object.keys(db.profiles)[0];
  saveDB();
}

function saveDB() { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) {} scheduleAutoCloud(); }
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {} }

// ================== STATE + ELEMENTS ==================
var currentFilter = 'all';
var presetDeleteMode = false;

var form = document.getElementById('expenseForm');
var nameInput = document.getElementById('name');
var amountInput = document.getElementById('amount');
var dateInput = document.getElementById('date');
var categorySelect = document.getElementById('category');
var listEl = document.getElementById('list');
var totalEl = document.getElementById('totalAmount');
var todayStat = document.getElementById('todayStat');
var countStat = document.getElementById('countStat');
var toastEl = document.getElementById('toast');
var moneyForm = document.getElementById('moneyForm');
var moneyInput = document.getElementById('moneyInput');
var summarySentence = document.getElementById('summarySentence');
var periodLineEl = document.getElementById('periodLine');
var reportTitle = document.getElementById('reportTitle');
var reportBody = document.getElementById('reportBody');

dateInput.value = getTodayStr();

function prof() {
  var p = db.profiles[db.active];
  if (!p) { p = emptyProfile(); db.profiles[db.active] = p; saveDB(); }
  if (!Array.isArray(p.expenses)) p.expenses = [];
  if (!Array.isArray(p.presets)) p.presets = [];
  if (!p.budgets || typeof p.budgets !== 'object') p.budgets = {};
  if (!(typeof p.goal === 'number' && p.goal > 0)) p.goal = null;
  if (!Array.isArray(p.incomes)) p.incomes = [];
  if (!Array.isArray(p.udhaar)) p.udhaar = [];
  if (!Array.isArray(p.shopping)) p.shopping = [];
  if (!Array.isArray(p.festivals)) p.festivals = [];
  return p;
}
prof();

// ================== CATEGORIES ==================
var CATEGORIES = {
  food:     { label: 'Khana-Peena',   icon: '🍛', color: '#f97316' },
  travel:   { label: 'Aavaghat',      icon: '🚌', color: '#3b82f6' },
  bill:     { label: 'Bill-Recharge', icon: '🧾', color: '#8b5cf6' },
  health:   { label: 'Dawai-Sehat',   icon: '💊', color: '#22c55e' },
  shopping: { label: 'Shopping',      icon: '🛍️', color: '#ec4899' },
  fun:      { label: 'Masti',         icon: '🎉', color: '#eab308' },
  other:    { label: 'Aur Kuch',      icon: '💸', color: '#94a3b8' }
};

function autoCategory(name) {
  var n = (name || '').toLowerCase();
  if (/(chai|coffee|tea|nashta|breakfast|khana|lunch|dinner|food|sabzi|sabji|grocery|ration|bazaar|doodh|bread|mithai)/.test(n)) return 'food';
  if (/(auto|bus|train|petrol|diesel|bike|car|travel|safar|rickshaw|station)/.test(n)) return 'travel';
  if (/(bill|light|bijli|pani|wifi|internet|mobile|recharge|gas)/.test(n)) return 'bill';
  if (/(dawai|dava|medicine|doctor|ilaj|hospital|clinic)/.test(n)) return 'health';
  if (/(kapde|shirt|shoe|juta|cloth|bag|haircut|cosmetic|grooming)/.test(n)) return 'shopping';
  if (/(movie|film|game|khel|party|masti|gift|tohfa|picnic)/.test(n)) return 'fun';
  return 'other';
}

function getCategory(e) {
  return (e.category && CATEGORIES[e.category]) ? e.category : autoCategory(e.name);
}

// ================== I18N ==================
var T = {
  hi: {
    appTitle: '💰 Keshu Kharcha Tracker', appSub: 'Roz ka kharcha aasan bhasha me track karein',
    settings: '⚙️ Settings', themeBtn: 'Dark Mode', langBtn: 'English',
    moneyLabel: 'Mere paas ab itne paise hai', moneyPh: 'Total paisa (₹)',
    sentencePrompt: '✏️ <b>Total paisa</b> set karein — har kharche ke saath baaki paise khud update hota rahega.',
    sentenceLeft: 'Mere paas <b>{M}</b> total paise the, isme se <b>{S}</b> kharch ho gaya, ab mere paas <b>{L}</b> hai.',
    sentenceOver: 'Mere paas <b>{M}</b> paise the, isme se <b>{S}</b> kharch ho gaya — ⚠️ <b>{O}</b> zyada kharch ho gaya hai!',
    bannerMsg: 'Aaj ka koi kharcha nahi — log karo!',
    formTitle: '➕ Naya Kharcha', nameLabel: 'Kharche ka naam', namePh: 'Jaise: sabzi, chai, auto...',
    catLabel: 'Category (kis cheez ka kharcha)', catAuto: '✨ Apne aap pehchaan lega',
    amountLabel: 'Rakam (₹)', dateLabel: 'Tarikh', addBtn: 'Kharcha Jodein',
    presetsLabel: '⚡ Quick:', presetAdd: '+ Naya', presetDel: '✎ Hatao',
    tabs: { today: 'Aaj', month: 'Ye Mahina', week: 'Is Hafte', all: 'Sab' },
    chartTitle: '📈 Pichle 6 mahine ka kharcha',
    listTitle: '📋 Kharche ki Suchi', clearAll: 'Sab mitayein',
    searchPh: '🔎 Kharche ka naam dhundo...',
    profileTitle: '👤 Naya profile jodein', profilePh: 'Naam (jaise: Papa, Mummy)',
    iconLabel: 'Icon chunein (optional)', profPanelTitle: '👥 FAMILY PROFILES',
    cancel: 'Cancel', jodein: 'Jodein', rukjao: 'Ruk jaao', confirmYes: 'Haan, karo',
    confirmTitle: '⚠️ Confirm karein',
    emptyToday: 'Aaj koi kharcha nahi hua.', emptyMonth: 'Is mahine abhi koi kharcha nahi hua.',
    emptyWeek: 'Is hafte abhi koi kharcha nahi hua.',
    emptyAll: 'Abhi koi kharcha nahi hai.', emptyAll2: 'Upar se apna pehla kharcha jodein!',
    toastProfileOpen: 'ka hisaab khul gaya', toastProfileAdded: 'jod diya — ab ✏️ se iska paisa set karein',
    toastProfileExists: '⚠️ Ye naam pehle se hai', toastProfileDeleted: 'delete ho gaya',
    toastAlertMoney: '✅ Total paisa update ho gaya:', toastAdded: '✅ Jod diya:',
    toastDeleted: '🗑️ Hata diya gaya: Kharcha', toastCleared: '🧹 Sab kharche mit gaye',
    toastFill: '⚠️ Sab details bharein', toastMoneyBad: '⚠️ Sahi rakam likhein',
    toastBudget80: '⚠️ Budget ke 80% poore ho gaye:', toastBudget100: '🚨 Budget paura ho gaya:',
    budgetLabel: 'Category Budget (₹, khali = nahi)', budgetBtn: '🎨 Budget set karein', budgetSave: 'Save',
    biggest: '🏆 Sabse mehanga:',
    trendSame: 'Pichle mahine jaise hi kharch ho raha hai.',
    trendUp: 'Pichle mahine se {A} ({P}%) zyada kharch ho raha hai!',
    trendDown: 'Pichle mahine se {A} ({P}%) kam kharch ho raha hai — shabaash! 👏',
    tagMehenga: 'Mehenga', tagSasta: 'Sasta',
    calendarTitle: '📅 Calendar', calendarSum: 'Is mahine: {S}',
    famTotal: '👨‍👩‍👧 Poore ghar ka kharcha (is mahine):',
    shareText: "📊 *Keshu Kharcha Tracker Report*\n🗓️ Mahine: {MON}\n👨‍👩‍👧 Poore ghar ka kharcha: {TOT}\n{DETAILS}\n💰 Mera bache hue paise: {BAL}\n\n(Keshu Kharcha Tracker app se)",
    shareDetailRow: '{ICON} {NAME}: {AMT}',
    toastShareOpened: '📤 WhatsApp khul gaya — report ready hai!',
    goalTitle: '🎯 Is mahine ka kharcha-maksad',
    goalHelp: 'Is mahine aap itne se zyada kharch nahi karna chahte. Khali = maksad nahi.',
    goalPh: 'Maksad (₹)',
    goalSet: 'Maksad set karein', goalChange: 'Badlein',
    goalRowNone: 'Koi maksad nahi — set kare!', goalRowSet: 'Kharch: {S} / maksad: {G}',
    goalOk: '🎉 Maksad ke andar ho — {L} bach gaya!', goalOver: '🚨 Maksad se {O} zyada!',
    health: '🚦 Health:', healthGood: '🟢 Badhiya — hisaab me ho', healthWarn: '🟡 Kharch thoda tez hai', healthBad: '🔴 Zyada kharch ho raha hai!',
    estimate: '🔮 {D} din me {S} hua — pura mahine ~{E} lag sakta hai',
    cloudTitle: '☁️ Cloud Backup (Firebase)',
    cloudHelp: 'Ek baar setup: Firebase me free project banao → Realtime Database → test mode rules → uska URL yaha daalo. Phir khud ka secret code chuno — data usi code ke niche save hoga (naye phone me sirf wahi code daalo).',
    cloudSaveBtn: '☁️ Save', cloudLoadBtn: '⬇️ Cloud se lao',
    toastCloudSaved: '✅ Cloud par save ho gaya', toastCloudLoaded: '✅ Cloud se data aa gaya!',
    toastCloudErr: '⚠️ Cloud se baat nahi hui — net/config check karein', toastCloudLoading: '⏳ Cloud se laa rahe hain...',
    toastGoalSaved: '🎯 Maksad update ho gaya',
    catModalTitle: '➕ Nayi category jodein', catNamePh: 'Naam (jaise: Mandir, School Fees)', catIconPh: 'Emoji (jaise: 🏠)',
    catSave: 'Jodein', catMyList: 'Aapki nayi categories (✕ = hatao):',
    toastCatAdded: '✅ Category jod di — ab form me dikhegi!', toastCatDup: '⚠️ Ye naam ki category pehle se hai', toastCatNeed: '⚠️ Pehle naam likhein',
    pinHelpNew: 'Agle baar app khulne par ye PIN lagega — sirf aap dekh sakenge!',
    pinHelpCurrent: 'Pehle apna purana PIN likhein — phir naya set hoga.',
    pinTitleNew: '🔒 Naya PIN set karein', pinTitleCurrent: '🔒 Purana PIN pehle',
    toastPinSet: '✅ PIN set ho gaya!', toastPinRemoved: '🔓 PIN hata diya', toastPinWrong: '⚠️ Pehle sahi PIN likhein', toastPinBad: '⚠️ PIN 4 digit ka number hona chahiye',
    lockTitle: 'App lock hai', lockWrong: '❌ Galat PIN — dobara try karein',
    lockForgotConfirm1: 'PIN bhool gaye? Data rahega, pin hata denge. Chal rahe?',
    toastMicNo: '⚠️ Is browser me mic kaam nahi karta — Chrome/Android me try karein',
    toastMicOn: '🎤 Bolein — sun raha hoon...', toastMicNone: '🎤 Kuch samajh nahi aaya, dobara bolein',
    toastMicAnswer: '🎤 Likh diya:',
    streakRow: '🔥 Lagataar din jod rahe ho: {D} {BADGE}', streakNone: '🔥 Roz 1 kharcha jodo — streak shuru karo!',
    badge1: '🥉 shuruaat!', badge2: '🥈 acha chal rahe ho!', badge3: '🥇 champion!', badge4: '🏆 legend!',
    csvBtn: '📥 Excel', toastCsvMade: '✅ Excel/CSV file download ho gayi',
    yearlyTitle: '🎁 Is saal ka poora hisaab', yearlyRow: '{MON}: {A}',
    autoCloudLabel: '☁️ Har kharcha khud cloud par save ho jaye', toastAutoCloudSaved: '☁️ Auto-save: cloud par chala gaya',
    undoBtn: '↩️ Wapas lao', toastUndone: '✅ Kharcha wapas aa gaya!', toastClearedUndone: '↩️ Sab wapas aa gaya!',
    incomeTitle: '✅ Paisa aaya', incomeTitleSaved: '✅ Paisa jud gaya:', incomeBad: '⚠️ Rakam aur kisse (dono) likhein', incomeDeleted: '🗑️ Income entry hata di — paisa ghata di gayi',
    noteSavedTag: '📝 Note',
    photoAdded: '📸 Photo jod di — Save dabana!', photoBig: '⚠️ Photo badi hai, thodi chhoti try karein',
    pieTitle: '🥧 Is mahine ka hisaab', pieNone: 'Is mahine ka kharcha — pie yahan dikhega',
    settingsTitle: '⚙️ Settings', cycleSaved: '📅 Mahine ki shuruaat update ho gayi', cycleBad: '⚠️ 1 se 28 ke beech ki tarikh',
    recSaved: '🔁 Recurring set — har mahine khud aayega', recBad: '⚠️ Naam, rakam aur tarikh teenо likhein',
    recDelConfirm: 'Ye recurring hatane se har mahine auto-add band ho jayega. Chal rahe?',
    recAddedNow: '🔁 Is mahine ka ye kharcha khud jod diya:',
    notifOk: '🔔 Notification ON — ab app khulne par yaad milega', notifNo: '⚠️ Phone ne permission nahi di — Chrome settings me allow karein',
    notifBody: 'Aaj ka koi kharcha nahi — log karо!',
    greetMorning: '🌅 Nayi subah, naya hisaab!', greetAfternoon: '🌤️ Namaste!', greetEvening: '🌆 Shubh sandhya!',
    welcomeBtn: 'Shuru karo 🚀', userNamePh: 'Aapka naam likho (jaise: Keshu)', nameSaved: 'naam save ho gaya! 🎉',
    quickAdd: '⚡ Smart add', calcBad: '⚠️ Ye hisaab samajh nahi aaya (jaise: 50+30)', calcDone: '🧮',
    udhaarSaved: '🤝 Udhaar likh diya:', udhaarBad: '⚠️ Naam aur rakam dono likhein', udhaarSettled: '✅ Settle ho gaya — hisaab barabar!', udhaarDeleted: '🗑️ Udhaar entry hata di',
    udDiyaTotal: '💸 Maine diya (wapas lena hai)', udLiyaTotal: '🤲 Maine liya (wapas dena hai)', udhaarEmpty: 'Abhi koi udhaar nahi — 🤝 button se jodо',
    udSettle: '✓ Settle', udSettledTag: '✅ Settled',
    shopSaved: '🛒 List me jod diya:', shopBad: '⚠️ Saman ka naam likhein', shopDeleted: '🗑️ List se hata diya', shopEmpty: 'List khaali hai — upar se jodо',
    shopConvert: '💰 Kharcha jodo', shopConverted: '⚡ Form me bhar diya — rakam daalo aur Save dabao!',
    shopQuickSaved: '⚡ saman list me jud gaye!', shopQuickBad: '⚠️ Kuch samajh nahi aaya — aise likho: doodh 40, sabzi 80', shopTotal: '🧮 Kharidne ka total',
    shopNext: 'Ab ye lena hai',
    shopAllDone: '✅ Sab kharid liya — badhai!', shopAllOpened: '↩️ Sab wapas pending me',
    festSaved: '🪔 Festival budget ban gaya:', festBad: '⚠️ Naam aur total budget dono likhein', festDeleted: '🗑️ Festival hata diya (uske kharche list me rehte hain)',
    festSpentOf: 'kharch hua', festSpendSaved: '🪔 Festival me kharcha jud gaya:', festSpendBad: '⚠️ Kharche ka naam aur rakam likhein', festOver: '🚨 Budget se zyada kharch!',
    festBacha: '💰 Bache hai', festOverAmt: 'zyada kharch ho gaya',
    compareTitle: '📊 Is mahine vs pichle mahine', compareNoPrev: 'Pichle mahine ka data khaali hai — comparison agle mahine se dikhega'
  },
  en: {
    appTitle: '💰 Keshu Kharcha Tracker', appSub: 'Track daily expenses the easy way',
    settings: '⚙️ Settings', themeBtn: 'Dark Mode', langBtn: 'Hindi',
    moneyLabel: 'Money I have now', moneyPh: 'Total money (₹)',
    sentencePrompt: '✏️ Set your <b>total money</b> — balance updates automatically with every expense.',
    sentenceLeft: 'I had <b>{M}</b>, spent <b>{S}</b>, now I have <b>{L}</b>.',
    sentenceOver: 'I had <b>{M}</b>, spent <b>{S}</b> — ⚠️ <b>{O}</b> over-spent!',
    bannerMsg: 'No expense logged today — add one!',
    formTitle: '➕ New Expense', nameLabel: 'Expense name', namePh: 'E.g., tea, auto, groceries...',
    catLabel: 'Category', catAuto: '✨ Detect automatically',
    amountLabel: 'Amount (₹)', dateLabel: 'Date', addBtn: 'Add Expense',
    presetsLabel: '⚡ Quick:', presetAdd: '+ New', presetDel: '✎ Delete mode',
    tabs: { today: 'Today', month: 'This Month', week: 'This Week', all: 'All' },
    chartTitle: '📈 Last 6 months spending',
    listTitle: '📋 Expense List', clearAll: 'Clear all',
    searchPh: '🔎 Search expenses...',
    profileTitle: '👤 Add new profile', profilePh: 'Name (e.g., Papa)',
    iconLabel: 'Pick an icon (optional)', profPanelTitle: '👥 FAMILY PROFILES',
    cancel: 'Cancel', jodein: 'Add', rukjao: 'Cancel', confirmYes: 'Yes, do it',
    confirmTitle: '⚠️ Confirm',
    emptyToday: 'Nothing spent today.', emptyMonth: 'No expenses this month yet.', emptyWeek: 'No expenses this week yet.',
    emptyAll: 'No expenses yet.', emptyAll2: 'Add your first expense above!',
    toastProfileOpen: 'opened', toastProfileAdded: 'added — set money with ✏️',
    toastProfileExists: '⚠️ Name already exists', toastProfileDeleted: 'deleted',
    toastAlertMoney: '✅ Total money updated:', toastAdded: '✅ Added:',
    toastDeleted: '🗑️ Expense removed', toastCleared: '🧹 All cleared',
    toastFill: '⚠️ Fill all details', toastMoneyBad: '⚠️ Enter a valid amount',
    toastBudget80: '⚠️ 80% of budget used:', toastBudget100: '🚨 Budget exceeded:',
    budgetLabel: 'Category Budget (₹, blank = none)', budgetBtn: '🎨 Budgets', budgetSave: 'Save',
    biggest: '🏆 Biggest:',
    famTotal: '👨‍👩‍👧 Whole family spending (this month):',
    shareText: "📊 *Keshu Kharcha Tracker Report*\n🗓️ Month: {MON}\n👨‍👩‍👧 Family total: {TOT}\n{DETAILS}\n💰 My remaining money: {BAL}\n\n(sent via Keshu Kharcha Tracker)",
    shareDetailRow: '{ICON} {NAME}: {AMT}',
    toastShareOpened: '📤 WhatsApp opened — report ready!',
    trendSame: 'Spending is similar to last month.',
    trendUp: '{A} ({P}%) more than last month!',
    trendDown: '{A} ({P}%) less than last month — well done! 👏',
    tagMehenga: 'Pricey', tagSasta: 'Cheap',
    calendarTitle: '📅 Calendar', calendarSum: 'This month: {S}',
    goalTitle: "🎯 This month's spending target",
    goalHelp: 'Spend no more than this amount this month. Blank = no target.',
    goalPh: 'Target (₹)',
    goalSet: 'Set target', goalChange: 'Change',
    goalRowNone: 'No spending target — set one!', goalRowSet: 'Spent {S} / target {G}',
    goalOk: '🎉 Within target — {L} saved!', goalOver: '🚨 {O} over target!',
    health: '🚦 Health:', healthGood: '🟢 Balanced — well done', healthWarn: '🟡 Spending a bit fast', healthBad: '🔴 Over-spending!',
    estimate: '🔮 Estimate: spent {S} in {D} days → whole month ~{E}',
    cloudSaveBtn: '☁️ Save', cloudLoadBtn: '⬇️ Load from cloud',
    cloudHelp: 'One-time setup: create a free Firebase project → Realtime Database → test-mode rules → paste its URL here. Then pick your own secret code — data is saved under that code (enter the same code on a new phone).',
    toastCloudSaved: '✅ Saved to cloud', toastCloudLoaded: '✅ Data loaded from cloud!',
    toastCloudErr: "⚠️ Couldn't reach cloud — check net/config", toastCloudLoading: '⏳ Loading from cloud...',
    toastGoalSaved: '🎯 Target updated',
    calendarTitle: '📅 Calendar', calendarSum: 'This month: {S}',
    goalTitle: '🎯 This month\'s spending target',
    goalHelp: 'Spend no more than this amount this month. Blank = no target.',
    goalPh: 'Target (₹)',
    goalSet: 'Set target', goalChange: 'Change',
    goalRowNone: 'No spending target — set one!', goalRowSet: 'Spent {S} / target {G}',
    goalOk: '🎉 Within target — {L} saved!', goalOver: '🚨 {O} over target!',
    health: '🚦 Health:', healthGood: '🟢 Balanced — well done', healthWarn: '🟡 Spending a bit fast', healthBad: '🔴 Over-spending!',
    estimate: '🔮 Estimate: spent {S} in {D} days → whole month ~{E}',
    cloudSaveBtn: '☁️ Save', cloudLoadBtn: '⬇️ Load from cloud',
    cloudHelp: 'One-time setup: create a free Firebase project → Realtime Database → test-mode rules → paste its URL here. Then pick your own secret code — data is saved under that code (enter the same code on a new phone).',
    toastCloudSaved: '✅ Saved to cloud', toastCloudLoaded: '✅ Data loaded from cloud!',
    toastCloudErr: "⚠️ Couldn't reach cloud — check net/config", toastCloudLoading: '⏳ Loading from cloud...',
    toastGoalSaved: '🎯 Target updated',
    catModalTitle: '➕ Add a category', catNamePh: 'Name (e.g. Temple, School Fees)', catIconPh: 'Emoji (e.g. 🏠)',
    catSave: 'Add', catMyList: 'Your categories (✕ = remove):',
    toastCatAdded: '✅ Category added — see it in the form!', toastCatDup: "⚠️ Category name already exists", toastCatNeed: '⚠️ Enter a name first',
    pinHelpNew: 'Next time the app opens, this PIN will be asked. Only you can see it!',
    pinHelpCurrent: 'Enter your old PIN first — then set a new one.',
    pinTitleNew: '🔒 Set new PIN', pinTitleCurrent: '🔒 Enter old PIN first',
    toastPinSet: '✅ PIN set!', toastPinRemoved: '🔓 PIN removed', toastPinWrong: '⚠️ Enter the correct old PIN first', toastPinBad: '⚠️ PIN must be a 4-digit number',
    lockTitle: 'App is locked', lockWrong: '❌ Wrong PIN — try again',
    lockForgotConfirm1: 'Forgot PIN? Your data stays, we remove the PIN. Continue?',
    toastMicNo: '⚠️ Mic not supported here — try Chrome/Android',
    toastMicOn: '🎤 Speak — listening...', toastMicNone: "🎤 Didn't catch that, try again",
    toastMicAnswer: '🎤 Wrote:',
    streakRow: '🔥 Streak: {D} {BADGE}', streakNone: '🔥 Log daily to start a streak!',
    badge1: '🥉 starter!', badge2: '🥈 going strong!', badge3: '🥇 champion!', badge4: '🏆 legend!',
    csvBtn: '📥 Excel', toastCsvMade: '✅ Excel/CSV file downloaded',
    yearlyTitle: '🎁 Whole-year summary', yearlyRow: '{MON}: {A}',
    autoCloudLabel: '☁️ Auto-save every expense to cloud', toastAutoCloudSaved: '☁️ Auto-saved to cloud',
    undoBtn: '↩️ Undo', toastUndone: '✅ Expense restored!', toastClearedUndone: '↩️ All restored!',
    incomeTitle: '✅ Money received', incomeTitleSaved: '✅ Added:', incomeBad: '⚠️ Amount and source, both needed', incomeDeleted: '🗑️ Income removed (money reduced)',
    noteSavedTag: '📝 Note',
    photoAdded: '📸 Photo added — press Save!', photoBig: '⚠️ Photo too large, try a smaller one',
    pieTitle: '🥧 This month split', pieNone: 'This month spending — pie will show here',
    settingsTitle: '⚙️ Settings', cycleSaved: '📅 Month start date updated', cycleBad: '⚠️ Date must be 1 to 28',
    recSaved: '🔁 Recurring set — auto-added every month', recBad: '⚠️ Name, amount and date — all three needed',
    recDelConfirm: 'Removing this recurring stops monthly auto-add. Continue?',
    recAddedNow: '🔁 Auto-added this month:',
    notifOk: '🔔 Bell ON — reminder when app opens', notifNo: "⚠️ Phone didn't allow — enable in Chrome settings",
    notifBody: 'Nothing spent today — log it!',
    greetMorning: '☀️ Good morning!', greetAfternoon: '🌤️ Good afternoon!', greetEvening: '🌆 Good evening!',
    welcomeBtn: "Let's start 🚀", userNamePh: 'Type your name (like: Keshu)', nameSaved: 'name saved! 🎉',
    quickAdd: '⚡ Smart add', calcBad: "⚠️ Can't read that math (like: 50+30)", calcDone: '🧮',
    udhaarSaved: '🤝 Loan logged:', udhaarBad: '⚠️ Name and amount both needed', udhaarSettled: '✅ Settled — all square!', udhaarDeleted: '🗑️ Loan entry removed',
    udDiyaTotal: '💸 I gave (to get back)', udLiyaTotal: '🤲 I took (to repay)', udhaarEmpty: 'No loans yet — use 🤝 button',
    udSettle: '✓ Settle', udSettledTag: '✅ Settled',
    shopSaved: '🛒 Added to list:', shopBad: '⚠️ Type the item name', shopDeleted: '🗑️ Removed from list', shopEmpty: 'List empty — add above',
    shopConvert: '💰 Add expense', shopConverted: '⚡ Filled in form — type amount and press Save!',
    shopQuickSaved: '⚡ items added to list!', shopQuickBad: "⚠️ Can't read that — write like: doodh 40, sabzi 80", shopTotal: '🧮 Shopping total',
    shopNext: 'Buy this next',
    shopAllDone: '✅ All bought — well done!', shopAllOpened: '↩️ All back to pending',
    festSaved: '🪔 Festival budget created:', festBad: '⚠️ Name and total budget both needed', festDeleted: '🗑️ Festival removed (its expenses stay)',
    festSpentOf: 'spent', festSpendSaved: '🪔 Added to festival:', festSpendBad: '⚠️ Expense name and amount needed', festOver: '🚨 Over budget!',
    festBacha: '💰 Left', festOverAmt: 'over budget',
    compareTitle: '📊 This month vs last', compareNoPrev: 'No data last month — comparison shows from next month'
  }
};
function t(key) { return T[settings.lang][key] !== undefined ? T[settings.lang][key] : T.hi[key]; }
function fmt(n) { return '₹' + Number(n).toLocaleString('en-IN'); }

// ================== HELPERS ==================
function getTodayStr() {
  var d = new Date();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}
function monthStr(offset) {
  var d = new Date();
  d.setMonth(d.getMonth() - (offset || 0));
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function monthShortLabel(yms) {
  var p = (yms || '').split('-');
  if (p.length !== 2) return yms;
  var names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return names[parseInt(p[1], 10) - 1] + ' ' + String(p[0]).slice(2);
}
function formatDate(iso) {
  var parts = (iso || '').split('-');
  if (parts.length !== 3) return iso || '';
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return parts[2] + ' ' + months[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
}
function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function isMonthOf(dateStr, refStr) { return (dateStr || '').slice(0, 7) === refStr.slice(0, 7); }
function getMonthOf(dateStr) { return (dateStr || '').slice(0, 7); }
// Is hafte (Mon-Sun) ka date-range
function weekRange() {
  var d = new Date();
  var day = d.getDay(); // 0 Sun
  var diff = (day === 0 ? -6 : 1 - day); // Monday se shuru
  var mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
  var sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  function iso(x) { return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  return { start: iso(mon), end: iso(sun) };
}
function isWeekOf(dateStr) {
  var r = weekRange();
  return (dateStr || '') >= r.start && (dateStr || '') <= r.end;
}
function fmtIso(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
// Salary-cycle: mahina cycleDay tarikh se shuru hota hai (default 1)
function cycleDay() { return (settings.cycleDay && settings.cycleDay >= 2 && settings.cycleDay <= 28) ? settings.cycleDay : 1; }
function cycOf(dateStr) {
  var cd = cycleDay();
  if (cd <= 1) return getMonthOf(dateStr);
  var pr = (dateStr || '').split('-');
  if (pr.length !== 3) return getMonthOf(dateStr);
  var y = Number(pr[0]), m = Number(pr[1]), d = Number(pr[2]);
  if (d < cd) { m--; if (m < 1) { m = 12; y--; } }
  return y + '-' + String(m).padStart(2, '0');
}
function curCycle() { return cycOf(getTodayStr()); }
function cycPrev(cycKey) {
  var pr = (cycKey || '').split('-');
  if (pr.length !== 2) return cycKey;
  var y = Number(pr[0]), m = Number(pr[1]) - 1;
  if (m < 1) { m = 12; y--; }
  return y + '-' + String(m).padStart(2, '0');
}
function cycleSeries(n) {
  var out = [];
  var base = curCycle().split('-');
  var y = Number(base[0]), m = Number(base[1]);
  for (var i = n - 1; i >= 0; i--) {
    var mm = m - i, yy = y;
    while (mm < 1) { mm += 12; yy--; }
    out.push(yy + '-' + String(mm).padStart(2, '0'));
  }
  return out;
}

// ================== TOAST ==================
var toastTimer = null;
function showToast(msg, actionLabel, actionFn) {
  if (actionLabel && actionFn) {
    toastEl.innerHTML = escapeHtml(String(msg)) +
      ' <button type="button" class="t-action">' + escapeHtml(actionLabel) + '</button>';
    var ab = toastEl.querySelector('.t-action');
    ab.addEventListener('click', function () {
      toastEl.classList.remove('show');
      actionFn();
    });
  } else {
    toastEl.textContent = msg;
  }
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, actionLabel ? 6000 : 2200);
}

// ================== APPLY I18N (static text) ==================
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(function (el) {
    var v = t(el.getAttribute('data-i18n'));
    if (typeof v === 'string') el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
    el.placeholder = t(el.getAttribute('data-i18n-ph'));
  });
  var catAuto = document.querySelector('#category option[value="auto"]');
  if (catAuto) catAuto.textContent = t('catAuto');
  document.querySelectorAll('.tab').forEach(function (el) {
    var f = el.getAttribute('data-i18n-tab');
    el.textContent = t('tabs')[f] || el.textContent;
  });
  document.getElementById('langBtn').textContent = settings.lang === 'hi' ? 'English' : 'Hindi';
  render();
}

// ================== SETTINGS UI ==================
document.getElementById('themeBtn').addEventListener('click', function () {
  settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
  saveSettings();
  applySettings();
  showToast(settings.theme === 'dark' ? '🌙 Dark mode ON' : '☀️ Light mode ON');
});
document.getElementById('langBtn').addEventListener('click', function () {
  settings.lang = settings.lang === 'hi' ? 'en' : 'hi';
  saveSettings();
  applyI18n();
});
document.querySelector('.top-controls').addEventListener('click', function (e) {
  var dot = e.target.closest('.accent-dot');
  if (!dot) return;
  settings.accent = dot.getAttribute('data-a');
  saveSettings();
  applySettings();
  document.querySelectorAll('.accent-dot').forEach(function (d) {
    d.classList.toggle('sel', d === dot);
  });
});
function paintAccentDots() {
  document.querySelectorAll('.accent-dot').forEach(function (d) {
    d.classList.toggle('sel', d.getAttribute('data-a') === settings.accent);
  });
}

// ================== PROFILES (FAMILY MODE) ==================
var PROF_ICONS = ['🙂','😎','👨','👩','🧑','👧','🧔','🧓'];

function renderProfiles() {
  var bar = document.getElementById('profileBar');
  var names = Object.keys(db.profiles);
  var html = names.map(function (n, i) {
    var icon = db.profiles[n].icon || PROF_ICONS[i % PROF_ICONS.length];
    var active = n === db.active ? ' active' : '';
    return '<button type="button" class="prof-chip' + active + '" data-name="' + escapeHtml(n) + '">' +
           '<span class="p-icon">' + icon + '</span>' + escapeHtml(n) + '</button>';
  }).join('');
  html += '<button type="button" class="prof-add" id="profAddBtn" aria-label="Naya profile" title="Naya profile jodein (Papa, Mummy...)">+ Naya profile</button>';
  html += '<button type="button" class="prof-manage" id="profManageBtn" aria-label="Profiles" title="Profiles manage karo (hatana / icon badalna)">👥 Manage</button>';
  bar.innerHTML = html;
  renderProfilePanel();
}

function renderProfilePanel() {
  var panel = document.getElementById('profPanel');
  if (panel.hidden) return;
  var names = Object.keys(db.profiles);
  var html = '<div style="font-weight:700;color:var(--muted);font-size:.72rem;padding:2px 4px 6px;">' + t('profPanelTitle') + '</div>';
  names.forEach(function (n) {
    var p = db.profiles[n];
    html += '<div class="pp-row"><span><b>' + escapeHtml(n) + '</b> <small style="color:var(--muted)">(' +
      (p.expenses || []).length + ')</small></span>' +
      '<button type="button" class="pp-del" data-n="' + escapeHtml(n) + '"' +
      (names.length < 2 ? ' disabled' : '') + '>🗑️</button></div>';
  });
  panel.innerHTML = html;
}

document.getElementById('profileBar').addEventListener('click', function (e) {
  var chip = e.target.closest('.prof-chip');
  var add = e.target.closest('#profAddBtn');
  var gear = e.target.closest('#profManageBtn');
  if (chip) {
    db.active = chip.getAttribute('data-name');
    saveDB();
    document.getElementById('profPanel').hidden = true;
    searchInput.value = '';
    render();
    showToast('👤 ' + db.active + ' ' + t('toastProfileOpen'));
    return;
  }
  if (add) { openProfModal(); return; }
  if (gear) {
    var panel = document.getElementById('profPanel');
    panel.hidden = !panel.hidden;
    renderProfilePanel();
  }
});

document.getElementById('profPanel').addEventListener('click', function (e) {
  var btn = e.target.closest('.pp-del');
  if (!btn || btn.disabled) return;
  var n = btn.getAttribute('data-n');
  if (Object.keys(db.profiles).length < 2) return;
  showConfirm(
    (settings.lang === 'en'
      ? '"' + n + '" and all its data will be deleted. Sure?'
      : '"' + n + '" ka saara data (kharche + paisa) mit jayega. Pakka?'),
    function () {
      delete db.profiles[n];
      if (db.active === n) db.active = Object.keys(db.profiles)[0];
      saveDB();
      document.getElementById('profPanel').hidden = true;
      render();
      showToast('🗑️ "' + n + '" ' + t('toastProfileDeleted'));
    }
  );
});

// ---- Profile modal (phone-safe) ----
var profModal = document.getElementById('profModal');
var profNameInput = document.getElementById('profNameInput');
var profIconRow = document.getElementById('profIconRow');
var chosenProfIcon = null;

function openProfModal() {
  chosenProfIcon = null;
  profNameInput.value = '';
  var idx = Object.keys(db.profiles).length % PROF_ICONS.length;
  var html = PROF_ICONS.map(function (ic, i) {
    var sel = (i === idx) ? ' sel' : '';
    if (sel) chosenProfIcon = ic;
    return '<button type="button" class="icon-opt' + sel + '" data-i="' + i + '">' + ic + '</button>';
  }).join('');
  profIconRow.innerHTML = html;
  profModal.hidden = false;
  setTimeout(function () { profNameInput.focus(); }, 60);
}

profIconRow.addEventListener('click', function (e) {
  var opt = e.target.closest('.icon-opt');
  if (!opt) return;
  profIconRow.querySelectorAll('.icon-opt').forEach(function (x) { x.classList.remove('sel'); });
  opt.classList.add('sel');
  chosenProfIcon = PROF_ICONS[Number(opt.getAttribute('data-i'))];
});
document.getElementById('profCancel').addEventListener('click', function () { profModal.hidden = true; });
profModal.addEventListener('click', function (e) { if (e.target === profModal) profModal.hidden = true; });

function commitProfile() {
  var n = (profNameInput.value || '').trim();
  if (!n) { showToast(settings.lang === 'en' ? '⚠️ Enter a name' : '⚠️ Naam likhein'); profNameInput.focus(); return; }
  if (db.profiles[n]) { showToast(t('toastProfileExists')); return; }
  var p = emptyProfile();
  p.icon = chosenProfIcon;
  db.profiles[n] = p;
  db.active = n;
  saveDB();
  profModal.hidden = true;
  document.getElementById('profPanel').hidden = true;
  searchInput.value = '';
  render();
  showToast('👤 ' + n + ' ' + t('toastProfileAdded'));
}
document.getElementById('profSave').addEventListener('click', commitProfile);
profNameInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); commitProfile(); }
});

// ================== CONFIRM (phone-safe) ==================
var confirmModal = document.getElementById('confirmModal');
var confirmMsg = document.getElementById('confirmMsg');
var confirmCallback = null;
function showConfirm(msg, onYes) {
  confirmMsg.textContent = msg;
  confirmCallback = onYes;
  confirmModal.hidden = false;
}
document.getElementById('confirmYes').addEventListener('click', function () {
  confirmModal.hidden = true;
  var cb = confirmCallback; confirmCallback = null;
  if (cb) cb();
});
document.getElementById('confirmNo').addEventListener('click', function () {
  confirmModal.hidden = true; confirmCallback = null;
});
confirmModal.addEventListener('click', function (e) {
  if (e.target === confirmModal) { confirmModal.hidden = true; confirmCallback = null; }
});

// ================== EDIT EXPENSE MODAL ==================
var editModal = document.getElementById('editModal');
var editName = document.getElementById('editName');
var editAmount = document.getElementById('editAmount');
var editDate = document.getElementById('editDate');
var editCategory = document.getElementById('editCategory');
var editNote = document.getElementById('editNote');
var editingId = null;
var editingPhoto = undefined; // undefined = kuch nahi kiya, null = hataya, string = nayi photo

function openEditModal(id) {
  var p = prof();
  var e = null;
  p.expenses.forEach(function (x) { if (x.id === id) e = x; });
  if (!e) return;
  editingId = id;
  editingPhoto = undefined;
  editName.value = e.name;
  editAmount.value = e.amount;
  editDate.value = e.date;
  editCategory.value = getCategory(e);
  editNote.value = e.note || '';
  document.getElementById('photoDelBtn').hidden = !e.photo;
  document.getElementById('photoAddBtn').textContent = e.photo ? '📸 Photo lagi hai (badlein)' : '📸 Bill photo jodo';
  editModal.hidden = false;
  setTimeout(function () { editName.focus(); }, 60);
}
document.getElementById('editCancel').addEventListener('click', function () { editModal.hidden = true; });
editModal.addEventListener('click', function (ev) { if (ev.target === editModal) editModal.hidden = true; });
document.getElementById('editSave').addEventListener('click', function () {
  var p = prof();
  var name = editName.value.trim();
  var amount = parseFloat(editAmount.value);
  var date = editDate.value;
  if (!name || !(amount > 0) || !date) {
    showToast(t('toastFill'));
    return;
  }
  p.expenses.forEach(function (x) {
    if (x.id === editingId) {
      x.name = name;
      x.amount = amount;
      x.date = date;
      x.category = editCategory.value === 'auto' ? autoCategory(name) : editCategory.value;
      x.note = editNote.value.trim() || '';
      if (editingPhoto === null) delete x.photo;
      else if (typeof editingPhoto === 'string') x.photo = editingPhoto;
    }
  });
  saveDB();
  editModal.hidden = true;
  render();
  showToast('✏️ ' + name + ' → ' + fmt(amount));
});

// Photo: compress karke dataURL (400px max, JPEG ~60%)
var photoInput = document.getElementById('photoInput');
document.getElementById('photoAddBtn').addEventListener('click', function () { photoInput.click(); });
document.getElementById('photoDelBtn').addEventListener('click', function () {
  editingPhoto = null;
  document.getElementById('photoDelBtn').hidden = true;
  document.getElementById('photoAddBtn').textContent = '📸 Bill photo jodo';
  showToast(settings.lang !== 'en' ? '🗑️ Photo hatayi — Save dabana!' : '🗑️ Photo removed — press Save!');
});
photoInput.addEventListener('change', function () {
  var f = photoInput.files && photoInput.files[0];
  if (!f) return;
  var reader = new FileReader();
  reader.onload = function () {
    var img = new Image();
    img.onload = function () {
      try {
        var max = 400;
        var scale = Math.min(max / img.width, max / img.height, 1);
        var cv = document.createElement('canvas');
        cv.width = Math.round(img.width * scale);
        cv.height = Math.round(img.height * scale);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        var dataUrl = cv.toDataURL('image/jpeg', 0.6);
        if (dataUrl.length > 200000) { showToast(t('photoBig')); return; }
        editingPhoto = dataUrl;
        document.getElementById('photoDelBtn').hidden = false;
        document.getElementById('photoAddBtn').textContent = '📸 Photo lagi hai (badlein)';
        showToast(t('photoAdded'));
      } catch (e) { showToast(t('photoBig')); }
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(f);
  photoInput.value = '';
});

// Photo viewer (list me 📸 badge click)
var photoModal = document.getElementById('photoModal');
document.getElementById('photoClose').addEventListener('click', function () { photoModal.hidden = true; });
photoModal.addEventListener('click', function (ev) { if (ev.target === photoModal) photoModal.hidden = true; });
function openPhotoViewer(exp) {
  document.getElementById('photoImg').src = exp.photo;
  photoModal.hidden = false;
}

// ================== TAG (mehenga/sasta) ==================
function cycleTag(id) {
  var p = prof();
  p.expenses.forEach(function (x) {
    if (x.id === id) {
      x.tag = x.tag === 'mehenga' ? 'sasta' : (x.tag === 'sasta' ? null : 'mehenga');
    }
  });
  saveDB();
  render();
}

// ================== SEARCH ==================
var searchInput = document.getElementById('searchInput');
searchInput.addEventListener('input', function () { renderListOnly(); });

// ================== INCOME (paisa aaya) ==================
var incomeModal = document.getElementById('incomeModal');
document.getElementById('incomeBtn').addEventListener('click', function () {
  document.getElementById('incomeAmount').value = '';
  document.getElementById('incomeFrom').value = '';
  renderIncomeHistory();
  incomeModal.hidden = false;
  setTimeout(function () { document.getElementById('incomeAmount').focus(); }, 60);
});
document.getElementById('incomeCancel').addEventListener('click', function () { incomeModal.hidden = true; });
incomeModal.addEventListener('click', function (ev) { if (ev.target === incomeModal) incomeModal.hidden = true; });
document.getElementById('incomeSave').addEventListener('click', function () {
  var amt = parseFloat(document.getElementById('incomeAmount').value);
  var from = document.getElementById('incomeFrom').value.trim();
  if (!(amt > 0) || !from) { showToast(t('incomeBad')); return; }
  var p = prof();
  if (p.money === null) p.money = 0;
  p.money += amt;
  p.incomes.push({ id: Date.now(), date: getTodayStr(), amount: amt, from: from });
  saveDB();
  incomeModal.hidden = true;
  render();
  showToast(t('incomeTitleSaved') + ' +' + fmt(amt) + ' (' + from + ')');
});
function renderIncomeHistory() {
  var host = document.getElementById('incomeHistory');
  var list = prof().incomes.slice().sort(function (a, b) { return b.id - a.id; }).slice(0, 10);
  if (list.length === 0) { host.innerHTML = ''; return; }
  var html = '<div class="set-label">📋 Aakhri 10 incomes:</div>';
  list.forEach(function (inc) {
    html += '<div class="income-row"><span>' + escapeHtml(inc.from) + ' <small style="color:var(--muted)">' + formatDate(inc.date) + '</small></span>' +
      '<span class="i-amt">+' + fmt(inc.amount) + '</span>' +
      '<button type="button" class="i-del" data-iid="' + inc.id + '">✕</button></div>';
  });
  host.innerHTML = html;
}
document.getElementById('incomeHistory').addEventListener('click', function (ev) {
  var btn = ev.target.closest('.i-del');
  if (!btn) return;
  var iid = Number(btn.getAttribute('data-iid'));
  var p = prof();
  var inc = null;
  p.incomes.forEach(function (x) { if (x.id === iid) inc = x; });
  if (!inc) return;
  p.incomes = p.incomes.filter(function (x) { return x.id !== iid; });
  if (p.money !== null) p.money -= inc.amount;
  saveDB();
  renderIncomeHistory();
  render();
  showToast(t('incomeDeleted'));
});

// ================== UDHAAR KHATA ==================
var udhaarModal = document.getElementById('udhaarModal');
var udDir = 'diya';
function paintUdDir() {
  document.getElementById('udDiya').classList.toggle('active', udDir === 'diya');
  document.getElementById('udLiya').classList.toggle('active', udDir === 'liya');
}
document.getElementById('udhaarBtn').addEventListener('click', function () {
  document.getElementById('udName').value = '';
  document.getElementById('udAmount').value = '';
  document.getElementById('udDate').value = getTodayStr();
  udDir = 'diya';
  paintUdDir();
  renderUdhaar();
  udhaarModal.hidden = false;
});
document.getElementById('udCancel').addEventListener('click', function () { udhaarModal.hidden = true; });
udhaarModal.addEventListener('click', function (ev) { if (ev.target === udhaarModal) udhaarModal.hidden = true; });
document.getElementById('udDiya').addEventListener('click', function () { udDir = 'diya'; paintUdDir(); });
document.getElementById('udLiya').addEventListener('click', function () { udDir = 'liya'; paintUdDir(); });
document.getElementById('udSave').addEventListener('click', function () {
  var nm = document.getElementById('udName').value.trim();
  var amt = parseFloat(document.getElementById('udAmount').value);
  if (!nm || !(amt > 0)) { showToast(t('udhaarBad')); return; }
  var p = prof();
  p.udhaar.push({
    id: Date.now(), name: nm, amount: amt, dir: udDir,
    date: document.getElementById('udDate').value || getTodayStr(), settled: false
  });
  saveDB();
  document.getElementById('udName').value = '';
  document.getElementById('udAmount').value = '';
  renderUdhaar();
  showToast(t('udhaarSaved') + ' ' + (udDir === 'diya' ? '💸' : '🤲') + ' ' + nm + ' ' + fmt(amt));
});
function renderUdhaar() {
  var host = document.getElementById('udList');
  var p = prof();
  var list = (p.udhaar || []).slice().sort(function (a, b) { return b.id - a.id; });
  var dSum = 0, lSum = 0;
  list.forEach(function (u) { if (!u.settled) { if (u.dir === 'diya') dSum += Number(u.amount) || 0; else lSum += Number(u.amount) || 0; } });
  if (list.length === 0) { host.innerHTML = '<div class="set-label">' + t('udhaarEmpty') + '</div>'; return; }
  var html = '<div class="set-label">' + t('udDiyaTotal') + ': <b style="color:var(--danger)">' + fmt(dSum) + '</b>' +
    ' • ' + t('udLiyaTotal') + ': <b style="color:var(--ok)">' + fmt(lSum) + '</b></div>';
  list.forEach(function (u) {
    var settledCls = u.settled ? ' shop-name done' : '';
    html += '<div class="income-row' + settledCls + '">' +
      '<span>' + (u.dir === 'diya' ? '💸' : '🤲') + ' ' + escapeHtml(u.name) +
      ' <small style="color:var(--muted)">' + formatDate(u.date) + '</small></span>' +
      '<span class="i-amt" style="color:' + (u.dir === 'diya' ? 'var(--danger)' : 'var(--ok)') + '">' + fmt(u.amount) + '</span>' +
      (u.settled
        ? '<small style="color:var(--muted);font-weight:700;">' + t('udSettledTag') + '</small>'
        : '<span><button type="button" class="shop-conv" data-udset="' + u.id + '" title="' + t('udSettle') + '">' + t('udSettle') + '</button> ' +
          '<button type="button" class="i-del" data-uddel="' + u.id + '">✕</button></span>') +
      '</div>';
  });
  host.innerHTML = html;
}
document.getElementById('udList').addEventListener('click', function (ev) {
  var setB = ev.target.closest('[data-udset]');
  var delB = ev.target.closest('[data-uddel]');
  var p = prof();
  if (setB) {
    var sid = Number(setB.getAttribute('data-udset'));
    p.udhaar.forEach(function (u) { if (u.id === sid) u.settled = true; });
    saveDB();
    renderUdhaar();
    showToast(t('udhaarSettled'));
  } else if (delB) {
    var did = Number(delB.getAttribute('data-uddel'));
    p.udhaar = p.udhaar.filter(function (u) { return u.id !== did; });
    saveDB();
    renderUdhaar();
    showToast(t('udhaarDeleted'));
  }
});

// ================== SHOPPING LIST ==================
var shopModal = document.getElementById('shopModal');
document.getElementById('shopBtn').addEventListener('click', function () {
  document.getElementById('shopName').value = '';
  renderShop();
  shopModal.hidden = false;
  setTimeout(function () { document.getElementById('shopName').focus(); }, 60);
});
document.getElementById('shopCancel').addEventListener('click', function () { shopModal.hidden = true; });
shopModal.addEventListener('click', function (ev) { if (ev.target === shopModal) shopModal.hidden = true; });
document.getElementById('shopAdd').addEventListener('click', function () {
  var nm = document.getElementById('shopName').value.trim();
  if (!nm) { showToast(t('shopBad')); return; }
  var p = prof();
  p.shopping.push({ id: Date.now(), name: nm, done: false });
  saveDB();
  document.getElementById('shopName').value = '';
  renderShop();
  showToast(t('shopSaved') + ' ' + nm);
});
// ⚡ Ek line me multiple saman: "doodh 40, sabzi 80, chai 15" → 3 items
function parseQuickList(raw) {
  var out = [];
  var parts = raw.split(/[,;\n।]+/);
  if (parts.length > 1) {
    parts.forEach(function (part) {
      var s = part.trim();
      if (!s) return;
      var pm = s.match(/^(.+?)\s+([\d][\d.,]*)$/) || s.match(/^([\d][\d.,]*)\s+(.+)$/);
      if (pm) {
        var amtFirst = /^[\d]/.test(pm[1]);
        var nm = (amtFirst ? pm[2] : pm[1]).trim();
        var a = parseFloat((amtFirst ? pm[1] : pm[2]).replace(/,/g, ''));
        out.push({ name: nm, amt: (a > 0 ? a : null) });
      } else {
        out.push({ name: s, amt: null });
      }
    });
    return out;
  }
  // koi comma nahi: "doodh 40 sabzi 80 anda 60" — pair-regex
  var re = /([^\d,;\n]+?)\s+([\d][\d.,]*)/g, m, last = 0;
  while ((m = re.exec(raw)) !== null) {
    var nm2 = m[1].replace(/^[\s]+/, '').trim();
    var a2 = parseFloat(m[2].replace(/,/g, ''));
    if (nm2) out.push({ name: nm2, amt: (a2 > 0 ? a2 : null) });
    last = re.lastIndex;
  }
  var tail = raw.slice(last).trim();
  if (tail && /[a-zA-Z\u0900-\u097F]/.test(tail)) out.push({ name: tail, amt: null });
  return out;
}
document.getElementById('shopQuickAdd').addEventListener('click', function () {
  var raw = document.getElementById('shopQuick').value.trim();
  if (!raw) { showToast(t('shopQuickBad')); return; }
  var items = parseQuickList(raw);
  if (items.length === 0) { showToast(t('shopQuickBad')); return; }
  var p = prof();
  items.forEach(function (it) {
    p.shopping.push({ id: Date.now() + Math.floor(Math.random() * 900), name: it.name, amt: it.amt, done: false });
  });
  saveDB();
  document.getElementById('shopQuick').value = '';
  renderShop();
  showToast('⚡ ' + items.length + ' ' + t('shopQuickSaved'));
});
document.getElementById('shopQuick').addEventListener('keydown', function (ev) {
  if (ev.key === 'Enter') { ev.preventDefault(); document.getElementById('shopQuickAdd').click(); }
});
// ✓ Sab tick karo / ↩️ Sab wapas
document.getElementById('shopAllTick').addEventListener('click', function () {
  var p = prof(); var n = 0;
  p.shopping.forEach(function (it) { if (!it.done) { it.done = true; n++; } });
  saveDB();
  renderShop();
  showToast(n ? n + ' ' + t('shopAllDone') : t('shopEmpty'));
});
document.getElementById('shopAllUntick').addEventListener('click', function () {
  var p = prof(); var n = 0;
  p.shopping.forEach(function (it) { if (it.done) { it.done = false; n++; } });
  saveDB();
  renderShop();
  showToast(n ? n + ' ' + t('shopAllOpened') : t('shopEmpty'));
});
function renderShop() {
  var host = document.getElementById('shopList');
  var list = (prof().shopping || []).slice().sort(function (a, b) {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return b.id - a.id;
  });
  if (list.length === 0) { host.innerHTML = '<div class="set-label">' + t('shopEmpty') + '</div>'; return; }
  var pendingTotal = 0, doneTotal = 0, hasAmt = false, pendingCount = 0, doneCount = 0;
  list.forEach(function (it) {
    if (it.amt > 0) {
      hasAmt = true;
      if (it.done) doneTotal += it.amt; else { pendingTotal += it.amt; pendingCount++; }
    }
    if (it.done) doneCount++; 
  });
  var totalCount = pendingCount + doneCount;
  var nextBuyId = null, nextBuyName = '';
  list.forEach(function (it) {
    if (!it.done && nextBuyId === null) { nextBuyId = it.id; nextBuyName = it.name; }
  });
  var html = '';
  if (hasAmt) {
    html += '<div class="shop-sum">' +
      '<div class="ss-row"><span>🧮 ' + t('shopTotal') + '</span><b>' + fmt(pendingTotal + doneTotal) + '</b></div>' +
      '<div class="ss-row"><span>🛍️ ' + (settings.lang === 'en' ? 'Left to buy' : 'Abhi kharidna hai') + '</span><b style="color:var(--accent)">' + fmt(pendingTotal) + ' <small>(' + pendingCount + (nextBuyName ? ' • 👉 ' + escapeHtml(nextBuyName) : '') + ')</small></b></div>' +
      '<div class="ss-row"><span>✓ ' + (settings.lang === 'en' ? 'Bought' : 'Kharid liya') + '</span><b style="color:var(--ok)">' + fmt(doneTotal) + ' <small>(' + doneCount + ')</small></b></div>' +
      '</div>';
  } else {
    html += '<div class="set-label">🛍️ ' + totalCount + ' ' + (settings.lang === 'en' ? 'items in list' : 'saman list me hai') + '</div>';
  }
  list.forEach(function (it) {
    html += '<div class="income-row" style="gap:8px;">' +
      '<button type="button" class="shop-tick' + (it.done ? ' done' : '') + '" data-shtick="' + it.id + '" title="' + (it.done ? 'Wapas kholо' : 'Kharid liya ✓') + '">' + (it.done ? '✓' : '') + '</button>' +
      '<span class="shop-name' + (it.done ? ' done' : '') + '" style="flex:1;">' + escapeHtml(it.name) +
      (it.amt > 0 ? ' <span class="shop-amt">₹' + it.amt + '</span>' : '') +
      (it.id === nextBuyId ? '<span class="next-buy">👉 ' + t('shopNext') + '</span>' : '') + '</span>' +
      (it.done ? '<button type="button" class="shop-conv" data-shconv="' + it.id + '" title="' + t('shopConvert') + '">' + t('shopConvert') + '</button>' : '') +
      '<button type="button" class="i-del" data-shdel="' + it.id + '">✕</button>' +
      '</div>';
  });
  host.innerHTML = html;
}
document.getElementById('shopList').addEventListener('click', function (ev) {
  var tick = ev.target.closest('[data-shtick]');
  var conv = ev.target.closest('[data-shconv]');
  var del = ev.target.closest('[data-shdel]');
  var p = prof();
  if (tick) {
    var tid = Number(tick.getAttribute('data-shtick'));
    p.shopping.forEach(function (it) { if (it.id === tid) it.done = !it.done; });
    saveDB();
    renderShop();
  } else if (conv) {
    var cid2 = Number(conv.getAttribute('data-shconv'));
    var item = null;
    p.shopping.forEach(function (it) { if (it.id === cid2) item = it; });
    if (item) {
      p.shopping = p.shopping.filter(function (it) { return it.id !== cid2; });
      saveDB();
      shopModal.hidden = true;
      nameInput.value = item.name;
      amountInput.value = (item.amt > 0 ? item.amt : '');
      (item.amt > 0 ? nameInput : amountInput).focus();
      renderShop();
      showToast(t('shopConverted'));
    }
  } else if (del) {
    var did2 = Number(del.getAttribute('data-shdel'));
    p.shopping = p.shopping.filter(function (it) { return it.id !== did2; });
    saveDB();
    renderShop();
    showToast(t('shopDeleted'));
  }
});

// ================== FESTIVAL BUDGET ==================
var festModal = document.getElementById('festModal');
var pendingFest = null;
document.getElementById('festBtn').addEventListener('click', function () {
  document.getElementById('festName').value = '';
  document.getElementById('festTotal').value = '';
  document.getElementById('festSpendForm').hidden = true;
  pendingFest = null;
  renderFest();
  festModal.hidden = false;
});
document.getElementById('festCancel').addEventListener('click', function () { festModal.hidden = true; });
festModal.addEventListener('click', function (ev) { if (ev.target === festModal) festModal.hidden = true; });
document.getElementById('festAdd').addEventListener('click', function () {
  var nm = document.getElementById('festName').value.trim();
  var tot = parseFloat(document.getElementById('festTotal').value);
  if (!nm || !(tot > 0)) { showToast(t('festBad')); return; }
  var p = prof();
  p.festivals.push({ id: Date.now(), name: nm, total: tot, created: getTodayStr() });
  saveDB();
  document.getElementById('festName').value = '';
  document.getElementById('festTotal').value = '';
  renderFest();
  showToast(t('festSaved') + ' ' + nm + ' ' + fmt(tot));
});
function festById(id) {
  var out = null;
  (prof().festivals || []).forEach(function (f) { if (f.id === id) out = f; });
  return out;
}
function renderFest() {
  var host = document.getElementById('festList');
  var list = prof().festivals || [];
  if (list.length === 0) {
    host.innerHTML = '<div class="set-label">' + (settings.lang === 'en' ? 'No festival budget yet — make one above 🪔' : 'Abhi koi festival budget nahi — upar se banao 🪔') + '</div>';
    document.getElementById('festSpendForm').hidden = true;
    pendingFest = null;
    return;
  }
  var html = '';
  list.forEach(function (f) {
    var spent = 0;
    prof().expenses.forEach(function (e) { if (e.festival === f.id) spent += Number(e.amount) || 0; });
    var pct = Math.min(Math.round((spent / f.total) * 100), 100);
    var color = pct >= 100 ? '#ef4444' : (pct >= 70 ? '#f59e0b' : '#16a34a');
    var bacha = f.total - spent;
    var bachaHtml = bacha >= 0
      ? '<b style="color:#16a34a;">' + t('festBacha') + ': ' + fmt(bacha) + '</b>'
      : '<b style="color:#ef4444;">' + t('festBacha') + ': -' + fmt(Math.abs(bacha)) + ' <small>(' + t('festOverAmt') + ')</small></b>';
    html += '<div style="padding:6px 2px;border-bottom:1px dashed var(--line);">' +
      '<div class="income-row" style="border:none;padding:0;">' +
      '<span>🪔 <b>' + escapeHtml(f.name) + '</b></span>' +
      '<span class="i-amt" style="color:' + color + '">' + fmt(spent) + ' / ' + fmt(f.total) + (spent > f.total ? ' ' + t('festOver') : '') + '</span>' +
      '</div>' +
      '<div class="fest-bar-wrap"><div class="fest-bar" style="width:' + pct + '%;background:' + color + ';"></div></div>' +
      '<div class="income-row" style="border:none;padding:4px 0 0;">' +
      '<small style="color:var(--muted);">' + pct + '% ' + t('festSpentOf') + '</small>' +
      bachaHtml +
      '</div>' +
      '<div class="income-row" style="border:none;padding:2px 0 0;">' +
      '<span><button type="button" class="shop-conv" data-fadd="' + f.id + '">💰 ' + (settings.lang === 'en' ? 'Add expense' : 'Kharcha jodo') + '</button> ' +
      '<button type="button" class="i-del" data-fdel="' + f.id + '">✕</button></span>' +
      '</div></div>';
  });
  host.innerHTML = html;
}
document.getElementById('festList').addEventListener('click', function (ev) {
  var addB = ev.target.closest('[data-fadd]');
  var delB = ev.target.closest('[data-fdel]');
  var p = prof();
  if (addB) {
    var fid = Number(addB.getAttribute('data-fadd'));
    var f = festById(fid);
    if (!f) return;
    pendingFest = fid;
    document.getElementById('festSpendTitle').textContent = f.name;
    document.getElementById('festSpendName').value = '';
    document.getElementById('festSpendAmt').value = '';
    document.getElementById('festSpendDate').value = getTodayStr();
    document.getElementById('festSpendForm').hidden = false;
    setTimeout(function () { document.getElementById('festSpendName').focus(); }, 60);
  } else if (delB) {
    var did = Number(delB.getAttribute('data-fdel'));
    p.festivals = p.festivals.filter(function (f2) { return f2.id !== did; });
    saveDB();
    renderFest();
    showToast(t('festDeleted'));
  }
});
document.getElementById('festSpendSave').addEventListener('click', function () {
  var f = festById(pendingFest);
  if (!f) return;
  var nm = document.getElementById('festSpendName').value.trim();
  var amt = parseFloat(document.getElementById('festSpendAmt').value);
  var dt = document.getElementById('festSpendDate').value || getTodayStr();
  if (!nm || !(amt > 0)) { showToast(t('festSpendBad')); return; }
  var p = prof();
  var cid = autoCategory(nm);
  p.expenses.push({ id: Date.now(), name: nm, amount: amt, date: dt, category: cid, festival: pendingFest });
  saveDB();
  var newSpent = 0;
  p.expenses.forEach(function (e) { if (e.festival === pendingFest) newSpent += Number(e.amount) || 0; });
  var bacha2 = f.total - newSpent;
  document.getElementById('festSpendForm').hidden = true;
  pendingFest = null;
  renderFest();
  render();
  showToast(t('festSpendSaved') + ' ' + f.name + ' — ' + CATEGORIES[cid].icon + ' ' + fmt(amt) + (bacha2 >= 0 ? ' (' + t('festBacha') + ' ' + fmt(bacha2) + ')' : ' (' + fmt(Math.abs(bacha2)) + ' ' + t('festOverAmt') + ')'));
});
function festBadge(e) {
  if (!e.festival) return '';
  var f = festById(e.festival);
  return '<span class="fest-badge">🪔 ' + escapeHtml(f ? f.name : 'Festival') + '</span>';
}

// ================== AMOUNT CALCULATOR (50+30 = 80) ==================
function calcEval(input) {
  var v = input.value.trim();
  if (!v || !/[+\-*/]/.test(v)) return;
  if (!/^[0-9+\-*/().\s]+$/.test(v)) { showToast(t('calcBad')); return; }
  try {
    var res = Function('"use strict";return (' + v + ')')();
    if (typeof res === 'number' && isFinite(res) && res > 0) {
      input.value = Math.round(res * 100) / 100;
      showToast(t('calcDone') + ' ' + v.replace(/\s+/g, '') + ' = ' + fmt(res));
    } else {
      showToast(t('calcBad'));
    }
  } catch (err) {
    showToast(t('calcBad'));
  }
}
amountInput.addEventListener('blur', function () { calcEval(amountInput); });
document.getElementById('editAmount').addEventListener('blur', function () {
  var el = document.getElementById('editAmount');
  calcEval(el);
});

// ================== MONTH COMPARISON (is vs pichle) ==================
function renderCompare() {
  var card = document.getElementById('compareCard');
  var body = document.getElementById('compareBody');
  if (!card) return;
  if (currentFilter !== 'month') { card.hidden = true; return; }
  var p = prof();
  if (p.expenses.length === 0) { card.hidden = true; return; }
  var cur = curCycle(), prev = cycPrev(cur);
  var cc = {}, pc = {};
  p.expenses.forEach(function (e) {
    var c = getCategory(e);
    var cyc = cycOf(e.date);
    if (cyc === cur) cc[c] = (cc[c] || 0) + (Number(e.amount) || 0);
    else if (cyc === prev) pc[c] = (pc[c] || 0) + (Number(e.amount) || 0);
  });
  var keys = {};
  Object.keys(cc).forEach(function (k) { keys[k] = 1; });
  Object.keys(pc).forEach(function (k) { keys[k] = 1; });
  var rows = Object.keys(keys).map(function (k) {
    return { c: k, now: cc[k] || 0, was: pc[k] || 0, delta: (cc[k] || 0) - (pc[k] || 0) };
  }).filter(function (r) { return r.delta !== 0; });
  var hadPrev = Object.keys(pc).length > 0;
  if (rows.length === 0) { card.hidden = true; return; }
  card.hidden = false;
  rows.sort(function (a, b) { return Math.abs(b.delta) - Math.abs(a.delta); });
  var html = '';
  if (!hadPrev) html += '<div class="set-label">' + t('compareNoPrev') + '</div>';
  rows.slice(0, 6).forEach(function (r) {
    var c = CATEGORIES[r.c];
    var up = r.delta > 0;
    html += '<div class="cmp-row">' +
      '<span>' + c.icon + ' ' + escapeHtml(c.label) + '</span>' +
      '<span class="cmp-mid">' + fmt(r.was) + ' → ' + fmt(r.now) + '</span>' +
      '<span class="' + (up ? 'cmp-badge-up' : 'cmp-badge-down') + '">' + (up ? '🔺 +' : '🔻 −') + fmt(Math.abs(r.delta)) + '</span>' +
      '</div>';
  });
  body.innerHTML = html;
}

// ================== SETTINGS MODAL (cycle + recurring + bell) ==================
var settingsModal = document.getElementById('settingsModal');
var cycleDayInput = document.getElementById('cycleDayInput');
function renderRecList() {
  var host = document.getElementById('recList');
  var list = settings.recurring || [];
  if (list.length === 0) { host.innerHTML = ''; return; }
  var html = '<div class="set-label">🔁 Active recurring:</div>';
  list.forEach(function (r) {
    html += '<div class="income-row"><span>' + escapeHtml(r.name) + ' <small style="color:var(--muted)">₹' + r.amount + ' • tarikh ' + r.day + '</small></span>' +
      '<button type="button" class="i-del" data-rid="' + r.id + '">✕</button></div>';
  });
  host.innerHTML = html;
}
document.getElementById('settingsBtn').addEventListener('click', function () {
  cycleDayInput.value = settings.cycleDay === 1 ? '' : settings.cycleDay;
  document.getElementById('settingsNameInput').value = getUserName();
  renderRecList();
  settingsModal.hidden = false;
});
document.getElementById('settingsCancel').addEventListener('click', function () { settingsModal.hidden = true; });
settingsModal.addEventListener('click', function (ev) { if (ev.target === settingsModal) settingsModal.hidden = true; });
document.getElementById('settingsSave').addEventListener('click', function () {
  var nmNew = document.getElementById('settingsNameInput').value.trim();
  var nmOld = getUserName();
  if (nmNew && nmNew !== nmOld) {
    setUserName(nmNew);
    showToast('👤 ' + nmNew + ' — ' + t('nameSaved'));
  }
  var v = parseInt(cycleDayInput.value, 10);
  if (v >= 2 && v <= 28) {
    settings.cycleDay = v;
    saveSettings();
    settingsModal.hidden = true;
    render();
    showToast(t('cycleSaved') + ' (tarikh ' + v + ')');
    checkRecurring();
  } else if (cycleDayInput.value === '' || v === 1) {
    settings.cycleDay = 1;
    saveSettings();
    settingsModal.hidden = true;
    render();
    showToast(t('cycleSaved') + ' (tarikh 1)');
    checkRecurring();
  } else {
    showToast(t('cycleBad'));
  }
});
document.getElementById('recAdd').addEventListener('click', function () {
  var nm = document.getElementById('recName').value.trim();
  var amt = parseFloat(document.getElementById('recAmount').value);
  var dy = parseInt(document.getElementById('recDay').value, 10);
  if (!nm || !(amt > 0) || !(dy >= 1 && dy <= 28)) { showToast(t('recBad')); return; }
  settings.recurring = settings.recurring || [];
  settings.recurring.push({
    id: Date.now(), name: nm, amount: amt, day: dy,
    cat: autoCategory(nm)
  });
  saveSettings();
  document.getElementById('recName').value = '';
  document.getElementById('recAmount').value = '';
  document.getElementById('recDay').value = '';
  renderRecList();
  var addedNow = checkRecurring();
  render();
  showToast(t('recSaved') + (addedNow ? ' — ' + t('recAddedNow') + ' ' + nm : ''));
});
document.getElementById('recList').addEventListener('click', function (ev) {
  var btn = ev.target.closest('.i-del');
  if (!btn) return;
  var rid = Number(btn.getAttribute('data-rid'));
  showConfirm(t('recDelConfirm'), function () {
    settings.recurring = (settings.recurring || []).filter(function (r) { return r.id !== rid; });
    saveSettings();
    renderRecList();
    showToast('🔁 ' + (settings.lang !== 'en' ? 'Recurring hata diya' : 'Recurring removed'));
  });
});
// Har load par: recurring check (is cycle me jo nahi aaya, add karo)
function recSkipKey(name, cycKey) {
  return 'kharcha_rec_skip_' + String(name).toLowerCase().replace(/\s+/g, '_') + '_' + cycKey;
}
function checkRecurring() {
  var list = settings.recurring || [];
  var addedAny = [];
  var today = getTodayStr();
  var curCyc = curCycle();
  list.forEach(function (r) {
    var startYm = curCyc;
    var targetDay = r.day;
    // cycle>1: agar r.day cycle start (cycleDay) se pehle ka hai to target prev cycle month
    if (cycleDay() > 1 && r.day < cycleDay()) startYm = cycPrev(curCyc);
    var targetDate = startYm + '-' + String(targetDay).padStart(2, '0');
    // abhi tak target date nahi aayi (future) → abhi nahi add karna
    if (targetDate > today) return;
    // skip: user ne is cycle me pehle delete kiya tha?
    if (localStorage.getItem(recSkipKey(r.name, curCyc)) === '1') return;
    // pehle se hai? (same naam + sahi cycle)
    var exists = false;
    Object.keys(db.profiles).forEach(function (pn) {
      (db.profiles[pn].expenses || []).forEach(function (x) {
        if ((x.name || '').toLowerCase() === r.name.toLowerCase() && cycOf(x.date) === curCyc) exists = true;
      });
    });
    if (exists) return;
    // add karo (active profile me)
    var p = prof();
    p.expenses.push({
      id: Date.now() + Math.floor(Math.random() * 999),
      name: r.name, amount: r.amount, date: targetDate, category: r.cat, recurring: true
    });
    saveDB();
    addedAny.push(r.name);
  });
  if (addedAny.length) render();
  return addedAny.length ? addedAny.join(', ') : null;
}

// ================== BELL NOTIFICATION ==================
document.getElementById('notifBtn').addEventListener('click', function () {
  if (!('Notification' in window)) { showToast(t('notifNo')); return; }
  if (Notification.permission === 'granted') {
    showToast(t('notifOk'));
    try { new Notification('💰 Keshu Kharcha Tracker', { body: t('notifBody') }); } catch (e) {}
    return;
  }
  Notification.requestPermission().then(function (perm) {
    if (perm === 'granted') {
      showToast(t('notifOk'));
      try { new Notification('💰 Keshu Kharcha Tracker', { body: t('notifBody') }); } catch (e) {}
    } else {
      showToast(t('notifNo'));
    }
  });
});
function dailyNotif() {
  if (!('Notification' in window) || Notification.permission !== 'granted' || getPin()) return;
  var p = prof();
  var shownKey = 'kharcha_notif_shown_' + getTodayStr();
  if (p.expenses.some(function (x) { return x.date === getTodayStr(); })) return;
  if (localStorage.getItem(shownKey) === '1') return;
  localStorage.setItem(shownKey, '1');
  try { new Notification('💰 Keshu Kharcha Tracker', { body: t('notifBody') }); } catch (e) {}
}

// ================== ADD EXPENSE ==================
form.addEventListener('submit', function (e) {
  e.preventDefault();
  var p = prof();
  var name = nameInput.value.trim();
  var amount = parseFloat(amountInput.value);
  var quickAddUsed = false;
  // ⚡ Smart Quick Add: "chai 50" ya "50 chai" — naam me se rakam khud pakdo
  if (name && amountInput.value.trim() === '') {
    var qm = name.match(/^(.+?)\s+([\d][\d.,]*)$/) || name.match(/^([\d][\d.,]*)\s+(.+)$/);
    if (qm) {
      var qamt = parseFloat(qm[2].replace(/,/g, ''));
      if (qamt > 0) {
        name = qm[1].trim();
        amount = qamt;
        quickAddUsed = true;
      }
    }
  }
  var date = dateInput.value;
  if (!name || !(amount > 0) || !date) { showToast(t('toastFill')); return; }
  var cid = (categorySelect.value === 'auto') ? autoCategory(name) : categorySelect.value;
  var amt = Number(amount) || 0;

  p.expenses.push({ id: Date.now(), name: name, amount: amt, date: date, category: cid });
  saveDB();
  render();

  nameInput.value = '';
  amountInput.value = '';
  categorySelect.value = 'auto';
  dateInput.value = getTodayStr();
  nameInput.focus();
  showToast((quickAddUsed ? t('quickAdd') + ': ' : t('toastAdded') + ' ') + '(' + CATEGORIES[cid].icon + ' ' + fmt(amt) + ')');

  // Repeat kharcha detect: 3+ baar same naam -> preset banane ka suggestion
  maybeSuggestPreset(name, amt);

  // Budget check
  var spentThisCat = 0;
  var midCyc = cycOf(date);
  p.expenses.forEach(function (x) {
    if (x.category === cid && cycOf(x.date) === midCyc) spentThisCat += Number(x.amount) || 0;
  });
  var badj = p.budgets[cid];
  if (badj && badj > 0) {
    if (spentThisCat >= badj) showToast('🚨 ' + CATEGORIES[cid].icon + ' ' + CATEGORIES[cid].label + ': ' + fmt(spentThisCat) + ' / ' + fmt(badj));
    else if (spentThisCat >= badj * 0.8) showToast(t('toastBudget80') + ' ' + CATEGORIES[cid].icon + ' ' + fmt(spentThisCat) + ' / ' + fmt(badj));
  }
});

// ================== DELETE / CLEAR ==================
listEl.addEventListener('click', function (e) {
  var del = e.target.closest('.del');
  var ed = e.target.closest('.mini-btn.edit');
  var tagb = e.target.closest('.tagb');
  var id = null;
  var row = e.target.closest('.expense');
  if (row) id = Number(row.getAttribute('data-id'));
  if (del && id != null) {
    var p = prof();
    var gone = null;
    p.expenses.forEach(function (x) { if (x.id === id) gone = x; });
    p.expenses = p.expenses.filter(function (x) { return x.id !== id; });
    if (gone && gone.recurring) {
      localStorage.setItem(recSkipKey(gone.name, cycOf(gone.date || getTodayStr())), '1');
    }
    saveDB();
    render();
    var delToastMsg = t('toastDeleted') + ' ✕';
    if (gone) {
      showToast(delToastMsg, t('undoBtn'), function () {
        var pp = prof();
        pp.expenses.push(gone);
        saveDB();
        render();
        showToast(t('toastUndone'));
      });
    } else {
      showToast(delToastMsg);
    }
    return;
  }
  if (ed && id != null) { openEditModal(id); return; }
  if (tagb && id != null) { cycleTag(id); return; }
  var phb = e.target.closest('.photob');
  if (phb && id != null) {
    var p2 = prof();
    var found = null;
    p2.expenses.forEach(function (x) { if (x.id === Number(phb.getAttribute('data-ph'))) found = x; });
    if (found && found.photo) openPhotoViewer(found);
    return;
  }
});

document.getElementById('clearAll').addEventListener('click', function () {
  var p = prof();
  if (p.expenses.length === 0) {
    showToast(settings.lang === 'en' ? 'Nothing to clear' : 'Koi kharcha nahi hai');
    return;
  }
  showConfirm(
    (settings.lang === 'en'
      ? 'Clear ALL ' + p.expenses.length + ' expenses of "' + db.active + '"?'
      : '"' + db.active + '" ke SAB ' + p.expenses.length + ' kharche mit jayenge. Pakka?'),
    function () {
      var snapshot = JSON.parse(JSON.stringify(p.expenses));
      var profName = db.active;
      p.expenses = [];
      saveDB();
      render();
      var clearMsg = t('toastCleared');
      showToast(clearMsg, t('undoBtn'), function () {
        if (db.profiles[profName]) {
          db.profiles[profName].expenses = snapshot;
          saveDB();
          render();
          showToast(t('toastClearedUndone'));
        }
      });
    }
  );
});

// ================== TABS ==================
document.getElementById('tabs').addEventListener('click', function (e) {
  var tab = e.target.closest('.tab');
  if (!tab) return;
  currentFilter = tab.getAttribute('data-filter');
  document.querySelectorAll('.tab').forEach(function (tb) {
    tb.classList.toggle('active', tb === tab);
  });
  render();
});

// ================== TOTAL PAISA ==================
document.getElementById('editMoneyBtn').addEventListener('click', function () {
  moneyForm.hidden = false;
  moneyInput.value = prof().money === null ? '' : prof().money;
  moneyInput.focus();
});
function commitMoney() {
  var v = parseFloat(moneyInput.value);
  if (isNaN(v) || v < 0) { showToast(t('toastMoneyBad')); return; }
  prof().money = v;
  saveDB();
  moneyForm.hidden = true;
  render();
  showToast(t('toastAlertMoney') + ' ' + fmt(v));
}
document.getElementById('saveMoneyBtn').addEventListener('click', commitMoney);
moneyInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); commitMoney(); }
});

// ================== PRESETS ==================
var presetModal = document.getElementById('presetModal');
var presetName = document.getElementById('presetName');
var presetAmount = document.getElementById('presetAmount');
document.getElementById('presetCancel').addEventListener('click', function () { presetModal.hidden = true; });
presetModal.addEventListener('click', function (ev) { if (ev.target === presetModal) presetModal.hidden = true; });
document.getElementById('presetSave').addEventListener('click', function () {
  var name = presetName.value.trim();
  var amount = parseFloat(presetAmount.value);
  if (!name || !(amount > 0)) { showToast(t('toastFill')); return; }
  prof().presets.push({ id: Date.now(), name: name, amount: amount, category: autoCategory(name) });
  saveDB();
  presetModal.hidden = true;
  presetName.value = '';
  presetAmount.value = '';
  render();
  showToast('⚡ "' + name + ' ' + fmt(amount) + '" preset ready!');
});
presetAmount.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('presetSave').click(); }
});

function usePreset(id) {
  var p = prof();
  var pr = null;
  p.presets.forEach(function (x) { if (x.id === id) pr = x; });
  if (!pr) return;
  var today = getTodayStr();
  p.expenses.push({
    id: Date.now(),
    name: pr.name,
    amount: pr.amount,
    date: today,
    category: pr.category || autoCategory(pr.name)
  });
  saveDB();
  render();
  showToast('⚡ ' + pr.name + ' ' + fmt(pr.amount) + ' ' + t('toastAdded'));
}

// ================== BUDGETS PANEL ==================
var budgetModal = document.getElementById('budgetModal');
var budgetBody = document.getElementById('budgetBody');

function openBudgetModal() {
  var p = prof();
  var html = '';
  Object.keys(CATEGORIES).forEach(function (cid) {
    var c = CATEGORIES[cid];
    html += '<div class="s-row"><span class="s-name">' + c.icon + ' ' + c.label + '</span>' +
      '<input type="number" class="budget-in" data-c="' + cid + '" min="0" step="any" inputmode="decimal" ' +
      'placeholder="₹—" value="' + (p.budgets[cid] || '') + '"></div>';
  });
  budgetBody.innerHTML = html;
  budgetModal.hidden = false;
}
document.getElementById('budgetBtn').addEventListener('click', openBudgetModal);
document.getElementById('budgetCancel').addEventListener('click', function () { budgetModal.hidden = true; });
budgetModal.addEventListener('click', function (ev) { if (ev.target === budgetModal) budgetModal.hidden = true; });
document.getElementById('budgetSave').addEventListener('click', function () {
  var p = prof();
  budgetBody.querySelectorAll('.budget-in').forEach(function (inp) {
    var cid = inp.getAttribute('data-c');
    var v = parseFloat(inp.value);
    if (isNaN(v) || v <= 0) delete p.budgets[cid];
    else p.budgets[cid] = v;
  });
  saveDB();
  budgetModal.hidden = true;
  render();
  showToast('🎯 Budgets update ho gaye');
});

// ================== BANNER ==================
document.getElementById('bannerOk').addEventListener('click', function () {
  localStorage.setItem(BANNER_KEY, getTodayStr());
  document.getElementById('reminderBanner').hidden = true;
});

// ================== MAIN RENDER ==================
function render() {
  var p = prof();
  var expenses = p.expenses;
  var money = p.money;
  var today = getTodayStr();

  // Paint setting toggles
  document.getElementById('themeBtn').textContent =
    (settings.theme === 'dark' ? '☀️' : '🌙') + ' ' + t('themeBtn');
  paintAccentDots();

  var filtered = expenses.filter(function (e) {
    if (currentFilter === 'today') return e.date === today;
    if (currentFilter === 'month') return cycOf(e.date) === cycOf(today);
    if (currentFilter === 'week') return isWeekOf(e.date);
    return true;
  });

  var sorted = filtered.slice().sort(function (a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.id - a.id;
  });

  var total = 0, todayTotal = 0, periodTotal = 0;
  filtered.forEach(function (e) {
    var amt = Number(e.amount) || 0;
    periodTotal += amt;
    if (e.date === today) todayTotal += amt;
  });
  expenses.forEach(function (e) { total += Number(e.amount) || 0; });

  var balanceText;
  if (money === null) balanceText = '₹—';
  else {
    var bal = money - total;
    balanceText = bal < 0 ? ('-' + fmt(-bal)) : fmt(bal);
  }

  totalEl.textContent = balanceText;
  todayStat.textContent = (settings.lang === 'en' ? 'Today: ' : 'Aaj: ') + fmt(todayTotal);
  countStat.textContent = expenses.length + (expenses.length === 1
    ? (settings.lang === 'en' ? ' expense' : ' kharcha')
    : (settings.lang === 'en' ? ' expenses' : ' kharche'));

  if (money === null) {
    summarySentence.innerHTML = t('sentencePrompt');
  } else {
    var left = money - total;
    if (left >= 0) {
      summarySentence.innerHTML = t('sentenceLeft')
        .replace('{M}', fmt(money)).replace('{S}', fmt(total)).replace('{L}', fmt(left));
    } else {
      summarySentence.innerHTML = t('sentenceOver')
        .replace('{M}', fmt(money)).replace('{S}', fmt(total)).replace('{O}', fmt(-left));
    }
  }

  periodLineEl.textContent = t('tabs')[currentFilter] === undefined
    ? ''
    : (t('tabs')[currentFilter] + ' ' +
       (settings.lang === 'en' ? 'total: ' : 'ka kharcha: ') + fmt(periodTotal) +
       ' • ' + filtered.length +
       (filtered.length === 1
         ? (settings.lang === 'en' ? ' expense' : ' kharcha')
         : (settings.lang === 'en' ? ' expenses' : ' kharche')));

  // ---- Month trend (sirf month tab par) ----
  var trendEl = document.getElementById('trendLine');
  if (currentFilter === 'month') {
    trendEl.hidden = false;
    var curM = curCycle(), prevM = cycPrev(curCycle());
    var curTotal = 0, prevTotal = 0;
    expenses.forEach(function (e) {
      if (cycOf(e.date) === curM) curTotal += Number(e.amount) || 0;
      else if (cycOf(e.date) === prevM) prevTotal += Number(e.amount) || 0;
    });
    if (prevTotal === 0 && curTotal === 0) {
      trendEl.innerHTML = '📊 —';
    } else if (prevTotal === 0) {
      trendEl.innerHTML = settings.lang === 'en'
        ? '📊 Spending started this month: ' + fmt(curTotal)
        : '📊 Pichle mahine ₹0 tha, is mahine: ' + fmt(curTotal);
    } else {
      var diff = curTotal - prevTotal;
      var pct = Math.round((diff / prevTotal) * 100);
      if (diff > 0) {
        trendEl.innerHTML = settings.lang === 'en'
          ? '🔴 ' + t('trendUp').replace('{A}', fmt(diff)).replace('{P}', Math.abs(pct))
          : '🔴 ' + t('trendUp').replace('{A}', fmt(diff)).replace('{P}', Math.abs(pct));
        trendEl.className = 'trend-line';
      } else if (diff < 0) {
        trendEl.innerHTML = '🟢 ' + t('trendDown')
          .replace('{A}', fmt(-diff)).replace('{P}', Math.abs(pct));
        trendEl.className = 'trend-line';
      } else {
        trendEl.innerHTML = '📊 ' + t('trendSame');
        trendEl.className = 'trend-line';
      }
    }
  } else {
    trendEl.hidden = true;
  }

  // ---- Category report + biggest + budgets ----
  var reportCard = document.getElementById('reportCard');
  reportTitle.textContent = '📊 ' + t('tabs')[currentFilter] +
    (settings.lang === 'en' ? ' Category Report' : ' ki Category Report');
  if (filtered.length === 0) {
    reportCard.style.display = 'none';
  } else {
    reportCard.style.display = '';
    var catTotals = {};
    filtered.forEach(function (e) {
      var cid = getCategory(e);
      catTotals[cid] = (catTotals[cid] || 0) + (Number(e.amount) || 0);
    });
    var cats = Object.keys(catTotals).sort(function (a, b) { return catTotals[b] - catTotals[a]; });
    var repHtml = '';
    var mid = monthStr(0);
    cats.forEach(function (cid) {
      var c = CATEGORIES[cid];
      var amt = catTotals[cid];
      var pct = periodTotal > 0 ? Math.round((amt / periodTotal) * 100) : 100;
      var barColor = c.color;
      var budget = p.budgets[cid];
      var budgetBadge = '';
      if (budget && currentFilter === 'month') {
        var ratio = amt / budget;
        if (ratio >= 1) { barColor = '#ef4444'; budgetBadge = ' 🚨'; }
        else if (ratio >= 0.8) { barColor = '#f59e0b'; budgetBadge = ' ⚠️'; }
      } else if (budget) {
        barColor = c.color;
      }
      repHtml +=
        '<div class="rep-row">' +
          '<div class="rep-top">' +
            '<span class="rep-cat"><span class="emoji">' + c.icon + '</span>' + c.label +
            (budget ? ' <span class="rep-pct">/ ' + escapeHtml(String(budget)) + '</span>' : '') + budgetBadge + '</span>' +
            '<span><span class="rep-amount">' + fmt(amt) + '</span> <span class="rep-pct">' + pct + '%</span></span>' +
          '</div>' +
          '<div class="rep-bar"><div class="rep-fill" style="width:' + Math.min(pct, 100) + '%;background:' + barColor + '"></div></div>' +
        '</div>';
    });
    // Pie chart (conic-gradient circle + legend)
    var pieHtml = '';
    var grad = [];
    var start = 0;
    var legend = '';
    var pieList = cats.slice(0, 6);
    if (periodTotal > 0 && pieList.length) {
      var pieSum = pieList.reduce(function (s, cid) { return s + catTotals[cid]; }, 0);
      pieList.forEach(function (cid) {
        var c = CATEGORIES[cid];
        var frac = catTotals[cid] / pieSum;
        var end = start + Math.round(frac * 360);
        grad.push(c.color + ' ' + start + 'deg ' + end + 'deg');
        legend += '<div class="pl-row"><span class="pl-dot" style="background:' + c.color + '"></span>' +
          c.icon + ' ' + escapeHtml(c.label) + ' <b>' + Math.round(frac * 100) + '%</b></div>';
        start = end;
      });
      pieHtml = '<div class="pie-wrap"><div class="pie" style="background:conic-gradient(' + grad.join(',') + ')"></div>' +
        '<div class="pie-legend">' + legend + '</div></div>';
    }
    // Biggest expense
    var biggest = null;
    filtered.forEach(function (e) {
      if (!biggest || (Number(e.amount) || 0) > (Number(biggest.amount) || 0)) biggest = e;
    });
    if (biggest) {
      repHtml += '<div class="biggest-line">' + t('biggest') + ' ' +
        CATEGORIES[getCategory(biggest)].icon + ' <b>' + escapeHtml(biggest.name) + '</b> — ' +
        fmt(biggest.amount) + ' (' + formatDate(biggest.date) + ')</div>';
    }
    repHtml += pieHtml;
    reportBody.innerHTML = repHtml;
  }

  // ---- 6-month chart ----
  var chartCard = document.getElementById('chartCard');
  if (expenses.length === 0) {
    chartCard.style.display = 'none';
  } else {
    chartCard.style.display = '';
    var months = cycleSeries(6); // salary-cycle aware 6 period
    var monthly = {};
    months.forEach(function (m) { monthly[m] = 0; });
    p.expenses.forEach(function (e) {
      var m = cycOf(e.date);
      if (monthly[m] !== undefined) monthly[m] += Number(e.amount) || 0;
    });
    var maxAmt = 1;
    months.forEach(function (m) { if (monthly[m] > maxAmt) maxAmt = monthly[m]; });
    var isPrevYear = false; // cycle series me default 6 period
    var useScroll = false;
    var chartHtml = months.map(function (m) {
      var h = Math.max(Math.round((monthly[m] / maxAmt) * 100), monthly[m] > 0 ? 4 : 2);
      var isCur = m === curCycle();
      return '<div class="chart-col">' +
        '<span class="c-amt">' + (monthly[m] >= 1000 ? (Math.round(monthly[m] / 100) / 10) + 'k' : monthly[m]) + '</span>' +
        '<div class="chart-bar' + (isCur ? ' cur' : ' past') + '" style="height:' + h + '%"></div>' +
        '<span class="c-lbl">' + monthShortLabel(m) + '</span></div>';
    }).join('');
    document.getElementById('chartRow').innerHTML =
      (useScroll ? '<div class="chart-inner">' : '') + chartHtml + (useScroll ? '</div>' : '');
  }

  // ---- Yearly summary ----
  renderYearly();

  // ---- Banner: aaj ka kharcha? ----
  var bannerEl = document.getElementById('reminderBanner');
  var skipped = localStorage.getItem(BANNER_KEY) === today;
  var hasTodayEntry = expenses.some(function (e) { return e.date === today; });
  bannerEl.hidden = skipped || hasTodayEntry;

  // ---- Presets row ----
  renderPresets();

  // ---- Smart card: Health + Goal + Estimate ----
  renderSmart();

  // ---- Calendar ----
  renderCalendar();

  // ---- Poore ghar ka combined kharcha (is cycle) ----
  var famEl = document.getElementById('familyTotal');
  var profiles = Object.keys(db.profiles);
  if (profiles.length < 2) {
    famEl.hidden = true;
  } else {
    famEl.hidden = false;
    var curM2 = curCycle();
    var famSum = 0;
    var rowsHtml = '';
    profiles.forEach(function (n) {
      var pp = db.profiles[n];
      var sum = 0;
      (pp.expenses || []).forEach(function (e) {
        if (cycOf(e.date) === curM2) sum += Number(e.amount) || 0;
      });
      famSum += sum;
      var icon = pp.icon || PROF_ICONS[profiles.indexOf(n) % PROF_ICONS.length];
      rowsHtml += '<div class="ft-row"><span>' + icon + ' ' + escapeHtml(n) + '</span>' +
        '<span>' + fmt(sum) + '</span></div>';
    });
    famEl.innerHTML = '<div>' + t('famTotal') + '</div>' +
      '<div class="ft-total">' + fmt(famSum) + '</div>' + rowsHtml;
  }

  // ---- Is mahine vs pichle mahine ----
  renderCompare();

  // ---- List ----
  renderListOnly();

  // ---- Profiles ----
  renderProfiles();
}

function renderPresets() {
  var p = prof();
  var row = document.getElementById('presetsRow');
  var chipHtml = p.presets.map(function (pr) {
    if (presetDeleteMode) {
      return '<button type="button" class="preset-chip" data-del="' + pr.id + '">' +
        '<span>' + escapeHtml(pr.name) + ' ' + fmt(pr.amount) + '</span><span class="px">✕</span></button>';
    }
    return '<button type="button" class="preset-chip" data-use="' + pr.id + '">' +
      CATEGORIES[pr.category].icon + ' ' + escapeHtml(pr.name) + ' ' + fmt(pr.amount) + '</button>';
  }).join('');
  var controls =
    '<button type="button" class="preset-chip addp" id="presetAddBtn">' + t('presetAdd') + '</button>' +
    '<button type="button" class="preset-chip ' + (presetDeleteMode ? '' : '') + '" id="presetDelBtn" style="' +
    (presetDeleteMode ? 'border-color:var(--danger);color:var(--danger);' : '') + '">' +
    (presetDeleteMode ? '✓ Done' : t('presetDel')) + '</button>';
  var label = '<span class="presets-label">' + t('presetsLabel') + '</span>';
  var inner = label + chipHtml + controls;
  row.innerHTML = inner;
}

document.getElementById('presetsRow').addEventListener('click', function (e) {
  var del = e.target.closest('[data-del]');
  var use = e.target.closest('[data-use]');
  if (e.target.closest('#presetAddBtn')) {
    presetModal.hidden = false;
    presetName.value = '';
    presetAmount.value = '';
    setTimeout(function () { presetName.focus(); }, 60);
    return;
  }
  if (e.target.closest('#presetDelBtn')) {
    presetDeleteMode = !presetDeleteMode;
    renderPresets();
    return;
  }
  if (del) {
    var id = Number(del.getAttribute('data-del'));
    var p = prof();
    p.presets = p.presets.filter(function (x) { return x.id !== id; });
    saveDB();
    renderPresets();
    showToast(settings.lang === 'en' ? '(box) Preset removed' : '⚡ Preset hata diya');
    return;
  }
  if (use) {
    usePreset(Number(use.getAttribute('data-use')));
  }
});

var presetDeleteMode = false;

// ================== SMART CARD: Health + Goal + Estimate ==================
function monthDays(yms) {
  var p = (yms || '').split('-');
  return new Date(Number(p[0]), Number(p[1]), 0).getDate();
}

function renderSmart() {
  var el = document.getElementById('smartCard');
  var body = document.getElementById('smartBody');
  var p = prof();
  var money = p.money;
  var curM = curCycle();
  var spentThisMonth = 0;
  p.expenses.forEach(function (e) {
    if (cycOf(e.date) === curM) spentThisMonth += Number(e.amount) || 0;
  });

  // Streak: lagataar kitne din kharcha joda (aaj ya kal se peeche)
  var streak = 0;
  var daySet = {};
  p.expenses.forEach(function (e) { daySet[e.date] = true; });
  var cur = new Date();
  if (!daySet[fmtIso(cur)]) cur.setDate(cur.getDate() - 1); // aaj khali ho to kal se ginо (din baaki hai!)
  while (daySet[fmtIso(cur)]) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }

  if (money === null && spentThisMonth === 0 && !p.goal && streak === 0) { el.hidden = true; return; }
  el.hidden = false;

  var html = '';

  // 0) Streak (roz log karne ki aadat) + badges
  if (streak > 0) {
    var badge = streak >= 30 ? t('badge4') : streak >= 15 ? t('badge3') : streak >= 7 ? t('badge2') : t('badge1');
    html += '<div class="streak-line">' + t('streakRow').replace('{D}', streak + ' din').replace('{BADGE}', badge) + '</div>';
  } else {
    html += '<div class="streak-line" style="opacity:.7;">' + t('streakNone') + '</div>';
  }

  // 1) Health score
  if (money !== null && spentThisMonth > 0) {
    var d = new Date();
    var dayNow = d.getDate();
    var daysInM = monthDays(curM);
    var expected = money * (dayNow / daysInM);
    var ratio = expected > 0 ? spentThisMonth / expected : 0;
    var cls, label;
    if (ratio <= 0.95) { label = t('healthGood'); cls = '#22c55e'; }
    else if (ratio <= 1.2) { label = t('healthWarn'); cls = '#f59e0b'; }
    else { label = t('healthBad'); cls = '#ef4444'; }
    html += '<div class="smart-row"><span class="s-name">' + t('health') +
      ' <span style="color:' + cls + '">' + label + '</span></span>' +
      '<span class="s-val">' + Math.round(ratio * 100) + '%</span></div>';
  }

  // 2) Kharcha goal (month target)
  var g = p.goal;
  var goalInner;
  if (g && g > 0) {
    var overM = spentThisMonth - g;
    if (overM <= 0) {
      var leftG = g - spentThisMonth;
      goalInner = '<span style="color:var(--ok)">' + t('goalOk').replace('{L}', fmt(leftG)) + '</span>';
    } else {
      goalInner = '<span style="color:var(--danger)">' + t('goalOver').replace('{O}', fmt(overM)) + '</span>';
    }
    html += '<div class="smart-row"><span class="s-name">' +
      t('goalRowSet').replace('{S}', fmt(spentThisMonth)).replace('{G}', fmt(g)) +
      '<div class="goal-progress"><div class="g-fill' + (spentThisMonth > g ? ' over' : '') +
      '" style="width:' + Math.min(Math.round((spentThisMonth / g) * 100), 100) + '%"></div></div></span>' +
      '<div>' + goalInner + '<br><button type="button" class="s-edit" id="goalEditBtn">✏️ ' + t('goalChange') + '</button></div></div>';
  } else {
    html += '<div class="smart-row"><span class="s-name">' + t('goalRowNone') + '</span>' +
      '<button type="button" class="s-edit" id="goalEditBtn">🎯 ' + (settings.lang !== 'en' ? 'Set karein' : 'Set') + '</button></div>';
  }

  // 3) Estimate (mahine me kitna lag sakta hai)
  if (spentThisMonth > 0) {
    var d2 = new Date();
    var daysGone = d2.getDate();
    var daysTotal2 = monthDays(curM);
    var estimateVal = Math.round((spentThisMonth / daysGone) * daysTotal2);
    html += '<div class="smart-row"><span class="s-name">' +
      t('estimate').replace('{D}', daysGone).replace('{S}', fmt(spentThisMonth)).replace('{E}', fmt(estimateVal)) +
      '</span></div>';
  }

  body.innerHTML = html;
  var gBtn = document.getElementById('goalEditBtn');
  if (gBtn) gBtn.addEventListener('click', openGoalModal);
}

// Goal modal
var goalModal = document.getElementById('goalModal');
var goalInput = document.getElementById('goalInput');
function openGoalModal() {
  goalInput.value = prof().goal === null ? '' : prof().goal;
  goalModal.hidden = false;
  setTimeout(function () { goalInput.focus(); }, 60);
}
document.getElementById('goalCancel').addEventListener('click', function () { goalModal.hidden = true; });
goalModal.addEventListener('click', function (ev) { if (ev.target === goalModal) goalModal.hidden = true; });
document.getElementById('goalSave').addEventListener('click', function () {
  var v = parseFloat(goalInput.value);
  var p = prof();
  if (isNaN(v) || v < 0) p.goal = null;
  else p.goal = v;
  saveDB();
  goalModal.hidden = true;
  render();
  showToast(t('toastGoalSaved') + (p.goal ? ' ' + fmt(p.goal) : ''));
});
goalInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('goalSave').click(); }
});

// ================== CALENDAR VIEW ==================
function renderCalendar() {
  var card = document.getElementById('calendarCard');
  var body = document.getElementById('calendarBody');
  var p = prof();
  if (p.expenses.length === 0) { card.style.display = 'none'; return; }
  card.style.display = '';

  var curM = curCycle(); // cycle ka start month (salary cycle aware)
  var cd = cycleDay();
  var d = new Date();
  if (cd > 1 && Number(getTodayStr().split('-')[2]) < cd) d.setMonth(d.getMonth() - 1);
  var first = new Date(d.getFullYear(), d.getMonth(), 1);
  var offset = first.getDay(); // 0 = Sunday
  var daysInM = monthDays(fmtIso(first).slice(0, 7));
  var today = getTodayStr();

  var dayTotals = {};
  var monthSum = 0;
  p.expenses.forEach(function (e) {
    if (cycOf(e.date) === curM) {
      var dd = Number(e.date.split('-')[2]);
      dayTotals[dd] = (dayTotals[dd] || 0) + (Number(e.amount) || 0);
      monthSum += Number(e.amount) || 0;
    }
  });

  var heads = (settings.lang === 'en')
    ? ['Su','Mo','Tu','We','Th','Fr','Sa']
    : ['र','सो','मं','बु','गु','शु','श'];
  var html = '<div style="text-align:center;font-size:.78rem;color:var(--muted);margin-bottom:8px;font-weight:700;">' +
    t('calendarSum').replace('{S}', fmt(monthSum)) + '</div>';
  html += '<div class="cal-head">' + heads.map(function (h) { return '<span>' + h + '</span>'; }).join('') + '</div>';
  html += '<div class="cal-grid">';
  for (var i = 0; i < offset; i++) html += '<div class="cal-day blank"></div>';
  for (var day = 1; day <= daysInM; day++) {
    var iso = curM + '-' + String(day).padStart(2, '0');
    var amt = dayTotals[day];
    var cls = 'cal-day' + (amt ? ' hasamt' : '') + (iso === today ? ' today' : '');
    html += '<div class="' + cls + '">' +
      '<span class="d-num">' + day + '</span>' +
      (amt ? '<span class="d-amt">' + (amt >= 1000 ? Math.round(amt / 100) / 10 + 'k' : amt) + '</span>' : '') +
      '</div>';
  }
  html += '</div>';
  body.innerHTML = html;
}

// ================== CLOUD BACKUP (Firebase RTDB REST) ==================
function cloudCfg() {
  return {
    dbUrl: (settings.cloud && settings.cloud.dbUrl) || '',
    code: (settings.cloud && settings.cloud.code) || ''
  };
}
function cloudUrl(code) {
  var c = cloudCfg();
  if (!c.dbUrl || !code) return null;
  return c.dbUrl.replace(/\/+$/, '') + '/backups/' + encodeURIComponent(code) + '.json';
}

var cloudModal = document.getElementById('cloudModal');
document.getElementById('cloudBtn').addEventListener('click', function () {
  var c = cloudCfg();
  document.getElementById('cloudUrlInput').value = c.dbUrl;
  document.getElementById('cloudCode').value = c.code;
  var autoChk = document.getElementById('autoCloudChk');
  autoChk.checked = settings.autoCloud === true;
  cloudModal.hidden = false;
});
document.getElementById('autoCloudChk').addEventListener('change', function () {
  settings.autoCloud = this.checked;
  saveSettings();
  if (this.checked) scheduleAutoCloud();
  showToast(settings.autoCloud ? '☁️ Auto-save ON' : '☁️ Auto-save OFF');
});
document.getElementById('cloudCancel').addEventListener('click', function () { cloudModal.hidden = true; });
cloudModal.addEventListener('click', function (ev) { if (ev.target === cloudModal) cloudModal.hidden = true; });
document.getElementById('cloudSaveBtn').addEventListener('click', function () {
  var url = document.getElementById('cloudUrlInput').value.trim();
  var code = document.getElementById('cloudCode').value.trim();
  if (!url || !code) {
    showToast(settings.lang === 'en' ? '⚠️ URL and secret code, both needed' : '⚠️ URL aur code dono likhein');
    return;
  }
  if (!/^https:\/\/.+/i.test(url)) {
    showToast('⚠️ https:// se shuru hona chahiye');
    return;
  }
  settings.cloud = { dbUrl: url, code: code };
  saveSettings();
  showToast(settings.lang !== 'en' ? '⏳ Cloud par bhej rahe hain...' : '⏳ Sending to cloud...');
  var target = cloudUrl(code);
  fetch(target, { method: 'PUT', body: JSON.stringify(db) })
    .then(function (r) {
      if (!r.ok) throw new Error('bad');
      showToast(settings.lang !== 'en' ? '✅ Cloud par save ho gaya' : '✅ Saved to cloud');
    })
    .catch(function () {
      showToast(settings.lang !== 'en' ? '⚠️ Cloud se baat nahi hui — net/config check karein' : "⚠️ Couldn't reach cloud — check net/config");
    });
});

document.getElementById('cloudLoadBtn').addEventListener('click', function () {
  var url = document.getElementById('cloudUrlInput').value.trim();
  var code = document.getElementById('cloudCode').value.trim();
  if (!url || !code) {
    showToast(settings.lang === 'en' ? '⚠️ URL and secret code, both needed' : '⚠️ URL aur code dono likhein');
    return;
  }
  settings.cloud = { dbUrl: url, code: code };
  saveSettings();
  showToast(settings.lang !== 'en' ? '⏳ Cloud se laa rahe hain...' : '⏳ Loading from cloud...');
  fetch(cloudUrl(code))
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data || !data.profiles) {
        showToast(settings.lang === 'en'
          ? '⚠️ Nothing in cloud for this code yet'
          : '⚠️ Is code me abhi kuch save nahi hai');
        return;
      }
      showConfirm(
        settings.lang === 'en'
          ? 'Cloud data will replace all current profiles. Continue?'
          : 'Cloud ka data abhi ke saare profiles replace karega. Chal rahe?'
      , function () {
        db = data;
        if (!db.active || !db.profiles[db.active]) db.active = Object.keys(db.profiles)[0];
        saveDB();
        cloudModal.hidden = true;
        searchInput.value = '';
        render();
        showToast(settings.lang !== 'en' ? '✅ Cloud se data aa gaya!' : '✅ Data loaded from cloud!');
      });
    })
    .catch(function () {
      showToast(settings.lang !== 'en' ? '⚠️ Cloud se baat nahi hui — net/config check karein' : "⚠️ Couldn't reach cloud — check net/config");
    });
});

// ================== REPEAT DETECT ==================
function maybeSuggestPreset(name, amount) {
  var p = prof();
  var low = name.toLowerCase();
  var sameName = p.expenses.filter(function (x) {
    return (x.name || '').toLowerCase() === low;
  });
  if (sameName.length < 3) return;
  if (p.presets.some(function (x) { return (x.name || '').toLowerCase() === low; })) return;
  var flagKey = 'kharcha_repeat_shown_' + low;
  if (localStorage.getItem(flagKey) === '1') return;
  localStorage.setItem(flagKey, '1');
  var isHi = settings.lang !== 'en';
  showConfirm(
    (isHi
      ? '⚡ "' + name + '" ' + sameName.length + ' baar laga hai! Preset banao — phir 1 tap me jodega?'
      : '⚡ "' + name + '" used ' + sameName.length + ' times! Make a preset — one-tap next time?'),
    function () {
      p.presets.push({ id: Date.now(), name: name, amount: amount, category: autoCategory(name) });
      saveDB();
      render();
      showToast('⚡ ' + name + ' preset ready!');
    }
  );
}

// ================== SHARE (WhatsApp report) ==================
document.getElementById('shareBtn').addEventListener('click', function () {
  var curM2 = curCycle();
  var famSum = 0;
  var details = '';
  var profs = Object.keys(db.profiles);
  profs.forEach(function (n) {
    var pp = db.profiles[n];
    var sum = 0;
    var catTot = {};
    (pp.expenses || []).forEach(function (e) {
      if (cycOf(e.date) === curM2) {
        var a = Number(e.amount) || 0;
        sum += a;
        var cid = (e.category && CATEGORIES[e.category]) ? e.category : autoCategory(e.name);
        catTot[cid] = (catTot[cid] || 0) + a;
      }
    });
    famSum += sum;
    if (sum > 0) {
      var icon = pp.icon || PROF_ICONS[profs.indexOf(n) % PROF_ICONS.length];
      var top = Object.keys(catTot).sort(function (a, b) { return catTot[b] - catTot[a]; })
        .slice(0, 3)
        .map(function (cid) {
          return t('shareDetailRow')
            .replace('{ICON}', CATEGORIES[cid].icon)
            .replace('{NAME}', CATEGORIES[cid].label)
            .replace('{AMT}', fmt(catTot[cid]));
        }).join(' • ');
      details += '\n' + icon + ' *' + n + '*: ' + fmt(sum) + (top ? '\n    ' + top : '');
    }
  });
  var balTxt = '—';
  if (prof().money !== null) {
    var mySpend = 0;
    prof().expenses.forEach(function (e) { mySpend += Number(e.amount) || 0; });
    balTxt = fmt(Math.max(prof().money - mySpend, 0));
  }
  var text = t('shareText')
    .replace('{MON}', monthShortLabel(curM2))
    .replace('{TOT}', fmt(famSum))
    .replace('{DETAILS}', details)
    .replace('{BAL}', balTxt);
  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  showToast(t('toastShareOpened'));
});

// ================== BACKUP FILE + RESTORE ==================
document.getElementById('backupBtn').addEventListener('click', function () {
  var today = getTodayStr();
  var fname = 'kharcha-backup-' + today + '.json';
  var data = JSON.stringify(db);
  try {
    if (navigator.canShare) {
      var file = new File([data], fname, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: fname })
          .then(function () { showToast(settings.lang !== 'en' ? '✅ Backup share ho gaya' : '✅ Backup shared'); })
          .catch(function () {});
        return;
      }
    }
  } catch (e) {}
  try {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast(settings.lang !== 'en' ? '✅ Backup file download ho gayi' : '✅ Backup file downloaded');
  } catch (e) {
    showToast(settings.lang !== 'en' ? '⚠️ Backup nahi ban paya, dobara try karein' : '⚠️ Backup failed, try again');
  }
});

var restoreFile = document.getElementById('restoreFile');
document.getElementById('restoreBtn').addEventListener('click', function () {
  restoreFile.click();
});
restoreFile.addEventListener('change', function () {
  var f = restoreFile.files && restoreFile.files[0];
  if (!f) return;
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var restored = JSON.parse(reader.result);
      if (!restored || typeof restored !== 'object' || !restored.profiles) throw new Error('bad');
      showConfirm(
        settings.lang !== 'en'
          ? 'Backup restore karne se abhi ke saare profiles replace ho jayenge. Chal rahe?'
          : 'Restoring will replace all current profiles. Continue?',
        function () {
          db = restored;
          if (!db.active || !db.profiles[db.active]) db.active = Object.keys(db.profiles)[0];
          saveDB();
          searchInput.value = '';
          render();
          showToast(settings.lang !== 'en' ? '✅ Backup restore ho gaya!' : '✅ Backup restored!');
        }
      );
    } catch (e) {
      showToast(settings.lang !== 'en' ? '⚠️ Ye backup file sahi nahi hai' : '⚠️ Invalid backup file');
    }
  };
  reader.readAsText(f);
  restoreFile.value = '';
});

function renderListOnly() {
  var p = prof();
  var expenses = p.expenses;
  var today = getTodayStr();
  var q = (searchInput.value || '').toLowerCase().trim();

  var filtered = expenses.filter(function (e) {
    if (currentFilter === 'today') return e.date === today;
    if (currentFilter === 'month') return cycOf(e.date) === cycOf(today);
    if (currentFilter === 'week') return isWeekOf(e.date);
    return true;
  });
  if (q) filtered = filtered.filter(function (e) {
    return (e.name || '').toLowerCase().indexOf(q) >= 0;
  });

  var sorted = filtered.slice().sort(function (a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return b.id - a.id;
  });

  if (sorted.length === 0) {
    var emptyIcon, emptyMsg;
    if (q) {
      emptyIcon = '🔍';
      emptyMsg = settings.lang === 'en'
        ? 'No results for "' + escapeHtml(q) + '"'
        : '"' + escapeHtml(q) + '" jaisa kuch nahi mila.';
    } else if (currentFilter === 'today') {
      emptyIcon = '👪'; emptyMsg = t('emptyToday');
    } else if (currentFilter === 'month') {
      emptyIcon = '🗓️'; emptyMsg = t('emptyMonth');
    } else if (currentFilter === 'week') {
      emptyIcon = '📅'; emptyMsg = t('emptyWeek');
    } else {
      emptyIcon = '🪙'; emptyMsg = t('emptyAll') + '<br>' + t('emptyAll2');
    }
    listEl.innerHTML = '<div class="empty"><span class="big">' + emptyIcon + '</span>' + emptyMsg + '</div>';
    return;
  }

  var html = '';
  sorted.forEach(function (e) {
    var cat = CATEGORIES[getCategory(e)];
    var tag = e.tag
      ? '<span class="tag-badge ' + (e.tag === 'mehenga' ? 'tag-mehenga' : 'tag-sasta') + '">' +
        (e.tag === 'mehenga' ? '⬆️ ' + t('tagMehenga') : '⬇️ ' + t('tagSasta')) + '</span>'
      : '';
    var tagIco = e.tag === 'mehenga' ? '⬆️' : (e.tag === 'sasta' ? '⬇️' : '🏷️');
    html +=
      '<div class="expense" data-id="' + e.id + '">' +
        '<div class="icon">' + cat.icon + '</div>' +
        '<div class="info">' +
          '<div class="name">' + escapeHtml(e.name) + tag +
            (e.photo ? '<button type="button" class="photob" data-ph="' + e.id + '" title="Bill photo dekhо">📸</button>' : '') + festBadge(e) + '</div>' +
          (e.note ? '<div class="note-line">📝 ' + escapeHtml(e.note) + '</div>' : '') +
          '<div class="date">' + cat.icon + ' ' + (settings.lang === 'en' ? cat.label : cat.label) +
          ' • 📅 ' + formatDate(e.date) + '</div>' +
        '</div>' +
        '<div class="amt">' + fmt(e.amount) + '</div>' +
        '<div class="mini-btns">' +
          '<button class="mini-btn tagb" title="Tag">' + tagIco + '</button>' +
          '<button class="mini-btn edit" title="Edit">✏️</button>' +
          '<button class="mini-btn del" title="Delete">✕</button>' +
        '</div>' +
      '</div>';
  });
  listEl.innerHTML = html;
}

// ================== CUSTOM CATEGORIES ==================
function applyCustomCats() {
  (settings.customCats || []).forEach(function (c) {
    if (c && c.id && !CATEGORIES[c.id]) CATEGORIES[c.id] = { label: c.name, icon: c.icon || '🏷️', color: c.color || '#64748b' };
  });
}
applyCustomCats();

function refreshCatOptions() {
  ['#category', '#editCategory'].forEach(function (sel) {
    var s = document.querySelector(sel);
    if (!s) return;
    s.querySelectorAll('option[data-custom]').forEach(function (o) { o.remove(); });
    var before = s.querySelector('option[value="other"]');
    (settings.customCats || []).forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c.id;
      opt.setAttribute('data-custom', '1');
      opt.textContent = (c.icon || '🏷️') + ' ' + c.name;
      s.insertBefore(opt, before);
    });
  });
}
refreshCatOptions();

var catModal = document.getElementById('catModal');
var catNameInput = document.getElementById('catNameInput');
var catIconInput = document.getElementById('catIconInput');
var catDelRow = document.getElementById('catDelRow');

function renderCatDelRow() {
  var list = settings.customCats || [];
  if (list.length === 0) { catDelRow.innerHTML = ''; return; }
  var html = '<span style="font-size:.72rem;color:var(--muted);font-weight:700;">' + t('catMyList') + '</span>';
  list.forEach(function (c) {
    html += '<button type="button" class="cat-del-chip" data-del="' + c.id + '">' +
      (c.icon || '🏷️') + ' ' + escapeHtml(c.name) + ' <span class="x">✕</span></button>';
  });
  catDelRow.innerHTML = html;
}

document.getElementById('catBtn').addEventListener('click', function () {
  catNameInput.value = '';
  catIconInput.value = '';
  renderCatDelRow();
  catModal.hidden = false;
  setTimeout(function () { catNameInput.focus(); }, 60);
});
document.getElementById('catCancel').addEventListener('click', function () { catModal.hidden = true; });
catModal.addEventListener('click', function (ev) { if (ev.target === catModal) catModal.hidden = true; });
catNameInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('catSave').click(); }
});
document.getElementById('catSave').addEventListener('click', function () {
  var name = catNameInput.value.trim();
  var icon = catIconInput.value.trim();
  if (!name) { showToast(t('toastCatNeed')); return; }
  settings.customCats = settings.customCats || [];
  var dup = settings.customCats.some(function (c) { return c.name.toLowerCase() === name.toLowerCase(); });
  var dupBuiltin = Object.keys(CATEGORIES).some(function (k) { return CATEGORIES[k].label.toLowerCase() === name.toLowerCase(); });
  if (dup || dupBuiltin) { showToast(t('toastCatDup')); return; }
  var cid = 'c' + Date.now();
  var color = ['#14b8a6', '#f43f5e', '#a855f7', '#0ea5e9', '#f59e0b', '#84cc16'][settings.customCats.length % 6];
  settings.customCats.push({ id: cid, name: name, icon: icon || '🏷️', color: color });
  saveSettings();
  applyCustomCats();
  refreshCatOptions();
  categorySelect.value = cid;
  render();
  catModal.hidden = true;
  showToast(t('toastCatAdded') + ' ' + (icon || '🏷️') + ' ' + name);
});
catDelRow.addEventListener('click', function (e) {
  var chip = e.target.closest('[data-del]');
  if (!chip) return;
  var cid = chip.getAttribute('data-del');
  settings.customCats = (settings.customCats || []).filter(function (c) { return c.id !== cid; });
  saveSettings();
  delete CATEGORIES[cid];
  refreshCatOptions();
  renderCatDelRow();
  if (categorySelect.value === cid) categorySelect.value = 'auto';
  render();
});

// ================== PIN LOCK ==================
function getPin() { return settings.pin && /^\d{4}$/.test(settings.pin) ? settings.pin : null; }

var lockOverlay = document.getElementById('lockOverlay');
var lockBox = document.getElementById('lockBox');
var lockDots = document.getElementById('lockDots');
var lockMsg = document.getElementById('lockMsg');
var lockPad = document.getElementById('lockPad');
var pinBuf = '';
var sessionUnlocked = false;

function buildLockPad() {
  var html = '';
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'].forEach(function (k) {
    html += '<button type="button" class="lock-key" data-k="' + k + '">' + k + '</button>';
  });
  lockPad.innerHTML = html;
}
buildLockPad();

function updateLockDots() {
  lockDots.textContent = pinBuf.length === 0
    ? '○ ○ ○ ○'
    : pinBuf.split('').map(function (d) { return '●'; }).join(' ') +
      Array(Math.max(0, 4 - pinBuf.length)).fill('○').map(function (x) { return ' ' + x; }).join('');
}
function tryUnlock() {
  if (pinBuf === getPin()) {
    sessionUnlocked = true;
    lockOverlay.hidden = true;
    pinBuf = '';
    showToast('🔓 ' + (settings.lang === 'en' ? 'Unlocked!' : 'Khul gaya!'));
    maybeWelcome();
  } else {
    lockMsg.textContent = t('lockWrong');
    lockBox.classList.add('shake');
    setTimeout(function () { lockBox.classList.remove('shake'); }, 400);
    pinBuf = '';
    updateLockDots();
  }
}
lockOverlay.addEventListener('click', function (e) {
  var btn = e.target.closest('.lock-key');
  if (!btn) return;
  var k = btn.getAttribute('data-k');
  lockMsg.textContent = '';
  if (k === '⌫') { pinBuf = pinBuf.slice(0, -1); updateLockDots(); return; }
  if (k === '✓') { if (pinBuf.length === 4) tryUnlock(); else { lockMsg.textContent = t('toastPinBad'); return; } return; }
  if (pinBuf.length < 4) {
    pinBuf += k;
    updateLockDots();
    if (pinBuf.length === 4) setTimeout(tryUnlock, 120);
  }
});
function showLock() { pinBuf = ''; updateLockDots(); lockMsg.textContent = ''; lockOverlay.hidden = false; }

document.getElementById('lockForgot').addEventListener('click', function () {
  showConfirm(t('lockForgotConfirm1'), function () {
    settings.pin = null;
    saveSettings();
    sessionUnlocked = true;
    lockOverlay.hidden = true;
    showToast(t('toastPinRemoved'));
  });
});

// App khulte hi lock dikhao
if (getPin()) showLock();

// PIN settings modal
var pinModal = document.getElementById('pinModal');
var pinInput = document.getElementById('pinInput');
var pinTitle = document.getElementById('pinTitle');
var pinHelp = document.getElementById('pinHelp');
var pinRemoveBtn = document.getElementById('pinRemove');
var pinState = 'new';

document.getElementById('pinBtn').addEventListener('click', function () {
  pinState = getPin() ? 'current' : 'new';
  pinInput.value = '';
  pinTitle.textContent = pinState === 'current' ? t('pinTitleCurrent') : t('pinTitleNew');
  pinHelp.textContent = t('pinHelpNew');
  pinRemoveBtn.hidden = true;
  pinModal.hidden = false;
  setTimeout(function () { pinInput.focus(); }, 60);
});
document.getElementById('pinCancel').addEventListener('click', function () { pinModal.hidden = true; });
pinModal.addEventListener('click', function (ev) { if (ev.target === pinModal) pinModal.hidden = true; });
pinInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('pinSave').click(); }
});
document.getElementById('pinSave').addEventListener('click', function () {
  var v = pinInput.value.trim();
  if (pinState === 'current') {
    if (v === getPin()) {
      pinState = 'new';
      pinInput.value = '';
      pinTitle.textContent = t('pinTitleNew');
      pinHelp.textContent = t('pinHelpNew');
      pinRemoveBtn.hidden = false;
    } else {
      showToast(t('toastPinWrong'));
    }
    return;
  }
  if (v === '') {
    settings.pin = null;
    saveSettings();
    pinModal.hidden = true;
    showToast(t('toastPinRemoved'));
    return;
  }
  if (/^\d{4}$/.test(v)) {
    settings.pin = v;
    saveSettings();
    sessionUnlocked = true;
    pinModal.hidden = true;
    showToast(t('toastPinSet'));
  } else {
    showToast(t('toastPinBad'));
  }
});
pinRemoveBtn.addEventListener('click', function () {
  settings.pin = null;
  saveSettings();
  pinModal.hidden = true;
  showToast(t('toastPinRemoved'));
});

// ================== VOICE INPUT ==================
var micBtn = document.getElementById('micBtn');
var SRKon = window.SpeechRecognition || window.webkitSpeechRecognition;
var micRec = null;
if (!SRKon) micBtn.style.display = 'none';
micBtn.addEventListener('click', function () {
  if (!SRKon) { showToast(t('toastMicNo')); return; }
  if (micRec) {
    try { micRec.stop(); } catch (e) {}
    micRec = null;
    micBtn.classList.remove('rec');
    return;
  }
  try {
    micRec = new SRKon();
    micRec.lang = 'hi-IN';
    micRec.interimResults = false;
    micRec.maxAlternatives = 1;
    micRec.onresult = function (ev) {
      var say = (ev.results[0][0].transcript || '').trim();
      if (!say) { showToast(t('toastMicNone')); return; }
      // amount nikalo: digits ya common hindi number words
      var num = say.match(/([0-9]+(?:\.[0-9]+)?)/);
      if (!num) {
        var words = { 'ek': 1, 'do': 2, 'teen': 3, 'char': 4, 'chaar': 4, 'paanch': 5, 'panch': 5, 'chhe': 6, 'che': 6, 'saat': 7, 'aath': 8, 'nau': 9, 'das': 10 };
        var lower = say.toLowerCase();
        Object.keys(words).some(function (w) {
          var m = lower.match(new RegExp(w));
          if (m) { num = [w, String(words[w])]; return true; }
          return false;
        });
      }
      var numStr = num ? num[1] : null;
      var nameTxt = say.replace(/[0-9]+(?:\.[0-9]+)?/g, '').replace(/\s+/g, ' ').trim();
      if (nameTxt) nameInput.value = nameTxt;
      if (numStr) amountInput.value = numStr;
      showToast(t('toastMicAnswer') + ' ' + say);
    };
    micRec.onerror = function () {
      showToast(t('toastMicNone'));
      micBtn.classList.remove('rec');
    };
    micRec.onend = function () {
      micBtn.classList.remove('rec');
      micRec = null;
    };
    micBtn.classList.add('rec');
    showToast(t('toastMicOn'));
    micRec.start();
  } catch (e) {
    showToast(t('toastMicNo'));
    micRec = null;
  }
});

// ================== YEARLY SUMMARY ==================
function renderYearly() {
  var card = document.getElementById('yearlyCard');
  var body = document.getElementById('yearlyBody');
  var p = prof();
  if (!p.expenses.length) { card.hidden = true; return; }
  card.hidden = false;

  var yNow = getTodayStr().slice(0, 4); // '2026'
  var byMonth = {};
  var yearTotal = 0;
  p.expenses.forEach(function (e) {
    var mo = getMonthOf(e.date); // '2026-11'
    if (mo && mo.slice(0, 4) === yNow) {
      byMonth[mo] = (byMonth[mo] || 0) + (Number(e.amount) || 0);
      yearTotal += Number(e.amount) || 0;
    }
  });

  var html = '<div style="font-size:.72rem;color:var(--muted);font-weight:700;margin-bottom:6px;">' +
    yNow + ' ka total: <span style="color:var(--accent);font-weight:800;">' + fmt(yearTotal) + '</span></div>';
  for (var m = 1; m <= 12; m++) {
    var key = yNow + '-' + String(m).padStart(2, '0');
    var amt = byMonth[key] || 0;
    var isCur = key === monthStr(0);
    html += '<div class="yearly-row' + (isCur ? ' y-hi' : '') + '"><span>' + monthShortLabel(key) +
      '</span><span class="' + (amt ? 'y-amt' : 'y-zero') + '">' + (amt ? fmt(amt) : '—') + '</span></div>';
  }
  body.innerHTML = html;
}

// ================== CSV / EXCEL EXPORT ==================
document.getElementById('csvBtn').addEventListener('click', function () {
  var rows = [['Tarikh', 'Profile', 'Kharcha', 'Category', 'Rakam', 'Tag', 'Note']];
  Object.keys(db.profiles).forEach(function (n) {
    var pp = db.profiles[n];
    (pp.expenses || []).forEach(function (e) {
      var c = CATEGORIES[getCategory(e)];
      rows.push([
        e.date || '',
        n,
        e.name || '',
        c ? (c.icon + ' ' + c.label) : 'Aur Kuch',
        Number(e.amount) || 0,
        e.tag || '',
        e.note || ''
      ]);
    });
  });
  var csv = '\uFEFF' + rows.map(function (r) {
    return r.map(function (v) {
      v = String(v);
      return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(',');
  }).join('\r\n');
  try {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = 'kharcha-' + getTodayStr() + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast(t('toastCsvMade'));
  } catch (e) {
    showToast(settings.lang !== 'en' ? '⚠️ File nahi bani, dobara try karein' : "⚠️ Couldn't create file, try again");
  }
});

// ================== AUTO CLOUD SAVE ==================
var autoCloudTimer = null;
function scheduleAutoCloud() {
  if (!settings.autoCloud || !settings.cloud || !settings.cloud.dbUrl || !settings.cloud.code) return;
  if (autoCloudTimer) clearTimeout(autoCloudTimer);
  autoCloudTimer = setTimeout(function () {
    autoCloudTimer = null;
    var url = settings.cloud.dbUrl.replace(/\/+$/, '') + '/backups/' + encodeURIComponent(settings.cloud.code) + '.json';
    fetch(url, { method: 'PUT', body: JSON.stringify(db) })
      .then(function (r) { if (r.ok) showToast(t('toastAutoCloudSaved')); })
      .catch(function () {});
  }, 15000);
}

// ================== SERVICE WORKER ==================
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(function () {});
}

// ================== WELCOME (Keshu first app!) ==================
var welcomeModal = document.getElementById('welcomeModal');
var userNameInput = document.getElementById('userNameInput');
var userNameKey = 'kharcha_user_name_v1';
function getUserName() { return localStorage.getItem(userNameKey) || ''; }
function setUserName(n) { localStorage.setItem(userNameKey, n.trim()); }
// Motivational quotes — har open par nayi line
var QUOTES_HI = [
  '💪 Paise ki soch badlo, paisa khud badlega',
  '🌱 Aaj ka ek kharcha record = kal ka poora control',
  '🚀 Chhote chhote bachao, bade sapne banate hain',
  '💰 Hisaab rakho — paisa khud aapka rahega',
  '🔥 Aapki streak mat todo — roz thoda thoda likho',
  '📊 Jo maapte hain, wo hi sambhalte hain',
  '🎯 Budget dushman nahi, dost hai',
  '✨ Aaj jitna likhoge, kal utna aasan hoga',
  '🏆 Har mahina ek nayi jeet ka mauka hai',
  '🧘 Sachchi shanti: jab paise ka hisaab clear ho'
];
var QUOTES_EN = [
  '💪 Change your money mindset, money follows',
  '🌱 Log one expense today = full control tomorrow',
  '🚀 Small savings today, big dreams tomorrow',
  '💰 Track it, and your money tracks you back',
  "🔥 Don't break your streak — write daily!",
  '📊 What gets measured, gets managed',
  '🎯 A budget is a friend, not a foe',
  '✨ Write today, breathe easy tomorrow',
  '🏆 Every month is a fresh chance to win',
  '🧘 Real peace: a clear money picture'
];
function showWelcome() {
  var h = new Date().getHours();
  var greet = h < 12 ? t('greetMorning') : h < 17 ? t('greetAfternoon') : t('greetEvening');
  var nm = getUserName();
  var titleEl = document.getElementById('welcomeTitle');
  var nameRow = document.getElementById('nameRow');
  if (nm) {
    // Naam saved hai — har baar naam ke saath welcome
    titleEl.textContent = (settings.lang === 'en' ? 'Welcome back, ' + nm + '! 👋' : 'Wapas swagat, ' + nm + '! 👋');
    nameRow.hidden = true;
  } else {
    // Pehli baar — naam maango
    titleEl.textContent = 'Welcome to Keshu first app!';
    nameRow.hidden = false;
    userNameInput.value = '';
    setTimeout(function () { userNameInput.focus(); }, 200);
  }
  document.getElementById('welcomeSub').textContent = (nm ? greet + ' — ' : '') + formatDate(getTodayStr());
  // Motivational quote (har baar nayi)
  var quotes = settings.lang === 'en' ? QUOTES_EN : QUOTES_HI;
  document.getElementById('welcomeQuote').textContent = '💡 ' + quotes[Math.floor(Math.random() * quotes.length)];
  welcomeModal.hidden = false;
}
// Har app-open par welcome dikhao (naam ke saath)
function maybeWelcome() { showWelcome(); }
document.getElementById('welcomeOk').addEventListener('click', function () {
  if (!getUserName() && userNameInput.value.trim()) {
    setUserName(userNameInput.value);
    showToast('👤 ' + userNameInput.value.trim() + ' — ' + t('nameSaved'));
  }
  welcomeModal.hidden = true;
});

// ================== INIT ==================
applySettings();
renderProfiles();
render();
checkRecurring();
applyI18n();
dailyNotif();
renderListOnly();
if (!getPin()) maybeWelcome();
