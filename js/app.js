/* ==========================================================
   亚马逊爆品选品系统 — 基于 Bella 爆品方法论
   核心方法论来源：
   · 第二课-亚马逊爆品体系化运营高阶.pptx
   · Bella厨房喷火器市调模板0929.xlsx
   · 本次直播围绕.docx
   ========================================================== */

let API_KEY = localStorage.getItem('amz_pro_api_key') || '';
let API_BASE_URL = localStorage.getItem('amz_pro_api_url') || 'https://api.anthropic.com';
let API_MODEL = localStorage.getItem('amz_pro_api_model') || 'claude-sonnet-4-20250514';
let projects = JSON.parse(localStorage.getItem('amz_pro_projects') || '[]');
let currentId = null;
let currentUploadType = 'screenshot';
let pendingUploadType = null;

// ===== INIT =====
updateApiStatus();
renderHistory();

// ===== API SETTINGS =====
function saveApiKey() {
  const keyEl = document.getElementById('apiKeyInput');
  const v = keyEl ? keyEl.value.trim() : '';
  if (!v) {
    showInlineError('请先输入 API Key');
    return;
  }
  API_KEY = v;
  localStorage.setItem('amz_pro_api_key', v);

  // 中转站地址
  const urlEl = document.getElementById('apiUrlInput');
  if (urlEl && urlEl.value.trim()) {
    API_BASE_URL = urlEl.value.trim().replace(/\/$/, '');
    localStorage.setItem('amz_pro_api_url', API_BASE_URL);
  }

  // 模型名：优先用用户填的，否则根据中转站自动推断
  const modelEl = document.getElementById('apiModelInput');
  const modelVal = modelEl ? modelEl.value.trim() : '';
  if (modelVal) {
    API_MODEL = modelVal;
  } else {
    // 如果是中转站且没填模型，保持默认
    API_MODEL = API_MODEL || 'claude-sonnet-4-20250514';
  }
  localStorage.setItem('amz_pro_api_model', API_MODEL);

  updateApiStatus();
  keyEl.value = '';

  // 显示成功提示，不用 alert
  const box = document.getElementById('apiSetupBox');
  const msg = document.getElementById('apiSavedMsg');
  if (box) { box.style.background = 'var(--green-light)'; box.style.borderColor = '#c6e09a'; }
  if (msg) { msg.style.display = 'block'; }
  setTimeout(() => { if (msg) msg.style.display = 'none'; }, 3000);
}

function showInlineError(text) {
  const msg = document.getElementById('apiSavedMsg');
  if (msg) {
    msg.style.display = 'block';
    msg.style.color = '#A32D2D';
    msg.textContent = '⚠ ' + text;
    setTimeout(() => {
      msg.style.display = 'none';
      msg.style.color = '#3B6D11';
      msg.textContent = '✓ 已保存，可以开始分析';
    }, 3000);
  }
}

function updateApiStatus() {
  const dot = document.getElementById('apiDot');
  const txt = document.getElementById('apiStatusText');
  if (!dot || !txt) return;
  const isProxy = API_BASE_URL !== 'https://api.anthropic.com';
  if (API_KEY) {
    dot.className = 'dot ok';
    txt.textContent = isProxy ? 'API 已就绪（中转）' : 'API 已就绪';
  } else {
    dot.className = 'dot';
    txt.textContent = '未配置 API Key';
  }
}

function selectApiMode(mode) {
  const cOff = document.getElementById('choiceOfficial');
  const cPro = document.getElementById('choiceProxy');
  const urlRow = document.getElementById('proxyUrlRow');
  const modelRow = document.getElementById('proxyModelRow');
  const hintEl = document.getElementById('apiHintText');
  const keyEl = document.getElementById('apiKeyInput');

  if (cOff) cOff.classList.toggle('selected', mode === 'official');
  if (cPro) cPro.classList.toggle('selected', mode === 'proxy');
  if (urlRow) urlRow.style.display = mode === 'proxy' ? 'block' : 'none';
  if (modelRow) modelRow.style.display = mode === 'proxy' ? 'block' : 'none';

  if (mode === 'official') {
    API_BASE_URL = 'https://api.anthropic.com';
    localStorage.setItem('amz_pro_api_url', API_BASE_URL);
    if (keyEl) keyEl.placeholder = 'sk-ant-api03-...';
    if (hintEl) hintEl.innerHTML = '获取官方 Key：<a href="https://console.anthropic.com/" target="_blank">console.anthropic.com →</a>（需翻墙）';
  } else {
    if (keyEl) keyEl.placeholder = '中转站 API Key';
    if (hintEl) hintEl.innerHTML = '填入中转站地址和 Key 后点保存，Key 只存在本地浏览器';
  }
}

// Helper: build fetch URL and headers
function buildApiRequest(body) {
  const isProxy = API_BASE_URL !== 'https://api.anthropic.com';
  const url = `${API_BASE_URL}/v1/messages`;
  const headers = { 'Content-Type': 'application/json' };
  if (isProxy) {
    headers['Authorization'] = `Bearer ${API_KEY}`;
  } else {
    headers['x-api-key'] = API_KEY;
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }
  return { url, headers, body: JSON.stringify(body) };
}

// ===== PROJECTS =====
function newProject() {
  document.getElementById('welcomeScreen').style.display = 'flex';
  document.getElementById('analysisScreen').style.display = 'none';
  currentId = null;
  renderHistory();
}

function startAnalysis() {
  if (!API_KEY) {
    // 滚动到 API 设置框提示
    const box = document.getElementById('apiSetupBox');
    if (box) { box.scrollIntoView({ behavior: 'smooth' }); box.style.borderColor = '#E24B4A'; }
    showInlineError('请先填写并保存 API Key');
    return;
  }
  const kw = document.getElementById('kwInput').value.trim();
  if (!kw) { document.getElementById('kwInput').focus(); return; }
  const asins = document.getElementById('asinInput').value.trim().split(',').map(a => a.trim()).filter(Boolean);
  const market = document.getElementById('marketInput').value;

  const id = Date.now().toString();
  const project = {
    id, kw, asins, market,
    createdAt: new Date().toLocaleString('zh-CN'),
    currentStep: 0, stepData: {},
    financials: { price: 19.98, cost: 3, ship: 0.5, fba: 4.3, adBudget: 20, inventory: 500, refund: 3, coupon: 1, storage: 2 },
    uploadedData: {}
  };
  projects.unshift(project);
  saveProjects();
  loadProject(id);
  runStep(1);
}

function loadProject(id) {
  const p = projects.find(x => x.id === id);
  if (!p) return;
  currentId = id;
  document.getElementById('welcomeScreen').style.display = 'none';
  document.getElementById('analysisScreen').style.display = 'flex';
  document.getElementById('analysisKw').textContent = p.kw;
  document.getElementById('analysisMeta').textContent =
    `市场: ${p.market} | ${p.asins.length ? 'ASIN: ' + p.asins.join(', ') : '未填入ASIN'} | ${p.createdAt}`;
  updateStepsNav(p.currentStep);
  renderHistory();
  if (p.stepData[p.currentStep]) renderStep(p.currentStep);
  else if (p.currentStep >= 1) { /* show step */ }
  else document.getElementById('stepContent').innerHTML = '';
}

function getP() { return projects.find(x => x.id === currentId); }
function saveProjects() { localStorage.setItem('amz_pro_projects', JSON.stringify(projects)); }

