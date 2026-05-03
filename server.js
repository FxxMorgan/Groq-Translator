require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
const JSZip = require("jszip");
const multer = require("multer");
const mammoth = require("mammoth");
const Groq = require("groq-sdk");
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require("docx");

const app = express();
const port = process.env.PORT || 3000;
const defaultModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "novels-db.json");
const modelCatalogPath = path.join(__dirname, "aimodel.md");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

if (!process.env.GROQ_API_KEY) {
  console.error("Falta GROQ_API_KEY en .env");
  process.exit(1);
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

ensureDb();

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "groq-novel-translator" });
});

app.get("/api/models", (_req, res) => {
  res.json({ models: loadModelCatalog() });
});

app.post("/api/import-source", upload.single("sourceFile"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Debes adjuntar un archivo txt o docx." });
    }

    const fileName = String(req.file.originalname || "").trim();
    const extension = path.extname(fileName).toLowerCase();
    let sourceText = "";

    if (extension === ".txt") {
      sourceText = decodeTextFile(req.file.buffer);
    } else if (extension === ".docx") {
      const extracted = await mammoth.extractRawText({ buffer: req.file.buffer });
      sourceText = String(extracted.value || "");
    } else {
      return res.status(400).json({ error: "Formato no soportado. Usa .txt o .docx" });
    }

    sourceText = normalizeImportedText(sourceText);
    if (!sourceText) {
      return res.status(400).json({ error: "No se detecto texto util en el archivo." });
    }

    const chapters = splitTextByChapterHeaders(sourceText);
    return res.json({
      fileName,
      sourceText,
      chapters,
      detectedChapters: chapters.length
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Error importando archivo." });
  }
});

app.get("/api/novels", (_req, res) => {
  const db = readDb();
  const novels = db.novels.map((novel) => ({
    id: novel.id,
    title: novel.title,
    description: novel.description,
    glossaryCount: novel.glossary.length,
    translationCount: novel.translations.length,
    createdAt: novel.createdAt,
    updatedAt: novel.updatedAt
  }));
  res.json({ novels });
});

app.get("/api/novels/:novelId", (req, res) => {
  const db = readDb();
  const novel = db.novels.find((entry) => entry.id === req.params.novelId);
  if (!novel) {
    return res.status(404).json({ error: "Novela no encontrada." });
  }
  return res.json({ novel });
});

app.post("/api/novels", (req, res) => {
  const title = String(req.body?.title || "").trim();
  const description = String(req.body?.description || "").trim();

  if (!title) {
    return res.status(400).json({ error: "El titulo es obligatorio." });
  }

  const db = readDb();
  const now = new Date().toISOString();
  const novel = {
    id: randomUUID(),
    title,
    description,
    createdAt: now,
    updatedAt: now,
    glossary: [],
    translations: []
  };

  db.novels.push(novel);
  writeDb(db);
  return res.status(201).json({ novel });
});

app.delete("/api/novels/:novelId", (req, res) => {
  const db = readDb();
  const previousSize = db.novels.length;
  db.novels = db.novels.filter((entry) => entry.id !== req.params.novelId);

  if (db.novels.length === previousSize) {
    return res.status(404).json({ error: "Novela no encontrada." });
  }

  writeDb(db);
  return res.json({ ok: true });
});

app.post("/api/novels/:novelId/glossary", (req, res) => {
  const term = String(req.body?.term || "").trim();
  const translation = String(req.body?.translation || "").trim();
  const note = String(req.body?.note || "").trim();

  if (!term || !translation) {
    return res.status(400).json({ error: "Termino y traduccion son obligatorios." });
  }

  const db = readDb();
  const novel = db.novels.find((entry) => entry.id === req.params.novelId);

  if (!novel) {
    return res.status(404).json({ error: "Novela no encontrada." });
  }

  const exists = novel.glossary.some((item) => item.term.toLowerCase() === term.toLowerCase());
  if (exists) {
    return res.status(409).json({ error: "Ese termino ya existe en el glosario." });
  }

  const item = {
    id: randomUUID(),
    term,
    translation,
    note
  };

  novel.glossary.push(item);
  novel.updatedAt = new Date().toISOString();
  writeDb(db);
  return res.status(201).json({ item });
});

