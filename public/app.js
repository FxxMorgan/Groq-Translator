const novelSelect = document.getElementById("novel-select");
const novelTitleInput = document.getElementById("novel-title");
const novelDescriptionInput = document.getElementById("novel-description");
const createNovelBtn = document.getElementById("create-novel-btn");
const deleteNovelBtn = document.getElementById("delete-novel-btn");

const termInput = document.getElementById("term");
const translationInput = document.getElementById("translation");
const noteInput = document.getElementById("note");
const addGlossaryBtn = document.getElementById("add-glossary-btn");
const glossaryBody = document.getElementById("glossary-body");

const modelSelect = document.getElementById("model");
const targetLanguageInput = document.getElementById("target-language");
const chapterTitleInput = document.getElementById("chapter-title");
const sourceTextInput = document.getElementById("source-text");
const maxTokensInput = document.getElementById("max-tokens");
const autoChunkInput = document.getElementById("auto-chunk");
const chunkSizeInput = document.getElementById("chunk-size");
const translateBtn = document.getElementById("translate-btn");
const sourceFileInput = document.getElementById("source-file");
const importSourceBtn = document.getElementById("import-source-btn");
const detectedChapterSelect = document.getElementById("detected-chapter-select");
const loadChapterBtn = document.getElementById("load-chapter-btn");
const importInfoEl = document.getElementById("import-info");

const translationSelect = document.getElementById("translation-select");
const exportTxtBtn = document.getElementById("export-txt");
const exportDocxBtn = document.getElementById("export-docx");
const exportEpubBtn = document.getElementById("export-epub");
const exportPdfBtn = document.getElementById("export-pdf");
const deleteTranslationBtn = document.getElementById("delete-translation-btn");
const copyBtn = document.getElementById("copy-btn"); // NEW

const statusEl = document.getElementById("status");
const replyEl = document.getElementById("reply");
const usageEl = document.getElementById("usage");

// --- UTILIDAD DE TOASTS ---
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  
  const toast = document.createElement("div");
  // Colores y diseño Toast
  const isError = type === "error";
  const bgColor = isError ? "bg-red-50 dark:bg-red-900/30" : "bg-emerald-50 dark:bg-emerald-900/30";
  const borderColor = isError ? "border-red-200 dark:border-red-800" : "border-emerald-200 dark:border-emerald-800";
  const iconColor = isError ? "text-red-500" : "text-emerald-500";
  const iconClass = isError ? "ph-warning-circle" : "ph-check-circle";

  toast.className = `toast flex items-center justify-between gap-3 p-4 rounded-xl shadow-lg border pointer-events-auto ${bgColor} bg-opacity-95 ${borderColor}`;
  toast.innerHTML = `
    <div class="flex items-center gap-3">
      <i class="ph ${iconClass} text-2xl ${iconColor}"></i>
      <p class="text-sm font-semibold text-gray-800 dark:text-gray-100">${message}</p>
    </div>
    <button class="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors shrink-0">
      <i class="ph ph-x"></i>
    </button>
  `;
  
  toast.querySelector("button").onclick = () => toast.remove();
  container.appendChild(toast);

  // Auto destruir
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = "slideInRight 0.3s ease-out reverse forwards";
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

const state = {
  novels: [],
  selectedNovel: null,
  models: [],
  importedChapters: []
};

init().catch((error) => setStatusError(error));

createNovelBtn.addEventListener("click", async () => {
  try {
    const title = novelTitleInput.value.trim();
    const description = novelDescriptionInput.value.trim();
    if (!title) {
      throw new Error("Debes ingresar el titulo de la novela.");
    }
    await api("/api/novels", {
      method: "POST",
      body: { title, description }
    });
    novelTitleInput.value = "";
    novelDescriptionInput.value = "";
    await refreshNovels();
    statusEl.textContent = "Novela creada";
    showToast("Novela creada con éxito!");
  } catch (error) {
    setStatusError(error);
  }
});