function renderHistory() {
  const list = document.getElementById('historyList');
  list.innerHTML = '';
  projects.forEach(p => {
    const div = document.createElement('div');
    div.className = 'history-item' + (p.id === currentId ? ' active' : '');
    div.onclick = () => loadProject(p.id);
    const v = p.stepData[7];
    let st = '<span class="hi-pending">分析中...</span>';
    if (v) {
      const c = v.decisionType === 'go' ? 'hi-go' : v.decisionType === 'caution' ? 'hi-caution' : 'hi-nogo';
      st = `<span class="${c}">${v.decision} · ${v.totalScore}分</span>`;
    } else if (p.currentStep > 0) {
      st = `<span class="hi-pending">Step ${p.currentStep}/7</span>`;
    }
    div.innerHTML = `<div class="hi-kw">${p.kw}</div><div class="hi-status">${st}</div>`;
    list.appendChild(div);
  });
}

// ===== STEPS NAV =====
function updateStepsNav(done) {
  for (let i = 1; i <= 7; i++) {
    const el = document.getElementById('si' + i);
    el.className = 'step-item';
    if (i <= done) el.classList.add('done');
    else if (i === done + 1) { /* available */ }
    else el.classList.add('locked');
  }
}

function goStep(n) {
  const p = getP(); if (!p) return;
  if (n > p.currentStep + 1) return;
  if (p.stepData[n]) { setActiveStep(n); renderStep(n); return; }
  if (n === 6) { showFinanceForm(); return; }
  runStep(n);
}

function setActiveStep(n) {
  const p = getP(); if (!p) return;
  for (let i = 1; i <= 7; i++) {
    const el = document.getElementById('si' + i);
    el.className = 'step-item';
    if (i < n && p.stepData[i]) el.classList.add('done');
    else if (i === n) el.classList.add('active');
    else if (i > p.currentStep + 1) el.classList.add('locked');
  }
}

async function runStep(n) {
  const p = getP(); if (!p) return;
  setActiveStep(n);
  document.getElementById('stepContent').innerHTML = loadingHtml(n);
  try {
    const result = await callClaude(n, p);
    p.stepData[n] = result;
    if (n > p.currentStep) p.currentStep = n;
    saveProjects();
    updateStepsNav(p.currentStep);
    renderHistory();
    renderStep(n);
  } catch (e) {
    document.getElementById('stepContent').innerHTML = `
      <div class="panel"><p style="color:var(--red);font-size:13px;">⚠ 分析失败：${e.message}</p>
      <p style="font-size:11px;color:var(--text-3);margin-top:6px;">请检查 API Key 及网络连接。</p>
      <button class="re-btn" style="margin-top:10px;" onclick="runStep(${n})">重试</button></div>`;
  }
}

const STEP_LABELS = ['', 'Google趋势分析', '市场概览', '竞品拆解', '用户画像', '差异化机会', '财务测算', 'Go/No-Go 决策'];
function loadingHtml(n) {
  return `<div class="panel"><div class="loading-wrap">
    <div class="loading-spinner"></div>
    <div class="loading-text">Step ${n}: ${STEP_LABELS[n]} 分析中</div>
    <div class="loading-sub">AI 正在基于 Bella 爆品方法论处理数据...</div>
  </div></div>`;
}