app.delete("/api/novels/:novelId/glossary/:glossaryId", (req, res) => {
  const db = readDb();
  const novel = db.novels.find((entry) => entry.id === req.params.novelId);

  if (!novel) {
    return res.status(404).json({ error: "Novela no encontrada." });
  }

  const previous = novel.glossary.length;
  novel.glossary = novel.glossary.filter((item) => item.id !== req.params.glossaryId);
  if (previous === novel.glossary.length) {
    return res.status(404).json({ error: "Termino no encontrado." });
  }

  novel.updatedAt = new Date().toISOString();
  writeDb(db);
  return res.json({ ok: true });
});

app.delete("/api/novels/:novelId/translate/:translationId", (req, res) => {
  const db = readDb();
  const novel = db.novels.find((entry) => entry.id === req.params.novelId);

  if (!novel) {
    return res.status(404).json({ error: "Novela no encontrada." });
  }

  const previousSize = novel.translations.length;
  novel.translations = novel.translations.filter((entry) => entry.id !== req.params.translationId);

  if (novel.translations.length === previousSize) {
    return res.status(404).json({ error: "Traducción no encontrada." });
  }

  novel.updatedAt = new Date().toISOString();
  writeDb(db);
  return res.json({ ok: true });
});

app.post("/api/novels/:novelId/translate", async (req, res) => {
  const sourceText = String(req.body?.sourceText || "").trim();
  const chapterTitle = String(req.body?.chapterTitle || "").trim() || "Capitulo";
  const model = String(req.body?.model || defaultModel).trim();
  const targetLanguage = String(req.body?.targetLanguage || "espanol").trim();
  const requestedMaxTokens = Number(req.body?.maxTokens);
  const envMaxTokens = Number(process.env.GROQ_MAX_TOKENS);
  const maxTokens = Number.isFinite(requestedMaxTokens) && requestedMaxTokens > 0
    ? Math.floor(requestedMaxTokens)
    : Number.isFinite(envMaxTokens) && envMaxTokens > 0
      ? Math.floor(envMaxTokens)
      : 4096;
  const chunkingEnabled = Boolean(req.body?.chunking?.enabled ?? true);
  const requestedChunkChars = Number(req.body?.chunking?.maxChunkChars);
  const envChunkChars = Number(process.env.GROQ_CHUNK_CHARS);
  const maxChunkChars = Number.isFinite(requestedChunkChars) && requestedChunkChars > 0
    ? Math.floor(requestedChunkChars)
    : Number.isFinite(envChunkChars) && envChunkChars > 0
      ? Math.floor(envChunkChars)
      : 9000;

  if (!sourceText) {
    return res.status(400).json({ error: "Debes enviar texto de origen." });
  }

  const db = readDb();
  const novel = db.novels.find((entry) => entry.id === req.params.novelId);

  if (!novel) {
    return res.status(404).json({ error: "Novela no encontrada." });
  }

  const glossaryText = buildGlossaryText(novel.glossary);
  const { tokenizedSourceText, tokenMap } = applyGlossaryTokensToSource(sourceText, novel.glossary);
  const tokenRulesText = buildTokenRulesText(tokenMap);
  const systemPrompt = [
    "Eres un traductor profesional de novelas ligeras.",
    `1. Tu tarea PRINCIPAL y UNICA es TRADUCIR TODO el texto completo al idioma objetivo: ${targetLanguage}.`,
    "2. NO rescribas en el idioma original, DEBES generar texto traducido al idioma solicitado.",
    "3. Respeta nombres propios, tono narrativo y estilo de diálogos.",
    "4. No resumas ni omitas contenido. MANTÉN los párrafos exactos del original.",
    "5. Si un término aparece en el glosario o en las reglas de tokens, usa exactamente esa traducción.",
    tokenRulesText
      ? "El texto puede incluir tokens con formato [[GLOSSARY_N]]. Debes conservarlos sin alterarlos."
      : "",
    tokenRulesText ? `Reglas de tokens obligatorias:\n${tokenRulesText}` : "",
    glossaryText ? `Glosario obligatorio:\n${glossaryText}` : "No hay glosario cargado para esta novela."
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const estimatedInputTokens = estimateTokens(systemPrompt) + estimateTokens(tokenizedSourceText) + 250;
    const shouldChunk = chunkingEnabled && (tokenizedSourceText.length > maxChunkChars || estimatedInputTokens > 5500);
    let chunks = shouldChunk ? chunkTextByParagraphs(tokenizedSourceText, maxChunkChars) : [tokenizedSourceText];

    let combinedWithTokens = "";
    let finishReasons = [];
    let combinedUsage = null;
    let previousTranslatedTail = "";
    let didAutoRetryChunking = false;

    for (let i = 0; i < chunks.length; i += 1) {
      const part = chunks[i];
      const partHeader = chunks.length > 1 ? `Parte ${i + 1} de ${chunks.length}` : "";
      const continuity = previousTranslatedTail
        ? `Contexto breve (solo para mantener estilo/continuidad, no lo repitas):\n${previousTranslatedTail}\n\n`
        : "";

      const completion = await groq.chat.completions.create({
        model,
        temperature: 0.2,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              `Por favor, TRADUCE al idioma ${targetLanguage} el siguiente contenido.`,
              partHeader ? `(${partHeader})` : "",
              "Reglas extra: NO agregues títulos, NO numeres, NO resumas, NO omitas. Mantén saltos de línea.",
              "",
              `Título del capitulo: ${chapterTitle}`,
              "",
              continuity,
              `Texto original:\n${part}`,
              "",
              "Devuelve SOLO la traducción final."
            ]
              .filter(Boolean)
              .join("\n")
          }
        ]
      });

      let translated = completion.choices?.[0]?.message?.content || "";
      const finishReason = completion.choices?.[0]?.finish_reason || null;
      finishReasons.push(finishReason);
      combinedUsage = mergeUsage(combinedUsage, completion.usage);

      // Si NO estábamos en chunks (1 sola parte) y se truncó, reintentamos automáticamente en modo chunking
      if (
        chunkingEnabled &&
        !didAutoRetryChunking &&
        chunks.length === 1 &&
        finishReason === "length" &&
        tokenizedSourceText.length > 2500
      ) {
        didAutoRetryChunking = true;
        const retryChunkChars = Math.max(2500, Math.floor(maxChunkChars / 2));
        chunks = chunkTextByParagraphs(tokenizedSourceText, retryChunkChars);
        combinedWithTokens = "";
        finishReasons = [];
        combinedUsage = null;
        previousTranslatedTail = "";
        i = -1; // reiniciar bucle con nuevos chunks
        continue;
      }

      translated = translated.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

      if (translated) {
        combinedWithTokens += (combinedWithTokens ? "\n\n" : "") + translated;
        previousTranslatedTail = String(translated).slice(-700);
      }

      // Si se truncó incluso en chunking, evitamos meter demasiado contexto para no empeorar el prompt siguiente
      if (finishReason === "length") {
        previousTranslatedTail = "";
      }
    }

    let firstPassTranslated = combinedWithTokens;
    const firstPassFinishReason = finishReasons.length ? finishReasons[finishReasons.length - 1] : null;

    let translatedText = restoreGlossaryTokens(firstPassTranslated, tokenMap);
    let missingGlossaryTerms = findMissingGlossaryTerms(translatedText, tokenMap);
    let compliance = {
      strict: missingGlossaryTerms.length === 0,
      repaired: false,
      passes: 1,
      missingTerms: missingGlossaryTerms
    };
    let finalUsage = combinedUsage;

    if (missingGlossaryTerms.length > 0 && tokenMap.length > 0) {
      const repairPrompt = [
        "Corrige la traduccion para cumplir estrictamente el glosario.",
        `Idioma objetivo: ${targetLanguage}`,
        "No resumes ni recortes.",
        tokenRulesText ? `Reglas de tokens:\n${tokenRulesText}` : "",
        `Glosario obligatorio:\n${glossaryText}`,
        `Terminos faltantes detectados:\n${missingGlossaryTerms
          .map((item) => `- ${item.term} => ${item.translation}`)
          .join("\n")}`,
        `Texto original con tokens:\n${tokenizedSourceText}`,
        `Traduccion actual:\n${firstPassTranslated}`,
        "Devuelve solo la traduccion final corregida."
      ]
        .filter(Boolean)
        .join("\n\n");

      const repairCompletion = await groq.chat.completions.create({
        model,
        temperature: 0,
        max_tokens: maxTokens,
        messages: [
          {
            role: "system",
            content: "Eres un editor de traduccion estricto. Cumples glosarios obligatorios al 100%."
          },
          { role: "user", content: repairPrompt }
        ]
      });

      let repairedWithTokens = repairCompletion.choices?.[0]?.message?.content || "";
      // Eliminar etiquetas <think> para los modelos de razonamiento (ej. Qwen)
      repairedWithTokens = repairedWithTokens.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

      translatedText = restoreGlossaryTokens(repairedWithTokens, tokenMap);
      missingGlossaryTerms = findMissingGlossaryTerms(translatedText, tokenMap);
      finalUsage = mergeUsage(finalUsage, repairCompletion.usage);
      compliance = {
        strict: missingGlossaryTerms.length === 0,
        repaired: true,
        passes: 2,
        missingTerms: missingGlossaryTerms
      };
    }

    // Agregar saltos de línea después de punto y espacio seguido de mayúscula o signos de apertura
    translatedText = translatedText.replace(/\.\s+([¿¡"“'‘]*[A-ZÁÉÍÓÚÑ])/g, ".\n\n$1");

    const translation = {
      id: randomUUID(),
      chapterTitle,
      sourceText,
      translatedText,
      targetLanguage,
      model,
      maxTokens,
      usage: finalUsage,
      finishReason: firstPassFinishReason,
      chunking: (chunks.length > 1 || didAutoRetryChunking)
        ? {
            enabled: true,
            maxChunkChars,
            chunks: chunks.length,
            finishReasons
          }
        : { enabled: false, chunks: 1, finishReasons },
      compliance,
      createdAt: new Date().toISOString()
    };

    novel.translations.unshift(translation);
    novel.updatedAt = new Date().toISOString();
    writeDb(db);

    return res.status(201).json({ translation });
  } catch (error) {
    const status = Number(error?.status) || 500;
    const details = error?.error?.message || error?.message || "Error desconocido";
    return res.status(status).json({ error: details });
  }
});