deleteNovelBtn.addEventListener("click", async () => {
  try {
    const novelId = novelSelect.value;
    if (!novelId) {
      throw new Error("Selecciona una novela.");
    }
    const current = state.novels.find((entry) => entry.id === novelId);
    if (!current) {
      throw new Error("Novela no encontrada.");
    }
    const approved = window.confirm(`Eliminar novela \"${current.title}\"?`);
    if (!approved) {
      return;
    }
    await api(`/api/novels/${novelId}`, { method: "DELETE" });
    await refreshNovels();
    statusEl.textContent = "Novela eliminada";
    showToast("Proyecto eliminado");
  } catch (error) {
    setStatusError(error);
  }
});

novelSelect.addEventListener("change", async () => {
  const novelId = novelSelect.value;
  await loadNovelDetails(novelId);
});

addGlossaryBtn.addEventListener("click", async () => {
  try {
    const novelId = novelSelect.value;
    if (!novelId) {
      throw new Error("Selecciona una novela primero.");
    }

    const term = termInput.value.trim();
    const translation = translationInput.value.trim();
    const note = noteInput.value.trim();

    if (!term || !translation) {
      throw new Error("Termino y traduccion son obligatorios.");
    }

    await api(`/api/novels/${novelId}/glossary`, {
      method: "POST",
      body: { term, translation, note }
    });

    termInput.value = "";
    translationInput.value = "";
    noteInput.value = "";

    await loadNovelDetails(novelId);
    statusEl.textContent = "Glosario actualizado";
    showToast("Término añadido al glosario");
  } catch (error) {
    setStatusError(error);
  }
});

glossaryBody.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (!target.matches("button[data-glossary-id]")) {
    return;
  }

  try {
    const glossaryId = target.dataset.glossaryId;
    const novelId = novelSelect.value;
    if (!glossaryId || !novelId) {
      return;
    }
    await api(`/api/novels/${novelId}/glossary/${glossaryId}`, { method: "DELETE" });
    await loadNovelDetails(novelId);
    statusEl.textContent = "Termino eliminado";
    showToast("Término eliminado", "info");
  } catch (error) {
    setStatusError(error);
  }
});

translateBtn.addEventListener("click", async () => {
  try {
    const novelId = novelSelect.value;
    if (!novelId) {
      throw new Error("Selecciona una novela primero.");
    }

    const chapterTitle = chapterTitleInput.value.trim() || "Capitulo";
    const sourceText = sourceTextInput.value.trim();
    const model = modelSelect.value;
    const targetLanguage = targetLanguageInput.value.trim() || "espanol";
    const maxTokens = maxTokensInput ? Number(maxTokensInput.value) : undefined;
    const autoChunk = autoChunkInput ? Boolean(autoChunkInput.checked) : true;
    const chunkSize = chunkSizeInput ? Number(chunkSizeInput.value) : undefined;

    if (!sourceText) {
      throw new Error("Debes ingresar texto a traducir.");
    }

    setBusy(true, "Traduciendo con Groq...");

    const result = await api(`/api/novels/${novelId}/translate`, {
      method: "POST",
      body: {
        chapterTitle,
        sourceText,
        model,
        targetLanguage,
        maxTokens: Number.isFinite(maxTokens) && maxTokens > 0 ? Math.floor(maxTokens) : undefined,
        chunking: {
          enabled: autoChunk,
          maxChunkChars: Number.isFinite(chunkSize) && chunkSize > 0 ? Math.floor(chunkSize) : undefined
        }
      }
    });

    await loadNovelDetails(novelId, result.translation.id);
    renderTranslation(result.translation.id);
    
    // Estimate tokens and save usage
    const estTokens = result.translation.usage?.total_tokens || Math.ceil((sourceText.length + (result.translation.translatedText || "").length) / 3.5);
    saveConsumo(model, estTokens);

    if (result.translation?.compliance?.strict) {
      statusEl.textContent = "Traduccion completada con glosario verificado";
      showToast("Traducción impecable (Glosario estricto OK)");
    } else {
      statusEl.textContent = "Traduccion completada con alertas de glosario";
      showToast("Traducción completada pero faltan términos", "error");
    }
  } catch (error) {
    setStatusError(error);
  } finally {
    setBusy(false);
  }
});

translationSelect.addEventListener("change", () => {
  renderTranslation(translationSelect.value);
});

