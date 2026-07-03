/* =========================
   🗂️ DATENBANK
========================= */

const HORSE_STORE_KEY = "pferde";
const HORSE_API_PATH = "/api/pferde";

let pferde = [];

function readLocalPferde() {
    try {
        const raw = localStorage.getItem(HORSE_STORE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeLocalPferde(data) {
    try {
        localStorage.setItem(HORSE_STORE_KEY, JSON.stringify(data));
    } catch {
        // Local storage is only a fallback when the remote store is unavailable.
    }
}

async function fetchRemotePferde() {
    const response = await fetch(HORSE_API_PATH, {
        headers: {
            Accept: "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(`Horse store GET failed with ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
}

async function persistPferdeToRemote() {
    const response = await fetch(HORSE_API_PATH, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
        },
        body: JSON.stringify(pferde)
    });

    if (!response.ok) {
        throw new Error(`Horse store PUT failed with ${response.status}`);
    }
}

async function loadPferde() {
    const localPferde = readLocalPferde();

    try {
        const remotePferde = await fetchRemotePferde();

        if (remotePferde.length === 0 && localPferde.length > 0) {
            pferde = localPferde;
            await persistPferdeToRemote();
            writeLocalPferde(pferde);
            return;
        }

        pferde = remotePferde;
        writeLocalPferde(pferde);
        return;
    } catch {
        pferde = localPferde;
        writeLocalPferde(pferde);
    }
}


/* =========================
   🧭 NAVIGATION
========================= */

function zeigeTool(name) {
    document.querySelectorAll(".tool").forEach(t => t.classList.remove("aktiv"));
    document.getElementById(name).classList.add("aktiv");

    if (name === "zucht" || name === "farben") {
        populateBreedingDropdowns();
    }

    if (name === "zucht") {
        const legacyLiveBox = document.getElementById("breeding_inbreeding_status");
        if (legacyLiveBox) legacyLiveBox.remove();
    }
}

function syncMenuLayerOffsets() {
    const header = document.querySelector("header");
    if (!header) return;

    const height = Math.ceil(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--header-offset", `${height}px`);
}

function toggleMenu() {
    const menu = document.getElementById("menu");
    const backdrop = document.getElementById("menu-backdrop");

    syncMenuLayerOffsets();

    menu.classList.toggle("open");
    backdrop.classList.toggle("active");
    document.body.classList.toggle("menu-open", menu.classList.contains("open"));

    const isOpen = menu.classList.contains("open");
    if (isOpen) {
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.overflow = "hidden";
        document.body.style.paddingRight = `${Math.max(scrollbarWidth, 0)}px`;
        return;
    }

    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
}

window.addEventListener("DOMContentLoaded", syncMenuLayerOffsets);
window.addEventListener("resize", syncMenuLayerOffsets);


/* =========================
   💾 SAVE SYSTEM
========================= */

async function savePferd(pferd) {

    const index = pferde.findIndex(p => p.name === pferd.name);

    if (index !== -1) {
        pferde[index] = { ...pferde[index], ...pferd };
    } else {
        pferde.push(pferd);
    }

    writeLocalPferde(pferde);

    try {
        await persistPferdeToRemote();
    } catch {
        // Keep the local copy so the app still works offline or during deployment setup.
    }
}


/* =========================
   🐎 IMPORT
========================= */

async function parsePferd() {

    const raw = document.getElementById("pferd_raw").value;

    const pferd = {
        name: findName(raw),
        geschlecht: findGeschlecht(raw),
        gp: findGP(raw),
        besitzer: findBesitzer(raw),
        abstammung: extractPedigree(raw),
        farbe: extractAlleles(raw),
        interieur: extractInterior(raw),
        exterieur: parseExterior(raw),
        leistungen: extractSkills(raw)
    };

    if (!pferd.name) {
        alert("❌ Name nicht erkannt!");
        return;
    }

    await savePferd(pferd);
    renderDatabase();

    document.getElementById("import_status").innerHTML = `
        <div class="card" style="margin-top:15px;">
            <strong>${pferd.name}</strong> gespeichert!
        </div>
    `;
}

function resetImportInput() {
    const raw = document.getElementById("pferd_raw");
    const status = document.getElementById("import_status");
    if (raw) raw.value = "";
    if (status) status.innerHTML = "";
}

function resetBreedingRaw(type) {
    const fieldId = type === "stallion" ? "stallion_raw" : "mare_raw";
    const field = document.getElementById(fieldId);
    if (field) field.value = "";
}

function resetTournamentInput() {
    const raw = document.getElementById("turnier_raw");
    const out = document.getElementById("turnier_result");
    if (raw) raw.value = "";
    if (out) {
        out.innerHTML = `<p>Noch keine Analyse gestartet.</p>`;
    }
}

function resetExteriorInput() {
    const raw = document.getElementById("exterieur_raw");
    const out = document.getElementById("exterieur_result");
    if (raw) raw.value = "";
    if (out) {
        out.innerHTML = "";
        out.style.display = "none";
    }
}

function analyzeTournamentInput() {
    const raw = document.getElementById("turnier_raw")?.value || "";
    const out = document.getElementById("turnier_result");
    if (!out) return;

    if (!raw.trim()) {
        out.innerHTML = `<p>Bitte Turnierdaten einfügen.</p>`;
        return;
    }

    const horse = {
        name: findName(raw) || "Vorschau (ohne Speichern)",
        leistungen: extractSkills(raw),
        interieur: extractInterior(raw)
    };

    if (!horse.leistungen || Object.keys(horse.leistungen).length === 0) {
        out.innerHTML = `<p>Keine Leistungswerte erkannt. Bitte einen MDR-Block mit Leistungsdaten einfügen.</p>`;
        return;
    }

    out.innerHTML = `
        <h3 style="margin-bottom: 8px;">🏆 Turnierwerte</h3>
        <p><b>${horse.name}</b> · nicht gespeichert</p>
        ${renderTournamentProfile(horse)}
    `;
}

function buildHorseFromRaw(rawText, roleLabel) {
    const name = findName(rawText) || `Eingabe ${roleLabel}`;
    const exterieur = parseExteriorLoose(rawText);
    const abstammung = extractPedigree(rawText);

    if (!Object.keys(exterieur).length) {
        return null;
    }

    return {
        name,
        geschlecht: roleLabel,
        abstammung,
        exterieur
    };
}

function buildHorseForInbreedingFromRaw(rawText, roleLabel) {
    const name = findName(rawText) || `Eingabe ${roleLabel}`;
    const abstammung = extractPedigree(rawText);

    if (!name) {
        return null;
    }

    return {
        name,
        geschlecht: roleLabel,
        abstammung
    };
}

function ensureBreedingInbreedingStatusElement() {
    let box = document.getElementById("breeding_inbreeding_status");
    if (box) return box;

    const zuchtCard = document.querySelector("#zucht .card");
    if (!zuchtCard) return null;

    box = document.createElement("div");
    box.id = "breeding_inbreeding_status";
    box.style.marginTop = "12px";
    box.style.padding = "10px 12px";
    box.style.borderRadius = "9px";
    box.style.border = "1px solid rgba(31,58,46,0.16)";
    box.style.background = "rgba(31,58,46,0.05)";
    box.style.color = "#244234";
    box.innerHTML = "<b>Inzucht-Check:</b> Bitte beide Eltern wählen oder Rohdaten einfügen.";

    const simulateButton = zuchtCard.querySelector("button.btn[onclick=\"simulateBreeding()\"]");
    if (simulateButton && simulateButton.parentNode) {
        simulateButton.insertAdjacentElement("afterend", box);
    } else {
        zuchtCard.appendChild(box);
    }

    return box;
}

function updateBreedingInbreedingStatus() {
    const box = ensureBreedingInbreedingStatusElement();
    if (!box) return;

    const mareRaw = document.getElementById("mare_raw")?.value?.trim() || "";
    const stallionRaw = document.getElementById("stallion_raw")?.value?.trim() || "";
    const mareFromDropdown = pferde[document.getElementById("mareSelect")?.value];
    const stallionFromDropdown = pferde[document.getElementById("stallionSelect")?.value];

    const mare = mareRaw ? buildHorseForInbreedingFromRaw(mareRaw, "Stute") : mareFromDropdown;
    const stallion = stallionRaw ? buildHorseForInbreedingFromRaw(stallionRaw, "Hengst") : stallionFromDropdown;

    if (!mare || !stallion) {
        box.style.border = "1px solid rgba(31,58,46,0.16)";
        box.style.background = "rgba(31,58,46,0.05)";
        box.style.color = "#244234";
        box.innerHTML = "<b>Inzucht-Check:</b> Bitte beide Eltern wählen oder Rohdaten einfügen.";
        return;
    }

    const inbreeding = getInbreedingRisk(mare, stallion);

    if (inbreeding.isRisk) {
        box.style.border = "1px solid rgba(198, 40, 40, 0.45)";
        box.style.background = "rgba(244, 67, 54, 0.16)";
        box.style.color = "#7f1d1d";
        box.innerHTML = `<b>Inzucht erkannt:</b> ${escapeHtml(inbreeding.reasons.join(" · "))}`;
        return;
    }

    box.style.border = "1px solid rgba(56, 142, 60, 0.35)";
    box.style.background = "rgba(76, 175, 80, 0.12)";
    box.style.color = "#1b5e20";
    box.innerHTML = "<b>Inzucht-Check:</b> Kein Hinweis für diese Paarung.";
}

function initBreedingInbreedingStatus() {
    ensureBreedingInbreedingStatusElement();

    const bind = (id, eventName = "change") => {
        const el = document.getElementById(id);
        if (!el || el.dataset.inbreedingBound === "1") return;
        el.addEventListener(eventName, updateBreedingInbreedingStatus);
        el.dataset.inbreedingBound = "1";
    };

    bind("mareSelect", "change");
    bind("stallionSelect", "change");
    bind("mare_raw", "input");
    bind("stallion_raw", "input");
}


/* =========================
   🧠 NAME
========================= */

function findName(text) {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("Jahre")) {
            return (lines[i - 1] || "").replace(/Ändern\??/gi, "").trim();
        }
    }
    return "";
}



/* Besitzer */

function findBesitzer(text) {

    const match = text.match(/Besitzer:\s*(.+)/i);

    return match ? match[1].trim() : "Unbekannt";
}

function normalizeHorseName(value) {
    return String(value || "")
        .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`´]/g, "")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\([^\)]*\)/g, " ")
    .replace(/\b[a-z]{1,4}\d{1,4}\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function findLineValueByLabels(text, labels) {
    for (const label of labels) {
        const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(`${escaped}\\s*[:\-]\\s*([^\n\r]+)`, "i");
        const match = pattern.exec(text);
        if (!match) continue;

        const value = (match[1] || "")
            .replace(/\s{2,}.*/, "")
            .replace(/\|.*/, "")
            .trim();

        if (value) {
            return value;
        }
    }

    return "";
}

function extractStammbaumSection(text) {
    const lines = text.split("\n");
    const startIndex = lines.findIndex((line) => /stammbaum/i.test(line));

    if (startIndex === -1) {
        return "";
    }

    const out = [];
    for (let i = startIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (/^(?:-\s*)?\[?\**exterieur\b/i.test(trimmed) || /horse_conformation/i.test(trimmed)) {
            break;
        }

        if (/^(?:-\s*)?\[?\**interieur\b/i.test(trimmed) || /horse_interiortest/i.test(trimmed)) {
            break;
        }

        out.push(trimmed);
    }

    return out.join("\n");
}

function extractPedigreeHorseNamesFromLinks(section) {
    const names = [];
    const seen = new Set();
    const regex = /\[([^\]]+)\]\((https?:\/\/[^\)]*site=pferd&id=\d+[^\)]*|[^\)]*site=pferd&id=\d+[^\)]*)\)/gi;

    let match;
    while ((match = regex.exec(section)) !== null) {
        const rawName = (match[1] || "").replace(/\*+/g, "").trim();
        if (!rawName) continue;

        const key = normalizeHorseName(rawName);
        if (!key || seen.has(key)) continue;

        seen.add(key);
        names.push(rawName);
    }

    return names;
}

function extractPedigreeHorseNamesFromPlainText(section) {
    const lines = section.split("\n").map((line) => line.trim()).filter(Boolean);
    const names = [];
    const seen = new Set();

    const pushName = (raw) => {
        const value = String(raw || "")
            .replace(/^stammbaum\s*/i, "")
            .replace(/\s*potential\s*:\s*\d+.*$/i, "")
            .trim();

        if (!value) return;
        if (/^(american\s+quarter\s+horse|potential\s*:|besitzhistorie|exterieur|interieur)$/i.test(value)) return;
        if (value.length < 3 || value.length > 80) return;

        const key = normalizeHorseName(value);
        if (!key || seen.has(key)) return;

        seen.add(key);
        names.push(value);
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const next = lines[i + 1] || "";

        if (/american\s+quarter\s+horse/i.test(next)) {
            pushName(line);
        }
    }

    // Fallback for compact copy/paste text where line breaks are partially lost.
    const compactRegex = /([^\n\r]{3,80}?)\s*American Quarter Horse/gi;
    let compactMatch;
    while ((compactMatch = compactRegex.exec(section)) !== null) {
        const raw = (compactMatch[1] || "").split(/\n|\r/).pop() || "";
        pushName(raw);
    }

    return names;
}

function extractPedigree(text) {
    const stammbaumSection = extractStammbaumSection(text);
    const linkedNames = extractPedigreeHorseNamesFromLinks(stammbaumSection);
    const plainNames = extractPedigreeHorseNamesFromPlainText(stammbaumSection);
    const ownNameKey = normalizeHorseName(findName(text));

    const allNames = [...linkedNames, ...plainNames];
    const uniqueNames = [];
    const uniqueKeys = new Set();

    for (const rawName of allNames) {
        const key = normalizeHorseName(rawName);
        if (!key || key === ownNameKey || uniqueKeys.has(key)) continue;
        uniqueKeys.add(key);
        uniqueNames.push(rawName);
    }

    const vaterByLabel = findLineValueByLabels(text, ["Vater", "Sire"]);
    const mutterByLabel = findLineValueByLabels(text, ["Mutter", "Dam"]);

    const vater = vaterByLabel || uniqueNames[0] || "";
    const mutter = mutterByLabel || uniqueNames[1] || "";

    const ahnen = uniqueNames.slice();
    if (vater && !ahnen.some((name) => normalizeHorseName(name) === normalizeHorseName(vater))) {
        ahnen.unshift(vater);
    }
    if (mutter && !ahnen.some((name) => normalizeHorseName(name) === normalizeHorseName(mutter))) {
        ahnen.splice(1, 0, mutter);
    }

    return {
        vater,
        mutter,
        ahnen
    };
}

function getPedigreeAncestorsWithinGenerations(horse, maxGenerations = 3) {
    const names = Array.isArray(horse?.abstammung?.ahnen) ? horse.abstammung.ahnen : [];
    const limitsByGeneration = [2, 6, 14]; // 1: parents, 2: +grandparents, 3: +great-grandparents
    const limit = limitsByGeneration[Math.max(0, Math.min(maxGenerations, 3)) - 1] || 0;

    const displayByKey = new Map();
    const ancestorKeys = [];

    for (const originalName of names.slice(0, limit)) {
        const key = normalizeHorseName(originalName);
        if (!key || key === "unbekannt") continue;
        if (!displayByKey.has(key)) {
            displayByKey.set(key, originalName);
            ancestorKeys.push(key);
        }
    }

    // Fallback for imports that only have labels without full ahnen list.
    if (!ancestorKeys.length) {
        for (const parentName of [horse?.abstammung?.vater, horse?.abstammung?.mutter]) {
            const key = normalizeHorseName(parentName);
            if (!key || key === "unbekannt" || displayByKey.has(key)) continue;
            displayByKey.set(key, parentName);
            ancestorKeys.push(key);
        }
    }

    return {
        ancestorSet: new Set(ancestorKeys),
        ancestorList: ancestorKeys,
        displayByKey
    };
}

function hasAncestorNameMatch(ancestorList, horseName) {
    const target = normalizeHorseName(horseName);
    if (!target) return false;

    for (const ancestor of ancestorList || []) {
        if (!ancestor) continue;
        if (ancestor === target) return true;

        // Fallback for remaining display/name variants after normalization.
        if ((ancestor.length >= 8 && ancestor.includes(target)) || (target.length >= 8 && target.includes(ancestor))) {
            return true;
        }
    }

    return false;
}

function getInbreedingRisk(mare, stallion, horses = pferde) {
    const mareName = normalizeHorseName(mare?.name);
    const stallionName = normalizeHorseName(stallion?.name);

    const empty = {
        isRisk: false,
        reasons: [],
        sharedAncestors: []
    };

    if (!mareName || !stallionName) {
        return empty;
    }

    const reasons = [];

    if (mareName === stallionName) {
        reasons.push("Gleiches Pferd");
    }

    const mareParents = [mare?.abstammung?.vater, mare?.abstammung?.mutter]
        .map(normalizeHorseName)
        .filter(Boolean);
    const stallionParents = [stallion?.abstammung?.vater, stallion?.abstammung?.mutter]
        .map(normalizeHorseName)
        .filter(Boolean);

    if (mareParents.includes(stallionName)) {
        reasons.push("Hengst ist direkter Elternteil der Stute");
    }

    if (stallionParents.includes(mareName)) {
        reasons.push("Stute ist direkter Elternteil des Hengstes");
    }

    // For foal inbreeding checks we only use:
    // foal, parents, grandparents, great-grandparents.
    // Therefore, per parent horse we only include 2 ancestor generations.
    const MAX_GENERATIONS = 2;
    const marePedigree = getPedigreeAncestorsWithinGenerations(mare, MAX_GENERATIONS);
    const stallionPedigree = getPedigreeAncestorsWithinGenerations(stallion, MAX_GENERATIONS);
    const mareAncestors = marePedigree.ancestorSet;
    const stallionAncestors = stallionPedigree.ancestorSet;

    const sharedAncestors = [...mareAncestors].filter((name) => stallionAncestors.has(name));

    if (mareAncestors.has(stallionName) || hasAncestorNameMatch(marePedigree.ancestorList, stallion?.name)) {
        reasons.push("Hengst steht im Stammbaum der Stute");
    }

    if (stallionAncestors.has(mareName) || hasAncestorNameMatch(stallionPedigree.ancestorList, mare?.name)) {
        reasons.push("Stute steht im Stammbaum des Hengstes");
    }

    if (sharedAncestors.length) {
        const prettyNames = sharedAncestors
            .slice(0, 4)
            .map((key) => marePedigree.displayByKey.get(key) || stallionPedigree.displayByKey.get(key) || key);
        const suffix = sharedAncestors.length > 4 ? " ..." : "";
        reasons.push(`Gemeinsame Vorfahren: ${prettyNames.join(", ")}${suffix}`);
    }

    const uniqueReasons = Array.from(new Set(reasons));

    return {
        isRisk: uniqueReasons.length > 0,
        reasons: uniqueReasons,
        sharedAncestors
    };
}

/* =========================
   🚻 GESCHLECHT
========================= */

function findGeschlecht(text) {
    const match = text.match(/Stute|Hengst|Wallach/);
    return match ? match[0] : "Unbekannt";
}

function normalizeOwner(value) {
    const owner = (value || "").trim();
    return owner || "Unbekannt";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}


/* =========================
   ⭐ GP
========================= */

function findGP(text) {
    const m = text.match(/Gesamtpotenzial:\s*(\d+)/i);
    return m ? Number(m[1]) : 0;
}


/* =========================
   🧠 INTERIEUR
========================= */

function mapInterior(text) {
    text = text.toLowerCase();

    if (text.includes("exzellent")) return 1;
    if (text.includes("gut")) return 2;
    if (text.includes("in ordnung")) return 3;
    if (text.includes("schlecht")) return 4;
    if (text.includes("miserabel")) return 5;

    return 0;
}

function extractInterior(text) {

    const lines = text.split("\n");
    let capture = false;
    let result = {};
    const interiorTraits = [
        "Temperament",
        "Gelehrigkeit",
        "Leistungsbereitschaft",
        "Aufmerksamkeit",
        "Gutmütigkeit",
        "Nervenstärke",
        "Intelligenz",
        "Siegeswille",
        "Furchtlosigkeit",
        "Sozialverhalten"
    ];

    for (let line of lines) {

        line = line.trim();

        if (line.includes("Interieur")) capture = true;
        if (capture && line.includes("Exterieur")) break;
        if (!capture) continue;

        const parts = line.split(/\t+|\s{2,}/g);
        if (parts.length < 2) continue;

        const key = parts[0];
        const value = mapInterior(parts.slice(1).join(" "));

        if (!interiorTraits.includes(key)) continue;

        if (key && value) result[key] = value;
    }

    // Fallback for compact MDR blocks where Interieur is pasted as one long line.
    if (Object.keys(result).length === 0) {
        for (const trait of interiorTraits) {
            const pattern = new RegExp(`${trait}\\s*(exzellent|gut|in ordnung|schlecht|miserabel)`, "i");
            const match = pattern.exec(text);
            if (!match) continue;
            const mapped = mapInterior(match[1]);
            if (mapped) {
                result[trait] = mapped;
            }
        }
    }

    return result;
}

function calculateInteriorAverage(obj) {
    const vals = Object.values(obj).filter(v => v > 0);
    if (!vals.length) return "0.00";
    return (vals.reduce((a,b)=>a+b,0) / vals.length).toFixed(2);
}


/* =========================
   🧬 EXTERIEUR (SAFE + GEN-SPEICHER)
========================= */

function parseExterior(text) {

    const geneResult = extractExteriorGenesAnyBlock(text);
    if (Object.keys(geneResult).length > 0) {
        return geneResult;
    }

    return parseExteriorFromText(text);
}

function extractExteriorGenesAnyBlock(text) {
    const lines = text.split("\n");
    const result = {};

    for (let rawLine of lines) {
        const line = rawLine.trim();
        if (!line || !line.includes("|")) continue;

        const [leftRaw, rightRaw] = line.split("|");
        if (!leftRaw || !rightRaw) continue;

        const leftParts = leftRaw.trim().split(/\s+/);
        const rightParts = rightRaw.trim().split(/\s+/);
        if (leftParts.length < 2 || rightParts.length < 1) continue;

        const key = leftParts[0];
        const leftGenes = leftParts.slice(1, 5);
        const rightGenes = rightParts.slice(0, 4);
        const genes = [...leftGenes, ...rightGenes];

        if (!key || genes.length < 8) continue;

        result[key] = {
            score: evaluateExteriorFixed(leftGenes, rightGenes),
            genes: genes.slice(0, 8)
        };
    }

    return result;
}

const EXTERIOR_TEXT_TRAITS = [
    { key: "Kopf", aliases: ["kopf"] },
    { key: "Halsansatz", aliases: ["halsansatz"] },
    { key: "Widerist", aliases: ["widerist"] },
    { key: "Schultern", aliases: ["schultern", "schulter"] },
    { key: "Brust", aliases: ["brust"] },
    { key: "Rückenlänge", aliases: ["ruckenlange", "rueckenlaenge", "ruckenlaenge"] },
    { key: "Kruppe", aliases: ["kruppe"] },
    { key: "Beinwinkelung", aliases: ["beinwinkelung"] },
    { key: "Fesseln", aliases: ["fesseln", "fessel"] },
    { key: "Hufen", aliases: ["hufen", "huf"] },
    { key: "Gebiss", aliases: ["gebiss"] },
    { key: "Hals", aliases: ["hals"] },
    { key: "Rückenlinie", aliases: ["ruckenlinie", "rueckenlinie"] },
    { key: "Beinstellung", aliases: ["beinstellung"] }
];

function normalizeExteriorText(value) {
    return (value || "")
        .toLowerCase()
        .replace(/[äÄ]/g, "ae")
        .replace(/[öÖ]/g, "oe")
        .replace(/[üÜ]/g, "ue")
        .replace(/[ß]/g, "ss")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function mapExteriorTextScore(label) {
    const n = normalizeExteriorText(label);
    if (!n) return null;

    if (/nicht\s+getestet|ungetestet|nicht\s+bewertet|k\s*a/.test(n)) return 0;

    const hasVielZu = /\bviel\s+zu\b/.test(n);
    const hasZu = /\bzu\b/.test(n);

    if (/(exzellent|exzel+ent|excellent)/.test(n)) return 1;
    if (/\bgut\b|\bguter\b|\bgute\b/.test(n)) return 2;
    if (/passabel|passabl/.test(n)) return 3;

    if (/\b(starker|starke|starkes|starken|stark)\b/.test(n)) return 5;
    if (hasVielZu) return 5;
    if (/\b(hirschhals|speckhals|zehenweit|zeheneng)\b/.test(n)) return 5;

    if (/\b(kurzer, dicker hals|kurzer dicker)\b/.test(n)) return 4;
    if (/\b(ueberbiss|unterbiss|schwanenhals|karpfenruecken|senkruecken|bodenweit|bodeneng)\b/.test(n)) return 4;
    if (hasZu && !hasVielZu) return 4;

    return null;
}

function extractExteriorTextSection(text) {
    const lines = text.split("\n");
    let startIndex = lines.findIndex((line) => /exterieur\s*nach\s*text/i.test(line));

    // Some imports contain multiple exterieur headings; prefer the lower block.
    if (startIndex === -1) {
        const plainIndexes = lines
            .map((line, index) => (/^\s*exterieur\b/i.test(line) ? index : -1))
            .filter(index => index !== -1);

        if (plainIndexes.length) {
            startIndex = plainIndexes[plainIndexes.length - 1];
        }
    }

    if (startIndex === -1) {
        return text;
    }

    const collected = [];

    const inlineStart = (lines[startIndex] || "")
        .replace(/^\s*exterieur(?:\s*nach\s*text)?\s*/i, "")
        .trim();

    if (inlineStart) {
        collected.push(inlineStart);
    }

    for (let i = startIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (/^(interieur|farben|leistungen|leistung|turnier|genetik|zuchtwert|abstammung|charakter)\b/i.test(trimmed)) {
            break;
        }

        collected.push(line);
    }

    return collected.join("\n");
}

function resolveExteriorTraitKey(label) {
    const normalized = normalizeExteriorText(label);
    if (!normalized) return null;

    for (const trait of EXTERIOR_TEXT_TRAITS) {
        if (trait.aliases.some(alias => normalized === alias)) {
            return trait.key;
        }
    }

    return null;
}

function parseExteriorFromText(text) {
    const section = extractExteriorTextSection(text);
    const result = {};

    // Handles compact imports like: Exterieur **Kopf**Nicht getestet**Gebiss**Nicht getestet
    const inlineSection = section.replace(/\r/g, " ").replace(/\n+/g, " ");
    const compactMatches = Array.from(inlineSection.matchAll(/\*\*([^*]+)\*\*\s*([^*\n]+)/g));

    for (const match of compactMatches) {
        const traitKey = resolveExteriorTraitKey(match[1] || "");
        if (!traitKey || result[traitKey]) continue;

        const label = (match[2] || "").trim();
        const score = mapExteriorTextScore(label);

        if (score !== null) {
            result[traitKey] = { score, label };
        }
    }

    const lines = section.split("\n").map((line) => line.trim()).filter(Boolean);

    for (const trait of EXTERIOR_TEXT_TRAITS) {
        if (result[trait.key]) continue;

        for (const line of lines) {
            const normalizedLine = normalizeExteriorText(line);
            const alias = trait.aliases.find((a) => normalizedLine.startsWith(`${a} `) || normalizedLine === a);
            if (!alias) continue;

            const remainder = line.slice(alias.length).replace(/^\s*[:\-]\s*/, "").trim();
            const score = mapExteriorTextScore(remainder || line);

            if (score !== null) {
                result[trait.key] = {
                    score,
                    label: remainder || line
                };
            }
            break;
        }
    }

    return result;
}

function parseExteriorLoose(text) {
    const parsed = parseExterior(text);
    if (Object.keys(parsed).length > 0) return parsed;

    // Fallback: allow pasting only raw exterieur rows without header blocks.
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const result = {};

    for (const line of lines) {
        if (!line.includes("|")) continue;

        const [left, right] = line.split("|");
        if (!left || !right) continue;

        const leftParts = left.trim().split(/\s+/);
        const rightParts = right.trim().split(/\s+/);
        if (leftParts.length < 2 || rightParts.length < 1) continue;

        const key = leftParts[0];
        const leftGenes = leftParts.slice(1);
        const genes = [...leftGenes, ...rightParts];

        if (genes.length < 8) continue;

        result[key] = {
            score: evaluateExteriorFixed(genes.slice(0, 4), genes.slice(4, 8)),
            genes: genes.slice(0, 8)
        };
    }

    return result;
}

function analyzeExteriorInput() {
    const raw = document.getElementById("exterieur_raw")?.value || "";
    const out = document.getElementById("exterieur_result");
    if (!out) return;

    if (!raw.trim()) {
        out.innerHTML = "";
        out.style.display = "none";
        return;
    }

    out.style.display = "block";

    const exterieur = parseExteriorLoose(raw);
    const keys = Object.keys(exterieur);

    if (!keys.length) {
        out.innerHTML = `<p>Keine gültigen Exterieur-Daten erkannt. Du kannst Genzeilen mit "|" oder den Block "Exterieur nach Text" einfügen.</p>`;
        return;
    }

    const avg = calculateExteriorAverage(exterieur);
    let totalHits = 0;
    let totalSlots = 0;

    for (const key of keys) {
        const genes = (exterieur[key]?.genes || []).slice(0, 8);
        if (genes.length < 8) continue;

        const left = genes.slice(0, 4);
        const right = genes.slice(4, 8);

        const leftHits = left.filter((g) => g === "HH" || g === "Hh" || g === "hH").length;
        const rightHits = right.filter((g) => g === "hh").length;

        totalHits += leftHits + rightHits;
        totalSlots += 8;
    }

    const hitPercent = totalSlots ? ((totalHits / totalSlots) * 100).toFixed(1) : "0.0";

    const rows = keys.map((key) => {
        const item = exterieur[key];
        const style = getExteriorScoreStyle(item.score);
        const genesText = (item.genes || []).join(" ");
        const detailText = genesText || item.label || "Textbewertung";

        return `
            <div style="margin-top: 10px; padding: 9px 10px; border: 1px solid ${style.border}; border-radius: 8px; background: #fffdf9; display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1; font-size: 0.9em; color: #465047; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${style.dot};"></span>
                    <b>${key}</b>
                    <span>${detailText}</span>
                </div>
                <div style="width:56px; text-align:center; font-size: 0.88em; color: #5a665f; flex-shrink:0;">(${item.score})</div>
            </div>
        `;
    }).join("");

    const hitInfo = totalSlots
        ? ` · <b>Treffer:</b> ${totalHits}/${totalSlots} (${hitPercent}%)`
        : ` · <b>Treffer:</b> Textmodus`;

    out.innerHTML = `
        <h3 style="margin-bottom: 8px;">Detailauswertung Exterieur</h3>
        <div style="display:flex; align-items:center; margin: 0 0 6px 0; font-size:0.85em; color:#5a665f;">
            <div style="flex:1;"><b>Ø:</b> ${avg}${hitInfo}</div>
            <div style="width:56px; text-align:center;"><b>Pkt</b></div>
        </div>
        ${rows}
    `;
}


/* =========================
   🧬 EXTERIEUR LOGIK (1–5)
========================= */

function evaluateExteriorFixed(left, right) {

    let frontGood = 0;
    let backGood = 0;

    for (let g of left) {
        if (g === "HH" || g === "Hh" || g === "hH") frontGood++;
    }

    for (let g of right) {
        if (g === "hh") backGood++;
    }

    const frontDeviation = 4 - frontGood;
    const backDeviation = 4 - backGood;

    const worstDeviation = Math.max(frontDeviation, backDeviation);

    if (worstDeviation <= 0) return 1;
    if (worstDeviation === 1) return 2;
    if (worstDeviation === 2) return 3;
    if (worstDeviation === 3) return 4;
    return 5;
}


/* =========================
   📊 EXTERIEUR Ø (ROBUST)
========================= */

function calculateExteriorAverage(obj) {

    const vals = Object.values(obj)
        .map(v => {
            if (typeof v === "number") return v;
            if (v && typeof v.score === "number") return v.score;
            return null;
        })
        .filter(v => v !== null);

    if (!vals.length) return "0.00";

    return (vals.reduce((a,b)=>a+b,0) / vals.length).toFixed(2);
}


/* =========================
   🧬 ZUCHT SYSTEM
========================= */

function populateBreedingDropdowns() {

    const mare = document.getElementById("mareSelect");
    const stallion = document.getElementById("stallionSelect");
    const colorMare = document.getElementById("colorMareSelect");
    const colorStallion = document.getElementById("colorStallionSelect");

    if (!mare || !stallion) return;

    mare.innerHTML = "";
    stallion.innerHTML = "";
    if (colorMare) colorMare.innerHTML = "";
    if (colorStallion) colorStallion.innerHTML = "";

    pferde.forEach((p, i) => {

        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = p.name;

        if (p.geschlecht === "Stute") {
            mare.appendChild(opt);
            if (colorMare) colorMare.appendChild(opt.cloneNode(true));
        }
        if (p.geschlecht === "Hengst") {
            stallion.appendChild(opt.cloneNode(true));
            if (colorStallion) colorStallion.appendChild(opt.cloneNode(true));
        }
    });

}



/* =========================
   🧬 ZUCHT SYSTEM (FOHLEN)
*/

function getAlleleOptions(gen) {
    return new Set([
        gen[0],
        gen[1]
    ]);
}

function normalizeGenePair(pair) {
    if (pair === "HH") return "HH";
    if (pair === "hh") return "hh";
    return "Hh";
}

function getPossibleChildGenes(mareGene, stallionGene) {
    const mA = getAlleleOptions(mareGene);
    const sA = getAlleleOptions(stallionGene);
    const out = new Set();

    for (const ma of mA) {
        for (const sa of sA) {
            out.add(normalizeGenePair(ma + sa));
        }
    }

    return out;
}

function chooseBestWorstGene(possibleGenes, isFrontPart) {
    const rankFront = { "HH": 2, "Hh": 2, "hh": 0 };
    const rankBack = { "HH": 0, "Hh": 1, "hh": 2 };
    const rank = isFrontPart ? rankFront : rankBack;

    const genes = Array.from(possibleGenes);

    let best = genes[0] || "hh";
    let worst = genes[0] || "hh";

    for (const g of genes) {
        if (rank[g] > rank[best]) best = g;
        if (rank[g] < rank[worst]) worst = g;
    }

    return { best, worst };
}

function summarizePositionMatches(genes) {
    let frontCorrect = 0;
    let backCorrect = 0;

    genes.forEach((g, i) => {
        if (i < 4) {
            if (g === "HH" || g === "Hh") frontCorrect++;
        } else {
            if (g === "hh") backCorrect++;
        }
    });

    return {
        frontCorrect,
        backCorrect,
        totalCorrect: frontCorrect + backCorrect
    };
}

function countGeneDistribution(genes) {
    return genes.reduce((acc, g) => {
        acc[g] = (acc[g] || 0) + 1;
        return acc;
    }, { HH: 0, Hh: 0, hh: 0 });
}

function getExteriorScoreStyle(score) {
    const styles = {
        1: { border: "rgba(33, 150, 243, 0.45)", dot: "#2196f3" },
        2: { border: "rgba(76, 175, 80, 0.45)", dot: "#4caf50" },
        3: { border: "rgba(207, 201, 21, 0.48)", dot: "#f2e14c" },
        4: { border: "rgba(255, 81, 0, 0.45)", dot: "#ff7300" },
        5: { border: "rgba(183, 28, 28, 0.45)", dot: "#b71c1c" }
    };

    return styles[score] || { border: "rgba(31,58,46,0.2)", dot: "#8a948e" };
}

function calculateExteriorRange(mare, stallion) {

    const keys = Object.keys(mare.exterieur);

    let bestScoreTotal = 0;
    let worstScoreTotal = 0;
    let bestCorrectTotal = 0;
    let worstCorrectTotal = 0;
    const partDetails = [];

    for (let key of keys) {

        const m = mare.exterieur[key]?.genes || [];
        const s = stallion.exterieur[key]?.genes || [];

        let bestGenes = [];
        let worstGenes = [];

        for (let i = 0; i < 8; i++) {

            const g1 = m[i];
            const g2 = s[i];

            if (!g1 || !g2) continue;

            const possibleGenes = getPossibleChildGenes(g1, g2);
            const selection = chooseBestWorstGene(possibleGenes, i < 4);

            bestGenes.push(selection.best);
            worstGenes.push(selection.worst);
        }

        const bestScore = evaluateExteriorFixed(
            bestGenes.slice(0, 4),
            bestGenes.slice(4, 8)
        );

        const worstScore = evaluateExteriorFixed(
            worstGenes.slice(0, 4),
            worstGenes.slice(4, 8)
        );

        const bestMatch = summarizePositionMatches(bestGenes);
        const worstMatch = summarizePositionMatches(worstGenes);
        const bestDist = countGeneDistribution(bestGenes);
        const worstDist = countGeneDistribution(worstGenes);

        bestScoreTotal += bestScore;
        worstScoreTotal += worstScore;
        bestCorrectTotal += bestMatch.totalCorrect;
        worstCorrectTotal += worstMatch.totalCorrect;

        partDetails.push({
            key,
            best: {
                score: bestScore,
                genes: bestGenes,
                match: bestMatch,
                dist: bestDist
            },
            worst: {
                score: worstScore,
                genes: worstGenes,
                match: worstMatch,
                dist: worstDist
            }
        });
    }

    const count = keys.length;
    const totalSlots = count * 8;

    const bestCorrectPercent = totalSlots
        ? ((bestCorrectTotal / totalSlots) * 100).toFixed(1)
        : "0.0";

    const worstCorrectPercent = totalSlots
        ? ((worstCorrectTotal / totalSlots) * 100).toFixed(1)
        : "0.0";

    return {
        best: (bestScoreTotal / count).toFixed(2),
        worst: (worstScoreTotal / count).toFixed(2),
        parts: partDetails,
        bestCorrectPercent,
        worstCorrectPercent,
        bestCorrectTotal,
        worstCorrectTotal,
        totalSlots
    };
}
function simulateBreeding() {
    const mareRaw = document.getElementById("mare_raw")?.value?.trim() || "";
    const stallionRaw = document.getElementById("stallion_raw")?.value?.trim() || "";

    const mareFromDropdown = pferde[document.getElementById("mareSelect").value];
    const stallionFromDropdown = pferde[document.getElementById("stallionSelect").value];

    const mare = mareRaw ? buildHorseFromRaw(mareRaw, "Stute") : mareFromDropdown;
    const stallion = stallionRaw ? buildHorseFromRaw(stallionRaw, "Hengst") : stallionFromDropdown;

    if (!mare || !stallion) {
        alert("Bitte Eltern auswählen oder gültige Rohdaten für Stute/Hengst einfügen!");
        return;
    }

    if (!mare.exterieur || !stallion.exterieur || !Object.keys(mare.exterieur).length || !Object.keys(stallion.exterieur).length) {
        alert("Exterieurdaten für beide Eltern werden benötigt.");
        return;
    }

    const inbreeding = getInbreedingRisk(mare, stallion);

    if (inbreeding.isRisk) {
        const reasonText = inbreeding.reasons.join(" · ");
        document.getElementById("breeding_result").innerHTML = `
            <h2>Exterieur Potenzial</h2>
            <div style="margin: 10px 0 12px; padding: 10px 12px; border: 1px solid rgba(198, 40, 40, 0.35); border-radius: 9px; background: rgba(244, 67, 54, 0.08); color: #7f1d1d;">
                <b>Verpaarung blockiert (Inzucht):</b> ${escapeHtml(reasonText)}
            </div>
        `;
        return;
    }

    const range = calculateExteriorRange(mare, stallion);

    const partBlocks = (range.parts || []).map(part => {
        const bestGenes = part.best.genes.join(" ");
        const worstGenes = part.worst.genes.join(" ");
        const bestStyle = getExteriorScoreStyle(part.best.score);
        const worstStyle = getExteriorScoreStyle(part.worst.score);

        return `
            <div style="margin-top: 12px; padding: 10px; border: 1px solid rgba(31,58,46,0.14); border-radius: 10px; background: #fffdf9;">
                <h4 style="margin: 0 0 8px 0; color: #244234;">${part.key}</h4>
                <div style="font-size: 0.9em; margin-bottom: 6px; color: #36443d; border: 1px solid ${bestStyle.border}; border-radius: 7px; padding: 4px 6px; background: rgba(255,255,255,0.45);">
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${bestStyle.dot}; margin-right:6px; vertical-align:middle;"></span>
                    <b>Best:</b> ${bestGenes} (${part.best.match.totalCorrect}/8)
                </div>
                <div style="font-size: 0.9em; color: #36443d; border: 1px solid ${worstStyle.border}; border-radius: 7px; padding: 4px 6px; background: rgba(255,255,255,0.45);">
                    <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${worstStyle.dot}; margin-right:6px; vertical-align:middle;"></span>
                    <b>Worst:</b> ${worstGenes} (${part.worst.match.totalCorrect}/8)
                </div>
            </div>
        `;
    }).join("");

    document.getElementById("breeding_result").innerHTML = `
        <h2>Exterieur Potenzial</h2>
        <p><b>Best Case:</b> ${range.best} · Treffer ${range.bestCorrectTotal}/${range.totalSlots} (${range.bestCorrectPercent}%)</p>
        <p><b>Worst Case:</b> ${range.worst} · Treffer ${range.worstCorrectTotal}/${range.totalSlots} (${range.worstCorrectPercent}%)</p>
        ${partBlocks}
    `;
}






/* =========================
   🎨 FARBEN
========================= */

function extractAlleles(text) {

    const lines = text.split("\n");

    let capture = false;
    let out = [];

    for (let l of lines) {
        if (l.includes("Farben")) capture = true;
        if (capture && l.includes("Exterieur")) break;
        if (capture) out.push(l.trim());
    }

    return out.join(" ");
}

function resetColorInput() {
    const mareRaw = document.getElementById("color_mare_raw");
    const stallionRaw = document.getElementById("color_stallion_raw");
    const out = document.getElementById("color_result");

    if (mareRaw) mareRaw.value = "";
    if (stallionRaw) stallionRaw.value = "";
    if (out) out.innerHTML = `<p>Noch keine Farbanalyse gestartet.</p>`;
}

function resetColorRaw(type) {
    const fieldId = type === "stallion" ? "color_stallion_raw" : "color_mare_raw";
    const field = document.getElementById(fieldId);
    if (field) field.value = "";
}

function toggleParentInputMode(scope, mode) {
    const isBreeding = scope === "breeding";
    const savedPanel = document.getElementById(isBreeding ? "breedingSavedPanel" : "colorSavedPanel");
    const directPanel = document.getElementById(isBreeding ? "breedingDirectPanel" : "colorDirectPanel");
    const savedBtn = document.getElementById(isBreeding ? "breedingModeSavedBtn" : "colorModeSavedBtn");
    const directBtn = document.getElementById(isBreeding ? "breedingModeDirectBtn" : "colorModeDirectBtn");

    if (!savedPanel || !directPanel || !savedBtn || !directBtn) return;

    const savedMode = mode !== "direct";

    savedPanel.style.display = savedMode ? "block" : "none";
    directPanel.style.display = savedMode ? "none" : "block";

    savedBtn.classList.toggle("active", savedMode);
    directBtn.classList.toggle("active", !savedMode);
}

function initColorTools() {
    const analyzeBtn = document.getElementById("colorAnalyzeBtn");
    const resetBtn = document.getElementById("colorResetBtn");

    if (analyzeBtn && analyzeBtn.dataset.boundColor !== "1") {
        analyzeBtn.addEventListener("click", analyzeColorInput);
        analyzeBtn.dataset.boundColor = "1";
    }

    if (resetBtn && resetBtn.dataset.boundColor !== "1") {
        resetBtn.addEventListener("click", resetColorInput);
        resetBtn.dataset.boundColor = "1";
    }
}

function normalizeColorToken(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/[äÄ]/g, "ae")
        .replace(/[öÖ]/g, "oe")
        .replace(/[üÜ]/g, "ue")
        .replace(/[ß]/g, "ss")
        .replace(/[^a-z0-9+]/g, "")
        .trim();
}

function canonicalizeAgouti(token) {
    const t = normalizeColorToken(token);
    if (!t) return null;
    if (t === "ap" || t === "a+") return "Ap";
    if (t === "a1" || t === "a") return "A1";
    if (t === "at") return "At";
    if (t === "a0" || t === "aa") return "a0";
    return null;
}

function canonicalizeGeneToken(token, geneKey) {
    const raw = String(token || "").trim();
    if (!raw) return null;

    if (geneKey === "agouti") return canonicalizeAgouti(raw);

    if (geneKey === "extension") {
        if (raw === "E") return "E";
        if (raw === "e") return "e";
        return null;
    }

    if (geneKey === "cream") {
        if (raw === "Cr") return "Cr";
        if (raw === "cr") return "cr";
        return null;
    }

    if (geneKey === "dun") {
        if (raw === "D") return "D";
        if (raw === "d") return "d";
        return null;
    }

    if (geneKey === "silver") {
        if (raw === "Z") return "Z";
        if (raw === "z") return "z";
        return null;
    }

    if (geneKey === "grey") {
        if (raw === "G") return "G";
        if (raw === "g") return "g";
        return null;
    }

    if (geneKey === "champagne") {
        if (raw === "Ch") return "Ch";
        if (raw === "ch") return "ch";
        return null;
    }

    if (geneKey === "sooty") {
        if (raw === "Sty") return "Sty";
        if (raw === "sty") return "sty";
        return null;
    }

    if (geneKey === "flaxen") {
        if (raw === "F") return "F";
        if (raw === "f") return "f";
        return null;
    }

    if (geneKey === "pearl") {
        if (raw === "Pl") return "Pl";
        if (raw === "pl") return "pl";
        return null;
    }

    if (geneKey === "pangare") {
        if (raw === "Pa") return "Pa";
        if (raw === "pa") return "pa";
        return null;
    }

    if (geneKey === "overo") {
        if (raw === "Ov") return "Ov";
        if (raw === "ov") return "ov";
        return null;
    }

    if (geneKey === "splashed") {
        if (raw === "Spl") return "Spl";
        if (raw === "spl") return "spl";
        return null;
    }

    if (geneKey === "rabicano") {
        if (raw === "Rb") return "Rb";
        if (raw === "rb") return "rb";
        return null;
    }

    if (geneKey === "leopard") {
        if (raw === "Lp") return "Lp";
        if (raw === "lp") return "lp";
        return null;
    }

    if (geneKey === "patn1") {
        if (raw === "PATN1") return "PATN1";
        if (raw === "patn1") return "patn1";
        return null;
    }

    if (geneKey === "tobiano") {
        if (raw === "To") return "To";
        if (raw === "to") return "to";
        return null;
    }

    if (geneKey === "sabino") {
        if (raw === "Sb") return "Sb";
        if (raw === "sb") return "sb";
        return null;
    }

    if (geneKey === "white") {
        if (raw === "W") return "W";
        if (raw === "w") return "w";
        return null;
    }

    if (geneKey === "roan") {
        if (raw === "Rn") return "Rn";
        if (raw === "rn") return "rn";
        return null;
    }

    return null;
}

function extractCompactGeneValues(text) {
    const map = {};
    const source = String(text || "");

    // Format A: **Gene**Value
    const markdownPattern = /\*\*([^*]+)\*\*\s*([^*\n\r]+)/g;
    let match;
    while ((match = markdownPattern.exec(source)) !== null) {
        const key = normalizeColorToken(match[1]);
        const value = (match[2] || "").trim();
        if (!key || !value) continue;
        map[key] = value;
    }

    // Format B: plain MDR section, often compacted like
    // FarbenFellfarbe: WildbayExtensionEeAgoutia0ApDundd...
    const labelDefs = [
        { key: "fellfarbe", label: "Fellfarbe" },
        { key: "extension", label: "Extension" },
        { key: "agouti", label: "Agouti" },
        { key: "dun", label: "Dun" },
        { key: "cream", label: "Cream" },
        { key: "champagne", label: "Champagne" },
        { key: "grey", label: "Grey" },
        { key: "kit", label: "KIT" },
        { key: "silver", label: "Silver" },
        { key: "pearl", label: "Pearl" },
        { key: "pangare", label: "Pangare" },
        { key: "rabicano", label: "Rabicano" },
        { key: "roan", label: "Roan" },
        { key: "tobiano", label: "Tobiano" },
        { key: "sabino", label: "Sabino" },
        { key: "white", label: "White" },
        { key: "overo", label: "Overo" },
        { key: "splashed", label: "Splashed" },
        { key: "appaloosa", label: "Appaloosa" },
        { key: "patn1", label: "PATN1" },
        { key: "patn2", label: "PATN2" },
        { key: "sooty", label: "Sooty" },
        { key: "flaxen", label: "Flaxen" }
    ];

    const farbenStart = source.search(/farben/i);
    const rawScope = farbenStart >= 0 ? source.slice(farbenStart) : source;

    // Trim at common next sections to avoid huge irrelevant tails.
    const stopAt = rawScope.search(/(exterieur|interieur|leistung|zucht|nachkommen|turniere)\b/i);
    const scope = stopAt > 0 ? rawScope.slice(0, stopAt) : rawScope;

    const labelAlternation = labelDefs.map((d) => d.label).join("|");
    const plainPattern = new RegExp(`(${labelAlternation})\\s*:?\\s*([\\s\\S]*?)(?=(?:${labelAlternation})\\s*:?|$)`, "gi");

    while ((match = plainPattern.exec(scope)) !== null) {
        const labelRaw = (match[1] || "").trim();
        const valueRaw = (match[2] || "").trim();
        const key = normalizeColorToken(labelRaw);
        if (!key || !valueRaw) continue;

        // Limit noisy captures to first meaningful token sequence.
        const cleaned = valueRaw
            .replace(/\s{2,}.*/, "")
            .replace(/^[^A-Za-z0-9]+/, "")
            .trim();

        if (cleaned) {
            map[key] = cleaned;
        }
    }

    return map;
}

function isGeneUntested(value) {
    const n = normalizeColorToken(value);
    return !n || n.includes("nichtgetestet") || n === "-";
}

function parseCompactPair(value, geneKey) {
    if (!value || isGeneUntested(value)) return null;

    const raw = String(value).trim();
    const compact = raw.replace(/\s+/g, "");

    let match = null;

    if (geneKey === "extension") {
        match = /^([Ee])\/?([Ee])$/.exec(compact);
    }

    if (geneKey === "dun") {
        match = /^([Dd])\/?([Dd])$/.exec(compact);
    }

    if (geneKey === "silver") {
        match = /^([Zz])\/?([Zz])$/.exec(compact);
    }

    if (geneKey === "grey") {
        match = /^([Gg])\/?([Gg])$/.exec(compact);
    }

    if (geneKey === "flaxen") {
        match = /^([Ff])\/?([Ff])$/.exec(compact);
    }

    if (geneKey === "cream") {
        match = /^(Cr|cr)\/?(Cr|cr)$/.exec(compact);
    }

    if (geneKey === "champagne") {
        match = /^(Ch|ch)\/?(Ch|ch)$/.exec(compact);
    }

    if (geneKey === "sooty") {
        match = /^(Sty|sty)\/?(Sty|sty)$/.exec(compact);
    }

    if (geneKey === "agouti") {
        match = /^(Ap|A1|At|a0)\/?(Ap|A1|At|a0)$/i.exec(compact);
    }

    if (geneKey === "pearl") {
        match = /^(Pl|pl)\/?(Pl|pl)$/.exec(compact);
    }

    if (geneKey === "pangare") {
        match = /^(Pa|pa)\/?(Pa|pa)$/.exec(compact);
    }

    if (geneKey === "overo") {
        match = /^(Ov|ov)\/?(Ov|ov)$/.exec(compact);
    }

    if (geneKey === "splashed") {
        match = /^(Spl|spl)\/?(Spl|spl)$/.exec(compact);
    }

    if (geneKey === "rabicano") {
        match = /^(Rb|rb)\/?(Rb|rb)$/.exec(compact);
    }

    if (geneKey === "leopard") {
        match = /^(Lp|lp)\/?(Lp|lp)$/.exec(compact);
    }

    if (geneKey === "patn1") {
        match = /^(PATN1|patn1)\/?(PATN1|patn1)$/.exec(compact);
    }

    if (geneKey === "tobiano") {
        match = /^(To|to)\/?(To|to)$/.exec(compact);
    }

    if (geneKey === "sabino") {
        match = /^(Sb|sb)\/?(Sb|sb)$/.exec(compact);
    }

    if (geneKey === "white") {
        match = /^(W|w)\/?(W|w)$/.exec(compact);
    }

    if (geneKey === "roan") {
        match = /^(Rn|rn)\/?(Rn|rn)$/.exec(compact);
    }

    if (!match) return null;

    const a = canonicalizeGeneToken(match[1], geneKey);
    const b = canonicalizeGeneToken(match[2], geneKey);
    if (!a || !b) return null;

    return [a, b];
}

function parsePairForGene(text, geneKey) {
    const raw = String(text || "");
    const compact = raw.replace(/\s+/g, " ");
    const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const compactGenes = extractCompactGeneValues(raw);

    const defs = {
        extension: ["extension", "ext", "e/e", "e ", " e"],
        agouti: ["agouti", "a1", "ap", "at", "a0"],
        cream: ["cream", "cr"],
        dun: ["dun", "falbe", "dilution"],
        silver: ["silver", "windfarben", "z"],
        pearl: ["pearl", "pl"],
        pangare: ["pangare", "pa"],
        rabicano: ["rabicano", "rb"],
        roan: ["roan", "rn"],
        tobiano: ["tobiano", "to"],
        sabino: ["sabino", "sb"],
        white: ["white", "dominant white", "w"],
        grey: ["grey", "gray", "schimmel", "g"],
        champagne: ["champagne", "ch"],
        sooty: ["sooty", "sty"],
        flaxen: ["flaxen", "f/"],
        overo: ["overo", "ov"],
        splashed: ["splashed", "spl"],
        leopard: ["appaloosa", "leopard", "lp"],
        patn1: ["patn1"]
    };

    const compactKeysByGene = {
        extension: ["extension"],
        agouti: ["agouti"],
        cream: ["cream"],
        dun: ["dun"],
        silver: ["silver"],
        pearl: ["pearl"],
        pangare: ["pangare"],
        rabicano: ["rabicano"],
        roan: ["roan"],
        tobiano: ["tobiano"],
        sabino: ["sabino"],
        white: ["white"],
        grey: ["grey", "gray"],
        champagne: ["champagne"],
        sooty: ["sooty"],
        flaxen: ["flaxen"],
        overo: ["overo"],
        splashed: ["splashed"],
        leopard: ["appaloosa", "leopard"],
        patn1: ["patn1"]
    };

    // Priority path for imported MDR format: **Gene**Value.
    const compactKeys = compactKeysByGene[geneKey] || [];
    let compactValueFound = false;
    for (const key of compactKeys) {
        if (!(key in compactGenes)) continue;
        compactValueFound = true;

        const value = compactGenes[key];
        if (isGeneUntested(value)) return null;

        const parsed = parseCompactPair(value, geneKey);
        return parsed || null;
    }

    // If gene key is present in compact data but unparseable, do not fall back to fuzzy regex.
    if (compactValueFound) {
        return null;
    }

    const candidates = defs[geneKey] || [];
    const lineRegex = new RegExp(`(?:${candidates.map((v) => escapeRegex(v)).join("|")})[^\\n\\r:]*[:\\-]?\\s*([A-Za-z0-9+]+)\\s*[/|\\s]\\s*([A-Za-z0-9+]+)`, "i");
    const lineMatch = lineRegex.exec(raw);
    if (lineMatch) {
        const a = canonicalizeGeneToken(lineMatch[1], geneKey);
        const b = canonicalizeGeneToken(lineMatch[2], geneKey);
        if (a && b) return [a, b];
    }

    if (geneKey === "agouti") {
        const agPairRegex = /(Ap|A1|At|a0)\s*[/|\s]\s*(Ap|A1|At|a0)/i;
        const m = agPairRegex.exec(compact);
        if (m) {
            const a = canonicalizeAgouti(m[1]);
            const b = canonicalizeAgouti(m[2]);
            if (a && b) return [a, b];
        }
    }

    if (geneKey === "extension") {
        const extPairRegex = /\b([Ee])\s*[/|\s]\s*([Ee])\b/;
        const m = extPairRegex.exec(compact);
        if (m) {
            const a = canonicalizeGeneToken(m[1], geneKey);
            const b = canonicalizeGeneToken(m[2], geneKey);
            if (a && b) return [a, b];
        }
    }

    return null;
}

function extractColorGenes(text) {
    return {
        extension: parsePairForGene(text, "extension"),
        agouti: parsePairForGene(text, "agouti"),
        cream: parsePairForGene(text, "cream"),
        dun: parsePairForGene(text, "dun"),
        silver: parsePairForGene(text, "silver"),
        pearl: parsePairForGene(text, "pearl"),
        pangare: parsePairForGene(text, "pangare"),
        rabicano: parsePairForGene(text, "rabicano"),
        roan: parsePairForGene(text, "roan"),
        tobiano: parsePairForGene(text, "tobiano"),
        sabino: parsePairForGene(text, "sabino"),
        white: parsePairForGene(text, "white"),
        overo: parsePairForGene(text, "overo"),
        splashed: parsePairForGene(text, "splashed"),
        leopard: parsePairForGene(text, "leopard"),
        patn1: parsePairForGene(text, "patn1"),
        grey: parsePairForGene(text, "grey"),
        champagne: parsePairForGene(text, "champagne"),
        sooty: parsePairForGene(text, "sooty"),
        flaxen: parsePairForGene(text, "flaxen")
    };
}

function genotypeDistribution(pairA, pairB) {
    if (!pairA || !pairB) return null;
    const out = new Map();

    for (const a of pairA) {
        for (const b of pairB) {
            const key = [a, b].sort().join("/");
            out.set(key, (out.get(key) || 0) + 1);
        }
    }

    const result = [];
    for (const [genotype, count] of out.entries()) {
        result.push({ genotype, prob: count / 4 });
    }
    return result;
}

function genotypeHasAllele(genotype, allele) {
    return String(genotype || "").split("/").includes(allele);
}

function genotypeAlleleCount(genotype, allele) {
    return String(genotype || "").split("/").filter((a) => a === allele).length;
}

function resolveBaseFromState(state) {
    const ext = state.extension;
    const ago = state.agouti;

    if (!ext) return "Basis unklar (Extension fehlt)";

    if (ext === "e/e") {
        return "Chestnut";
    }

    if (!ago) {
        return "Black/Bay-Basis (Agouti unklar)";
    }

    const [a1, a2] = ago.split("/");
    const rank = { Ap: 4, A1: 3, At: 2, a0: 1 };
    const top = (rank[a1] || 0) >= (rank[a2] || 0) ? a1 : a2;

    if (top === "Ap") return "Wildbay";
    if (top === "A1") return "Bay";
    if (top === "At") return "Sealbrown";
    return "Black";
}

function resolvePhenotypeFromState(state) {
    const base = resolveBaseFromState(state);

    const creamCount = genotypeAlleleCount(state.cream, "Cr");
    const hasDun = genotypeHasAllele(state.dun, "D");
    const hasSilver = genotypeHasAllele(state.silver, "Z");
    const hasPearl = genotypeAlleleCount(state.pearl, "pl") === 2;
    const hasPangare = genotypeHasAllele(state.pangare, "Pa");
    const hasRoan = genotypeHasAllele(state.roan, "Rn");
    const hasTobiano = genotypeHasAllele(state.tobiano, "To");
    const hasSabino = genotypeHasAllele(state.sabino, "Sb");
    const hasWhite = genotypeHasAllele(state.white, "W");
    const hasOvero = genotypeHasAllele(state.overo, "Ov");
    const hasSplashed = genotypeHasAllele(state.splashed, "Spl");
    const hasLeopard = genotypeHasAllele(state.leopard, "Lp");
    const hasPATN1 = genotypeHasAllele(state.patn1, "PATN1");
    const hasRabicano = genotypeHasAllele(state.rabicano, "Rb");
    const hasGrey = genotypeHasAllele(state.grey, "G");
    const hasChampagne = genotypeHasAllele(state.champagne, "Ch");
    const isFlaxen = state.flaxen === "f/f";
    const hasSooty = genotypeHasAllele(state.sooty, "Sty");

    let label = base;

    if (hasChampagne) {
        if (base === "Chestnut") label = "Gold Champagne";
        else if (base === "Bay" || base === "Wildbay") label = "Amber Champagne";
        else if (base === "Sealbrown") label = "Sable Champagne";
        else if (base === "Black") label = "Classic Champagne";
        else label = `${base} + Champagne`;
    }

    if (creamCount === 1) {
        if (base === "Chestnut") label = "Palomino";
        else if (base === "Bay" || base === "Wildbay") label = "Buckskin";
        else if (base === "Sealbrown") label = "Smoky Brown";
        else if (base === "Black") label = "Smoky Black";
        else label = `${label} + Cream`;
    }

    if (creamCount === 2) {
        if (base === "Chestnut") label = "Cremello";
        else if (base === "Bay" || base === "Wildbay") label = "Perlino";
        else if (base === "Sealbrown") label = "Sealbrown Cream";
        else if (base === "Black") label = "Smoky Cream";
        else label = `${label} + Double Cream`;
    }

    if (hasDun) {
        if (label === "Chestnut") label = "Red Dun";
        else if (label === "Bay" || label === "Wildbay") label = "Classic Dun";
        else if (label === "Sealbrown") label = "Brown Dun";
        else if (label === "Black") label = "Grulla";
        else label = `${label} + Dun`;
    }

    if (hasSilver && !/Chestnut|Palomino|Cremello|Gold Champagne/.test(label)) {
        label = `Silver ${label}`;
    }

    if (isFlaxen && (base === "Chestnut" || label === "Chestnut")) {
        label = "Flaxen Chestnut";
    }

    if (hasSooty) {
        label = `${label} (Sooty)`;
    }

    if (hasPearl) {
        label = `${label} + Pearl`;
    }

    if (hasPangare) {
        label = `${label} + Pangare`;
    }

    if (hasRoan) {
        label = `${label} Roan`;
    }

    const pinto = [];
    if (hasTobiano) pinto.push("Tobiano");
    if (hasSabino) pinto.push("Sabino");
    if (hasWhite) pinto.push("Dominant White");
    if (hasOvero) pinto.push("Overo");
    if (hasSplashed) pinto.push("Splashed");
    if (pinto.length) {
        label = `${label} (${pinto.join(" + ")})`;
    }

    if (hasLeopard) {
        label = `${label} (${hasPATN1 ? "Leopard/PATN1" : "Appaloosa"})`;
    }

    if (hasRabicano) {
        label = `${label} (Rabicano)`;
    }

    if (hasGrey) {
        label = `${label} (Grey)`;
    }

    return label;
}

function buildOffspringStates(geneDistributions) {
    const entries = Object.entries(geneDistributions).filter(([, dist]) => Array.isArray(dist) && dist.length);
    if (!entries.length) return [{ state: {}, prob: 1 }];

    let states = [{ state: {}, prob: 1 }];

    for (const [gene, dist] of entries) {
        const next = [];
        for (const root of states) {
            for (const variant of dist) {
                next.push({
                    state: { ...root.state, [gene]: variant.genotype },
                    prob: root.prob * variant.prob
                });
            }
        }
        states = next;
    }

    return states;
}

function formatPercent(value) {
    return `${(value * 100).toFixed(value * 100 % 1 === 0 ? 0 : 1)}%`;
}

function renderColorAnalysisReport(mareName, stallionName, mareText, stallionText, options = {}) {
    const mareGenes = extractColorGenes(mareText);
    const stallionGenes = extractColorGenes(stallionText);

    const geneDistributions = {
        extension: genotypeDistribution(mareGenes.extension, stallionGenes.extension),
        agouti: genotypeDistribution(mareGenes.agouti, stallionGenes.agouti),
        cream: genotypeDistribution(mareGenes.cream, stallionGenes.cream),
        dun: genotypeDistribution(mareGenes.dun, stallionGenes.dun),
        silver: genotypeDistribution(mareGenes.silver, stallionGenes.silver),
        pearl: genotypeDistribution(mareGenes.pearl, stallionGenes.pearl),
        pangare: genotypeDistribution(mareGenes.pangare, stallionGenes.pangare),
        rabicano: genotypeDistribution(mareGenes.rabicano, stallionGenes.rabicano),
        roan: genotypeDistribution(mareGenes.roan, stallionGenes.roan),
        tobiano: genotypeDistribution(mareGenes.tobiano, stallionGenes.tobiano),
        sabino: genotypeDistribution(mareGenes.sabino, stallionGenes.sabino),
        white: genotypeDistribution(mareGenes.white, stallionGenes.white),
        overo: genotypeDistribution(mareGenes.overo, stallionGenes.overo),
        splashed: genotypeDistribution(mareGenes.splashed, stallionGenes.splashed),
        leopard: genotypeDistribution(mareGenes.leopard, stallionGenes.leopard),
        patn1: genotypeDistribution(mareGenes.patn1, stallionGenes.patn1),
        grey: genotypeDistribution(mareGenes.grey, stallionGenes.grey),
        champagne: genotypeDistribution(mareGenes.champagne, stallionGenes.champagne),
        flaxen: genotypeDistribution(mareGenes.flaxen, stallionGenes.flaxen),
        sooty: genotypeDistribution(mareGenes.sooty, stallionGenes.sooty)
    };

    const offspringStates = buildOffspringStates(geneDistributions);
    const phenotypeProb = new Map();

    for (const entry of offspringStates) {
        const label = resolvePhenotypeFromState(entry.state);
        phenotypeProb.set(label, (phenotypeProb.get(label) || 0) + entry.prob);
    }

    const phenotypeRows = [...phenotypeProb.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([label, prob]) => `<div class="color-row"><span class="color-row-label">${escapeHtml(label)}</span><span class="color-row-value">${formatPercent(prob)}</span></div>`)
        .join("");

    const renderDist = (title, dist) => {
        if (!dist) return "";
        const dominanceWeight = (genotype) => (genotype.match(/[A-Z]/g) || []).length;
        const text = dist
            .sort((a, b) => {
                const byProb = b.prob - a.prob;
                if (byProb !== 0) return byProb;

                const byDominance = dominanceWeight(b.genotype) - dominanceWeight(a.genotype);
                if (byDominance !== 0) return byDominance;

                return a.genotype.localeCompare(b.genotype, "de", { sensitivity: "base" });
            })
            .map((x) => `<span class="color-dist-item">${escapeHtml(x.genotype)} (${formatPercent(x.prob)})</span>`)
            .join("");

        return `
            <div class="color-dist-row">
                <span class="color-dist-gene">${escapeHtml(title)}</span>
                <span class="color-dist-line">${text}</span>
            </div>
        `;
    };

    const geneLabels = {
        extension: "Extension",
        agouti: "Agouti",
        dun: "Dun",
        cream: "Cream",
        champagne: "Champagne",
        grey: "Grey",
        silver: "Silver",
        pearl: "Pearl",
        pangare: "Pangare",
        rabicano: "Rabicano",
        roan: "Roan",
        tobiano: "Tobiano",
        sabino: "Sabino",
        white: "White",
        overo: "Overo",
        splashed: "Splashed",
        leopard: "Appaloosa/Leopard",
        patn1: "PATN1",
        sooty: "Sooty",
        flaxen: "Flaxen"
    };

    const formatPair = (pair) => pair ? pair.join("/") : "nicht erkannt";

    const parentBreakdownRows = Object.keys(geneLabels)
        .filter((key) => mareGenes[key] || stallionGenes[key])
        .map((key) => `
            <div class="color-parent-row">
                <span class="color-parent-gene">${geneLabels[key]}</span>
                <span class="color-parent-value">${escapeHtml(formatPair(mareGenes[key]))}</span>
                <span class="color-parent-value">${escapeHtml(formatPair(stallionGenes[key]))}</span>
            </div>
        `)
        .join("");

    const distributionRows = Object.keys(geneLabels)
        .map((key) => renderDist(geneLabels[key], geneDistributions[key]))
        .filter(Boolean)
        .join("");

    const knownGeneCount = Object.values(geneDistributions).filter((dist) => Array.isArray(dist)).length;
    const compactClass = options.compact ? " color-report-compact" : "";

    return `
        <div class="color-report${compactClass}">
            <div class="color-report-head">
                <h3>Farbvererbung</h3>
                <p><b>${escapeHtml(mareName || "Stute")}</b> × <b>${escapeHtml(stallionName || "Hengst")}</b></p>
                <div class="color-meta">
                    <span class="color-pill">Berücksichtigte Gene: ${knownGeneCount}</span>
                </div>
            </div>

            <div class="color-report-grid">
                ${parentBreakdownRows ? `
                    <section class="color-card">
                        <h4>Eltern-Gene</h4>
                        <div class="color-parent-head">
                            <span></span>
                            <span>Mutter</span>
                            <span>Vater</span>
                        </div>
                        <div class="color-parent-grid">${parentBreakdownRows}</div>
                    </section>
                ` : ""}

                <section class="color-card color-card-strong">
                    <h4>Alle berechneten Farb-Möglichkeiten</h4>
                    <div class="color-list">
                        ${phenotypeRows || `<div class="color-row"><span class="color-row-label">Unklar</span><span class="color-row-value">Zu wenige Gene erkannt</span></div>`}
                    </div>
                </section>

                ${distributionRows ? `
                    <section class="color-card">
                        <h4>Gen-Verteilung</h4>
                        <div class="color-list">${distributionRows}</div>
                    </section>
                ` : ""}
            </div>
        </div>
    `;
}

function analyzeColorInput() {
    const out = document.getElementById("color_result");
    if (!out) return;

    try {
        const mareRaw = document.getElementById("color_mare_raw")?.value?.trim() || "";
        const stallionRaw = document.getElementById("color_stallion_raw")?.value?.trim() || "";
        const mareStored = pferde[document.getElementById("colorMareSelect")?.value];
        const stallionStored = pferde[document.getElementById("colorStallionSelect")?.value];

        out.innerHTML = `<p class="color-status">Analysiere Farbgene...</p>`;

        const mareText = mareRaw || mareStored?.farbe || "";
        const stallionText = stallionRaw || stallionStored?.farbe || "";

        if (!mareText || !stallionText) {
            out.innerHTML = `<p class="color-status">Bitte Stute und Hengst auswählen oder Rohdaten einfügen.</p>`;
            return;
        }

        try {
            out.innerHTML = renderColorAnalysisReport(
                mareStored?.name || "Stute",
                stallionStored?.name || "Hengst",
                mareText,
                stallionText,
                { compact: false }
            );
        } catch (error) {
            out.innerHTML = `<p class="color-status color-status-error">Farbanalyse fehlgeschlagen: ${escapeHtml(error?.message || "Unbekannter Fehler")}</p>`;
            return;
        }
    } catch (error) {
        out.innerHTML = `<p class="color-status color-status-error">Farbanalyse fehlgeschlagen: ${escapeHtml(error?.message || "Unbekannter Fehler")}</p>`;
    }
}


/* =========================
   ⚡ LEISTUNGSWERTE (SKILLS)
========================= */

function extractSkills(text) {
    const skills = {};

    const knownSkills = Array.from(new Set([
        ...Object.values(DISCIPLINES).flat()
    ]));

    const normalize = (value) => value.toLowerCase().replace(/^#+\s*/, "").replace(/[:]/g, "").trim();
    const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const markerRegex = /#{2,}\s*([^%#\n]+?)\s*((?:\d+\s*%\s*)+)/g;
    let match;

    while ((match = markerRegex.exec(text)) !== null) {
        const rawName = match[1].trim();
        const normalized = normalize(rawName);
        const skillName = knownSkills.find(skill => normalized === skill.toLowerCase() || normalized.startsWith(skill.toLowerCase()));
        if (!skillName) continue;
        const values = Array.from(match[2].matchAll(/(\d+)\s*%/g), m => Number(m[1])).filter(v => !Number.isNaN(v));
        if (!values.length) continue;

        const potential = values[values.length - 1];
        const current = values.length > 1 ? values[0] : null;

        skills[skillName] = current !== null ? { current, potential } : potential;
    }

    // Robust parser for compact text blocks like "Reining30 %Trail30 %Pleasure12 %32 %"
    const sortedSkills = [...knownSkills].sort((a, b) => b.length - a.length);
    for (const skillName of sortedSkills) {
        const pattern = new RegExp(`${escapeRegex(skillName)}\\s*(\\d+)\\s*%(?:\\s*(\\d+)\\s*%)?`, "iu");
        const compactMatch = pattern.exec(text);
        if (!compactMatch) continue;

        const first = Number(compactMatch[1]);
        const second = compactMatch[2] !== undefined ? Number(compactMatch[2]) : null;

        if (!Number.isNaN(first)) {
            const potential = second !== null && !Number.isNaN(second) ? Math.max(first, second) : first;
            const current = second !== null && !Number.isNaN(second) ? first : null;
            skills[skillName] = current !== null ? { current, potential } : potential;
        }
    }

    if (Object.keys(skills).length > 0) {
        return skills;
    }

    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        for (let skillName of knownSkills) {
            const lowerSkill = skillName.toLowerCase();
            const lowerLine = line.toLowerCase();
            if (lowerLine.includes(lowerSkill)) {
                const values = Array.from(line.matchAll(/(\d+)\s*%/g), m => Number(m[1]));
                if (values.length) {
                    skills[skillName] = values[0];
                }
            }
        }
    }

    return skills;
}

function getSkillValue(skillData) {
    if (skillData === null || skillData === undefined) return null;
    if (typeof skillData === 'number') return skillData;
    if (typeof skillData === 'string') {
        const n = Number(skillData.replace(/[^0-9.]/g, ""));
        return Number.isNaN(n) ? null : n;
    }
    if (typeof skillData === 'object') {
        if (typeof skillData.potential === 'number') return skillData.potential;
        if (typeof skillData.current === 'number') return skillData.current;
        if (typeof skillData.potential === 'string') {
            const n = Number(skillData.potential.replace(/[^0-9.]/g, ""));
            if (!Number.isNaN(n)) return n;
        }
        if (typeof skillData.current === 'string') {
            const n = Number(skillData.current.replace(/[^0-9.]/g, ""));
            if (!Number.isNaN(n)) return n;
        }
    }
    return null;
}

function getTournamentSkillValue(skillData) {
    if (skillData === null || skillData === undefined) return null;
    if (typeof skillData === 'number') return skillData;
    if (typeof skillData === 'string') {
        const n = Number(skillData.replace(/[^0-9.]/g, ""));
        return Number.isNaN(n) ? null : n;
    }
    if (typeof skillData === 'object') {
        if (typeof skillData.potential === 'number') return skillData.potential;
        if (typeof skillData.current === 'number') return skillData.current;
        if (typeof skillData.potential === 'string') {
            const n = Number(skillData.potential.replace(/[^0-9.]/g, ""));
            if (!Number.isNaN(n)) return n;
        }
        if (typeof skillData.current === 'string') {
            const n = Number(skillData.current.replace(/[^0-9.]/g, ""));
            if (!Number.isNaN(n)) return n;
        }
    }
    return null;
}


/* =========================
   🗑️ DELETE
========================= */

async function deletePferd(i) {
    if (!confirm("Pferd löschen?")) return;
    pferde.splice(i,1);
    writeLocalPferde(pferde);

    try {
        await persistPferdeToRemote();
    } catch {
        // Keep local data in sync even if the remote store is temporarily unavailable.
    }

    renderDatabase();
}


/* =========================
   📊 RENDER
========================= */

function renderDatabase() {

    document.querySelector("#datenbank .hero").style.display = "block";
    document.getElementById("db_sortbar").style.display = "block";

    const db = document.getElementById("db_liste");
    db.innerHTML = "";

    const ownerFilter = document.getElementById("dbFilterBesitzer");
    if (ownerFilter) {
        const currentOwner = ownerFilter.value || "__all__";
        const owners = [...new Set(pferde.map((horse) => normalizeOwner(horse.besitzer)))]
            .sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));

        ownerFilter.innerHTML = `
            <option value="__all__">Alle Besitzer</option>
            ${owners.map((owner) => `<option value="${escapeHtml(owner)}">${escapeHtml(owner)}</option>`).join("")}
        `;

        const hasCurrent = owners.includes(currentOwner);
        ownerFilter.value = hasCurrent ? currentOwner : "__all__";
    }

    const filterGeschlecht = document.getElementById("dbFilterGeschlecht")?.value || "__all__";
    const filterBesitzer = ownerFilter?.value || "__all__";

    let sorted = pferde.filter((horse) => {
        const genderPass = filterGeschlecht === "__all__" || (horse.geschlecht || "Unbekannt") === filterGeschlecht;
        const ownerPass = filterBesitzer === "__all__" || normalizeOwner(horse.besitzer) === filterBesitzer;
        return genderPass && ownerPass;
    });

    const mode = document.getElementById("dbSort")?.value || "name";

    if (mode === "name") {
        sorted.sort((a, b) => a.name.localeCompare(b.name));
    }

    if (mode === "gp") {
        sorted.sort((a, b) => b.gp - a.gp);
    }

    if (mode === "geschlecht") {
        sorted.sort((a, b) => a.geschlecht.localeCompare(b.geschlecht));
    }

    if (mode === "besitzer") {
        sorted.sort((a, b) =>
            (a.besitzer || "").localeCompare(b.besitzer || "")
        );
    }

    if (mode === "interieur") {
        sorted.sort((a, b) =>
            Number(calculateInteriorAverage(a.interieur)) -
            Number(calculateInteriorAverage(b.interieur))
        );
    }

    if (mode === "exterieur") {
        sorted.sort((a, b) =>
            Number(calculateExteriorAverage(a.exterieur)) -
            Number(calculateExteriorAverage(b.exterieur))
        );
    }

    sorted.forEach((p) => {

        const row = document.createElement("div");
        row.className = "horse-row";
        row.style.cursor = "pointer";

        const intAvg = calculateInteriorAverage(p.interieur);
        const extAvg = calculateExteriorAverage(p.exterieur);

        row.innerHTML = `
            <div class="horse-main">

                <div class="horse-title">
                    <b>${escapeHtml(p.name)}</b>
                </div>

                <div class="horse-line">
                    ${(p.geschlecht || "Unbekannt")} · GP ${p.gp} · Int Ø ${intAvg} · Ext Ø ${extAvg}
                </div>

            </div>

            <div class="horse-owner">
                ${escapeHtml(normalizeOwner(p.besitzer))}
            </div>

            <button class="delete-btn">
                X
            </button>
        `;

        // 🧠 Klick nur wenn NICHT Delete
        row.onclick = (e) => {
            if (e.target.classList.contains("delete-btn")) return;
            showHorseDetail(p);
        };

        // 🗑 Delete separat sauber
        row.querySelector(".delete-btn").onclick = (e) => {
            e.stopPropagation();

            const index = pferde.findIndex(x => x.name === p.name);
            if (index !== -1) deletePferd(index);
        };

        db.appendChild(row);
    });
}

function resetDatabaseFilters() {
    const genderFilter = document.getElementById("dbFilterGeschlecht");
    const ownerFilter = document.getElementById("dbFilterBesitzer");
    const sort = document.getElementById("dbSort");

    if (genderFilter) genderFilter.value = "__all__";
    if (ownerFilter) ownerFilter.value = "__all__";
    if (sort) sort.value = "name";

    renderDatabase();
}


function showHorseDetail(horse) {

    if (!horse) return;

    if (horse.geschlecht === "Stute") {
        showMareCombinations(horse);
        return;
    }

    if (horse.geschlecht === "Hengst") {
        showStallionView(horse);
        return;
    }
}

function hasCompleteExteriorGenesForPair(mare, stallion) {
    const mareKeys = Object.keys(mare?.exterieur || {});
    if (!mareKeys.length) return false;

    let sharedComplete = 0;

    for (const key of mareKeys) {
        const genes = stallion?.exterieur?.[key]?.genes;
        if (Array.isArray(genes) && genes.length >= 8) {
            sharedComplete++;
        }
    }

    if (sharedComplete > 0) {
        return true;
    }

    // Fallback for legacy imports with differing trait keys: allow stallions that
    // have at least one complete exterior trait block.
    const stallionTraits = Object.values(stallion?.exterieur || {});
    return stallionTraits.some((entry) => Array.isArray(entry?.genes) && entry.genes.length >= 8);
}

function showStallionDetailFromMare(mareIndex, stallionIndex) {
    const mare = pferde[mareIndex];
    const stallion = pferde[stallionIndex];
    if (!mare || !stallion) {
        renderDatabase();
        return;
    }

    showFoalGeneOverview(mare, stallion, {
        backAction: `showMareCombinationsByRefresh(${mareIndex})`,
        backLabel: "Zurück zur Hengstkombi"
    });
}

function showFoalGeneOverview(mare, stallion, options = {}) {

    document.getElementById("db_sortbar").style.display = "none";
    document.querySelector("#datenbank .hero").style.display = "none";

    if (!mare || !stallion) return;

    const container = document.getElementById("db_liste");
    const backAction = options.backAction || "renderDatabase()";
    const backLabel = options.backLabel || "Zurück";
    const intAvg = calculateInteriorAverage(stallion.interieur || {});
    const extAvg = calculateExteriorAverage(stallion.exterieur || {});

    const range = calculateExteriorRange(mare, stallion);
    const inbreeding = getInbreedingRisk(mare, stallion);

    const partBlocks = (range.parts || []).map((part) => {
        const bestStyle = getExteriorScoreStyle(part.best.score);
        const worstStyle = getExteriorScoreStyle(part.worst.score);

        const bestGenes = part.best.genes.join(" ");
        const worstGenes = part.worst.genes.join(" ");

        return `
            <div class="foal-legacy-part-card">
                <h4>${escapeHtml(part.key)}</h4>
                <div class="foal-legacy-gene-tone" style="--tone-border:${bestStyle.border}; --tone-dot:${bestStyle.dot};">
                    <div class="foal-legacy-gene-line"><span class="foal-tone-dot"></span><b>Best (${part.best.match.totalCorrect}/8)</b> ${escapeHtml(bestGenes)}</div>
                </div>

                <div class="foal-legacy-gene-tone" style="--tone-border:${worstStyle.border}; --tone-dot:${worstStyle.dot};">
                    <div class="foal-legacy-gene-line"><span class="foal-tone-dot"></span><b>Worst (${part.worst.match.totalCorrect}/8)</b> ${escapeHtml(worstGenes)}</div>
                </div>
            </div>
        `;
    }).join("");

    const inbreedingInfo = inbreeding.isRisk
        ? `<div class="foal-status foal-status-risk"><b>Inzucht:</b> ${escapeHtml(inbreeding.reasons.join(" · "))}</div>`
        : `<div class="foal-status"><b>Inzucht:</b> Kein Hinweis</div>`;

    let colorDetailHtml = `<p class="color-status">Für diese Paarung sind keine Farbdaten bei beiden Eltern gespeichert.</p>`;
    if (mare?.farbe && stallion?.farbe) {
        try {
            colorDetailHtml = renderColorAnalysisReport(mare.name, stallion.name, mare.farbe, stallion.farbe, { compact: true });
        } catch (error) {
            colorDetailHtml = `<p class="color-status color-status-error">Farbanalyse fehlgeschlagen: ${escapeHtml(error?.message || "Unbekannter Fehler")}</p>`;
        }
    }

    container.innerHTML = `
        <div class="detail-header">
            <button class="btn back-btn" onclick="${backAction}">${backLabel}</button>

            <div class="detail-title-block">
                <h2>${escapeHtml(stallion.name)}</h2>
                <p class="detail-meta">GP ${stallion.gp || 0} · Int Ø ${intAvg} · Ext Ø ${extAvg}</p>
            </div>

            <div class="view-switch">
                <button id="btnFoalZucht" class="active" onclick="showFoalDetailTab('zucht')">Exterieur</button>
                <button id="btnFoalFarben" onclick="showFoalDetailTab('farben')">Farben</button>
            </div>
        </div>

        <div id="foal-view-zucht">
            ${inbreedingInfo}

            <h2>Exterieur Potenzial</h2>
            <p class="foal-legacy-line"><b>Paarung:</b> ${escapeHtml(mare.name)} × ${escapeHtml(stallion.name)}</p>
            <p class="foal-legacy-line"><b>Best Case:</b> ${range.best} · Treffer ${range.bestCorrectTotal}/${range.totalSlots} (${range.bestCorrectPercent}%)</p>
            <p class="foal-legacy-line"><b>Worst Case:</b> ${range.worst} · Treffer ${range.worstCorrectTotal}/${range.totalSlots} (${range.worstCorrectPercent}%)</p>

            ${partBlocks ? `<div class="foal-legacy-parts">${partBlocks}</div>` : `<div class="foal-empty">Keine passenden Exterieur-Gene für diese Kombination gefunden.</div>`}
        </div>

        <div id="foal-view-farben" style="display:none;">
            ${colorDetailHtml}
        </div>
    `;
}

function showFoalDetailTab(view) {
    const zucht = document.getElementById("foal-view-zucht");
    const farben = document.getElementById("foal-view-farben");

    const btnZucht = document.getElementById("btnFoalZucht");
    const btnFarben = document.getElementById("btnFoalFarben");

    if (!zucht || !farben || !btnZucht || !btnFarben) return;

    if (view === "farben") {
        zucht.style.display = "none";
        farben.style.display = "block";
        btnZucht.classList.remove("active");
        btnFarben.classList.add("active");
        return;
    }

    zucht.style.display = "block";
    farben.style.display = "none";
    btnZucht.classList.add("active");
    btnFarben.classList.remove("active");
}

function showStallionView(horse, options = {}) {

    document.getElementById("db_sortbar").style.display = "none";
    document.querySelector("#datenbank .hero").style.display = "none";

    if (!horse) return;

    const container = document.getElementById("db_liste");
    const backAction = options.backAction || "renderDatabase()";
    const backLabel = options.backLabel || "Zurück";
    const intAvg = calculateInteriorAverage(horse.interieur || {});
    const extAvg = calculateExteriorAverage(horse.exterieur || {});

    const header = `
        <div class="detail-header">

            <button class="btn back-btn" onclick="${backAction}">${backLabel}</button>

            <div class="detail-title-block">
                <h2>${horse.name}</h2>
                <p class="detail-meta">GP ${horse.gp || 0} · Int Ø ${intAvg} · Ext Ø ${extAvg}</p>
            </div>

            <div class="view-switch">
                <button class="active">Turnier</button>
            </div>

        </div>
    `;

    const content = renderTournamentProfile(horse);

    container.innerHTML = header + content;
}


const mareCombinationViewState = {
    sortBy: "best",
    sortDir: "asc",
    inbreedingFilter: "all"
};

function defaultSortDirection(column) {
    if (column === "gp") return "desc";
    return "asc";
}

function setMareCombinationSort(mareIndex, column) {
    if (mareCombinationViewState.sortBy === column) {
        mareCombinationViewState.sortDir = mareCombinationViewState.sortDir === "asc" ? "desc" : "asc";
    } else {
        mareCombinationViewState.sortBy = column;
        mareCombinationViewState.sortDir = defaultSortDirection(column);
    }

    showMareCombinationsByRefresh(mareIndex);
}

function setMareInbreedingFilter(mareIndex, value) {
    mareCombinationViewState.inbreedingFilter = value || "all";
    showMareCombinationsByRefresh(mareIndex);
}

function renderSortLabel(label, column) {
    if (mareCombinationViewState.sortBy !== column) {
        return label;
    }

    const dir = mareCombinationViewState.sortDir === "asc" ? "▲" : "▼";
    return `${label} ${dir}`;
}



function showMareCombinations(mare) {

    document.getElementById("db_sortbar").style.display = "none";
    document.querySelector("#datenbank .hero").style.display = "none";

    const container = document.getElementById("db_liste");

    let stallions = pferde.filter(p => p.geschlecht === "Hengst");

    const stallionSearchRaw = (document.getElementById("stallionSearch")?.value || "").trim().toLowerCase();
    const inbreedingFilter = mareCombinationViewState.inbreedingFilter || "all";
    const sortBy = mareCombinationViewState.sortBy || "best";
    const sortDir = mareCombinationViewState.sortDir || defaultSortDirection(sortBy);
    const sortFactor = sortDir === "asc" ? 1 : -1;

    const rangeCache = new Map();
    const getRange = (stallion) => {
        const key = stallion.name;
        if (!rangeCache.has(key)) {
            rangeCache.set(key, calculateExteriorRange(mare, stallion));
        }
        return rangeCache.get(key);
    };

    const riskCache = new Map();
    const getRisk = (stallion) => {
        const key = stallion.name;
        if (!riskCache.has(key)) {
            riskCache.set(key, getInbreedingRisk(mare, stallion));
        }
        return riskCache.get(key);
    };

    stallions = stallions.filter((horse) => {
        const genesPass = hasCompleteExteriorGenesForPair(mare, horse);
        const searchPass = !stallionSearchRaw || (horse.name || "").toLowerCase().includes(stallionSearchRaw);

        if (!genesPass || !searchPass) {
            return false;
        }

        const risk = getRisk(horse);

        if (inbreedingFilter === "risk") return risk.isRisk;
        if (inbreedingFilter === "safe") return !risk.isRisk;

        return true;
    });

    if (!stallions.length && inbreedingFilter !== "all") {
        mareCombinationViewState.inbreedingFilter = "all";
        return showMareCombinations(mare);
    }

    stallions.sort((a, b) => {

        const aRange = getRange(a);
        const bRange = getRange(b);
        const aRisk = getRisk(a).isRisk ? 1 : 0;
        const bRisk = getRisk(b).isRisk ? 1 : 0;
        const aSpread = Number(aRange.worst) - Number(aRange.best);
        const bSpread = Number(bRange.worst) - Number(bRange.best);

        let compare = 0;

        if (sortBy === "name") compare = a.name.localeCompare(b.name, "de", { sensitivity: "base" });
        if (sortBy === "gp") compare = Number(a.gp || 0) - Number(b.gp || 0);
        if (sortBy === "best") compare = Number(aRange.best) - Number(bRange.best);
        if (sortBy === "worst") compare = Number(aRange.worst) - Number(bRange.worst);
        if (sortBy === "spread") compare = aSpread - bSpread;
        if (sortBy === "inbreeding") compare = aRisk - bRisk;

        if (compare !== 0) return compare * sortFactor;

        return a.name.localeCompare(b.name, "de", { sensitivity: "base" });
    });

    const inbreedingCount = stallions.filter((stallion) => getRisk(stallion).isRisk).length;

    const stallionRows = stallions.map((stallion, index) => {
        const range = getRange(stallion);
        const spread = (Number(range.worst) - Number(range.best)).toFixed(2);
        const inbreeding = getRisk(stallion);
        const rowStyle = inbreeding.isRisk
            ? ` style="background: rgba(244, 67, 54, 0.18);"`
            : "";
        const inbreedingReason = inbreeding.reasons.join(" · ");
        const inbreedingCell = inbreeding.isRisk
            ? `<span title="${escapeHtml(inbreedingReason)}" style="color:#8e1b1b; font-weight:700;">Ja</span>`
            : `<span style="color:#2e7d32; font-weight:600;">Nein</span>`;

        return `
            <tr${rowStyle}>
                <td>${index + 1}</td>
                <td><b>${escapeHtml(stallion.name)}</b></td>
                <td>${stallion.gp}</td>
                <td><span class="score-chip score-chip-good">${range.best}</span></td>
                <td><span class="score-chip score-chip-warn">${range.worst}</span></td>
                <td>${spread}</td>
                <td>${inbreedingCell}</td>
                <td>
                    <button class="btn btn-mini" onclick="showStallionDetailFromMare(${pferde.indexOf(mare)}, ${pferde.indexOf(stallion)})">Details</button>
                </td>
            </tr>
        `;
    }).join("");

    let html = `
        <div class="detail-header">

<button class="btn back-btn" onclick="renderDatabase()">Zurück</button>

            <h2>${mare.name}</h2>

            <div class="view-switch">
                <button id="btnZucht" class="active" onclick="showView('zucht')">Zucht</button>
                <button id="btnTurnier" onclick="showView('turnier')">Turnier</button>
            </div>

        </div>

        <div id="view-zucht">

            <div class="compare-toolbar">
                <label class="compare-sort-label" for="inbreedingFilter">Inzucht-Filter</label>
                <select class="compare-sort-select" id="inbreedingFilter" onchange="setMareInbreedingFilter(${pferde.indexOf(mare)}, this.value)">
                    <option value="all" ${inbreedingFilter === "all" ? "selected" : ""}>Alle</option>
                    <option value="safe" ${inbreedingFilter === "safe" ? "selected" : ""}>Nur ohne Hinweis</option>
                    <option value="risk" ${inbreedingFilter === "risk" ? "selected" : ""}>Nur mit Hinweis</option>
                </select>

                <span class="compare-toolbar-spacer" aria-hidden="true"></span>

                <input
                    id="stallionSearch"
                    class="stallion-search-input"
                    type="text"
                    placeholder="Hengst suchen..."
                    value="${escapeHtml(stallionSearchRaw)}"
                    onkeydown="handleStallionSearchEnter(event, ${pferde.indexOf(mare)})"
                >
                <button class="btn btn-mini" onclick="runStallionSearch(${pferde.indexOf(mare)})">Suchen</button>
            </div>

            <p><b>Hengst-Kombinationen</b></p>

            <p class="compare-summary">${stallions.length} Treffer · nur Hengste mit ausgeschlüsseltem Exterieur · ${inbreedingCount} mit Inzucht-Hinweis</p>

            <div class="compare-table-wrap">
                <table class="compare-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th><button type="button" onclick="setMareCombinationSort(${pferde.indexOf(mare)}, 'name')" style="background:none; border:0; padding:0; margin:0; color:inherit; font:inherit; font-weight:700; cursor:pointer;">${renderSortLabel("Name", "name")}</button></th>
                            <th><button type="button" onclick="setMareCombinationSort(${pferde.indexOf(mare)}, 'gp')" style="background:none; border:0; padding:0; margin:0; color:inherit; font:inherit; font-weight:700; cursor:pointer;">${renderSortLabel("GP", "gp")}</button></th>
                            <th><button type="button" onclick="setMareCombinationSort(${pferde.indexOf(mare)}, 'best')" style="background:none; border:0; padding:0; margin:0; color:inherit; font:inherit; font-weight:700; cursor:pointer;">${renderSortLabel("Best", "best")}</button></th>
                            <th><button type="button" onclick="setMareCombinationSort(${pferde.indexOf(mare)}, 'worst')" style="background:none; border:0; padding:0; margin:0; color:inherit; font:inherit; font-weight:700; cursor:pointer;">${renderSortLabel("Worst", "worst")}</button></th>
                            <th><button type="button" onclick="setMareCombinationSort(${pferde.indexOf(mare)}, 'spread')" style="background:none; border:0; padding:0; margin:0; color:inherit; font:inherit; font-weight:700; cursor:pointer;">${renderSortLabel("Spanne", "spread")}</button></th>
                            <th><button type="button" onclick="setMareCombinationSort(${pferde.indexOf(mare)}, 'inbreeding')" style="background:none; border:0; padding:0; margin:0; color:inherit; font:inherit; font-weight:700; cursor:pointer;">${renderSortLabel("Inzucht", "inbreeding")}</button></th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stallionRows || `<tr><td colspan="8" class="compare-empty">Keine Hengste für diese Filter gefunden.</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>

        <div id="view-turnier" style="display:none;">
            ${renderTournamentProfile(mare)}
        </div>
    `;

    container.innerHTML = html;
}

function showMareCombinationsByRefresh(mareIndex) {
    const mare = pferde[mareIndex];
    if (mare) {
        showMareCombinations(mare);
    }
}

function runStallionSearch(mareIndex) {
    showMareCombinationsByRefresh(mareIndex);
}

function handleStallionSearchEnter(event, mareIndex) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    runStallionSearch(mareIndex);
}



function showView(view) {

    const zucht = document.getElementById("view-zucht");
    const turnier = document.getElementById("view-turnier");

    const btnZucht = document.getElementById("btnZucht");
    const btnTurnier = document.getElementById("btnTurnier");

    if (!zucht || !turnier) return;

    if (view === "zucht") {
        zucht.style.display = "block";
        turnier.style.display = "none";

        btnZucht.classList.add("active");
        btnTurnier.classList.remove("active");
    } else {
        zucht.style.display = "none";
        turnier.style.display = "block";

        btnTurnier.classList.add("active");
        btnZucht.classList.remove("active");
    }
}


/* =========================
   🏆 TURNIER SYSTEM
========================= */

// Disziplinen und ihre Anforderungen
const DISCIPLINES = {
    // Dressur
    "Dressur": ["Dressur", "Schritt", "Trab", "Galopp", "Kraft", "Präzision", "Ausdruck", "Gelehrigkeit", "Aufmerksamkeit", "Intelligenz"],
    "Springen": ["Springen", "Galopp", "Beschleunigung", "Wendigkeit", "Kondition", "Kraft", "Tempo", "Furchtlosigkeit", "Leistungsbereitschaft", "Temperament"],
    "Cross Country": ["Cross Country", "Galopp", "Beschleunigung", "Wendigkeit", "Kondition", "Kraft", "Tempo", "Nervenstärke", "Aufmerksamkeit", "Leistungsbereitschaft"],
    "Distanz": ["Distanz", "Schritt", "Trab", "Galopp", "Kondition", "Tempo", "Gelassenheit", "Gutmütigkeit", "Nervenstärke", "Temperament"],
    
    // Flach- und Hindernisrennen
    "Flachrennen": ["Flachrennen", "Renngalopp", "Beschleunigung", "Kondition", "Tempo", "Kraft", "Gelassenheit", "Siegeswille", "Leistungsbereitschaft", "Temperament"],
    "Hindernisrennen": ["Hindernisrennen", "Renngalopp", "Beschleunigung", "Kondition", "Tempo", "Kraft", "Gelassenheit", "Siegeswille", "Nervenstärke", "Aufmerksamkeit"],
    "Seejagdrennen": ["Seejagdrennen", "Renngalopp", "Beschleunigung", "Kondition", "Tempo", "Kraft", "Gelassenheit", "Siegeswille", "Nervenstärke", "Furchtlosigkeit"],
    "Trabrennen": ["Trabrennen", "Trab", "Beschleunigung", "Kondition", "Tempo", "Kraft", "Gelassenheit", "Temperament", "Siegeswille", "Leistungsbereitschaft"],
    
    // Western
    "Reining": ["Reining", "Schritt", "Galopp", "Beschleunigung", "Wendigkeit", "Kondition", "Präzision", "Temperament", "Leistungsbereitschaft", "Intelligenz"],
    "Trail": ["Trail", "Schritt", "Trab", "Galopp", "Wendigkeit", "Präzision", "Gelassenheit", "Aufmerksamkeit", "Gelehrigkeit", "Intelligenz"],
    "Pleasure": ["Pleasure", "Schritt", "Trab", "Galopp", "Gelassenheit", "Ausdruck", "Präzision", "Sozialverhalten", "Gutmütigkeit", "Gelehrigkeit"],
    "Horsemanship": ["Horsemanship", "Schritt", "Trab", "Galopp", "Gelassenheit", "Ausdruck", "Präzision", "Gutmütigkeit", "Gelehrigkeit", "Intelligenz"],
    
    // Speed Events
    "Cutting": ["Cutting", "Galopp", "Beschleunigung", "Wendigkeit", "Gelassenheit", "Kraft", "Tempo", "Furchtlosigkeit", "Nervenstärke", "Intelligenz"],
    "Roping": ["Roping", "Galopp", "Beschleunigung", "Präzision", "Gelassenheit", "Kraft", "Tempo", "Aufmerksamkeit", "Furchtlosigkeit", "Nervenstärke"],
    "Pole Bending": ["Pole Bending", "Galopp", "Beschleunigung", "Wendigkeit", "Präzision", "Kraft", "Tempo", "Leistungsbereitschaft", "Siegeswille", "Temperament"],
    "Barrel Racing": ["Barrel Racing", "Galopp", "Beschleunigung", "Wendigkeit", "Präzision", "Kraft", "Tempo", "Leistungsbereitschaft", "Siegeswille", "Temperament"],
    
    // Fahren
    "Dressurfahren": ["Dressurfahren", "Schritt", "Trab", "Galopp", "Wendigkeit", "Präzision", "Ausdruck", "Sozialverhalten", "Gelehrigkeit", "Intelligenz"],
    "Hindernisfahren": ["Hindernisfahren", "Galopp", "Tempo", "Wendigkeit", "Präzision", "Kondition", "Kraft", "Sozialverhalten", "Aufmerksamkeit", "Furchtlosigkeit"],
    "Geländefahren": ["Geländefahren", "Galopp", "Tempo", "Wendigkeit", "Gelassenheit", "Kondition", "Kraft", "Sozialverhalten", "Nervenstärke", "Furchtlosigkeit"],
    "Holzrücken": ["Holzrücken", "Schritt", "Kraft", "Gelassenheit", "Kondition", "Wendigkeit", "Ausdruck", "Nervenstärke", "Furchtlosigkeit", "Gutmütigkeit"],
    
    // Barock
    "Klassische Dressur": ["Klassische Dressur", "Schritt", "Trab", "Galopp", "Kraft", "Präzision", "Ausdruck", "Gelehrigkeit", "Aufmerksamkeit", "Intelligenz"],
    "Spanische Gänge": ["Spanische Gänge", "Schritt", "Trab", "Wendigkeit", "Präzision", "Ausdruck", "Gelassenheit", "Gutmütigkeit", "Aufmerksamkeit", "Intelligenz"],
    "Schulsprünge": ["Schulsprünge", "Kraft", "Präzision", "Ausdruck", "Gelassenheit", "Kondition", "Wendigkeit", "Temperament", "Leistungsbereitschaft", "Nervenstärke"],
    "Hohe Schule": ["Hohe Schule", "Schritt", "Trab", "Galopp", "Kraft", "Präzision", "Ausdruck", "Gelehrigkeit", "Leistungsbereitschaft", "Intelligenz"],
    
    // Mehrgang
    "Tölt-Prüfung": ["Tölt-Prüfung", "Tölt", "Kraft", "Präzision", "Ausdruck", "Kondition", "Gelassenheit", "Gutmütigkeit", "Sozialverhalten", "Aufmerksamkeit"],
    "Passrennen": ["Passrennen", "Pass", "Beschleunigung", "Kondition", "Tempo", "Kraft", "Gelassenheit", "Sozialverhalten", "Siegeswille", "Temperament"],
    "Foxtrott Pleasure": ["Foxtrott Pleasure", "Foxtrott", "Gelassenheit", "Ausdruck", "Präzision", "Kondition", "Wendigkeit", "Gutmütigkeit", "Sozialverhalten", "Gelehrigkeit"],
    "Racking": ["Racking", "Rack", "Tempo", "Ausdruck", "Präzision", "Kondition", "Beschleunigung", "Gutmütigkeit", "Sozialverhalten", "Gelehrigkeit"]
};

// Interieur-Anforderungen pro Disziplin (6 wichtige)
const INTERIOR_REQUIREMENTS = {
    "Dressur": ["Gelehrigkeit", "Aufmerksamkeit", "Intelligenz"],
    "Springen": ["Furchtlosigkeit", "Leistungsbereitschaft", "Temperament"],
    "Cross Country": ["Nervenstärke", "Aufmerksamkeit", "Leistungsbereitschaft"],
    "Distanz": ["Temperament", "Gutmütigkeit", "Nervenstärke"],
    
    "Flachrennen": ["Leistungsbereitschaft", "Siegeswille", "Temperament"],
    "Hindernisrennen": ["Nervenstärke", "Siegeswille", "Aufmerksamkeit"],
    "Seejagdrennen": ["Nervenstärke", "Siegeswille", "Furchtlosigkeit"],
    "Trabrennen": ["Leistungsbereitschaft", "Temperament", "Siegeswille"],
    
    "Reining": ["Temperament", "Leistungsbereitschaft", "Intelligenz"],
    "Trail": ["Aufmerksamkeit", "Gelehrigkeit", "Intelligenz"],
    "Pleasure": ["Gutmütigkeit", "Sozialverhalten", "Gelehrigkeit"],
    "Horsemanship": ["Gutmütigkeit", "Gelehrigkeit", "Intelligenz"],
    
    "Cutting": ["Furchtlosigkeit", "Nervenstärke", "Intelligenz"],
    "Roping": ["Aufmerksamkeit", "Furchtlosigkeit", "Nervenstärke"],
    "Pole Bending": ["Temperament", "Siegeswille", "Leistungsbereitschaft"],
    "Barrel Racing": ["Temperament", "Siegeswille", "Leistungsbereitschaft"],
    
    "Dressurfahren": ["Sozialverhalten", "Gelehrigkeit", "Intelligenz"],
    "Hindernisfahren": ["Sozialverhalten", "Aufmerksamkeit", "Furchtlosigkeit"],
    "Geländefahren": ["Sozialverhalten", "Nervenstärke", "Furchtlosigkeit"],
    "Holzrücken": ["Gutmütigkeit", "Nervenstärke", "Furchtlosigkeit"],
    
    "Klassische Dressur": ["Gelehrigkeit", "Aufmerksamkeit", "Intelligenz"],
    "Spanische Gänge": ["Gutmütigkeit", "Aufmerksamkeit", "Intelligenz"],
    "Schulsprünge": ["Nervenstärke", "Temperament", "Leistungsbereitschaft"],
    "Hohe Schule": ["Gelehrigkeit", "Leistungsbereitschaft", "Intelligenz"],
    
    "Tölt-Prüfung": ["Gutmütigkeit", "Sozialverhalten", "Aufmerksamkeit"],
    "Passrennen": ["Temperament", "Sozialverhalten", "Siegeswille"],
    "Foxtrott Pleasure": ["Gutmütigkeit", "Sozialverhalten", "Gelehrigkeit"],
    "Racking": ["Gutmütigkeit", "Sozialverhalten", "Gelehrigkeit"]
};

const TOURNAMENT_CATEGORIES = {
    "Western": ["Reining", "Trail", "Pleasure", "Horsemanship"],
    "Rodeo": ["Cutting", "Roping", "Pole Bending", "Barrel Racing"],
    "Englisch": ["Dressur", "Springen", "Cross Country", "Distanz"],
    "Fahren": ["Dressurfahren", "Hindernisfahren", "Geländefahren", "Holzrücken"],
    "Rennen": ["Flachrennen", "Hindernisrennen", "Seejagdrennen", "Trabrennen"],
    "Barock": ["Klassische Dressur", "Spanische Gänge", "Schulsprünge", "Hohe Schule"],
    "Mehrgang": ["Tölt-Prüfung", "Passrennen", "Foxtrott Pleasure", "Racking"]
};

const CATEGORY_THEME = {
    "Western": { accent: "#7d4f2a", soft: "#f5ebe1", strong: "#5a3417" },
    "Rodeo": { accent: "#b44b3a", soft: "#fbe8e5", strong: "#7b2f23" },
    "Englisch": { accent: "#315f8f", soft: "#e8f0f9", strong: "#1f4268" },
    "Fahren": { accent: "#3b7f73", soft: "#e6f4f1", strong: "#25584f" },
    "Rennen": { accent: "#9b2f5f", soft: "#f9e6ef", strong: "#6a1f41" },
    "Barock": { accent: "#6b4f9e", soft: "#efe9fb", strong: "#463170" },
    "Mehrgang": { accent: "#8c6a2c", soft: "#f8f1e3", strong: "#5f481d" }
};

/**
 * Berechnet die Leistungsklasse basierend auf Potential-Prozentsätzen
 * Der NIEDRIGSTE Wert bestimmt die LK (Engpass-Prinzip)
 * Niedrig % = schlechte Performance = hohe LK-Zahl
 * LK10: 0-9%, LK9: 10-19%, LK8: 20-29%, ..., LK1: 90-100%
 */
function calculatePerformanceClass(percent) {
    if (percent === null || percent === undefined) return null;
    
    if (percent <= 9) return "LK10";
    if (percent <= 19) return "LK9";
    if (percent <= 29) return "LK8";
    if (percent <= 39) return "LK7";
    if (percent <= 49) return "LK6";
    if (percent <= 59) return "LK5";
    if (percent <= 69) return "LK4";
    if (percent <= 79) return "LK3";
    if (percent <= 89) return "LK2";
    return "LK1";
}

/**
 * Berechnet für eine Disziplin die beste erreichbare Leistungsklasse
 * Der schlechteste Wert bestimmt die LK
 */
function calculateDisciplineLevel(horse, disciplineName) {

    if (!horse.leistungen) return null;

    const required = DISCIPLINES[disciplineName];
    if (!required) return null;

    const requiredPerformance = required.slice(0, 7);
    if (!requiredPerformance.length) return null;


    // Hauptdisziplin muss vorhanden sein
    const mainSkill = requiredPerformance[0];
    const mainValue = getSkillValue(horse.leistungen[mainSkill]);

    if (mainValue === null) {
        return null;
    }


    // Engpass-Prinzip:
    // niedrigster vorhandener Wert bestimmt die LK
    let worstPercent = mainValue;


    for (let i = 1; i < requiredPerformance.length; i++) {

        const skill = requiredPerformance[i];
        const value = getSkillValue(horse.leistungen[skill]);

        // Turnier-LK nur berechnen, wenn alle geforderten Werte vorhanden sind.
        if (value === null) {
            return null;
        }

        if (value < worstPercent) {
            worstPercent = value;
        }
    }


    return calculatePerformanceClass(worstPercent);
}

// Fallback for detail view: uses discipline + six basics when full LK cannot be resolved.
function calculateDisciplineLevelFallback(horse, disciplineName) {
    if (!horse.leistungen) return null;

    const required = DISCIPLINES[disciplineName];
    if (!required) return null;

    const requiredPerformance = required.slice(0, 7);
    if (!requiredPerformance.length) return null;

    let worstPercent = null;

    for (const skill of requiredPerformance) {
        const value = getSkillValue(horse.leistungen[skill]);
        if (value === null) return null;
        if (worstPercent === null || value < worstPercent) {
            worstPercent = value;
        }
    }

    return calculatePerformanceClass(worstPercent);
}

function calculateDisciplineInteriorAverage(horse, disciplineName) {
    const requirements = INTERIOR_REQUIREMENTS[disciplineName];
    if (!requirements || !requirements.length) return null;

    const values = [];

    for (const trait of requirements) {
        const raw = horse?.interieur?.[trait];
        if (raw === null || raw === undefined) return null;

        if (typeof raw === "number") {
            values.push(raw);
            continue;
        }

        if (typeof raw === "string") {
            const mapped = mapInterior(raw);
            if (!mapped) return null;
            values.push(mapped);
            continue;
        }

        return null;
    }

    if (values.length !== requirements.length) return null;

    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    return avg.toFixed(2);
}

function resolveHorseInterior(horse) {
    if (!horse) return horse;

    if (horse.interieur && Object.keys(horse.interieur).length > 0) {
        return horse;
    }

    // Some legacy imports stored no interieur object; try to recover from saved text fields.
    const candidates = [horse.farbe, horse.raw, horse.sourceText].filter(value => typeof value === "string" && value.trim());

    for (const text of candidates) {
        const recovered = extractInterior(text);
        if (recovered && Object.keys(recovered).length > 0) {
            return { ...horse, interieur: recovered };
        }
    }

    return horse;
}


/**
 * Rendert das komplette Turnierprofil in Kategorien (4 pro Kategorie wie auf der Website)
 * Kategorien werden sortiert nach bester LK (oben)
 */
function renderTournamentProfile(horse) {
    if (!horse.leistungen || Object.keys(horse.leistungen).length === 0) {
        return `<div class="card"><p>Keine Leistungswerte vorhanden</p></div>`;
    }

    const resolvedHorse = resolveHorseInterior(horse);

    // Sortiere Kategorien nach bester LK (kleinste LK-Zahl ist am besten)
    const sortedCategories = Object.entries(TOURNAMENT_CATEGORIES).sort((a, b) => {
        const aLK = getCategoryBestLK(resolvedHorse, a[1]);
        const bLK = getCategoryBestLK(resolvedHorse, b[1]);
        if (aLK === null && bLK === null) return 0;
        if (aLK === null) return 1;
        if (bLK === null) return -1;
        return aLK - bLK;
    });

    let html = ``;

    for (let [category, disciplines] of sortedCategories) {
        const theme = getCategoryTheme(category);
        let categoryHtml = `
            <div style="margin-bottom: 25px;">
                <h3 style="margin: 0 0 12px 0; font-size: 1.1em; color: ${theme.strong}; border-bottom: 2px solid ${theme.accent}; padding-bottom: 8px; font-family: 'Playfair Display', serif;">
                    ${category}
                </h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(132px, 1fr)); gap: 8px;">
        `;

        for (let disciplineName of disciplines) {
            const strictLevel = calculateDisciplineLevel(resolvedHorse, disciplineName);
            const fallbackLevel = strictLevel ? null : calculateDisciplineLevelFallback(resolvedHorse, disciplineName);
            const displayLevel = strictLevel || fallbackLevel;
            const levelColor = displayLevel ? getLevelColor(displayLevel) : "#999";
            const tournamentValue = calculateTournamentValue(resolvedHorse, disciplineName);
            const interiorAvg = calculateDisciplineInteriorAverage(resolvedHorse, disciplineName);

            categoryHtml += `
                <div style="
                    border: 2px solid ${theme.accent};
                    border-radius: 10px;
                    padding: 7px 8px 5px;
                    background: ${theme.soft};
                    text-align: center;
                    font-family: 'Poppins', sans-serif;
                ">
                    <div style="
                        font-weight: 800;
                        color: ${theme.strong};
                        font-size: 0.85em;
                        min-height: 22px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding: 1px 2px;
                        text-transform: uppercase;
                        letter-spacing: 0.02em;
                    ">
                        <span>${disciplineName}</span>
                        <span style="font-size: 0.8em; color: ${levelColor}; font-weight: 800; letter-spacing: 0; text-transform: none;">${displayLevel || "—"}</span>
                    </div>
                    <div style="
                        font-size: 1.48em;
                        font-weight: 900;
                        color: #1f3a2e;
                        line-height: 1;
                        margin-top: 0;
                        letter-spacing: 0.01em;
                    ">
                        ${tournamentValue !== null ? tournamentValue : "—"}
                    </div>

                    <div style="margin-top: 5px; border-top: 1px solid rgba(0,0,0,0.08); padding-top: 4px; display: flex; justify-content: center; gap: 6px; font-size: 0.64em; color: #6a756f;">
                        <span>Int Ø <b style="color: #33453c;">${interiorAvg ?? "—"}</b></span>
                    </div>
                </div>
            `;
        }

        categoryHtml += `
                </div>
            </div>
        `;

        html += categoryHtml;
    }

    return html;
}

function getCategoryTheme(category) {
    return CATEGORY_THEME[category] || { accent: "#6d6d6d", soft: "#f3f3f3", strong: "#404040" };
}

/**
 * Gibt die Farbe für eine Leistungsklasse zurück
 */
function getLevelColor(level) {
    const colors = {
        "LK10": "#1e7e34", // Grün
        "LK9": "#198754",
        "LK8": "#0d6efd", // Blau
        "LK7": "#0dcaf0",
        "LK6": "#ffff00", // Gelb
        "LK5": "#ff9800",
        "LK4": "#fd7e14", // Orange
        "LK3": "#dc3545", // Rot
        "LK2": "#c82333",
        "LK1": "#6f42c1"  // Violett
    };
    return colors[level] || "#999";
}

/**
 * Berechnet den Turnierwert für eine Disziplin
 * Die Disziplin selber wird dreifach gewertet, alle anderen Skills einfach
 */
function calculateTournamentValue(horse, disciplineName) {

    if (!horse.leistungen) return null;

    const required = DISCIPLINES[disciplineName];
    if (!required) return null;

    // Points are based on discipline + six basics (first 7 entries in the requirement list).
    const requiredPerformance = required.slice(0, 7);
    if (!requiredPerformance.length) return null;

    let totalPoints = 0;
    let hasMainSkill = false;

    const mainSkill = requiredPerformance[0];

    for (let skill of requiredPerformance) {

        const value = getTournamentSkillValue(horse.leistungen[skill]);

        if (value === null) return null;

        if (skill === mainSkill) {
            totalPoints += value * 3;
            hasMainSkill = true;
        } else {
            totalPoints += value;
        }
    }

    if (!hasMainSkill) return null;

    return Math.round(totalPoints);
}

/**
 * Gibt die beste LK einer Kategorie zurück
 */
function getCategoryBestLK(horse, disciplines) {
    let bestLK = null;
    const lkOrder = {
        "LK10": 10, "LK9": 9, "LK8": 8, "LK7": 7, "LK6": 6,
        "LK5": 5, "LK4": 4, "LK3": 3, "LK2": 2, "LK1": 1
    };

    for (let disciplineName of disciplines) {
        const level = calculateDisciplineLevel(horse, disciplineName);
        const value = level ? lkOrder[level] : null;
        if (value === null) continue;

        if (bestLK === null || value < bestLK) {
            bestLK = value;
        }
    }

    return bestLK;
}

/* =========================
   INIT
========================= */

window.addEventListener("DOMContentLoaded", async () => {
    await loadPferde();
    initColorTools();
    renderDatabase();
});