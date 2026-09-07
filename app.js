const SOURCES = {
  ug: "data/evidence-inventory-ug.json",
  pg: "data/evidence-inventory-pg.json",
  classification: "data/evidence-classification.json",
  library: "data/library-books.json",
  institutional: "data/institutional-evidence.json",
  writing: "data/writing-guide.json",
  workflow: "data/workflow.json",
};

const STORE_KEY = "selfStudyEvidenceAudit.v1";
const LAYER_STORE_KEY = "selfStudyLayerAudit.v1";
const CHECKLIST_STORE_KEY = "selfStudyWritingChecklist.v1";
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
  stage: "s2",
  openLayer: 1,
  institutionalSection: "templates",
  institutionalQuery: "",
  institutionalLevel: "all",
  institutionalStatus: "all",
  institutionalProgram: "ug",
  writingSection: "rule",
  layerStatuses: loadStore(LAYER_STORE_KEY),
  checklistState: loadStore(CHECKLIST_STORE_KEY),
};

let programs = {};
let classification = null;
let institutional = null;
let writingGuide = null;
let workflow = null;
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
  workflowView: document.querySelector("#workflowView"),
  workflowPrinciple: document.querySelector("#workflowPrinciple"),
  stageTrack: document.querySelector("#stageTrack"),
  stageDetail: document.querySelector("#stageDetail"),
  decisionBanner: document.querySelector("#decisionBanner"),
  layerGrid: document.querySelector("#layerGrid"),
  layerDetail: document.querySelector("#layerDetail"),
  institutionalView: document.querySelector("#institutionalView"),
  institutionalIntro: document.querySelector("#institutionalIntro"),
  institutionalSections: document.querySelector("#institutionalSections"),
  institutionalLevelField: document.querySelector("#institutionalLevelField"),
  institutionalStatusField: document.querySelector("#institutionalStatusField"),
  institutionalProgramField: document.querySelector("#institutionalProgramField"),
  workflowProgress: document.querySelector("#workflowProgress"),
  institutionalRule: document.querySelector("#institutionalRule"),
  institutionalSearch: document.querySelector("#institutionalSearch"),
  institutionalLevelFilter: document.querySelector("#institutionalLevelFilter"),
  institutionalStatusFilter: document.querySelector("#institutionalStatusFilter"),
  institutionalProgramFilter: document.querySelector("#institutionalProgramFilter"),
  institutionalSummary: document.querySelector("#institutionalSummary"),
  institutionalGrid: document.querySelector("#institutionalGrid"),
  printInstitutional: document.querySelector("#printInstitutional"),
  writingView: document.querySelector("#writingView"),
  writingIntro: document.querySelector("#writingIntro"),
  writingTabs: document.querySelector("#writingTabs"),
  writingBody: document.querySelector("#writingBody"),
  printWriting: document.querySelector("#printWriting"),
};

init();