if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    try {
      const textToCopy = replyEl.textContent;
      if (!textToCopy || textToCopy === "Todavia no hay traducciones." || textToCopy === "El resultado aparecerá aquí...") return;
      await navigator.clipboard.writeText(textToCopy);
      statusEl.textContent = "Texto copiado!";
      
      // Feedback visual rápido
      const iconBtn = copyBtn.querySelector("i");
      iconBtn.classList.remove("ph-copy");
      iconBtn.classList.add("ph-check", "text-emerald-500");
      setTimeout(() => {
        iconBtn.classList.add("ph-copy");
        iconBtn.classList.remove("ph-check", "text-emerald-500");
      }, 2000);
    } catch (e) {
      console.error("No se pudo copiar", e);
    }
  });
}

if (deleteTranslationBtn) {
  deleteTranslationBtn.addEventListener("click", async () => {
    try {
      const novelId = novelSelect.value;
      const translationId = translationSelect.value;
      if (!novelId || !translationId) {
        throw new Error("Selecciona una traducción del historial.");
      }

      const confirmDelete = window.confirm("¿Seguro que deseas ELIMINAR esta traducción?");
      if (!confirmDelete) return;

      setBusy(true, "Eliminando traducción...");
      await api(`/api/novels/${novelId}/translate/${translationId}`, { method: "DELETE" });
      
      await loadNovelDetails(novelId);
      statusEl.textContent = "Traducción eliminada";
      showToast("Traducción eliminada del historial", "info");
    } catch (error) {
      setStatusError(error);
    } finally {
      setBusy(false);
    }
  });
}