// ===== CLAUDE API =====
async function callClaude(step, p) {
  const { kw, asins, market, stepData, financials: fin, uploadedData } = p;
  const asinStr = asins.join(', ') || '未提供';
  const uploadCtx = buildUploadContext(uploadedData);

  // ── BELLA METHODOLOGY SYSTEM PROMPT ──
  const SYSTEM = `你是亚马逊爆品选品专家，深度掌握以下方法论：
【Bella爆品方法论核心】
1. 选对产品 > 努力运营，错误的产品让顶尖运营也事倍功半
2. 选品四维评估：市场垄断度 + 利润空间 + 产品趋势与季节性 + 用户偏好
3. 用户需求金字塔：基础需求(65%) → 期望需求(35%) → 社交/尊重需求(5%)
4. WHO/WHAT/HOW/WHERE 四维用户画像分析
5. 供需比分析：关键词下竞争供给/市场需求，识别低竞争高潜力蓝海词
6. 差异化方法：数据→空白→机会 + 交叉维度结构性空白
7. 成本核算：显性成本(采购+运费+FBA+佣金) + 隐性成本(推广+仓储+退货+优惠券)
8. 警惕伪风口：区分事件驱动短期暴增 vs 长期稳定趋势
9. 市场垄断度：Top3品牌份额总计 < 50% 为可进入市场
10. 季节性判断：比较360天vs90天数据，提前1-2个月布局旺季

所有分析必须有数据支撑，输出JSON格式，不要加markdown代码块。`;

  const prompts = {
    1: `分析"${kw}"在${market}市场的Google趋势数据。${uploadCtx}
仅输出JSON：
{"trendDirection":"平稳","trendScore":65,"seasonal":true,"peakMonth":"5月","peakMonthNum":5,"isFakeHype":false,"fakeHypeReason":"","trendHistory":[65,58,70,80,75,65,72,68,60,55,70,78],"trendMonths":["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"],"relatedTopics":["small crossbody bag","crossbody purse women","mini crossbody bag"],"relatedQueries":["crossbody bags for women leather","small crossbody bags for women","crossbody bags women black"],"trendInsight":"趋势平稳上升，有明显季节性，旺季为5月（母亲节）和12月（圣诞），非伪风口，适合长期布局","seasonalAdvice":"建议提前2个月（3月/10月）备货，完成关键词卡位","riskLevel":"低"}`,

    2: `分析"${kw}"在${market}市场的整体市场概况，含ABA品牌分析和商机探测器数据。竞品ASIN: ${asinStr}。${uploadCtx}
仅输出JSON：
{"monthlySearch":666802,"weeklySearch":156260,"cpc":0.54,"competitorCount":260076,"peakMonth":"5月","avgPrice":24.5,"priceRange":{"min":12.99,"max":49.99},"topBrands":[{"name":"Pander","share":7.77,"monthlySales":23792},{"name":"BAGSMART","share":6.70,"monthlySales":20513},{"name":"MAXTOP","share":5.32,"monthlySales":16287}],"top3ShareTotal":19.79,"monopolyLevel":"中等","monopolyOk":true,"repeatPurchaseRate":12.5,"marketBasket":["wallet","phone case","earbuds"],"subMarkets":[{"name":"small crossbody bags for women","search360":120343,"search90":32000,"growth":"+8%","avgPrice":22.5,"status":"增长"},{"name":"leather crossbody bags","search360":85000,"search90":20000,"growth":"+3%","avgPrice":35,"status":"稳定"}],"chineseSellers":78,"usSellers":22,"summary":"市场需求旺盛，Top3品牌占比19.79%（<50%），市场进入门槛适中，细分词\"small crossbody bags\"增长强劲"}`,

    3: `深度拆解"${kw}"竞品，含垄断度分析和产品属性矩阵。竞品ASIN: ${asinStr}。${uploadCtx}
仅输出JSON（competitors最多6个）：
{"competitors":[{"name":"KAMEILONG","brand":"KAMEILONG","price":20.99,"rating":4.6,"reviews":256,"monthlySales":814,"asin":"B0DCHY41QT","listingAge":"2023年","material":"Vegan Leather","colors":5,"hasAdjustStrap":true,"hasMultiPocket":true,"monopolyScore":2},{"name":"Caitina","brand":"Caitina","price":29.99,"rating":4.6,"reviews":2058,"monthlySales":266,"asin":"B0BWYC7D7J","listingAge":"2022年","material":"Corduroy","colors":8,"hasAdjustStrap":true,"hasMultiPocket":true,"monopolyScore":4}],"priceDistribution":{"under15":5,"15to20":20,"20to25":40,"25to30":35,"over30":0},"mainMaterials":[{"name":"Vegan Leather/PU","pct":40},{"name":"Corduroy","pct":20},{"name":"Faux Straw","pct":20},{"name":"未注明","pct":20}],"newSellerBarrier":"低","adSpotOpportunity":"新品评论少的广告位机会大，首页广告坑位中评论<100的占100%","monopolyAnalysis":"Top3份额19.79%<50%，市场分散，新卖家可进入","basicAttributes":["可调节肩带","多口袋","拉链设计","防水"],"upgradeAttributes":["超轻(<300g)","防盗设计","RFID防护","可拆卸"],"summary":"竞争激烈但无绝对垄断，差异化空间存在于轻量化和智能分区，新品有广告位切入机会"}`,

    4: `分析"${kw}"用户画像与评论痛点，基于WHO/WHAT/HOW/WHERE四维模型和需求金字塔。${uploadCtx}
仅输出JSON：
{"who":"重实用性与时尚感的都市女性，日常通勤者和休闲出行者，25-45岁，有家庭","what":"满足日常通勤和休闲出行的收纳需求，提升个人风格，作为礼品","how":"注重轻便舒适的佩戴体验（尤其肩带），高效内部收纳，材质质感","where":"日常通勤、休闲逛街、朋友聚会、短途旅行","basicNeeds":[{"label":"足够收纳空间","pct":25,"desc":"包体容量能装下手机、钱包、钥匙等日常必需品"},{"label":"基本品质与结构","pct":20,"desc":"耐用性和结构稳定性，避免掉线、松散"},{"label":"功能性肩带","pct":10,"desc":"可斜挎或单肩，支撑包体重量"}],"expectedNeeds":[{"label":"舒适佩戴体验","pct":20,"desc":"肩带可调节，长度宽度适中，不勒肩"},{"label":"精良细节做工","pct":10,"desc":"材质、缝线、五金件工艺良好"},{"label":"高效内部组织","pct":10,"desc":"合理的分层、口袋、卡槽设计"}],"socialNeeds":[{"label":"时尚外观与个性表达","pct":5,"desc":"设计符合潮流，吸引力强，与个人风格匹配"}],"basicNeedsPct":55,"expectedNeedsPct":40,"socialNeedsPct":5,"painPoints":[{"type":"尺寸/容量","pain":"包太小放不下手机和钱包","pct":18,"source":"差评"},{"type":"内部收纳","pain":"内部分区混乱，物品容易丢失","pct":15,"source":"差评"},{"type":"肩带","pain":"肩带太窄不可调节，长时间佩戴勒肩","pct":12,"source":"差评"},{"type":"材质做工","pain":"拉链易卡，材质廉价，缝线散开","pct":25,"source":"差评"},{"type":"描述与实物不符","pain":"颜色/尺寸与图片差异大","pct":10,"source":"差评"}],"positivePoints":["轻便易携带","外观时尚多色","性价比高","多口袋实用"],"qaInsights":["询问材质是否防水占22%","询问容量尺寸占18%","询问肩带长度占15%"],"targetCustomer":"都市25-45岁女性，对品质有要求但价格敏感，重视实用性>时尚性","listingHints":"主图应展示家庭/通勤/旅行等温暖场景，强调轻便+多口袋+可调节肩带"}`,

    5: `基于"${kw}"的用户痛点和竞品分析，识别差异化机会，输出关键词供需比分析。${uploadCtx}
仅输出JSON：
{"gaps":[{"title":"极致轻巧+智能分区的小包","desc":"\"small crossbody bags for women\"月搜索12万，但市场上结合\"超轻+4+口袋合理分区\"的产品极少，结构性空白","priority":"高"},{"title":"可调宽肩带+防水内衬","desc":"近12%差评指向肩带问题，30%+QA询问防水性，竞品普遍忽视","priority":"高"},{"title":"入门价格段的品质感","desc":"$20-25价格带占40%市场，但做工好评仅20%，\"性价比+品质感\"有机会","priority":"中"}],"targetKeywords":[{"kw":"small crossbody bags for women","monthlySearch":120343,"results":45000,"supplyDemandRatio":0.37,"competition":"低","opportunity":"极高","recommended":true},{"kw":"crossbody bags for women","monthlySearch":666802,"results":260076,"supplyDemandRatio":0.39,"competition":"中","opportunity":"高","recommended":true},{"kw":"crossbody purse for women small","monthlySearch":35000,"results":8000,"supplyDemandRatio":0.23,"competition":"低","opportunity":"极高","recommended":true},{"kw":"mini crossbody bag women","monthlySearch":28000,"results":12000,"supplyDemandRatio":0.43,"competition":"中","opportunity":"中","recommended":false}],"positioning":{"title":"极轻便·智收纳·多口袋 女士斜挎包","priceRange":"$22-$26","material":"轻量PU皮/Vegan Leather","targetPrice":24.98},"keyFeatures":["超轻设计<300g（解决佩戴疲劳）","4+口袋智能分区（解决收纳混乱）","可调节1.5寸宽肩带（解决肩部不适）","防水PU内衬（解决常见QA问题）","12+色彩选择（满足个性化需求）"],"differentiationScore":78,"listingStrategy":"标题前置\"Small Crossbody Bag\"，Bullet Points重点突出\"轻量化+分区+可调节\"，主图展示装满日常物品的容量对比","warningWords":["fake leather","thin strap","too small"],"summary":"市场存在\"轻量+智能分区\"的结构性空白，供需比<0.4的词仍有蓝海机会，建议切入small crossbody细分"}`,

    6: `计算"${kw}"的完整财务数据，包括显性和隐性成本。
显性成本: 采购$${fin.cost}, 头程$${fin.ship}/件, FBA$${fin.fba}
售价: $${fin.price}, 日均广告: $${fin.adBudget}, 首批库存: ${fin.inventory}件
隐性成本: 退货率估算$${fin.refund||3}/月%, 优惠券$${fin.coupon||1}/月%, 仓储$${fin.storage||2}/月
仅输出JSON：
{"unitCost":${fin.cost},"unitShip":${fin.ship},"fbaFee":${fin.fba},"commission":${(fin.price*0.15).toFixed(2)},"sellingPrice":${fin.price},"totalVisibleCost":${(fin.cost+fin.ship+fin.fba+fin.price*0.15).toFixed(2)},"grossProfit":${(fin.price-fin.cost-fin.ship-fin.fba-fin.price*0.15).toFixed(2)},"grossMargin":${(((fin.price-fin.cost-fin.ship-fin.fba-fin.price*0.15)/fin.price)*100).toFixed(1)},"monthlyAdSpend":${fin.adBudget*30},"estimatedDailySales":3,"monthlyRevenue":${(3*fin.price*30).toFixed(0)},"monthlyGrossProfit":${((3*(fin.price-fin.cost-fin.ship-fin.fba-fin.price*0.15)*30)).toFixed(0)},"hiddenCosts":${(fin.refund||3)+(fin.coupon||1)+(fin.storage||2)+fin.adBudget*30},"monthlyNetProfit":${((3*(fin.price-fin.cost-fin.ship-fin.fba-fin.price*0.15)*30)-fin.adBudget*30-((fin.refund||3)+(fin.coupon||1)+(fin.storage||2))).toFixed(0)},"firstBatchCost":${(fin.inventory*(fin.cost+fin.ship)).toFixed(0)},"monthlyROI":${((((3*(fin.price-fin.cost-fin.ship-fin.fba-fin.price*0.15)*30)-fin.adBudget*30)/(fin.inventory*(fin.cost+fin.ship)))*100).toFixed(1)},"inventoryDays":166,"breakEvenDays":${Math.ceil(fin.inventory*(fin.cost+fin.ship)/Math.max(1,(3*(fin.price-fin.cost-fin.ship-fin.fba-fin.price*0.15)-fin.adBudget/30)))}, "supplierLow":"¥15.00","supplierMid":"¥32.00","supplierHigh":"¥42.00","healthCheck":{"marginOk":${((fin.price-fin.cost-fin.ship-fin.fba-fin.price*0.15)/fin.price)>0.3},"roiOk":${(((3*(fin.price-fin.cost-fin.ship-fin.fba-fin.price*0.15)*30)-fin.adBudget*30)/(fin.inventory*(fin.cost+fin.ship)))>0.08},"marginNote":"毛利率${(((fin.price-fin.cost-fin.ship-fin.fba-fin.price*0.15)/fin.price)*100).toFixed(1)}%，${(((fin.price-fin.cost-fin.ship-fin.fba-fin.price*0.15)/fin.price))>0.3 ? '超过30%健康线，盈利基础良好' : '低于30%警戒线，需优化成本'}"},"warning":"广告日均投入$${fin.adBudget}，预估日销3单，广告效率偏低，建议优化关键词定向，库存周转166天高于健康值(90天)，存在资金积压风险"}`,

    7: `作为资深亚马逊卖家顾问，基于完整七步数据，做最终Go/No-Go决策。
关键词:${kw} | 市场:${market} | 月搜索:${stepData[2]?.monthlySearch||666802}
Top3份额:${stepData[2]?.top3ShareTotal||19.79}% | 垄断OK:${stepData[2]?.monopolyOk||true}
毛利率:${stepData[6]?.grossMargin||46}% | 月净利:$${stepData[6]?.monthlyNetProfit||226} | ROI:${stepData[6]?.monthlyROI||9.6}%
差异化评分:${stepData[5]?.differentiationScore||78}/100 | 趋势:${stepData[1]?.trendDirection||'平稳'}
仅输出JSON：
{"totalScore":74,"decision":"谨慎GO","decisionType":"caution","dimensions":[{"name":"市场容量","weight":15,"score":13,"maxScore":15,"reason":"月搜索66万，细分词12万，市场规模大","status":"ok"},{"name":"竞争可进入性","weight":20,"score":13,"maxScore":20,"reason":"Top3份额<20%，新品广告位机会存在，但竞品数26万偏多","status":"caution"},{"name":"利润空间","weight":20,"score":16,"maxScore":20,"reason":"毛利率46%远超30%健康线，显性成本结构健康","status":"ok"},{"name":"差异化空间","weight":15,"score":12,"maxScore":15,"reason":"轻量化+智能分区有结构性空白，关键词供需比<0.4","status":"ok"},{"name":"供应链可行性","weight":15,"score":10,"maxScore":15,"reason":"1688有货源，但需确认MOQ和打样周期","status":"caution"},{"name":"品牌壁垒","weight":15,"score":10,"maxScore":15,"reason":"无头部绝对垄断，但Pander等品牌有粉丝积累","status":"caution"}],"goReasons":["毛利率健康，盈利基础好","差异化方向清晰：轻量+分区+宽肩带","市场需求持续稳定，非伪风口","Top3总份额<20%，市场分散可进入"],"cautionReasons":["广告效率偏低，日投$20仅带来3单，需优化","库存周转166天，资金积压风险高","竞品数超26万，需精准差异化和长尾词策略"],"noGoReasons":[],"nextSteps":["打样：验证\"超轻+4口袋+宽肩带\"设计方案，送样测试","关键词：优先布局small crossbody bags for women等供需比<0.4的词","广告：新品期主攻精准长尾词，控日预算$10-15，优化ACOS","库存：首批控制200-300件，验证市场反应后再追货","Listing：主图展示容量对比图，突出\"轻量+分区\"核心卖点","时机：5月母亲节旺季前2个月（3月初）完成上架和关键词卡位"],"seasonalTiming":"建议3月初上架，布局母亲节旺季","finalAdvice":"市场机会真实存在，产品差异化方向清晰，但需严格控制首批库存量和广告成本，以小成本验证后再放量。"}`,
  };

  const req = buildApiRequest({
    model: API_MODEL,
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompts[step] }]
  });
  const resp = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
  }
  const data = await resp.json();
  const text = data.content.map(c => c.text || '').join('').replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