async function init() {
  try {
    const [ug, pg, cls, inst, writing, flow] = await Promise.all([
      fetch(SOURCES.ug).then((response) => response.json()),
      fetch(SOURCES.pg).then((response) => response.json()),
      fetch(SOURCES.classification).then((response) => response.json()),
      fetch(SOURCES.institutional).then((response) => response.json()),
      fetch(SOURCES.writing).then((response) => response.json()),
      fetch(SOURCES.workflow).then((response) => response.json()),
    ]);

    classification = cls;
    institutional = inst;
    writingGuide = writing;
    workflow = flow;
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

  el.criterionFocus.addEventListener("click", (event) => {
    const jump = event.target.closest("[data-goto-view]");
    if (!jump) return;
    state.view = jump.dataset.gotoView;
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  el.stageTrack.addEventListener("click", (event) => {
    const button = event.target.closest("[data-stage]");
    if (!button) return;
    state.stage = button.dataset.stage;
    renderWorkflow();
  });

  el.stageDetail.addEventListener("click", (event) => {
    const jump = event.target.closest("[data-goto-view]");
    if (!jump) return;
    const target = jump.dataset.gotoView;
    if (target === "workflow") {
      el.layerGrid.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    state.view = target;
    render();
    if (target === "library") loadLibraryData().then(render);
  });

  el.layerGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-layer]");
    if (!button) return;
    state.openLayer = Number(button.dataset.layer);
    renderWorkflow();
  });

  el.stageDetail.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-stage-step]");
    if (!nav) return;
    const order = workflow.stages.findIndex((item) => item.id === state.stage);
    const next = order + Number(nav.dataset.stageStep);
    if (next < 0 || next >= workflow.stages.length) return;
    state.stage = workflow.stages[next].id;
    renderWorkflow();
    el.stageDetail.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  el.layerDetail.addEventListener("click", (event) => {
    const button = event.target.closest("[data-layer-item][data-layer-status]");
    if (!button) return;
    const key = button.dataset.layerItem;
    const value = button.dataset.layerStatus;
    if (state.layerStatuses[key] === value) delete state.layerStatuses[key];
    else state.layerStatuses[key] = value;
    saveStore(LAYER_STORE_KEY, state.layerStatuses);
    renderWorkflow();
  });

  el.institutionalSections.addEventListener("click", (event) => {
    const button = event.target.closest("[data-institutional-section]");
    if (!button) return;
    state.institutionalSection = button.dataset.institutionalSection;
    state.institutionalQuery = "";
    el.institutionalSearch.value = "";
    renderInstitutional();
  });

  el.institutionalSearch.addEventListener("input", (event) => {
    state.institutionalQuery = event.target.value.trim();
    renderInstitutional();
  });

  el.institutionalLevelFilter.addEventListener("change", (event) => {
    state.institutionalLevel = event.target.value;
    renderInstitutional();
  });

  el.institutionalStatusFilter.addEventListener("change", (event) => {
    state.institutionalStatus = event.target.value;
    renderInstitutional();
  });

  el.institutionalProgramFilter.addEventListener("change", (event) => {
    state.institutionalProgram = event.target.value;
    renderInstitutional();
  });

  el.institutionalGrid.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-open-criterion]");
    if (!chip) return;
    state.program = chip.dataset.program || state.program;
    state.standard = "all";
    state.query = "";
    el.criterionSearch.value = "";
    state.selectedCriterionId = chip.dataset.openCriterion;
    state.view = "criteria";
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  el.printInstitutional.addEventListener("click", () => window.print());
  el.printWriting.addEventListener("click", () => window.print());

  el.writingTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-writing-section]");
    if (!button) return;
    state.writingSection = button.dataset.writingSection;
    renderWriting();
  });

  el.writingBody.addEventListener("click", (event) => {
    const item = event.target.closest("[data-checklist]");
    if (!item) return;
    const key = item.dataset.checklist;
    state.checklistState[key] = !state.checklistState[key];
    saveStore(CHECKLIST_STORE_KEY, state.checklistState);
    renderWriting();
  });
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
  if (state.view === "workflow") {
    renderWorkflow();
    return;
  }
  if (state.view === "institutional") {
    renderInstitutional();
    return;
  }
  if (state.view === "writing") {
    renderWriting();
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
  el.workflowView.hidden = state.view !== "workflow";
  el.institutionalView.hidden = state.view !== "institutional";
  el.writingView.hidden = state.view !== "writing";
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
    ${institutionalForCriterion(criterion.id)}
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
  const cleanedDetail = libraryData.metadata.excluded_records_removed
    ? `بعد تنقية ${formatNumber(libraryData.metadata.excluded_records_removed)} سجل مستبعد`
    : `من أصل ${formatNumber(libraryData.metadata.total_records)} سجل`;

  el.librarySummary.innerHTML = `
    ${metric("سجلات النسخ", formatNumber(records.length), cleanedDetail)}
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

function loadStore(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function saveStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    /* تخزين المتصفح غير متاح */
  }
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

function institutionalForCriterion(criterionId) {
  if (!institutional) return "";
  const key = state.program === "pg" ? "criteria_pg" : "criteria_ug";
  const matches = institutional.items.filter((item) => (item[key] || []).includes(criterionId));
  if (!matches.length) return "";

  const order = { university: 0, national: 1, college: 2 };
  matches.sort((a, b) => (order[a.level] ?? 3) - (order[b.level] ?? 3));

  return `
    <div class="criterion-institutional">
      <div class="ci-head">
        ${icon("i-bank")}
        <span>الإطار المؤسسي المقترح لافتتاح هذا المحك</span>
        <button class="text-button" type="button" data-goto-view="institutional">السجل الكامل</button>
      </div>
      <div class="chip-row">
        ${matches
          .slice(0, 8)
          .map(
            (item) =>
              `<span class="tag ${item.level === "university" ? "core" : item.level === "national" ? "support" : "soft"}" title="${escapeHtml(item.usage)}">${escapeHtml(item.name)}</span>`,
          )
          .join("")}
        ${matches.length > 8 ? `<span class="tag soft">+${formatNumber(matches.length - 8)}</span>` : ""}
      </div>
    </div>
  `;
}

/* ───────────────────────── مسار العمل والطبقات الأربع ───────────────────────── */

const LAYER_STATUS = {
  available: { label: "متوفر", factor: 1, icon: "i-check" },
  partial: { label: "جزئي", factor: 0.5, icon: "i-minus" },
  missing: { label: "ناقص", factor: 0, icon: "i-x" },
};

function renderWorkflow() {
  if (!workflow || !classification) return;
  el.workflowPrinciple.textContent = workflow.metadata.principle;
  renderWorkflowProgress();
  renderStageTrack();
  renderStageDetail();
  renderLayerBoard();
}

function stageIndex() {
  const found = workflow.stages.findIndex((item) => item.id === state.stage);
  return found < 0 ? 0 : found;
}

function renderWorkflowProgress() {
  const order = stageIndex() + 1;
  const total = workflow.stages.length;
  const percent = Math.round((order / total) * 100);
  el.workflowProgress.innerHTML = `
    <div class="hero-dial" style="--dial:${percent}%">
      <span class="hero-dial-value">${formatNumber(order)}<small>/${formatNumber(total)}</small></span>
    </div>
    <div class="hero-dial-caption">
      <strong>المرحلة الحالية</strong>
      <span>${escapeHtml(workflow.stages[stageIndex()].name)}</span>
    </div>
  `;
}

function renderStageTrack() {
  const current = stageIndex();
  el.stageTrack.innerHTML = workflow.stages
    .map((stage, index) => {
      const stateCls = index < current ? "is-past" : index === current ? "is-active" : "";
      return `
        <button class="journey-node ${stateCls}" type="button" role="tab"
          aria-selected="${index === current}" data-stage="${stage.id}">
          <span class="journey-dot">${index < current ? icon("i-check") : formatNumber(stage.order)}</span>
          <span class="journey-label">${escapeHtml(stage.name)}</span>
          <span class="journey-skill">${escapeHtml(stage.question)}</span>
        </button>
      `;
    })
    .join("");
}

function renderStageDetail() {
  const index = stageIndex();
  const stage = workflow.stages[index];
  const total = workflow.stages.length;
  const prev = index > 0 ? workflow.stages[index - 1] : null;
  const next = index < total - 1 ? workflow.stages[index + 1] : null;
  const list = (title, values, mod) => `
    <div class="stage-col ${mod}">
      <h4>${title}</h4>
      <ul>${values.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>
    </div>
  `;

  el.stageDetail.innerHTML = `
    <header class="stage-head">
      <div>
        <p class="eyebrow">المرحلة ${formatNumber(stage.order)} من ${formatNumber(total)}</p>
        <h3>${escapeHtml(stage.name)}</h3>
        <p class="stage-question">${escapeHtml(stage.question)}</p>
      </div>
      <button class="text-button" type="button" data-goto-view="${stage.link.view}">
        ${icon("i-link")} ${escapeHtml(stage.link.label)}
      </button>
    </header>

    <p class="stage-purpose">${escapeHtml(stage.purpose)}</p>

    <div class="stage-cols">
      ${list("المدخلات", stage.inputs, "is-in")}
      ${list("المخرجات", stage.outputs, "is-out")}
    </div>

    <div class="stage-panels">
      <div class="stage-gate">
        <span class="gate-label">${icon("i-gate")} بوابة الانتقال</span>
        <p>${escapeHtml(stage.gate)}</p>
      </div>
      <div class="stage-rule">
        <span class="gate-label">${icon("i-spark")} قاعدة هذه المرحلة</span>
        <p>${escapeHtml(stage.rule)}</p>
      </div>
    </div>

    <footer class="stage-foot">
      <span class="mini-chip">المهارة: ${escapeHtml(stage.skill)}</span>
      <div class="stage-nav">
        <button class="ghost-button" type="button" data-stage-step="-1" ${prev ? "" : "disabled"}>
          ${icon("i-arrow-start")} ${prev ? escapeHtml(prev.name) : "بداية المسار"}
        </button>
        <button class="ghost-button" type="button" data-stage-step="1" ${next ? "" : "disabled"}>
          ${next ? escapeHtml(next.name) : "نهاية المسار"} ${icon("i-arrow-end")}
        </button>
      </div>
    </footer>
  `;
}

function layerItems(layer) {
  return (layer.sections || []).flatMap((section) =>
    (section.items || []).map((item) => ({ ...item, section: section.section_name })),
  );
}

function layerKey(layerId, itemId) {
  return `L${layerId}:${itemId}`;
}

function computeLayer(layer) {
  const items = layerItems(layer);
  let score = 0;
  let decided = 0;
  let criticalBlocked = 0;
  const criticalTotal = items.filter((item) => item.criticality === "حرج").length;

  items.forEach((item) => {
    const status = state.layerStatuses[layerKey(layer.layer_id, item.id)];
    if (status) decided += 1;
    score += LAYER_STATUS[status]?.factor ?? 0;
    if (item.criticality === "حرج" && status === "missing") criticalBlocked += 1;
  });

  const completion = items.length ? (score / items.length) * 100 : 0;
  const verdict =
    completion >= 80 && criticalBlocked === 0 ? "ready" : completion >= 60 ? "partial" : "blocked";

  return { items, completion, decided, criticalTotal, criticalBlocked, verdict };
}

const VERDICT = {
  ready: { label: "جاهز", cls: "ok" },
  partial: { label: "مقبول", cls: "warn" },
  blocked: { label: "غير جاهز", cls: "risk" },
};

function renderLayerBoard() {
  const layers = classification.layers || [];
  const results = layers.map((layer) => ({ layer, result: computeLayer(layer) }));
  const gateLayers = results.filter(({ layer }) => layer.layer_id <= 2);
  const gateReady = gateLayers.every(({ result }) => result.verdict === "ready");
  const blockers = gateLayers.reduce((sum, { result }) => sum + result.criticalBlocked, 0);

  el.decisionBanner.className = `decision-banner ${gateReady ? "ok" : blockers ? "risk" : "warn"}`;
  el.decisionBanner.innerHTML = `
    <div>
      <h3>${gateReady ? "قرار البدء: ابدأ الكتابة" : "قرار البدء: لم تُستوفَ البوابة بعد"}</h3>
      <p>${escapeHtml(classification.metadata.classification_system.start_decision)}</p>
    </div>
    <div class="decision-figures">
      ${gateLayers
        .map(
          ({ layer, result }) => `
        <span class="mini-chip">${escapeHtml(layer.name)}: ${formatPercent(result.completion)}٪</span>
      `,
        )
        .join("")}
      ${blockers ? `<span class="warn-chip">${icon("i-alert")} ${formatNumber(blockers)} دليل حرج ناقص</span>` : ""}
    </div>
  `;

  el.layerGrid.innerHTML = results
    .map(({ layer, result }) => {
      const active = layer.layer_id === state.openLayer;
      const verdict = VERDICT[result.verdict];
      return `
        <button class="layer-card ${active ? "is-active" : ""} ${verdict.cls}" type="button" data-layer="${layer.layer_id}">
          <header>
            <span class="layer-order">الطبقة ${formatNumber(layer.layer_id)}</span>
            <span class="state-pill ${verdict.cls}">${verdict.label}</span>
          </header>
          <h3>${escapeHtml(layer.name)}</h3>
          <p>${escapeHtml(layer.description)}</p>
          <div class="layer-bar"><span style="width:${Math.round(result.completion)}%"></span></div>
          <footer>
            <span>${formatPercent(result.completion)}٪ جاهزية</span>
            <span>${formatNumber(result.items.length)} عنصر · ${formatNumber(result.criticalTotal)} حرج</span>
          </footer>
        </button>
      `;
    })
    .join("");

  const current = results.find(({ layer }) => layer.layer_id === state.openLayer) || results[0];
  if (!current) {
    el.layerDetail.innerHTML = "";
    return;
  }
  renderLayerDetail(current.layer);
}

function renderLayerDetail(layer) {
  const sections = layer.sections || [];
  el.layerDetail.innerHTML = `
    <div class="layer-detail-head">
      <div>
        <h3>${escapeHtml(layer.name)}</h3>
        <p>${escapeHtml(layer.impact || "")}</p>
      </div>
      <span class="mini-chip">${escapeHtml(layer.priority || "")}</span>
    </div>
    ${sections
      .map(
        (section) => `
      <section class="layer-section">
        <h4>${escapeHtml(section.section_name)}</h4>
        <div class="layer-items">
          ${(section.items || []).map((item) => renderLayerItem(layer, item)).join("")}
        </div>
      </section>
    `,
      )
      .join("")}
  `;
}

function renderLayerItem(layer, item) {
  const key = layerKey(layer.layer_id, item.id);
  const status = state.layerStatuses[key] || "";
  const critical = item.criticality === "حرج";
  return `
    <article class="layer-item ${status ? `is-${status}` : ""}">
      <header>
        <div>
          <span class="mono-value">${escapeHtml(item.id)}</span>
          <h5>${escapeHtml(item.name)}</h5>
        </div>
        <span class="state-pill ${critical ? "risk" : "muted"}">${escapeHtml(item.criticality || "")}</span>
      </header>
      ${item.frequency || item.impact ? `<p class="layer-meta">${escapeHtml([item.frequency, item.impact].filter(Boolean).join(" — "))}</p>` : ""}
      ${
        (item.check_items || []).length
          ? `<ul class="check-items">${item.check_items.map((check) => `<li>${escapeHtml(check)}</li>`).join("")}</ul>`
          : ""
      }
      <div class="status-actions">
        ${Object.entries(LAYER_STATUS)
          .map(
            ([value, meta]) => `
          <button class="status-action ${status === value ? "is-active" : ""}" type="button"
            data-layer-item="${key}" data-layer-status="${value}">
            ${icon(meta.icon)} ${meta.label}
          </button>
        `,
          )
          .join("")}
      </div>
    </article>
  `;
}

/* ───────────────────────── سجل الأدلة المؤسسية ───────────────────────── */

function formatBytes(bytes) {
  if (!bytes) return "";
  const mb = bytes / 1048576;
  if (mb >= 1) return `${formatNumber(mb.toFixed(1))} م.ب`;
  return `${formatNumber(Math.max(1, Math.round(bytes / 1024)))} ك.ب`;
}

function downloadLink(file, label) {
  const name = label || `${file.format_name}${file.level_name ? ` · ${file.level_name}` : ""}`;
  return `
    <a class="download-chip is-${escapeHtml(file.format)}" href="${escapeHtml(file.path)}" download>
      ${icon("i-download")}
      <span>${escapeHtml(name)}</span>
      <small>${escapeHtml(formatBytes(file.size))}</small>
    </a>
  `;
}

function renderInstitutional() {
  if (!institutional) return;
  const meta = institutional.metadata;
  const templatesMode = state.institutionalSection === "templates";
  const section = meta.sections.find((item) => item.id === state.institutionalSection) || meta.sections[0];

  el.institutionalIntro.textContent = section.description;

  el.institutionalSections.innerHTML = meta.sections
    .map((item) => {
      const count = item.id === "templates" ? institutional.templates.length : institutional.items.length;
      return `
        <button class="segment ${item.id === state.institutionalSection ? "is-active" : ""}" type="button"
          role="tab" aria-selected="${item.id === state.institutionalSection}" data-institutional-section="${item.id}">
          ${icon(item.id === "templates" ? "i-file" : "i-bank")}
          <span>${escapeHtml(item.name)}</span>
          <strong>${formatNumber(count)}</strong>
        </button>
      `;
    })
    .join("");

  el.institutionalRule.innerHTML = `${icon(templatesMode ? "i-spark" : "i-alert")}<div><strong>${
    templatesMode ? "القالب وعاء لا دليل" : "قاعدة أحدث نسخة"
  }</strong><p>${escapeHtml(templatesMode ? meta.templates_rule : meta.golden_rule)}</p></div>`;

  el.institutionalLevelField.hidden = templatesMode;
  el.institutionalStatusField.hidden = templatesMode;
  el.institutionalProgramField.hidden = templatesMode;
  el.institutionalSearch.placeholder = templatesMode
    ? "بحث باسم القالب أو رمزه"
    : "بحث باسم الوثيقة أو الجهة أو الموضوع";

  if (!el.institutionalLevelFilter.options.length) {
    el.institutionalLevelFilter.innerHTML = `<option value="all">كل المستويات</option>${meta.levels
      .map((level) => `<option value="${level.id}">${escapeHtml(level.name)}</option>`)
      .join("")}`;
  }

  if (templatesMode) renderTemplatesSection();
  else renderRegistrySection();
}

function renderTemplatesSection() {
  const templates = filteredTemplates();
  const all = institutional.templates;
  const withFiles = all.filter((item) => item.files.length).length;
  const fileCount = all.reduce((sum, item) => sum + item.files.length, 0);
  const totalSize = all.reduce((sum, item) => sum + item.files.reduce((s, f) => s + f.size, 0), 0);

  el.institutionalSummary.innerHTML = `
    ${metric("القوالب المعروضة", formatNumber(templates.length), `من ${formatNumber(all.length)} قالب في الكتالوج`)}
    ${metric("قوالب قابلة للتنزيل", formatNumber(withFiles), "بصيغتَي Word و PDF حيث توفرتا")}
    ${metric("ملفات جاهزة", formatNumber(fileCount), formatBytes(totalSize))}
    ${metric("الجهة المصدِرة", "المركز الوطني", "للتقويم والاعتماد الأكاديمي")}
  `;

  el.institutionalGrid.innerHTML = templates.length
    ? templates.map(renderTemplateCard).join("")
    : `<p class="empty-cell">لا توجد قوالب مطابقة للبحث الحالي.</p>`;
}

function renderTemplateCard(item) {
  const groups = {};
  item.files.forEach((file) => {
    (groups[file.level] = groups[file.level] || { name: file.level_name, files: [] }).files.push(file);
  });

  return `
    <article class="doc-card is-template">
      <header>
        <div>
          <span class="mono-value">${escapeHtml(item.code || item.group)}</span>
          <h3>${escapeHtml(item.name)}</h3>
          <p class="doc-issuer">${escapeHtml(item.purpose)}</p>
        </div>
        <div class="doc-badges">
          <span class="state-pill info">${escapeHtml(item.group)}</span>
        </div>
      </header>

      <p class="doc-usage"><strong>كيف يُستعمل:</strong> ${escapeHtml(item.usage)}</p>
      ${item.version_watch ? `<p class="doc-version">${escapeHtml(item.version_watch)}</p>` : ""}

      <div class="doc-tags">
        ${(item.topics || []).map((topic) => `<span class="tag soft">${escapeHtml(topic)}</span>`).join("")}
      </div>

      ${
        item.files.length
          ? `<div class="download-block">
              ${Object.values(groups)
                .map(
                  (group) => `
                <div class="download-row">
                  <span class="download-row-label">${escapeHtml(group.name)}</span>
                  <div class="download-chips">
                    ${group.files.map((file) => downloadLink(file, file.format_name)).join("")}
                  </div>
                </div>
              `,
                )
                .join("")}
            </div>`
          : `<p class="doc-note">لم يُرفع ملف هذا القالب بعد.</p>`
      }
    </article>
  `;
}

function renderRegistrySection() {
  const items = filteredInstitutional();
  const programKey = state.institutionalProgram === "pg" ? "criteria_pg" : "criteria_ug";
  const needsAction = items.filter((item) => item.status === "للتأكيد").length;
  const linked = items.reduce((sum, item) => sum + (item[programKey]?.length || 0), 0);
  const downloadable = institutional.items.filter((item) => item.file).length;

  el.institutionalSummary.innerHTML = `
    ${metric("الوثائق المعروضة", formatNumber(items.length), `من ${formatNumber(institutional.items.length)} وثيقة في السجل`)}
    ${metric("متاحة للتنزيل", formatNumber(downloadable), "لوائح وأدلة جامعية مرفوعة")}
    ${metric("تحتاج تأكيداً", formatNumber(needsAction), "غير متوفرة أو تنتظر جهة خارجية")}
    ${metric("إحالات المحكات", formatNumber(linked), state.institutionalProgram === "pg" ? "الدراسات العليا" : "البكالوريوس")}
  `;

  el.institutionalGrid.innerHTML = items.length
    ? items.map((item) => renderInstitutionalCard(item, programKey)).join("")
    : `<p class="empty-cell">لا توجد وثائق مطابقة للتصفية الحالية.</p>`;
}

function renderInstitutionalCard(item, programKey) {
  const levelName =
    institutional.metadata.levels.find((level) => level.id === item.level)?.name || item.level;
  const criteria = item[programKey] || [];
  const program = state.institutionalProgram;
  const warn = (item.version_watch || "").startsWith("⚠️");

  return `
    <article class="doc-card ${item.status === "للتأكيد" ? "is-pending" : ""}">
      <header>
        <div>
          <span class="mono-value">${escapeHtml(item.id)}</span>
          <h3>${escapeHtml(item.name)}</h3>
          <p class="doc-issuer">${escapeHtml(item.issuer)}</p>
        </div>
        <div class="doc-badges">
          <span class="state-pill ${item.level === "university" ? "ok" : "muted"}">${escapeHtml(levelName)}</span>
          <span class="state-pill ${item.status === "معتمد" ? "ok" : "warn"}">${escapeHtml(item.status)}</span>
        </div>
      </header>

      <p class="doc-usage"><strong>الاستخدام في المتن:</strong> ${escapeHtml(item.usage)}</p>

      ${
        item.version_watch
          ? `<p class="doc-version ${warn ? "is-warn" : ""}">${warn ? icon("i-alert") : ""}${escapeHtml(item.version_watch.replace("⚠️ ", ""))}</p>`
          : ""
      }

      ${item.notes ? `<p class="doc-note">${escapeHtml(item.notes)}</p>` : ""}

      <div class="doc-tags">
        <span class="tag">${escapeHtml(item.category)}</span>
        ${(item.topics || []).map((topic) => `<span class="tag soft">${escapeHtml(topic)}</span>`).join("")}
      </div>

      ${
        item.file
          ? `<div class="download-block">
              <div class="download-row">
                <span class="download-row-label">نسخة الوثيقة</span>
                <div class="download-chips">
                  ${downloadLink(item.file, item.file.pages ? `PDF · ${formatNumber(item.file.pages)} صفحة` : "PDF")}
                </div>
              </div>
            </div>`
          : ""
      }

      ${
        criteria.length
          ? `<div class="doc-criteria">
              <span class="doc-criteria-label">محكات مقترحة (${formatNumber(criteria.length)})</span>
              <div class="chip-row">
                ${criteria
                  .map(
                    (id) =>
                      `<button class="criterion-chip" type="button" data-open-criterion="${escapeHtml(id)}" data-program="${program}">${escapeHtml(id)}</button>`,
                  )
                  .join("")}
              </div>
            </div>`
          : `<p class="doc-note">لا توجد إحالات مطابقة آلياً في هذا البرنامج.</p>`
      }
    </article>
  `;
}

function filteredTemplates() {
  const query = normalize(state.institutionalQuery);
  return institutional.templates.filter((item) => {
    if (!query) return true;
    const blob = normalize(
      [item.name, item.code, item.group, item.purpose, item.usage, (item.topics || []).join(" ")].join(" "),
    );
    return blob.includes(query);
  });
}

function filteredInstitutional() {
  const query = normalize(state.institutionalQuery);
  return institutional.items.filter((item) => {
    if (state.institutionalLevel !== "all" && item.level !== state.institutionalLevel) return false;
    if (state.institutionalStatus !== "all" && item.status !== state.institutionalStatus) return false;
    if (!query) return true;
    const blob = normalize(
      [item.name, item.issuer, item.category, item.usage, item.notes, (item.topics || []).join(" ")].join(" "),
    );
    return blob.includes(query);
  });
}

/* ───────────────────────── دليل الكتابة ───────────────────────── */

const WRITING_SECTIONS = [
  { id: "rule", label: "القاعدة المعتمدة" },
  { id: "phrasing", label: "الصياغة المثالية" },
  { id: "example", label: "نموذج محك مكتمل" },
  { id: "checklist", label: "قائمة التحقق" },
  { id: "review", label: "الأخطاء الشائعة" },
];

function renderWriting() {
  if (!writingGuide) return;
  el.writingIntro.textContent = writingGuide.metadata.description;
  el.writingTabs.innerHTML = WRITING_SECTIONS.map(
    (section) => `
      <button class="sub-tab ${state.writingSection === section.id ? "is-active" : ""}" type="button"
        role="tab" aria-selected="${state.writingSection === section.id}" data-writing-section="${section.id}">
        ${escapeHtml(section.label)}
      </button>
    `,
  ).join("");

  const renderers = {
    rule: writingRule,
    phrasing: writingPhrasing,
    example: writingExample,
    checklist: writingChecklist,
    review: writingReview,
  };
  el.writingBody.innerHTML = (renderers[state.writingSection] || writingRule)();
}

function writingRule() {
  const rule = writingGuide.rule;
  const adli = writingGuide.adli;
  const citation = writingGuide.citation;
  return `
    <article class="doc-panel">
      <span class="eyebrow">القاعدة</span>
      <h3>${escapeHtml(rule.headline)}</h3>
      <div class="rule-banner"><div><strong>نصّ القاعدة</strong><p>${escapeHtml(rule.statement)}</p><p>${escapeHtml(rule.verification)}</p></div></div>
      <div class="two-cols">
        <div class="do-box">
          <h4>${icon("i-check")} افعل داخل المحك</h4>
          <ul>${rule.do.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
        </div>
        <div class="dont-box">
          <h4>${icon("i-x")} لا تفعل</h4>
          <ul>${rule.dont.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
        </div>
      </div>
      <div class="callout">
        <h4>في نهاية كل معيار</h4>
        <ol>${rule.standard_end.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ol>
        <p class="callout-foot">${escapeHtml(rule.consistency)}</p>
      </div>
    </article>

    <article class="doc-panel">
      <span class="eyebrow">المنطق</span>
      <h3>${escapeHtml(adli.headline)}</h3>
      <p class="panel-note">${escapeHtml(adli.note)}</p>
      <div class="adli-grid">
        ${adli.items
          .map(
            (item) => `
          <div class="adli-card">
            <h4>${escapeHtml(item.key)}</h4>
            <p class="adli-q">${escapeHtml(item.question)}</p>
            <p class="sample">${escapeHtml(item.sample)}</p>
          </div>
        `,
          )
          .join("")}
      </div>
    </article>

    <article class="doc-panel">
      <span class="eyebrow">الإحالة</span>
      <h3>${escapeHtml(citation.headline)}</h3>
      <div class="rule-list">
        ${citation.rules
          .map(
            (item) => `
          <div class="rule-item">
            <h4>${escapeHtml(item.title)}</h4>
            <p>${escapeHtml(item.body)}</p>
            <p class="sample">${escapeHtml(item.example)}</p>
          </div>
        `,
          )
          .join("")}
      </div>
    </article>
  `;
}

function writingPhrasing() {
  const phrasing = writingGuide.phrasing;
  return `
    <article class="doc-panel">
      <span class="eyebrow">قوالب</span>
      <h3>${escapeHtml(phrasing.headline)}</h3>
      ${phrasing.groups
        .map(
          (group) => `
        <section class="phrase-group">
          <h4>${escapeHtml(group.name)}</h4>
          ${(group.templates || []).map((line) => `<p class="sample">${escapeHtml(line)}</p>`).join("")}
          ${
            group.good
              ? `<div class="two-cols">
                  <div class="do-box"><h4>${icon("i-check")} صياغة صحيحة</h4><ul>${group.good.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul></div>
                  <div class="dont-box"><h4>${icon("i-x")} صياغة مرفوضة</h4><ul>${group.bad.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul></div>
                </div>`
              : ""
          }
        </section>
      `,
        )
        .join("")}
    </article>

    <article class="doc-panel">
      <span class="eyebrow">تنقية</span>
      <h3>عبارات محظورة وبدائلها</h3>
      <div class="swap-list">
        ${phrasing.forbidden
          .map(
            (item) => `
          <div class="swap-item">
            <p class="swap-bad">${icon("i-x")} ${escapeHtml(item.phrase)}</p>
            <p class="swap-why">${escapeHtml(item.why)}</p>
            <p class="swap-good">${icon("i-check")} ${escapeHtml(item.instead)}</p>
          </div>
        `,
          )
          .join("")}
      </div>
    </article>
  `;
}

function writingExample() {
  const example = writingGuide.example;
  const end = example.standard_end_sample;
  return `
    <article class="doc-panel">
      <span class="eyebrow">نموذج</span>
      <h3>المحك ${escapeHtml(example.criterion_id)} — بنية الصياغة المعتمدة</h3>
      <blockquote class="criterion-quote">${escapeHtml(example.criterion_text)}</blockquote>
      <div class="chip-row">
        ${example.keywords.map((word, index) => `<span class="tag">${formatNumber(index + 1)}. ${escapeHtml(word)}</span>`).join("")}
      </div>
      <p class="panel-note">${escapeHtml(example.note)}</p>
      <ol class="model-list">
        ${example.paragraphs
          .map(
            (para) => `
          <li>
            <div class="model-head">
              <h4>${escapeHtml(para.label)}</h4>
              <span class="mini-chip">${escapeHtml(para.role)}</span>
            </div>
            <p class="model-text">${escapeHtml(para.text)}</p>
          </li>
        `,
          )
          .join("")}
      </ol>
    </article>

    <article class="doc-panel">
      <span class="eyebrow">نهاية المعيار</span>
      <h3>ما يُكتب بعد آخر محك في المعيار</h3>
      <div class="two-cols">
        <div class="callout">
          <h4>نقاط القوة</h4>
          <ul>${end.strengths.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
        </div>
        <div class="callout">
          <h4>أولويات التحسين</h4>
          <ul>${end.priorities.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
        </div>
      </div>
      <p class="callout-foot">تقييم مستوى التطبيق: ${escapeHtml(end.application_level)}</p>
    </article>
  `;
}

function writingChecklist() {
  const items = writingGuide.checklist;
  const done = items.filter((_, index) => state.checklistState[`c${index}`]).length;
  const percent = items.length ? (done / items.length) * 100 : 0;
  return `
    <article class="doc-panel">
      <span class="eyebrow">قبل العرض</span>
      <h3>قائمة التحقق قبل تسليم أي محك</h3>
      <div class="checklist-progress">
        <div class="layer-bar"><span style="width:${Math.round(percent)}%"></span></div>
        <span>${formatNumber(done)} من ${formatNumber(items.length)}</span>
      </div>
      <ul class="checklist">
        ${items
          .map(
            (line, index) => `
          <li>
            <button class="check-row ${state.checklistState[`c${index}`] ? "is-done" : ""}" type="button" data-checklist="c${index}">
              <span class="check-box">${icon("i-check")}</span>
              <span>${escapeHtml(line)}</span>
            </button>
          </li>
        `,
          )
          .join("")}
      </ul>
      <p class="panel-note">الحالة محفوظة في هذا المتصفح فقط، وتُعاد تصفيرها بمسح بيانات الموقع.</p>
    </article>

    <article class="doc-panel">
      <span class="eyebrow">شرط قبول</span>
      <h3>${escapeHtml(writingGuide.report_elements.headline)}</h3>
      <ol class="elements-list">
        ${writingGuide.report_elements.items
          .map(
            (item) => `
          <li><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.detail)}</span></li>
        `,
          )
          .join("")}
      </ol>
    </article>
  `;
}

function writingReview() {
  return `
    <article class="doc-panel">
      <span class="eyebrow">قبل التسليم</span>
      <h3>${escapeHtml(writingGuide.pitfalls_headline)}</h3>
      <p class="panel-note">${escapeHtml(writingGuide.pitfalls_note)}</p>
      <div class="finding-list">
        ${writingGuide.pitfalls
          .map(
            (item) => `
          <div class="finding-item">
            <span class="finding-num">${formatNumber(item.n)}</span>
            <div>
              <h4>${escapeHtml(item.title)}</h4>
              <p><strong>كيف تكتشفه:</strong> ${escapeHtml(item.how)}</p>
              <p class="finding-impact">${escapeHtml(item.why)}</p>
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    </article>
  `;
}