if (exportPdfBtn) {
  exportPdfBtn.addEventListener("click", () => {
    const translation = state.selectedNovel?.translations?.find(
      (item) => item.id === translationSelect.value
    );
    if (!translation) {
      showToast("Selecciona una traducción del historial para exportar.", "error");
      return;
    }
    
    setBusy(true, "Generando PDF...");
    try {
      const element = document.createElement("div");
      element.innerHTML = `
        <h1 style="font-family: sans-serif; font-size: 24px; text-align: center; margin-bottom: 20px;">
          ${translation.chapterTitle || "Traducción"}
        </h1>
        <div style="font-family: serif; font-size: 14px; line-height: 1.6; white-space: pre-wrap; text-align: justify;">
          ${translation.translatedText || "(Sin texto)"}
        </div>
      `;
      
      const opt = {
        margin: 15,
        filename: `${translation.chapterTitle || 'documento'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      html2pdf().set(opt).from(element).save().then(() => {
        setBusy(false);
        showToast("PDF Exportado Exitosamente!");
      });
    } catch (err) {
      setBusy(false);
      showToast("Error generando PDF", "error");
    }
  });
}

exportTxtBtn.addEventListener("click", () => triggerExport("txt"));
exportDocxBtn.addEventListener("click", () => triggerExport("docx"));
exportEpubBtn.addEventListener("click", () => triggerExport("epub"));

importSourceBtn.addEventListener("click", async () => {
  try {
    const file = sourceFileInput.files?.[0];
    if (!file) {
      throw new Error("Selecciona un archivo txt o docx.");
    }

    setBusy(true, "Importando archivo...");
    const result = await uploadSourceFile(file);
    state.importedChapters = Array.isArray(result.chapters) ? result.chapters : [];
    renderImportedChapters();

    if (state.importedChapters.length > 0) {
      loadDetectedChapter(state.importedChapters[0].id);
    } else if (result.sourceText) {
      sourceTextInput.value = result.sourceText;
      chapterTitleInput.value = "Capitulo importado";
    }

    importInfoEl.textContent = `${result.fileName || file.name} Â· ${result.detectedChapters || 0} capitulo(s)`;
    statusEl.textContent = "Archivo importado";
    showToast(`Se importaron ${result.detectedChapters || 0} capítulos detectados`);
  } catch (error) {
    setStatusError(error);
  } finally {
    setBusy(false);
  }
});

loadChapterBtn.addEventListener("click", () => {
  loadDetectedChapter(detectedChapterSelect.value);
});

detectedChapterSelect.addEventListener("change", () => {
  loadDetectedChapter(detectedChapterSelect.value);
});

async function init() {
  statusEl.textContent = "Cargando...";
  await Promise.all([loadModels(), refreshNovels()]);

  if (!state.selectedNovel) {
    replyEl.textContent = "Crea una novela para comenzar a traducir.";
  }

  statusEl.textContent = "Listo";
}

async function loadModels() {
  const result = await api("/api/models");
  state.models = result.models || [];
  modelSelect.innerHTML = "";

  state.models.forEach((model) => {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    modelSelect.appendChild(option);
  });
}

async function refreshNovels() {
  const result = await api("/api/novels");
  state.novels = result.novels || [];

  const previousId = state.selectedNovel?.id;
  novelSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = state.novels.length ? "Selecciona una novela" : "Sin novelas";
  novelSelect.appendChild(placeholder);

  state.novels.forEach((novel) => {
    const option = document.createElement("option");
    option.value = novel.id;
    option.textContent = `${novel.title} (${novel.translationCount} trads)`;
    novelSelect.appendChild(option);
  });

  const targetId = state.novels.some((item) => item.id === previousId)
    ? previousId
    : state.novels[0]?.id;

  if (targetId) {
    novelSelect.value = targetId;
    await loadNovelDetails(targetId);
  } else {
    state.selectedNovel = null;
    renderGlossary([]);
    renderTranslationOptions([]);
    replyEl.textContent = "Todavia no hay traducciones.";
    usageEl.textContent = "";
  }
}

async function loadNovelDetails(novelId, preferredTranslationId) {
  if (!novelId) {
    state.selectedNovel = null;
    renderGlossary([]);
    renderTranslationOptions([]);
    replyEl.textContent = "Selecciona una novela para ver su informacion.";
    usageEl.textContent = "";
    updateActiveNovelDisplay("Ninguna seleccionada");
    return;
  }

  const result = await api(`/api/novels/${novelId}`);
  state.selectedNovel = result.novel;
  updateActiveNovelDisplay(state.selectedNovel.title);

  renderGlossary(state.selectedNovel.glossary || []);
  renderTranslationOptions(state.selectedNovel.translations || []);

  const selected =
    preferredTranslationId || translationSelect.value || state.selectedNovel.translations?.[0]?.id || "";
  if (selected) {
    translationSelect.value = selected;
    renderTranslation(selected);
  } else {
    replyEl.textContent = "Todavia no hay traducciones.";
    usageEl.textContent = "";
  }
}

function updateActiveNovelDisplay(title) {
  const displayEl = document.getElementById("active-novel-display");
  if (displayEl) {
    displayEl.textContent = title;
  }
}


function renderGlossary(glossary) {
  glossaryBody.innerHTML = "";

  if (!glossary.length) {
    const row = document.createElement("tr");
    row.innerHTML = '<td colspan="4" class="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">Sin terminos en glosario.</td>';
    glossaryBody.appendChild(row);
    return;
  }

  glossary.forEach((item) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="px-4 py-3 align-top text-gray-800 dark:text-gray-200">${escapeHtml(item.term)}</td>
      <td class="px-4 py-3 align-top font-medium text-brand-600 dark:text-brand-400">${escapeHtml(item.translation)}</td>
      <td class="px-4 py-3 align-top text-gray-500 dark:text-gray-400 max-w-[150px] truncate" title="${escapeHtml(item.note || "")}">${escapeHtml(item.note || "")}</td>
      <td class="px-3 py-3 align-top flex justify-end"><button type="button" class="rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 px-3 py-1 text-xs font-semibold transition" data-glossary-id="${item.id}">Quitar</button></td>
    `;
    glossaryBody.appendChild(row);
  });
}

function renderImportedChapters() {
  detectedChapterSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = state.importedChapters.length
    ? "Selecciona capitulo detectado"
    : "Sin capitulos detectados";
  detectedChapterSelect.appendChild(placeholder);

  state.importedChapters.forEach((chapter, index) => {
    const option = document.createElement("option");
    option.value = chapter.id;
    option.textContent = `${index + 1}. ${chapter.title}`;
    detectedChapterSelect.appendChild(option);
  });

  if (state.importedChapters.length > 0) {
    detectedChapterSelect.value = state.importedChapters[0].id;
  }
}

function loadDetectedChapter(chapterId) {
  if (!chapterId) {
    return;
  }

  const chapter = state.importedChapters.find((item) => item.id === chapterId);
  if (!chapter) {
    return;
  }

  chapterTitleInput.value = chapter.title;
  sourceTextInput.value = chapter.content;
  statusEl.textContent = `Capitulo cargado: ${chapter.title}`;
  showToast("Capítulo cargado en el Workspace de Traducción");
}

function renderTranslationOptions(translations) {
  translationSelect.innerHTML = "";
  const base = document.createElement("option");
  base.value = "";
  base.textContent = translations.length ? "Selecciona traduccion" : "Sin traducciones";
  translationSelect.appendChild(base);

  translations.forEach((translation) => {
    const option = document.createElement("option");
    option.value = translation.id;
    option.textContent = `${translation.chapterTitle} - ${formatDate(translation.createdAt)}`;
    translationSelect.appendChild(option);
  });
}

function renderTranslation(translationId) {
  const translation = state.selectedNovel?.translations?.find((item) => item.id === translationId);
  if (!translation) {
    replyEl.textContent = "Selecciona una traduccion para visualizarla.";
    usageEl.textContent = "";
    return;
  }

  replyEl.textContent = translation.translatedText || "(Sin texto)";
  usageEl.textContent = buildUsageText(translation);
}

function buildUsageText(translation) {
  const complianceInfo = buildComplianceText(translation?.compliance);
  const finishInfo = translation?.finishReason ? `finish: ${translation.finishReason}` : "finish: ?";
  const chunkInfo = translation?.chunking?.enabled
    ? `chunks: ${translation.chunking.chunks || "?"}`
    : "chunks: 1";

  if (!translation?.usage) {
    return `Modelo: ${translation?.model || "desconocido"} | ${finishInfo} | ${chunkInfo} | ${complianceInfo}`;
  }
  return `Modelo: ${translation.model} | Tokens prompt ${translation.usage.prompt_tokens || 0} | completion ${translation.usage.completion_tokens || 0} | total ${translation.usage.total_tokens || 0} | ${finishInfo} | ${chunkInfo} | ${complianceInfo}`;
}

function buildComplianceText(compliance) {
  if (!compliance) {
    return "Glosario: sin validacion";
  }

  if (compliance.strict) {
    const suffix = compliance.repaired ? " (corregido en 2da pasada)" : "";
    return `Glosario: OK${suffix}`;
  }

  const missing = Array.isArray(compliance.missingTerms)
    ? compliance.missingTerms.map((item) => item.translation).join(", ")
    : "";
  return missing
    ? `Glosario: faltan terminos (${missing})`
    : "Glosario: faltan terminos obligatorios";
}

function triggerExport(format) {
  const novelId = novelSelect.value;
  if (!novelId) {
    statusEl.textContent = "Selecciona una novela para exportar";
    return;
  }

  const translationId = translationSelect.value;
  const qs = translationId ? `?translationId=${encodeURIComponent(translationId)}` : "";
  window.open(`/api/novels/${encodeURIComponent(novelId)}/export/${format}${qs}`, "_blank");
}

function setBusy(isBusy, label) {
  createNovelBtn.disabled = isBusy;
  deleteNovelBtn.disabled = isBusy;
  addGlossaryBtn.disabled = isBusy;
  translateBtn.disabled = isBusy;
  importSourceBtn.disabled = isBusy;
  loadChapterBtn.disabled = isBusy;
  exportTxtBtn.disabled = isBusy;
  exportDocxBtn.disabled = isBusy;
  exportEpubBtn.disabled = isBusy;
  if(exportPdfBtn) exportPdfBtn.disabled = isBusy;

  if (isBusy) {
    statusEl.textContent = label || "Procesando...";
    document.getElementById("status-dot")?.classList.add("bg-amber-500");
    document.getElementById("status-dot")?.classList.remove("bg-emerald-500");
    // Añadimos spinner a translateBtn como ejemplo
    const translateIcon = translateBtn.querySelector("i.ph-magic-wand");
    if(translateIcon) translateIcon.className = "ph ph-spinner animate-spin text-lg";
  } else {
    statusEl.textContent = label || "Listo";
    document.getElementById("status-dot")?.classList.remove("bg-amber-500");
    document.getElementById("status-dot")?.classList.add("bg-emerald-500");
    const spinnerIcon = translateBtn.querySelector("i.ph-spinner");
    if(spinnerIcon) spinnerIcon.className = "ph ph-magic-wand text-lg";
  }
}

function setStatusError(error) {
  statusEl.textContent = "Hubo un error";
  usageEl.textContent = String(error?.message || error);
  document.getElementById("status-dot")?.classList.add("bg-red-500");
  document.getElementById("status-dot")?.classList.remove("bg-emerald-500");
  showToast(String(error?.message || error), "error");
}

function formatDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch (_error) {
    return "sin fecha";
  }
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_error) {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || `Error HTTP ${response.status}`);
  }

  return data || {};
}