app.get("/api/novels/:novelId/export/:format", async (req, res) => {
  const format = String(req.params.format || "").toLowerCase();
  const translationId = String(req.query.translationId || "").trim();
  const db = readDb();
  const novel = db.novels.find((entry) => entry.id === req.params.novelId);

  if (!novel) {
    return res.status(404).json({ error: "Novela no encontrada." });
  }

  const exportData = pickTranslationsForExport(novel, translationId);
  if (exportData.chapters.length === 0) {
    return res.status(400).json({ error: "No hay traducciones para exportar." });
  }

  const fileBaseName = sanitizeFileName(exportData.title || "novela");

  if (format === "txt") {
    const content = buildTxtExport(exportData);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileBaseName}.txt"`);
    return res.send(content);
  }

  if (format === "docx") {
    const buffer = await buildDocxExport(exportData);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileBaseName}.docx"`);
    return res.send(buffer);
  }

  if (format === "epub") {
    const buffer = await buildEpubExport(exportData);
    res.setHeader("Content-Type", "application/epub+zip");
    res.setHeader("Content-Disposition", `attachment; filename="${fileBaseName}.epub"`);
    return res.send(buffer);
  }

  return res.status(400).json({ error: "Formato no soportado." });
});

app.listen(port, () => {
  console.log(`Groq novel translator corriendo en http://localhost:${port}`);
});

