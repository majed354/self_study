const SOURCES = {
  ug: "data/evidence-inventory-ug.json",
  pg: "data/evidence-inventory-pg.json",
  classification: "data/evidence-classification.json",
  library: "data/library-books.json",
};

const STORE_KEY = "selfStudyEvidenceAudit.v1";
const STATUS = {
  available: { label: "متوفر", factor: 1, icon: "i-check" },
  partial: { label: "جزئي", factor: 0.5, icon: "i-minus" },
  missing: { label: "ناقص", factor: 0, icon: "i-x" },
};

const state = {
  view: "criteria",
  program: "ug",
  standard: "all",
  selectedCriterionId: "",
  query: "",
  pickerOpen: false,
  libraryQuery: "",
  libraryProgram: "all",
  libraryRelation: "all",
  libraryTopic: "all",
  statuses: loadStatuses(),
};

let programs = {};
let classification = null;
let libraryData = null;
let libraryPromise = null;
let toastTimer = 0;

const el = {
  criteriaView: document.querySelector("#criteriaView"),
  libraryView: document.querySelector("#libraryView"),
  criteriaActions: document.querySelector("#criteriaActions"),
  loading: document.querySelector("#loadingState"),
  app: document.querySelector("#appContent"),
  overview: document.querySelector("#overviewBand"),
  standardFilters: document.querySelector("#standardFilters"),
  criterionList: document.querySelector("#criterionList"),
  criterionSearch: document.querySelector("#criterionSearch"),
  criterionPicker: document.querySelector("#criterionPicker"),
  criterionTrigger: document.querySelector("#criterionTrigger"),
  criterionTriggerText: document.querySelector("#criterionTriggerText"),
  criterionMenu: document.querySelector("#criterionMenu"),
  criterionMenuList: document.querySelector("#criterionMenuList"),
  criterionFocus: document.querySelector("#criterionFocus"),
  evidenceList: document.querySelector("#evidenceList"),
  evidenceCount: document.querySelector("#evidenceCount"),
  impactPanel: document.querySelector("#impactPanel"),
  statusLegend: document.querySelector("#statusLegend"),
  copyCriterion: document.querySelector("#copyCriterion"),
  printPage: document.querySelector("#printPage"),
  resetCriterion: document.querySelector("#resetCriterion"),
  toast: document.querySelector("#toast"),
  libraryLoading: document.querySelector("#libraryLoading"),
  libraryContent: document.querySelector("#libraryContent"),
  librarySearch: document.querySelector("#librarySearch"),
  libraryProgramFilter: document.querySelector("#libraryProgramFilter"),
  libraryRelationFilter: document.querySelector("#libraryRelationFilter"),
  libraryTopicFilter: document.querySelector("#libraryTopicFilter"),
  librarySummary: document.querySelector("#librarySummary"),
  libraryResultCount: document.querySelector("#libraryResultCount"),
  libraryTableBody: document.querySelector("#libraryTableBody"),
  exportLibraryCsv: document.querySelector("#exportLibraryCsv"),
  exportLibraryPdf: document.querySelector("#exportLibraryPdf"),
};

init();

async function init() {
  try {
    const [ug, pg, cls] = await Promise.all([
      fetch(SOURCES.ug).then((response) => response.json()),
      fetch(SOURCES.pg).then((response) => response.json()),
      fetch(SOURCES.classification).then((response) => response.json()),
    ]);

    classification = cls;
    programs = {
      ug: prepareProgram(ug),
      pg: prepareProgram(pg),
    };

    document.querySelector("#ugTabCount").textContent = `${formatNumber(programs.ug.criteria.length)} محك`;
    document.querySelector("#pgTabCount").textContent = `${formatNumber(programs.pg.criteria.length)} محك`;

    state.selectedCriterionId = programs[state.program].criteria[0]?.id ?? "";
    bindEvents();
    el.loading.hidden = true;
    el.app.hidden = false;
    render();
    loadLibraryData().then(() => {
      if (state.view === "library") render();
    });
  } catch (error) {
    el.loading.textContent = "تعذر تحميل بيانات الأدلة. تحقق من وجود ملفات data داخل الموقع.";
    console.error(error);
  }
}