// Build uploaded data context string
function buildUploadContext(ud) {
  if (!ud || Object.keys(ud).length === 0) return '';
  let ctx = '\n\n【用户已上传的亚马逊数据，优先使用以下数据代替模拟值】:\n';
  for (const [type, items] of Object.entries(ud)) {
    if (items && items.length > 0) {
      ctx += `[${type}]: ${items.map(i => i.summary || i.text || '').join(' | ')}\n`;
    }
  }
  return ctx;
}

// ===== RENDER STEPS =====
function renderStep(n) {
  const p = getP(); if (!p || !p.stepData[n]) return;
  setActiveStep(n);
  const renders = [null, renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6, renderStep7];
  document.getElementById('stepContent').innerHTML = renders[n](p.stepData[n], p);
}

const nextBtnHtml = (n, label, fn) => `<div class="next-btn-wrap"><button class="next-btn" onclick="${fn||`runStep(${n})`}">${label} →</button></div>`;
const reBtn = (n, label) => `<button class="re-btn" onclick="${n===6?'showFinanceForm()':n===5?'runStep(5)':(`runStep(${n})`)}">${label||'重新分析'}</button>`;
const uploadHintBtn = () => `<button class="upload-hint-btn" onclick="showDataUpload()">📎 上传数据</button>`;

// STEP 1: Google Trends
function renderStep1(d) {
  const bars = (d.trendHistory||[]).map((v,i) =>
    `<div class="trend-bar-col" style="height:${v}%;opacity:${i===4?'1':'0.7'};background:${i===4?'var(--green)':'var(--green-2)'}" title="${d.trendMonths?.[i]||''}:${v}"></div>`
  ).join('');
  return `<div class="panel">
    <div class="panel-hd"><h2>Step 1: Google Trends 趋势分析</h2><div class="panel-hd-actions">${uploadHintBtn()}${reBtn(1)}</div></div>
    ${d.isFakeHype ? `<div class="warn-box" style="margin-bottom:14px;">⚠ 伪风口预警：${d.fakeHypeReason}</div>` : ''}
    <div class="metrics-grid">
      <div class="metric-card"><div class="metric-label">热度指数</div><div class="metric-value">${d.trendScore}<span style="font-size:14px;font-weight:400;color:var(--text-3)">/100</span></div></div>
      <div class="metric-card"><div class="metric-label">趋势方向</div><div class="metric-value" style="font-size:16px;font-weight:700;">${d.trendDirection}</div></div>
      <div class="metric-card"><div class="metric-label">搜索旺季</div><div class="metric-value" style="font-size:16px;">${d.peakMonth}</div></div>
      <div class="metric-card"><div class="metric-label">季节性</div><div class="metric-value" style="font-size:16px;">${d.seasonal?'明显':'不明显'}</div><div class="metric-sub">${d.seasonal?'需提前2个月布局':'全年稳定可销售'}</div></div>
    </div>
    <div class="two-col">
      <div>
        <div class="section-title">12个月热度走势</div>
        <div class="trend-bar-wrap">${bars}</div>
        <div class="trend-axis"><span>${d.trendMonths?.[0]||'1月'}</span><span>${d.peakMonth}</span><span>${d.trendMonths?.[11]||'12月'}</span></div>
        <div style="margin-top:12px;">
          <div class="section-title">相关主题词</div>
          <div class="tag-row">${(d.relatedTopics||[]).map(t=>`<span class="tag tag-blue">${t}</span>`).join('')}</div>
        </div>
      </div>
      <div>
        <div class="section-title">趋势洞察（Bella方法论）</div>
        <div class="inner-card" style="margin-bottom:10px;"><div class="inner-card-text">${d.trendInsight}</div></div>
        <div class="section-title">季节性运营建议</div>
        <div class="inner-card"><div class="inner-card-text">${d.seasonalAdvice}</div></div>
        <div style="margin-top:12px;">
          <div class="section-title">风险等级</div>
          <span class="tag ${d.riskLevel==='低'?'tag-green':d.riskLevel==='中'?'tag-amber':'tag-red'}">${d.riskLevel}风险</span>
          ${!d.isFakeHype?'<span class="tag tag-green" style="margin-left:4px;">非伪风口</span>':'<span class="tag tag-red" style="margin-left:4px;">⚠ 伪风口风险</span>'}
        </div>
      </div>
    </div>
  </div>
  ${nextBtnHtml(2,'下一步: 市场概览 & 商机探测器')}`;
}