function ensureDb() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ novels: [] }, null, 2), "utf8");
  }
}

function readDb() {
  try {
    const raw = fs.readFileSync(dbPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.novels)) {
      return { novels: [] };
    }
    return parsed;
  } catch (_error) {
    return { novels: [] };
  }
}

function writeDb(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), "utf8");
}

function loadModelCatalog() {
  const defaults = [
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "qwen/qwen3-32b"
  ];

  if (!fs.existsSync(modelCatalogPath)) {
    return defaults;
  }

  const lines = fs.readFileSync(modelCatalogPath, "utf8").split(/\r?\n/);
  const models = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("Modelo") || trimmed.startsWith("Speech to Text")) {
      continue;
    }
    if (trimmed.startsWith("Text to Speech")) {
      break;
    }
    const modelName = trimmed.split(",")[0]?.trim();
    if (modelName && !modelName.includes(" ") && !models.includes(modelName)) {
      models.push(modelName);
    }
  }

  if (!models.includes(defaultModel)) {
    models.unshift(defaultModel);
  }

  return models.length > 0 ? models : defaults;
}

function buildGlossaryText(glossary) {
  if (!glossary || glossary.length === 0) {
    return "";
  }
  return glossary
    .map((item) => {
      const noteSuffix = item.note ? ` (${item.note})` : "";
      return `- ${item.term} => ${item.translation}${noteSuffix}`;
    })
    .join("\n");
}