function bindEvents() {
  document.querySelectorAll(".mode-tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      state.pickerOpen = false;
      render();
      if (state.view === "library") {
        loadLibraryData().then(render);
      }
    });
  });

  document.querySelectorAll(".program-tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.program = button.dataset.program;
      state.standard = "all";
      state.query = "";
      state.pickerOpen = false;
      el.criterionSearch.value = "";
      state.selectedCriterionId = programs[state.program].criteria[0]?.id ?? "";
      render();
    });
  });

  el.criterionSearch.addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    state.pickerOpen = false;
    ensureVisibleCriterion();
    render();
  });

  el.criterionTrigger.addEventListener("click", () => {
    state.pickerOpen = !state.pickerOpen;
    renderCriterionOptions();
  });

  el.criterionMenuList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-picker-criterion]");
    if (!button) return;
    state.selectedCriterionId = button.dataset.pickerCriterion;
    state.pickerOpen = false;
    render();
  });

  document.addEventListener("click", (event) => {
    if (!state.pickerOpen || el.criterionPicker.contains(event.target)) return;
    state.pickerOpen = false;
    renderCriterionOptions();
  });

  document.addEventListener("keydown", (event) => {
    if (!state.pickerOpen || event.key !== "Escape") return;
    state.pickerOpen = false;
    renderCriterionOptions();
  });

  el.standardFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-standard]");
    if (!button) return;
    state.standard = button.dataset.standard;
    state.pickerOpen = false;
    ensureVisibleCriterion();
    render();
  });

  el.criterionList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-criterion]");
    if (!button) return;
    state.selectedCriterionId = button.dataset.criterion;
    state.pickerOpen = false;
    render();
  });

  el.evidenceList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-status][data-evidence]");
    if (!button) return;
    const key = statusKey(state.program, state.selectedCriterionId, button.dataset.evidence);
    state.statuses[key] = button.dataset.status;
    saveStatuses();
    render();
  });

  el.copyCriterion.addEventListener("click", copySelectedCriterion);
  el.printPage.addEventListener("click", () => window.print());
  el.resetCriterion.addEventListener("click", resetSelectedCriterion);

  el.librarySearch.addEventListener("input", (event) => {
    state.libraryQuery = event.target.value.trim();
    renderLibrary();
  });

  el.libraryProgramFilter.addEventListener("change", (event) => {
    state.libraryProgram = event.target.value;
    renderLibrary();
  });

  el.libraryRelationFilter.addEventListener("change", (event) => {
    state.libraryRelation = event.target.value;
    renderLibrary();
  });

  el.libraryTopicFilter.addEventListener("change", (event) => {
    state.libraryTopic = event.target.value;
    renderLibrary();
  });

  el.exportLibraryCsv.addEventListener("click", exportLibraryCsv);
  el.exportLibraryPdf.addEventListener("click", () => window.print());
}

function loadLibraryData() {
  if (libraryData) return Promise.resolve(libraryData);
  if (!libraryPromise) {
    libraryPromise = fetch(SOURCES.library)
      .then((response) => response.json())
      .then((raw) => {
        libraryData = prepareLibrary(raw);
        return libraryData;
      })
      .catch((error) => {
        el.libraryLoading.textContent = "تعذر تحميل بيانات كتب المكتبة.";
        console.error(error);
      });
  }
  return libraryPromise;
}

function prepareProgram(raw) {
  const criteria = [];
  raw.standards.forEach((standard, standardIndex) => {
    standard.criteria.forEach((criterion, criterionIndex) => {
      const evidencePlan = buildEvidencePlan(criterion.evidence, criterion);
      criteria.push({
        ...criterion,
        standardName: standard.name,
        standardIndex,
        criterionIndex,
        evidencePlan,
      });
    });
  });
  return { ...raw, criteria };
}