// STEP 2: Market Overview
function renderStep2(d) {
  const monopolyColor = d.monopolyOk ? 'var(--green)' : 'var(--red)';
  return `<div class="panel">
    <div class="panel-hd"><h2>Step 2: 市场概览 / ABA品牌分析 / 商机探测器</h2><div class="panel-hd-actions">${uploadHintBtn()}${reBtn(2)}</div></div>
    <div class="metrics-grid">
      <div class="metric-card"><div class="metric-label">月搜索量</div><div class="metric-value">${(d.monthlySearch||0).toLocaleString()}</div></div>
      <div class="metric-card"><div class="metric-label">搜索结果数</div><div class="metric-value">${(d.competitorCount||0).toLocaleString()}</div></div>
      <div class="metric-card"><div class="metric-label">CPC 竞价</div><div class="metric-value">$${d.cpc}</div></div>
      <div class="metric-card"><div class="metric-label">类目均价</div><div class="metric-value">$${d.avgPrice}</div></div>
    </div>
    <div class="two-col">
      <div>
        <div class="section-title">头部品牌市场份额（垄断度分析）</div>
        ${(d.topBrands||[]).map(b=>`<div class="score-row">
          <span class="score-dim">${b.name}</span>
          <div class="score-bar-wrap"><div class="score-bar-fill" style="width:${Math.min(b.share*5,100)}%;background:var(--green-2)"></div></div>
          <span class="score-num">${b.share}%</span>
        </div>`).join('')}
        <div style="margin-top:8px;padding:8px 10px;background:var(--bg-3);border-radius:var(--r-sm);">
          <span style="font-size:12px;color:var(--text-2);">Top3合计占比：</span>
          <strong style="color:${monopolyColor};font-size:14px;">${d.top3ShareTotal}%</strong>
          <span style="font-size:11px;margin-left:6px;" class="tag ${d.monopolyOk?'tag-green':'tag-red'}">${d.monopolyOk?'< 50% 可进入':'> 50% 垄断市场'}</span>
        </div>
        <div style="margin-top:10px;">
          <div class="section-title">卖家构成（Bella: 中国卖家占主导属正常）</div>
          <div class="score-row"><span class="score-dim">中国卖家</span><div class="score-bar-wrap"><div class="score-bar-fill" style="width:${d.chineseSellers}%;background:var(--amber-mid)"></div></div><span class="score-num">${d.chineseSellers}%</span></div>
          <div class="score-row"><span class="score-dim">本土卖家</span><div class="score-bar-wrap"><div class="score-bar-fill" style="width:${d.usSellers}%;background:var(--blue)"></div></div><span class="score-num">${d.usSellers}%</span></div>
        </div>
      </div>
      <div>
        <div class="section-title">商机探测器 — 细分市场增长分析</div>
        ${(d.subMarkets||[]).map(sm=>`<div class="inner-card" style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-size:12px;font-weight:700;color:var(--text);">${sm.name}</span>
            <span class="tag ${sm.status==='增长'?'tag-green':sm.status==='稳定'?'tag-blue':'tag-amber'}">${sm.growth} ${sm.status}</span>
          </div>
          <div style="font-size:11px;color:var(--text-3);">年搜索量: ${(sm.search360||0).toLocaleString()} | 季度: ${(sm.search90||0).toLocaleString()} | 均价: $${sm.avgPrice}</div>
        </div>`).join('')}
        <div class="section-title" style="margin-top:12px;">复购率 & 关联购买</div>
        <div class="inner-card">
          <div style="font-size:12px;color:var(--text-2);">复购率: <strong>${d.repeatPurchaseRate}%</strong></div>
          <div style="font-size:11px;color:var(--text-3);margin-top:4px;">常与该品类一起购买: ${(d.marketBasket||[]).join('、')}</div>
        </div>
      </div>
    </div>
    <div style="margin-top:12px;padding:10px 12px;background:var(--green-light);border-radius:var(--r-sm);font-size:12px;color:var(--green);">
      <strong>市场结论：</strong>${d.summary}
    </div>
  </div>
  ${nextBtnHtml(3,'下一步: 竞品深度拆解')}`;
}