function applyGlossaryTokensToSource(sourceText, glossary) {
  if (!Array.isArray(glossary) || glossary.length === 0) {
    return {
      tokenizedSourceText: sourceText,
      tokenMap: []
    };
  }

  let tokenizedSourceText = sourceText;
  const tokenMap = [];
  const sortedGlossary = [...glossary].sort((a, b) => String(b.term).length - String(a.term).length);
  let index = 0;

  for (const item of sortedGlossary) {
    const term = String(item.term || "").trim();
    const translation = String(item.translation || "").trim();

    if (!term || !translation) {
      continue;
    }

    const regex = new RegExp(escapeRegExp(term), "gi");
    if (!regex.test(tokenizedSourceText)) {
      continue;
    }

    const token = `[[GLOSSARY_${index}]]`;
    tokenizedSourceText = tokenizedSourceText.replace(regex, token);
    tokenMap.push({
      token,
      term,
      translation,
      note: item.note || ""
    });
    index += 1;
  }

  return {
    tokenizedSourceText,
    tokenMap
  };
}

function buildTokenRulesText(tokenMap) {
  if (!Array.isArray(tokenMap) || tokenMap.length === 0) {
    return "";
  }

  return tokenMap
    .map((item) => {
      const noteSuffix = item.note ? ` (${item.note})` : "";
      return `- ${item.token} => ${item.translation}${noteSuffix}`;
    })
    .join("\n");
}

function restoreGlossaryTokens(translatedText, tokenMap) {
  let result = String(translatedText || "");
  for (const item of tokenMap) {
    result = result.split(item.token).join(item.translation);
  }
  return result;
}

function findMissingGlossaryTerms(translatedText, tokenMap) {
  const normalizedTranslation = normalizeForComparison(translatedText);
  const missing = [];

  for (const item of tokenMap) {
    const normalizedExpected = normalizeForComparison(item.translation);
    if (!normalizedExpected) {
      continue;
    }

    if (!normalizedTranslation.includes(normalizedExpected)) {
      missing.push({
        term: item.term,
        translation: item.translation
      });
    }
  }

  return missing;
}

function normalizeForComparison(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function mergeUsage(first, second) {
  if (!first && !second) {
    return null;
  }

  const keys = [
    "queue_time",
    "prompt_tokens",
    "prompt_time",
    "completion_tokens",
    "completion_time",
    "total_tokens",
    "total_time"
  ];

  const merged = {};
  for (const key of keys) {
    const a = Number(first?.[key] || 0);
    const b = Number(second?.[key] || 0);
    const value = a + b;
    if (value > 0) {
      merged[key] = value;
    }
  }

  return merged;
}

function estimateTokens(text) {
  // Estimación simple (aprox 1 token ~ 4 chars en promedio para texto)
  return Math.ceil(String(text || "").length / 4);
}

function chunkTextByParagraphs(text, maxChars) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.split(/\n{2,}/);
  const chunks = [];
  let current = "";

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = "";
  };

  for (const block of blocks) {
    const b = block.trim();
    if (!b) continue;

    const candidate = current ? `${current}\n\n${b}` : b;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    // Si un bloque por sí solo es enorme, partir por líneas
    if (!current && b.length > maxChars) {
      const lines = b.split("\n");
      let lineAcc = "";
      for (const line of lines) {
        const cand = lineAcc ? `${lineAcc}\n${line}` : line;
        if (cand.length <= maxChars) {
          lineAcc = cand;
        } else {
          if (lineAcc.trim()) chunks.push(lineAcc.trim());
          lineAcc = line;
        }
      }
      if (lineAcc.trim()) chunks.push(lineAcc.trim());
      continue;
    }

    pushCurrent();
    current = b.length <= maxChars ? b : b.slice(0, maxChars);
  }

  pushCurrent();
  return chunks.length ? chunks : [normalized.trim()];
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitizeFileName(value) {
  return String(value || "novela")
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function pickTranslationsForExport(novel, translationId) {
  let chapters = novel.translations;
  let title = novel.title;

  if (translationId) {
    const target = novel.translations.find((item) => item.id === translationId);
    chapters = target ? [target] : [];
    if (target) {
      title = `${novel.title}-${target.chapterTitle}`;
    }
  }

  return {
    title,
    novelTitle: novel.title,
    chapters
  };
}

function buildTxtExport(data) {
  const blocks = [`# ${data.novelTitle}`];

  for (const chapter of data.chapters) {
    blocks.push("", `## ${chapter.chapterTitle}`, "", chapter.translatedText || "");
  }

  return blocks.join("\n");
}

async function buildDocxExport(data) {
  const paragraphs = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun(data.novelTitle)]
    })
  ];

  for (const chapter of data.chapters) {
    paragraphs.push(new Paragraph({ text: "" }));
    paragraphs.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun(chapter.chapterTitle)]
      })
    );

    const lines = String(chapter.translatedText || "").split(/\r?\n/);
    for (const line of lines) {
      paragraphs.push(new Paragraph({ text: line }));
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children: paragraphs }]
  });

  return Packer.toBuffer(doc);
}