async function uploadSourceFile(file) {
  const form = new FormData();
  form.append("sourceFile", file);

  const response = await fetch("/api/import-source", {
    method: "POST",
    body: form
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || `Error HTTP ${response.status}`);
  }

  return data;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- LOGICA DE CONSUMO ---
const limitsData = [
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", tpd: 500000 },
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile", tpd: 100000 },
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B", tpd: 500000 },
  { id: "qwen/qwen3-32b", name: "Qwen 3 32B", tpd: 500000 }
];

function getConsumo() {
  const hoy = new Date().toISOString().split("T")[0];
  let data = JSON.parse(localStorage.getItem("cypher-consumo") || "{}");
  if (data.date !== hoy) {
    data = { date: hoy, tokens: {} };
  }
  return data;
}

function saveConsumo(modelId, tokensUsed) {
  const data = getConsumo();
  data.tokens[modelId] = (data.tokens[modelId] || 0) + tokensUsed;
  localStorage.setItem("cypher-consumo", JSON.stringify(data));
  renderConsumoTable();
}

function renderConsumoTable() {
  const tbody = document.getElementById("consumo-table-body");
  if (!tbody) return;
  const data = getConsumo();
  
  tbody.innerHTML = limitsData.map(limit => {
    const consumido = data.tokens[limit.id] || 0;
    const tpdStr = limit.tpd === Infinity ? "No Limit" : limit.tpd.toLocaleString("es-ES");
    const restante = limit.tpd === Infinity ? "âˆž" : (limit.tpd - consumido);
    const restanteStr = restante === "âˆž" ? "âˆž" : Math.max(0, restante).toLocaleString("es-ES");
    
    let stateColor = "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400";
    let stateIcon = "ph-check-circle";
    let stateText = "Normal";
    
    if (limit.tpd !== Infinity && restante <= 0) {
      stateColor = "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400";
      stateIcon = "ph-warning-circle";
      stateText = "Agotado";
    } else if (limit.tpd !== Infinity && consumido > (limit.tpd * 0.8)) {
      stateColor = "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400";
      stateIcon = "ph-warning";
      stateText = "Crítico";
    }
    
    return `<tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <td class="py-3 px-4 text-gray-900 dark:text-gray-100 font-medium">${limit.name}</td>
      <td class="py-3 px-4 text-gray-600 dark:text-gray-400 text-center font-mono">${tpdStr}</td>
      <td class="py-3 px-4 text-gray-900 dark:text-gray-100 text-center font-mono">${consumido.toLocaleString("es-ES")}</td>
      <td class="py-3 px-4 text-gray-800 dark:text-gray-200 text-center font-mono font-semibold">${restanteStr}</td>
      <td class="py-3 px-4">
        <span class="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${stateColor}">
          <i class="ph ${stateIcon}"></i> ${stateText}
        </span>
      </td>
    </tr>`;
  }).join("");
}

// Initial render mapping
document.addEventListener("DOMContentLoaded", () => {
  renderConsumoTable();
});