function prepareLibrary(raw) {
  const programNames = Object.fromEntries(raw.programs.map((program) => [program.id, program.name]));
  const copyGroups = new Map();
  const records = raw.records.map((record) => {
    const fieldsText = Object.values(record.fields || {}).join(" ");
    const programText = [...(record.corePrograms || []), ...(record.supportingPrograms || [])]
      .map((programId) => programNames[programId] || programId)
      .join(" ");
    const prepared = {
      ...record,
      searchText: normalize(
        `${record.title} ${record.mainTitle} ${record.responsibility} ${record.publisher} ${record.callNumber} ${record.libraryName} ${record.itemID} ${record.copyNumber} ${record.topicLabel} ${programText} ${fieldsText}`,
      ),
    };
    const group = copyGroups.get(record.workKey) || {
      count: 0,
      libraries: new Map(),
      itemIds: [],
    };
    group.count += 1;
    group.itemIds.push(record.itemID);
    const libraryName = record.libraryName || "غير محدد";
    group.libraries.set(libraryName, (group.libraries.get(libraryName) || 0) + 1);
    copyGroups.set(record.workKey, group);
    return prepared;
  });

  records.forEach((record) => {
    const group = copyGroups.get(record.workKey);
    record.copyCount = group?.count || 1;
    record.copyLibraries = [...(group?.libraries || new Map()).entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ar"))
      .map(([name, count]) => ({ name, count }));
  });

  const relationLabels = raw.metadata?.relation_labels || { core: "أساسي", supporting: "مساند" };
  return {
    ...raw,
    records,
    copyGroupCount: copyGroups.size,
    programNames,
    relationLabels,
  };
}

function buildEvidencePlan(evidence, criterion) {
  const enriched = evidence.map((item, index) => {
    const type = classifyEvidence(item.description, item.notes);
    return {
      ...item,
      code: `${criterion.id.replaceAll(".", "-")}-${index + 1}`,
      evidenceKey: `${criterion.id}-${item.id ?? index + 1}`,
      index,
      type,
      weight: 0,
      role: "داعم",
    };
  });

  if (enriched.length === 0) return enriched;
  if (enriched.length === 1) {
    enriched[0].weight = 100;
    enriched[0].role = "دليل حاكم";
    return enriched;
  }

  const leadIndex = enriched.reduce((bestIndex, item, index) => {
    const best = enriched[bestIndex];
    if (item.type.score > best.type.score) return index;
    if (item.type.score === best.type.score && item.index < best.index) return index;
    return bestIndex;
  }, 0);

  enriched[leadIndex].weight = 50;
  enriched[leadIndex].role = "دليل حاكم";

  const remaining = enriched.filter((_, index) => index !== leadIndex);
  const totalScore = remaining.reduce((sum, item) => sum + item.type.score, 0) || remaining.length;
  let assigned = 50;
  remaining.forEach((item, index) => {
    const rawWeight = (item.type.score / totalScore) * 50;
    item.weight = index === remaining.length - 1 ? roundWeight(100 - assigned) : roundWeight(rawWeight);
    assigned += item.weight;
    item.role = item.type.score >= 3 ? "أساسي" : item.type.score === 2 ? "مهم" : "تكميلي";
  });

  return enriched.sort((a, b) => a.index - b.index);
}

function classifyEvidence(description = "", notes = "") {
  const text = `${description} ${notes}`.toLowerCase();

  const groups = [
    {
      label: "تأسيسي",
      score: 4,
      className: "core",
      terms: [
        "توصيف البرنامج",
        "دليل نظام إدارة الجودة",
        "لائحة",
        "قرار إنشاء",
        "اعتماد",
        "مصادقة",
        "مجلس الجامعة",
        "مخرجات التعلم",
        "توصيفات المقررات",
        "توصيف المقرر",
      ],
    },
    {
      label: "تشغيلي",
      score: 3,
      className: "important",
      terms: [
        "الخطة التشغيلية",
        "محضر",
        "مجلس القسم",
        "مجلس الكلية",
        "لجنة",
        "تقرير إنجاز",
        "مؤشرات الأداء",
        "التقرير السنوي",
        "خطة التحسين",
        "إجراءات",
        "مهام",
        "صلاحيات",
        "مصفوفة",
      ],
    },
    {
      label: "إثباتي",
      score: 2,
      className: "support",
      terms: [
        "استبان",
        "رضا",
        "تحليل",
        "نتائج",
        "قياس",
        "عينة",
        "إحصاء",
        "مقارنة",
        "تقرير",
        "أنشطة",
      ],
    },
    {
      label: "تكميلي",
      score: 1,
      className: "support",
      terms: ["رابط", "نشر", "إعلان", "صور", "شهادات", "خطابات", "مخاطبات", "وسائط"],
    },
  ];

  return groups.find((group) => group.terms.some((term) => text.includes(term))) ?? groups[2];
}

function render() {
  updateModeTabs();
  if (state.view === "library") {
    renderLibrary();
    return;
  }
  updateTabs();
  renderOverview();
  renderStandards();
  renderCriterionOptions();
  renderCriteriaList();
  renderLegend();
  renderCriterion();
}

function updateModeTabs() {
  document.querySelectorAll(".mode-tab").forEach((button) => {
    const active = button.dataset.view === state.view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  el.criteriaView.hidden = state.view !== "criteria";
  el.libraryView.hidden = state.view !== "library";
  el.criteriaActions.hidden = state.view !== "criteria";
}

function updateTabs() {
  document.querySelectorAll(".program-tab").forEach((button) => {
    const active = button.dataset.program === state.program;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

function renderOverview() {
  const program = programs[state.program];
  const aggregate = computeAggregate(program.criteria);
  const meta = program.metadata;
  const layerNames = classification?.metadata?.classification_system?.layers?.map((layer) => layer.name).join("، ");

  el.overview.innerHTML = `
    ${metric("المعايير", formatNumber(meta.total_standards), meta.template)}
    ${metric("المحكات", formatNumber(meta.total_criteria), meta.program_type)}
    ${metric("الأدلة", formatNumber(meta.total_evidence), meta.kpi_model)}
    ${metric("متوسط الجاهزية", `${formatPercent(aggregate.average)}٪`, `${formatNumber(aggregate.blocked)} محك متأثر`)}
    <div class="quality-signal">
      <div>
        <h2>${readinessText(aggregate.average, aggregate.blocked).title}</h2>
        <p>${meta.college} - ${meta.university}. التصنيف المعتمد: ${layerNames || "تأسيسية، تشغيلية، إثباتية، مساندة"}.</p>
      </div>
      <div class="heat-strip" style="--segments:${Math.min(program.criteria.length, 36)}">
        ${program.criteria
          .slice(0, 36)
          .map((criterion) => {
            const score = computeCriterion(criterion).completion;
            const cls = score < 60 ? "risk" : score < 80 ? "warn" : "";
            return `<span class="heat-dot ${cls}" title="${criterion.id}: ${formatPercent(score)}٪"></span>`;
          })
          .join("")}
      </div>
    </div>
  `;
}

function metric(label, value, detail) {
  return `
    <div class="metric-tile">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${detail}</small>
    </div>
  `;
}

function renderStandards() {
  const program = programs[state.program];
  const standards = program.standards.map((standard, index) => ({
    name: standard.name,
    index: String(index),
    count: standard.criteria.length,
  }));

  el.standardFilters.innerHTML = `
    <button class="standard-button ${state.standard === "all" ? "is-active" : ""}" type="button" data-standard="all">
      <strong>كل المعايير</strong>
      <span>${formatNumber(program.criteria.length)}</span>
    </button>
    ${standards
      .map(
        (standard) => `
          <button class="standard-button ${state.standard === standard.index ? "is-active" : ""}" type="button" data-standard="${standard.index}">
            <strong>${standard.name}</strong>
            <span>${formatNumber(standard.count)}</span>
          </button>
        `,
      )
      .join("")}
  `;
}

function renderCriterionOptions() {
  const criteria = filteredCriteria();
  ensureVisibleCriterion(criteria);
  const current = selectedCriterion();
  el.criterionTrigger.disabled = criteria.length === 0;
  el.criterionTrigger.setAttribute("aria-expanded", String(state.pickerOpen));
  el.criterionTriggerText.textContent = current ? `${current.id} - ${current.text}` : "لا توجد محكات مطابقة";
  el.criterionMenu.hidden = !state.pickerOpen;
  el.criterionMenuList.innerHTML = criteria
    .map((criterion) => {
      const selected = criterion.id === state.selectedCriterionId;
      return `
        <button
          class="criterion-menu-option ${selected ? "is-active" : ""}"
          type="button"
          data-picker-criterion="${criterion.id}"
          role="option"
          aria-selected="${selected}"
        >
          <strong>${criterion.id}</strong>
          <span>${escapeHtml(criterion.text)}</span>
        </button>
      `;
    })
    .join("");
}

function renderCriteriaList() {
  const criteria = filteredCriteria();
  el.criterionList.innerHTML = criteria
    .map((criterion) => {
      const score = computeCriterion(criterion).completion;
      return `
        <button class="criterion-button ${criterion.id === state.selectedCriterionId ? "is-active" : ""}" type="button" data-criterion="${criterion.id}">
          <strong>${criterion.id} <span>${formatPercent(score)}٪</span></strong>
          <p>${escapeHtml(criterion.text)}</p>
        </button>
      `;
    })
    .join("");
}

function renderLegend() {
  el.statusLegend.innerHTML = Object.entries(STATUS)
    .map(([key, status]) => `<span class="legend-pill ${key}">${icon(status.icon)} ${status.label}</span>`)
    .join("");
}

function renderCriterion() {
  const criterion = selectedCriterion();
  if (!criterion) return;

  const result = computeCriterion(criterion);
  const readiness = readinessText(result.completion, result.criticalIssues);
  const readyLevels = ["good", "very-good", "excellent"];
  const ringColor = readyLevels.includes(readiness.level) ? "var(--green)" : readiness.level === "watch" ? "var(--amber)" : "var(--red)";

  el.criterionFocus.innerHTML = `
    <div>
      <div class="criterion-meta">
        <span>${criterion.standardName}</span>
        <span>محك ${criterion.id}</span>
        <span>${formatNumber(criterion.evidencePlan.length)} أدلة</span>
      </div>
      <h2>${criterion.id}</h2>
      <p class="criterion-text">${escapeHtml(criterion.text)}</p>
    </div>
    <div class="progress-card">
      <div class="progress-ring" style="--value:${result.completion}; --ring-color:${ringColor}">
        <div>
          <strong>${formatPercent(result.completion)}٪</strong>
          <span>جاهزية</span>
        </div>
      </div>
      <span class="state-pill ${readiness.level}">${readiness.title}</span>
    </div>
  `;

  el.evidenceCount.textContent = `${formatNumber(criterion.evidencePlan.length)} أدلة`;
  el.evidenceList.innerHTML = criterion.evidencePlan.map((item) => renderEvidenceCard(criterion, item)).join("");
  renderImpactPanel(criterion, result, readiness);
}

function renderEvidenceCard(criterion, item) {
  const current = getStatus(criterion.id, item.evidenceKey);
  const loss = item.weight * (1 - STATUS[current].factor);
  const statusClass = current === "missing" ? "is-missing" : current === "partial" ? "is-partial" : "";
  const roleClass = item.role === "دليل حاكم" ? "governing" : item.role === "تكميلي" ? "support" : "important";

  return `
    <article class="evidence-card ${statusClass}">
      <div class="evidence-main">
        <div class="evidence-title">
          <strong>مرفق (${item.code})</strong>
          <span class="tag ${roleClass}">${item.role} ${formatPercent(item.weight)}٪</span>
          <span class="tag ${item.type.className}">${item.type.label}</span>
          ${loss > 0 ? `<span class="tag governing">نقص ${formatPercent(loss)}٪</span>` : ""}
        </div>
        <p>${escapeHtml(item.description)}</p>
        ${item.notes ? `<small class="evidence-note">${escapeHtml(item.notes)}</small>` : ""}
      </div>
      <div class="status-actions" aria-label="حالة الدليل">
        ${Object.entries(STATUS)
          .map(
            ([key, status]) => `
              <button class="status-action ${current === key ? "is-active" : ""}" type="button"
                data-evidence="${item.evidenceKey}" data-status="${key}" aria-label="${status.label}">
                ${icon(status.icon)}
              </button>
            `,
          )
          .join("")}
      </div>
    </article>
  `;
}

function renderImpactPanel(criterion, result, readiness) {
  const missing = criterion.evidencePlan
    .map((item) => {
      const current = getStatus(criterion.id, item.evidenceKey);
      const loss = item.weight * (1 - STATUS[current].factor);
      return { item, current, loss };
    })
    .filter((entry) => entry.loss > 0)
    .sort((a, b) => b.loss - a.loss);

  el.impactPanel.innerHTML = `
    <div>
      <h2>أثر النقص</h2>
      <p>${readiness.detail}</p>
    </div>
    <div class="impact-summary">
      <div class="impact-number">
        <span>الفاقد</span>
        <strong>${formatPercent(result.lost)}٪</strong>
      </div>
      <div class="impact-number">
        <span>النواقص</span>
        <strong>${formatNumber(missing.length)}</strong>
      </div>
    </div>
    <div class="impact-list">
      ${
        missing.length
          ? missing
              .map(
                ({ item, current, loss }) => `
                  <div class="impact-item">
                    <strong>${formatPercent(loss)}٪ - ${STATUS[current].label}</strong>
                    <p>${item.role}: ${escapeHtml(item.description)}</p>
                  </div>
                `,
              )
              .join("")
          : `<p>لا توجد فجوة مؤثرة في المحك المحدد.</p>`
      }
    </div>
  `;
}

function renderLibrary() {
  if (!libraryData) {
    el.libraryLoading.hidden = false;
    el.libraryContent.hidden = true;
    return;
  }

  el.libraryLoading.hidden = true;
  el.libraryContent.hidden = false;
  renderLibraryFilters();

  const records = filteredLibraryRecords();
  const workCount = new Set(records.map((record) => record.workKey)).size;
  const libraryCount = new Set(records.map((record) => record.libraryName).filter(Boolean)).size;
  const averageCopies = workCount ? records.length / workCount : 0;
  const coreCount = records.filter((record) => recordMatchesRelation(record, "core")).length;
  const supportCount = records.filter((record) => recordMatchesRelation(record, "supporting")).length;

  el.librarySummary.innerHTML = `
    ${metric("سجلات النسخ", formatNumber(records.length), `من أصل ${formatNumber(libraryData.metadata.total_records)} سجل`)}
    ${metric("العناوين/الطبعات", formatNumber(workCount), "بحسب النص الببليوجرافي ورقم التصنيف")}
    ${metric("متوسط النسخ", formatDecimal(averageCopies), "نسخة لكل عنوان ظاهر")}
    ${metric("المكتبات", formatNumber(libraryCount), `أساسي ${formatNumber(coreCount)} / مساند ${formatNumber(supportCount)}`)}
  `;

  el.libraryResultCount.textContent = `${formatNumber(records.length)} سجل نسخة، ${formatNumber(workCount)} عنوان/طبعة`;
  el.libraryTableBody.innerHTML = records.length
    ? records.map(renderLibraryRow).join("")
    : `<tr><td colspan="7" class="empty-cell">لا توجد كتب مطابقة للبحث الحالي.</td></tr>`;
}

function renderLibraryFilters() {
  const selectedProgram = state.libraryProgram;
  const selectedTopic = state.libraryTopic;

  el.libraryProgramFilter.innerHTML = `
    <option value="all">كل البرامج</option>
    ${libraryData.programs
      .map((program) => `<option value="${program.id}">${escapeHtml(program.name)}</option>`)
      .join("")}
  `;
  el.libraryProgramFilter.value = selectedProgram;

  el.libraryTopicFilter.innerHTML = `
    <option value="all">كل المجالات</option>
    ${libraryData.topics
      .map((topic) => `<option value="${topic.id}">${escapeHtml(topic.label)} (${formatNumber(topic.records)})</option>`)
      .join("")}
  `;
  el.libraryTopicFilter.value = selectedTopic;
}

function renderLibraryRow(record) {
  const fields = Object.entries(record.fields || {})
    .map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value || "—")}</dd>`)
    .join("");
  const publisher = record.publisher ? `<span class="mini-chip">دار النشر: ${escapeHtml(record.publisher)}</span>` : "";

  return `
    <tr>
      <td class="book-cell">
        <strong>${escapeHtml(record.title || record.mainTitle || "بدون عنوان")}</strong>
        ${record.responsibility ? `<small>${escapeHtml(record.responsibility)}</small>` : ""}
        <div class="book-tags">
          <span class="mini-chip">${escapeHtml(record.topicLabel || "عام")}</span>
          ${publisher}
        </div>
      </td>
      <td>${libraryRelationSummary(record)}</td>
      <td class="copy-cell">
        <strong>${formatNumber(record.copyCount)}</strong>
        <small>${escapeHtml(copyLibrariesText(record))}</small>
      </td>
      <td><span class="mono-value">${escapeHtml(record.callNumber || "—")}</span></td>
      <td>
        <strong>${escapeHtml(record.libraryName || "—")}</strong>
        <small>${escapeHtml(record.location || "")}</small>
      </td>
      <td>
        <span class="mono-value">${escapeHtml(record.copyNumber || "—")}</span>
        <small>${escapeHtml(record.itemID || "")}</small>
      </td>
      <td>
        <details class="record-details">
          <summary>كل الحقول</summary>
          <dl>${fields}</dl>
        </details>
      </td>
    </tr>
  `;
}

function libraryRelationSummary(record) {
  if (state.libraryProgram !== "all") {
    const relation = relationForProgram(record, state.libraryProgram);
    if (!relation) return `<span class="relation-pill muted">غير مرتبط</span>`;
    return `
      <span class="relation-pill ${relation}">${libraryData.relationLabels[relation] || relation}</span>
      <small>${escapeHtml(libraryData.programNames[state.libraryProgram] || "")}</small>
    `;
  }

  const coreCount = record.corePrograms?.length || 0;
  const supportCount = record.supportingPrograms?.length || 0;
  return `
    ${coreCount ? `<span class="relation-pill core">أساسي في ${formatNumber(coreCount)}</span>` : ""}
    ${supportCount ? `<span class="relation-pill supporting">مساند في ${formatNumber(supportCount)}</span>` : ""}
    ${!coreCount && !supportCount ? `<span class="relation-pill muted">عام</span>` : ""}
  `;
}

function filteredLibraryRecords() {
  if (!libraryData) return [];
  const query = normalize(state.libraryQuery);
  return libraryData.records.filter((record) => {
    if (query && !record.searchText.includes(query)) return false;
    if (state.libraryTopic !== "all" && !record.topics.includes(state.libraryTopic)) return false;

    if (state.libraryProgram !== "all") {
      const relation = relationForProgram(record, state.libraryProgram);
      if (!relation) return false;
      return state.libraryRelation === "all" || relation === state.libraryRelation;
    }

    if (state.libraryRelation !== "all" && !recordMatchesRelation(record, state.libraryRelation)) return false;
    return true;
  });
}

function recordMatchesRelation(record, relation) {
  if (state.libraryProgram !== "all") {
    return relationForProgram(record, state.libraryProgram) === relation;
  }
  return (record.programRelations || []).some((entry) => entry.relation === relation);
}

function relationForProgram(record, programId) {
  return (record.programRelations || []).find((entry) => entry.programId === programId)?.relation || "";
}

function copyLibrariesText(record) {
  const libraries = record.copyLibraries || [];
  if (!libraries.length) return "لا يوجد توزيع مكتبات";
  const shown = libraries
    .slice(0, 3)
    .map((library) => `${library.name} (${formatNumber(library.count)})`)
    .join("، ");
  const remaining = libraries.length - 3;
  return remaining > 0 ? `${shown}، و${formatNumber(remaining)} مكتبات أخرى` : shown;
}

function programNames(ids) {
  return (ids || []).map((id) => libraryData.programNames[id] || id).join(" | ");
}

function exportLibraryCsv() {
  if (!libraryData) return;
  const records = filteredLibraryRecords();
  const sourceColumns = libraryData.metadata.columns || [];
  const headers = [
    "معرف السجل",
    "رقم الصف في المصدر",
    "العنوان",
    "العنوان المختصر",
    "بيان المسؤولية",
    "دار النشر المستخرجة",
    "رقم التصنيف",
    "اسم المكتبة",
    "رمز المكتبة",
    "رقم النسخة",
    "معرف النسخة",
    "الموقع",
    "المجال",
    "عدد نسخ العنوان",
    "توزيع النسخ على المكتبات",
    "برامج أساسية",
    "برامج مساندة",
    "العلاقة مع البرنامج المحدد",
    ...sourceColumns.map((column) => `الأصل: ${column}`),
  ];
  const rows = records.map((record) => {
    const selectedRelation =
      state.libraryProgram === "all"
        ? ""
        : libraryData.relationLabels[relationForProgram(record, state.libraryProgram)] || "";
    return [
      record.id,
      record.rowNumber,
      record.title,
      record.mainTitle,
      record.responsibility,
      record.publisher,
      record.callNumber,
      record.libraryName,
      record.libraryCode,
      record.copyNumber,
      record.itemID,
      record.location,
      record.topicLabel,
      record.copyCount,
      copyLibrariesText(record),
      programNames(record.corePrograms),
      programNames(record.supportingPrograms),
      selectedRelation,
      ...sourceColumns.map((column) => record.fields?.[column] || ""),
    ];
  });

  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `library-books-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast(`تم تجهيز CSV بعدد ${formatNumber(records.length)} سجل.`);
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function filteredCriteria() {
  const program = programs[state.program];
  const query = normalize(state.query);
  return program.criteria.filter((criterion) => {
    const matchesStandard = state.standard === "all" || String(criterion.standardIndex) === state.standard;
    const haystack = normalize(`${criterion.id} ${criterion.text} ${criterion.standardName}`);
    return matchesStandard && (!query || haystack.includes(query));
  });
}

function ensureVisibleCriterion(criteria = filteredCriteria()) {
  if (!criteria.length) {
    state.selectedCriterionId = "";
    return;
  }
  if (!criteria.some((criterion) => criterion.id === state.selectedCriterionId)) {
    state.selectedCriterionId = criteria[0].id;
  }
}

function selectedCriterion() {
  return programs[state.program].criteria.find((criterion) => criterion.id === state.selectedCriterionId);
}

function computeAggregate(criteria) {
  const results = criteria.map(computeCriterion);
  const average = results.reduce((sum, result) => sum + result.completion, 0) / (results.length || 1);
  const blocked = results.filter((result) => result.criticalIssues > 0 || result.completion < 80).length;
  return { average, blocked };
}

function computeCriterion(criterion) {
  let earned = 0;
  let criticalIssues = 0;

  criterion.evidencePlan.forEach((item) => {
    const current = getStatus(criterion.id, item.evidenceKey);
    const factor = STATUS[current].factor;
    earned += item.weight * factor;
    if (item.role === "دليل حاكم" && factor < 1) criticalIssues += 1;
  });

  const completion = Math.min(100, roundWeight(earned));
  return {
    completion,
    lost: roundWeight(100 - completion),
    criticalIssues,
  };
}

function readinessText(score, criticalIssues) {
  if (criticalIssues > 0 || score < 60) {
    return {
      level: "blocked",
      title: "غير جاهز",
      detail: "يوجد نقص في دليل حاكم أو فجوة كبيرة؛ أثره يمنع قبول المحك بصيغته الحالية.",
    };
  }
  if (score < 80) {
    return {
      level: "watch",
      title: "مقبول بحذر",
      detail: "يمكن بناء المحك مبدئياً، لكن النقص الحالي سيضعف قوة الاستدلال ويحتاج تعويضاً واضحاً.",
    };
  }
  if (score >= 99.95) {
    return {
      level: "excellent",
      title: "كتابة بجودة ممتازة",
      detail: "جميع الأدلة المطلوبة متوفرة؛ يمكن كتابة المحك بجودة ممتازة وباستدلال مكتمل.",
    };
  }
  if (score >= 90) {
    return {
      level: "very-good",
      title: "كتابة بجودة جيدة جداً",
      detail: "الأدلة المتاحة قوية جداً، وما تبقى لا يمنع كتابة محك رصين بجودة جيدة جداً.",
    };
  }
  return {
    level: "good",
    title: "كتابة بجودة جيدة",
    detail: "الأدلة المتاحة كافية لكتابة المحك بجودة جيدة، مع إمكانية تحسينه باستكمال النواقص المتبقية.",
  };
}

async function copySelectedCriterion() {
  const criterion = selectedCriterion();
  if (!criterion) return;

  const result = computeCriterion(criterion);
  const lines = [
    `محك ${criterion.id}`,
    criterion.text,
    `الجاهزية: ${formatPercent(result.completion)}٪`,
    "",
    ...criterion.evidencePlan.map((item) => {
      const current = getStatus(criterion.id, item.evidenceKey);
      return `- مرفق (${item.code}) [${STATUS[current].label} | ${formatPercent(item.weight)}٪] ${item.description}`;
    }),
  ];

  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    showToast("تم نسخ قائمة المحك.");
  } catch {
    showToast("تعذر النسخ من المتصفح.");
  }
}

function resetSelectedCriterion() {
  const criterion = selectedCriterion();
  if (!criterion) return;
  criterion.evidencePlan.forEach((item) => {
    delete state.statuses[statusKey(state.program, criterion.id, item.evidenceKey)];
  });
  saveStatuses();
  showToast("تمت إعادة ضبط المحك.");
  render();
}

function getStatus(criterionId, evidenceKey) {
  return state.statuses[statusKey(state.program, criterionId, evidenceKey)] || "available";
}

function statusKey(program, criterionId, evidenceKey) {
  return `${program}:${criterionId}:${evidenceKey}`;
}

function loadStatuses() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveStatuses() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state.statuses));
}

function showToast(message) {
  clearTimeout(toastTimer);
  el.toast.textContent = message;
  el.toast.classList.add("show");
  toastTimer = window.setTimeout(() => el.toast.classList.remove("show"), 2200);
}

function icon(id) {
  return `<svg aria-hidden="true"><use href="#${id}"></use></svg>`;
}

function normalize(value) {
  return String(value)
    .toLowerCase()
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ًٌٍَُِّْـ]/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatNumber(value) {
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value) {
  return new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value);
}

function formatDecimal(value) {
  return new Intl.NumberFormat("ar-SA", {
    maximumFractionDigits: 1,
  }).format(value);
}

function roundWeight(value) {
  return Math.round(value * 10) / 10;
}