async function buildEpubExport(data) {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  const metaInf = zip.folder("META-INF");
  metaInf.file(
    "container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  const oebps = zip.folder("OEBPS");
  const chapterItems = [];
  const spineItems = [];
  const tocNavPoints = [];

  data.chapters.forEach((chapter, index) => {
    const fileName = `chapter-${index + 1}.xhtml`;
    const id = `chapter-${index + 1}`;
    const chapterBody = String(chapter.translatedText || "")
      .split(/\r?\n/)
      .map((line) => `<p>${escapeXml(line)}</p>`)
      .join("\n");

    oebps.file(
      fileName,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
  <head>
    <title>${escapeXml(chapter.chapterTitle)}</title>
    <meta charset="utf-8"/>
  </head>
  <body>
    <h1>${escapeXml(chapter.chapterTitle)}</h1>
    ${chapterBody}
  </body>
</html>`
    );

    chapterItems.push(`<item id="${id}" href="${fileName}" media-type="application/xhtml+xml"/>`);
    spineItems.push(`<itemref idref="${id}"/>`);
    tocNavPoints.push(
      `<navPoint id="${id}" playOrder="${index + 1}"><navLabel><text>${escapeXml(
        chapter.chapterTitle
      )}</text></navLabel><content src="${fileName}"/></navPoint>`
    );
  });

  oebps.file(
    "content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package version="2.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(data.novelTitle)}</dc:title>
    <dc:language>es</dc:language>
    <dc:identifier id="bookid">urn:uuid:${randomUUID()}</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    ${chapterItems.join("\n    ")}
  </manifest>
  <spine toc="ncx">
    ${spineItems.join("\n    ")}
  </spine>
</package>`
  );

  oebps.file(
    "toc.ncx",
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${randomUUID()}"/>
  </head>
  <docTitle>
    <text>${escapeXml(data.novelTitle)}</text>
  </docTitle>
  <navMap>
    ${tocNavPoints.join("\n    ")}
  </navMap>
</ncx>`
  );

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeTextFile(buffer) {
  if (!buffer || !buffer.length) {
    return "";
  }

  const utf8 = buffer.toString("utf8");
  if (utf8.includes("\uFFFD")) {
    return buffer.toString("latin1");
  }
  return utf8;
}

function normalizeImportedText(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .trim();
}

function splitTextByChapterHeaders(sourceText) {
  const headingRegex = /^(capitulo|capítulo|chapter|ch\.?|prologo|prólogo|epilogo|epílogo)\b/i;
  const lines = String(sourceText || "").split("\n");
  const chapters = [];
  let currentTitle = "Capitulo 1";
  let currentLines = [];

  const flushChapter = () => {
    const content = currentLines.join("\n").trim();
    if (!content) {
      return;
    }
    chapters.push({
      id: randomUUID(),
      title: currentTitle,
      content
    });
    currentLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const looksLikeHeader = trimmed.length > 0 && trimmed.length <= 120 && headingRegex.test(trimmed);

    if (looksLikeHeader) {
      flushChapter();
      currentTitle = trimmed;
      continue;
    }

    currentLines.push(line);
  }

  flushChapter();

  if (chapters.length === 0) {
    return [
      {
        id: randomUUID(),
        title: "Capitulo importado",
        content: sourceText
      }
    ];
  }

  return chapters;
}