// STEP 3: Competitor Analysis
function renderStep3(d) {
  return `<div class="panel">
    <div class="panel-hd"><h2>Step 3: 竞品拆解 — 垄断度 + 产品属性矩阵</h2><div class="panel-hd-actions">${uploadHintBtn()}${reBtn(3)}</div></div>
    <div class="table-wrap">
      <table class="comp">
        <thead><tr><th>竞品</th><th>价格</th><th>评分</th><th>评论数</th><th>月销量</th><th>上架年</th><th>可调肩带</th><th>多口袋</th><th>ASIN</th></tr></thead>
        <tbody>${(d.competitors||[]).map(c=>`<tr>
          <td class="td-bold">${c.name}</td><td>$${c.price}</td>
          <td>${c.rating} ★</td><td>${(c.reviews||0).toLocaleString()}</td>
          <td class="td-bold">${c.monthlySales}</td><td>${c.listingAge}</td>
          <td><span class="tag ${c.hasAdjustStrap?'tag-green':'tag-red'}" style="font-size:10px;">${c.hasAdjustStrap?'✓':'✗'}</span></td>
          <td><span class="tag ${c.hasMultiPocket?'tag-green':'tag-red'}" style="font-size:10px;">${c.hasMultiPocket?'✓':'✗'}</span></td>
          <td class="mono">${c.asin}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="two-col" style="margin-top:14px;">
      <div>
        <div class="section-title">价格分布</div>
        ${[['$15以下',d.priceDistribution?.under15||0],['$15-20',d.priceDistribution?.['15to20']||0],['$20-25',d.priceDistribution?.['20to25']||0],['$25-30',d.priceDistribution?.['25to30']||0],['$30+',d.priceDistribution?.over30||0]].map(([l,v])=>`
          <div class="score-row"><span class="score-dim">${l}</span><div class="score-bar-wrap"><div class="score-bar-fill" style="width:${v}%;"></div></div><span class="score-num">${v}%</span></div>`).join('')}
        <div class="section-title" style="margin-top:12px;">主要材质分布</div>
        ${(d.mainMaterials||[]).map(m=>`<div class="score-row"><span class="score-dim">${m.name}</span><div class="score-bar-wrap"><div class="score-bar-fill" style="width:${m.pct}%;background:var(--blue)"></div></div><span class="score-num">${m.pct}%</span></div>`).join('')}
      </div>
      <div>
        <div class="section-title">基础属性 vs 升级属性（Bella方法论）</div>
        <div style="margin-bottom:8px;"><span style="font-size:11px;color:var(--text-3);">基础属性（必须满足）</span>
          <div class="tag-row" style="margin-top:4px;">${(d.basicAttributes||[]).map(a=>`<span class="tag tag-green">${a}</span>`).join('')}</div>
        </div>
        <div style="margin-bottom:12px;"><span style="font-size:11px;color:var(--text-3);">升级属性（差异化加分项）</span>
          <div class="tag-row" style="margin-top:4px;">${(d.upgradeAttributes||[]).map(a=>`<span class="tag tag-purple">${a}</span>`).join('')}</div>
        </div>
        <div class="section-title">广告位机会</div>
        <div class="inner-card"><div class="inner-card-text">${d.adSpotOpportunity}</div></div>
        <div class="section-title" style="margin-top:12px;">垄断度结论</div>
        <div class="inner-card"><div class="inner-card-text">${d.monopolyAnalysis}</div></div>
      </div>
    </div>
  </div>
  ${nextBtnHtml(4,'下一步: 用户画像 & 需求金字塔')}`;
}

// STEP 4: User Portrait
function renderStep4(d) {
  return `<div class="panel">
    <div class="panel-hd"><h2>Step 4: 用户画像分析 — WHO/WHAT/HOW/WHERE + 需求金字塔</h2><div class="panel-hd-actions">${uploadHintBtn()}${reBtn(4)}</div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
      ${[['WHO — 使用对象',d.who],['WHAT — 购买目的',d.what],['HOW — 使用感受',d.how],['WHERE — 使用场景',d.where]].map(([l,v])=>`
        <div class="inner-card"><div class="inner-card-label">${l}</div><div class="inner-card-text">${v}</div></div>`).join('')}
    </div>
    <div class="two-col">
      <div>
        <div class="section-title">用户需求金字塔（Bella方法论）</div>
        <div style="margin-bottom:10px;background:var(--green-light);border-radius:var(--r-sm);padding:10px 12px;">
          <div style="font-size:11px;color:var(--green);font-weight:700;margin-bottom:6px;">基础需求 ${d.basicNeedsPct}% — 必须满足</div>
          ${(d.basicNeeds||[]).map(n=>`<div class="score-row" style="margin-bottom:4px;"><span class="score-dim">${n.label}(${n.pct}%)</span><div class="score-bar-wrap"><div class="score-bar-fill" style="width:${n.pct*4}%;background:var(--green)"></div></div></div>`).join('')}
        </div>
        <div style="margin-bottom:10px;background:var(--amber-light);border-radius:var(--r-sm);padding:10px 12px;">
          <div style="font-size:11px;color:var(--amber);font-weight:700;margin-bottom:6px;">期望需求 ${d.expectedNeedsPct}% — 满足则加分</div>
          ${(d.expectedNeeds||[]).map(n=>`<div class="score-row" style="margin-bottom:4px;"><span class="score-dim">${n.label}(${n.pct}%)</span><div class="score-bar-wrap"><div class="score-bar-fill" style="width:${n.pct*4}%;background:var(--amber-mid)"></div></div></div>`).join('')}
        </div>
        <div style="background:var(--purple-light);border-radius:var(--r-sm);padding:10px 12px;">
          <div style="font-size:11px;color:var(--purple);font-weight:700;margin-bottom:6px;">社交/尊重需求 ${d.socialNeedsPct}% — 高价值差异化</div>
          ${(d.socialNeeds||[]).map(n=>`<div class="score-row" style="margin-bottom:4px;"><span class="score-dim">${n.label}(${n.pct}%)</span><div class="score-bar-wrap"><div class="score-bar-fill" style="width:${n.pct*8}%;background:var(--purple)"></div></div></div>`).join('')}
        </div>
      </div>
      <div>
        <div class="section-title">评论痛点分析（差评来源）</div>
        ${(d.painPoints||[]).map(pt=>`<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;">
          <span class="tag tag-red" style="flex-shrink:0;">${pt.type}</span>
          <div>
            <div style="font-size:12px;color:var(--text);">${pt.pain}</div>
            <div style="font-size:10px;color:var(--text-3);">占差评 ${pt.pct}% · 来源: ${pt.source}</div>
          </div>
        </div>`).join('')}
        <div class="section-title" style="margin-top:12px;">好评聚焦点</div>
        <div class="tag-row">${(d.positivePoints||[]).map(p=>`<span class="tag tag-green">${p}</span>`).join('')}</div>
        <div class="section-title" style="margin-top:12px;">QA 高频问题</div>
        ${(d.qaInsights||[]).map(q=>`<div style="font-size:11px;color:var(--text-2);padding:3px 0;border-bottom:1px solid var(--border);">${q}</div>`).join('')}
        <div class="section-title" style="margin-top:12px;">Listing 优化提示</div>
        <div class="inner-card"><div class="inner-card-text">${d.listingHints}</div></div>
      </div>
    </div>
  </div>
  ${nextBtnHtml(5,'下一步: 差异化机会 & 关键词供需分析')}`;
}

// STEP 5: Differentiation
function renderStep5(d) {
  const compColor = (ratio) => ratio < 0.4 ? 'td-green' : ratio < 1.0 ? '' : 'td-amber';
  const kwBadge = (opp) => opp==='极高'?'kw-low':opp==='高'?'kw-low':opp==='中'?'kw-mid':'kw-high';
  return `<div class="panel">
    <div class="panel-hd"><h2>Step 5: 差异化机会 & 关键词供需比（蓝海分析）</h2><div class="panel-hd-actions">${uploadHintBtn()}${reBtn(5)}</div></div>
    <div class="section-title">市场空白识别（数据→空白→机会）</div>
    <div style="margin-bottom:14px;">
      ${(d.gaps||[]).map((g,i)=>`<div class="gap-card"><div class="gap-num">机会 ${i+1} · 优先级: ${g.priority}</div><div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:3px;">${g.title}</div><div class="gap-text">${g.desc}</div></div>`).join('')}
    </div>
    <div class="section-title">关键词供需比分析（Bella核心方法：供给/需求 < 0.4 = 蓝海）</div>
    <div class="table-wrap" style="margin-bottom:14px;">
      <table class="comp">
        <thead><tr><th>关键词</th><th>月搜索量</th><th>竞争结果数</th><th>供需比</th><th>竞争强度</th><th>机会评级</th><th>建议</th></tr></thead>
        <tbody>${(d.targetKeywords||[]).map(kw=>`<tr>
          <td style="font-weight:${kw.recommended?'700':'400'};color:${kw.recommended?'var(--green)':'var(--text)'};">${kw.kw}</td>
          <td>${(kw.monthlySearch||0).toLocaleString()}</td>
          <td>${(kw.results||0).toLocaleString()}</td>
          <td class="${compColor(kw.supplyDemandRatio)}">${kw.supplyDemandRatio.toFixed(2)}</td>
          <td>${kw.competition}</td>
          <td><span class="kw-score-badge ${kwBadge(kw.opportunity)}">${kw.opportunity}</span></td>
          <td>${kw.recommended?'✓ 重点布局':'参考'}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="two-col">
      <div>
        <div class="section-title">产品定位方案</div>
        <div class="inner-card" style="margin-bottom:10px;">
          <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:6px;">${d.positioning?.title}</div>
          <div style="font-size:12px;color:var(--text-2);">价格区间: <strong>${d.positioning?.priceRange}</strong> | 材质: ${d.positioning?.material}</div>
        </div>
        <div class="section-title">核心差异化卖点</div>
        ${(d.keyFeatures||[]).map(f=>`<div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:6px;"><span style="color:var(--green);font-size:12px;flex-shrink:0;">✓</span><span style="font-size:12px;color:var(--text);">${f}</span></div>`).join('')}
      </div>
      <div>
        <div class="section-title">Listing 关键词策略</div>
        <div class="inner-card" style="margin-bottom:10px;"><div class="inner-card-text">${d.listingStrategy}</div></div>
        <div class="section-title">需回避的负面词</div>
        <div class="tag-row">${(d.warningWords||[]).map(w=>`<span class="tag tag-red">${w}</span>`).join('')}</div>
        <div class="section-title" style="margin-top:12px;">差异化综合评分</div>
        <div class="score-row">
          <span class="score-dim">综合评分</span>
          <div class="score-bar-wrap"><div class="score-bar-fill" style="width:${d.differentiationScore}%;"></div></div>
          <span class="score-num">${d.differentiationScore}/100</span>
        </div>
        <p style="font-size:12px;color:var(--text-2);margin-top:8px;line-height:1.6;">${d.summary}</p>
      </div>
    </div>
  </div>
  ${nextBtnHtml(6,'下一步: 财务测算（显性+隐性成本）','showFinanceForm()')}`;
}

// STEP 6 FORM
function showFinanceForm() {
  const p = getP(); if (!p) return;
  setActiveStep(6);
  const f = p.financials;
  document.getElementById('stepContent').innerHTML = `<div class="panel">
    <div class="panel-hd"><h2>Step 6: 财务测算（Bella全成本核算模型）</h2></div>
    <div class="section-title">显性成本（直接成本）</div>
    <div class="fin-form" style="margin-bottom:18px;">
      <div class="fin-group"><label>采购单价 ($)</label><input type="number" id="f-cost" value="${f.cost}" step="0.1" /></div>
      <div class="fin-group"><label>头程运费/件 ($)</label><input type="number" id="f-ship" value="${f.ship}" step="0.1" /></div>
      <div class="fin-group"><label>FBA 费用 ($)</label><input type="number" id="f-fba" value="${f.fba}" step="0.1" /></div>
      <div class="fin-group"><label>目标售价 ($)</label><input type="number" id="f-price" value="${f.price}" step="0.01" /></div>
      <div class="fin-group"><label>日均广告预算 ($)</label><input type="number" id="f-ad" value="${f.adBudget}" step="1" /></div>
      <div class="fin-group"><label>首批库存 (件)</label><input type="number" id="f-inv" value="${f.inventory}" step="50" /></div>
    </div>
    <div class="section-title">隐性成本（间接成本，Bella强调必须计算）</div>
    <div class="fin-form">
      <div class="fin-group"><label>月退货成本 ($)</label><input type="number" id="f-refund" value="${f.refund||3}" step="1" /></div>
      <div class="fin-group"><label>月优惠券成本 ($)</label><input type="number" id="f-coupon" value="${f.coupon||1}" step="0.5" /></div>
      <div class="fin-group"><label>月仓储费 ($)</label><input type="number" id="f-storage" value="${f.storage||2}" step="0.5" /></div>
    </div>
    <div class="warn-box" style="margin-top:12px;">💡 Bella强调：只看毛利率会忽略广告、退货、仓储等隐性成本，必须做全成本核算才能看到真实净利润。</div>
    <button class="start-btn" style="max-width:200px;margin-top:14px;" onclick="submitFinance()">开始计算</button>
  </div>`;
}

function submitFinance() {
  const p = getP(); if (!p) return;
  p.financials = {
    cost: +document.getElementById('f-cost').value,
    ship: +document.getElementById('f-ship').value,
    fba: +document.getElementById('f-fba').value,
    price: +document.getElementById('f-price').value,
    adBudget: +document.getElementById('f-ad').value,
    inventory: +document.getElementById('f-inv').value,
    refund: +document.getElementById('f-refund').value,
    coupon: +document.getElementById('f-coupon').value,
    storage: +document.getElementById('f-storage').value
  };
  p.stepData[6] = null;
  saveProjects();
  runStep(6);
}

// STEP 6 RENDER
function renderStep6(d) {
  const mc = d.grossMargin > 30 ? 'green' : d.grossMargin > 15 ? 'amber' : 'red';
  const rc = d.monthlyROI > 15 ? 'green' : d.monthlyROI > 8 ? 'amber' : 'red';
  return `<div class="panel">
    <div class="panel-hd"><h2>Step 6: 财务测算 — 全成本核算结果</h2>${reBtn(6,'修改参数')}</div>
    <div class="fin-results">
      <div class="metric-card"><div class="metric-label">毛利/件</div><div class="metric-value ${mc}">$${d.grossProfit}</div><div class="metric-sub">毛利率 ${d.grossMargin}%</div></div>
      <div class="metric-card"><div class="metric-label">月净利润</div><div class="metric-value ${mc}">$${d.monthlyNetProfit}</div></div>
      <div class="metric-card"><div class="metric-label">首批投入</div><div class="metric-value">$${d.firstBatchCost}</div></div>
      <div class="metric-card"><div class="metric-label">月 ROI</div><div class="metric-value ${rc}">${d.monthlyROI}%</div></div>
    </div>
    <div class="two-col">
      <div>
        <div class="section-title">全成本拆解（显性 + 隐性）</div>
        ${[['采购成本',d.unitCost,d.sellingPrice,''],['头程运费',d.unitShip,d.sellingPrice,''],['FBA费用',d.fbaFee,d.sellingPrice,''],['平台佣金(15%)',d.commission||+(d.sellingPrice*0.15).toFixed(2),d.sellingPrice,'隐性'],['总显性成本/件',d.totalVisibleCost,d.sellingPrice,'']].map(([l,v,s,note])=>`
          <div class="score-row"><span class="score-dim" style="width:140px;">${l}${note?` <span style="font-size:9px;color:var(--text-3);">${note}</span>`:''}</span><div class="score-bar-wrap"><div class="score-bar-fill" style="width:${Math.min((v/s*100),100).toFixed(0)}%"></div></div><span class="score-num">$${v}</span></div>`).join('')}
        <div style="margin-top:10px;font-size:12px;color:var(--text-2);">月隐性成本合计（广告+退货+优惠券+仓储）: <strong>$${d.hiddenCosts}</strong></div>
        <div style="margin-top:4px;font-size:12px;color:var(--text-2);">回本预计: <strong>${d.breakEvenDays} 天</strong> | 库存周转: <strong>${d.inventoryDays} 天</strong></div>
        <div style="margin-top:4px;font-size:12px;color:var(--text-2);">月销售额: <strong>$${d.monthlyRevenue}</strong></div>
        <div class="warn-box" style="margin-top:10px;">${d.warning}</div>
      </div>
      <div>
        <div class="section-title">1688 供应商参考价格</div>
        <div class="supplier-row">
          <div class="supplier-card"><div class="supplier-type low">低成本</div><div class="supplier-price">${d.supplierLow}</div></div>
          <div class="supplier-card"><div class="supplier-type mid">均衡型</div><div class="supplier-price">${d.supplierMid}</div></div>
          <div class="supplier-card"><div class="supplier-type high">高品质</div><div class="supplier-price">${d.supplierHigh}</div></div>
        </div>
        <div class="section-title" style="margin-top:12px;">财务健康体检</div>
        <div style="display:flex;flex-direction:column;gap:6px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="tag ${d.healthCheck?.marginOk?'tag-green':'tag-red'}">${d.healthCheck?.marginOk?'✓':'✗'} 毛利率达标</span>
            <span style="font-size:11px;color:var(--text-3);">${d.healthCheck?.marginNote}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="tag ${d.healthCheck?.roiOk?'tag-green':'tag-red'}">${d.healthCheck?.roiOk?'✓':'✗'} ROI达标</span>
            <span style="font-size:11px;color:var(--text-3);">月ROI ${d.monthlyROI}%，${d.healthCheck?.roiOk?'超过8%安全线':'低于8%警戒线'}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  ${nextBtnHtml(7,'最终决策: Go / No-Go')}`;
}

// STEP 7: Decision
function renderStep7(d) {
  const cls = d.decisionType==='go'?'vbox-go':d.decisionType==='caution'?'vbox-caution':'vbox-nogo';
  return `<div class="verdict-box ${cls}">
    <div class="verdict-score">${d.totalScore}</div>
    <div class="verdict-sub">/ 100 分</div>
    <div class="verdict-label">${d.decision}</div>
    <div class="tag-row">
      ${(d.goReasons||[]).map(r=>`<span class="tag tag-green">${r}</span>`).join('')}
      ${(d.cautionReasons||[]).map(r=>`<span class="tag tag-amber">${r}</span>`).join('')}
      ${(d.noGoReasons||[]).map(r=>`<span class="tag tag-red">${r}</span>`).join('')}
    </div>
  </div>
  <div class="panel">
    <div class="panel-hd"><h2>多维评分矩阵（Bella四维评估体系扩展版）</h2>${reBtn(7)}</div>
    ${(d.dimensions||[]).map(dim=>`
      <div class="score-row">
        <span class="score-dim" style="width:170px;">${dim.name} (${dim.weight}%)</span>
        <div class="score-bar-wrap"><div class="score-bar-fill" style="width:${(dim.score/dim.maxScore*100).toFixed(0)}%;background:${dim.status==='ok'?'var(--green-2)':dim.status==='caution'?'var(--amber-mid)':'var(--red)'}"></div></div>
        <span class="score-num">${dim.score}/${dim.maxScore}</span>
      </div>
      <div style="font-size:11px;color:var(--text-3);padding-left:182px;margin:-4px 0 10px;">${dim.reason}</div>`).join('')}
  </div>
  <div class="panel">
    <div class="panel-hd"><h2>选品时机 & 运营行动计划</h2></div>
    ${d.seasonalTiming?`<div class="inner-card" style="margin-bottom:14px;background:var(--blue-light);"><div class="inner-card-label">季节性时机</div><div class="inner-card-text">${d.seasonalTiming}</div></div>`:''}
    <div class="ns-list">
      ${(d.nextSteps||[]).map((s,i)=>`<div class="ns-item"><div class="ns-num">${i+1}</div><div class="ns-text">${s}</div></div>`).join('')}
    </div>
    ${d.finalAdvice?`<div style="margin-top:14px;padding:12px 14px;background:var(--green-light);border-radius:var(--r-sm);font-size:12px;color:var(--green);line-height:1.6;"><strong>最终建议：</strong>${d.finalAdvice}</div>`:''}
  </div>`;
}

// ===== DATA UPLOAD =====
function showDataUpload() {
  document.getElementById('uploadModal').style.display = 'flex';
}
function closeUploadModal(e) {
  if (e.target.id === 'uploadModal') document.getElementById('uploadModal').style.display = 'none';
}
function switchUploadTab(tab) {
  currentUploadType = tab;
  document.querySelectorAll('.utab').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('uploadTabScreenshot').style.display = tab === 'screenshot' ? 'block' : 'none';
  document.getElementById('uploadTabFile').style.display = tab === 'file' ? 'block' : 'none';
}
function triggerFileUpload(type) {
  pendingUploadType = type;
  document.querySelectorAll('.utype-card').forEach(c => c.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
  document.getElementById('screenshotFileInput').click();
}
function handleDragOver(e) { e.preventDefault(); document.getElementById('fileDropZone').classList.add('dragover'); }
function handleFileDrop(e) { e.preventDefault(); document.getElementById('fileDropZone').classList.remove('dragover'); handleFileUpload({ target: { files: e.dataTransfer.files } }); }

async function handleScreenshotUpload(e) {
  const p = getP();
  if (!p) { console.warn('请先创建选品项目'); return; }
  const files = Array.from(e.target.files);
  if (!files.length) return;
  if (!p.uploadedData) p.uploadedData = {};
  if (!p.uploadedData[pendingUploadType]) p.uploadedData[pendingUploadType] = [];

  for (const file of files) {
    const base64 = await fileToBase64(file);
    addUploadedItem(file.name, pendingUploadType, '📸');
    const summary = await extractImageData(base64, pendingUploadType);
    p.uploadedData[pendingUploadType].push({ file: file.name, summary, base64 });
    showExtractedPreview(p.uploadedData);
  }
  saveProjects();
  e.target.value = '';
}

async function handleFileUpload(e) {
  const p = getP();
  if (!p) { console.warn('请先创建选品项目'); return; }
  const files = Array.from(e.target?.files || []);
  if (!files.length) return;
  if (!p.uploadedData) p.uploadedData = {};
  if (!p.uploadedData['excel_file']) p.uploadedData['excel_file'] = [];

  for (const file of files) {
    addUploadedItem(file.name, 'excel_file', '📊');
    const text = await readFileAsText(file);
    const summary = `文件: ${file.name}, 内容摘要: ${text.slice(0, 500)}`;
    p.uploadedData['excel_file'].push({ file: file.name, summary });
    showExtractedPreview(p.uploadedData);
  }
  saveProjects();
  if (e.target) e.target.value = '';
}

async function extractImageData(base64, type) {
  if (!API_KEY) return '已保存图片（需API Key才能提取数据）';
  const typeLabels = {
    google_trends: 'Google Trends 热度图表',
    opportunity_explorer: '亚马逊商机探测器数据',
    aba_brand: 'ABA品牌分析关键词数据',
    competitor_listing: '竞品Listing页面',
    review_analysis: '评论数据分析',
    bsr_ranking: 'BSR排名数据'
  };
  try {
    const req = buildApiRequest({
      model: API_MODEL, max_tokens: 600,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64.split(',')[1] || base64 } },
        { type: 'text', text: `这是一张${typeLabels[type]||'亚马逊数据'}截图。请提取所有可见的关键数据，输出简洁的文本摘要（数字、百分比、趋势方向等），不超过300字。` }
      ]}]
    });
    const resp = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body });
    const data = await resp.json();
    return data.content?.[0]?.text || '图片已上传，数据提取中...';
  } catch (e) { return '图片已上传'; }
}

function readFileAsText(file) {
  return new Promise(res => {
    const reader = new FileReader();
    reader.onload = e => res(e.target.result.toString().slice(0, 2000));
    reader.readAsText(file, 'UTF-8');
  });
}

function fileToBase64(file) {
  return new Promise(res => {
    const reader = new FileReader();
    reader.onload = e => res(e.target.result);
    reader.readAsDataURL(file);
  });
}

function addUploadedItem(name, type, icon) {
  const list = document.getElementById('uploadedList');
  const div = document.createElement('div');
  div.className = 'uploaded-item';
  div.innerHTML = `<span class="ui-icon">${icon}</span><span>${name}</span><span class="processing-badge"><span class="pb-dot"></span>识别中</span><span class="ui-rm" onclick="this.parentNode.remove()">✕</span>`;
  list.appendChild(div);
}

function showExtractedPreview(data) {
  const el = document.getElementById('extractedDataPreview');
  const items = Object.entries(data).flatMap(([type, arr]) => arr.map(item => ({ type, ...item })));
  if (!items.length) { el.innerHTML = ''; return; }
  const typeLabels = { google_trends:'Google趋势', opportunity_explorer:'商机探测器', aba_brand:'ABA分析', competitor_listing:'竞品Listing', review_analysis:'评论数据', bsr_ranking:'BSR排名', excel_file:'Excel文件' };
  el.innerHTML = `<div class="extracted-preview">
    <div class="ep-title">已提取数据（将用于 AI 分析）</div>
    ${items.map(item=>`<div class="ep-item"><span class="ep-key">[${typeLabels[item.type]||item.type}] </span>${item.summary||'处理中...'}</div>`).join('')}
  </div>`;
}
