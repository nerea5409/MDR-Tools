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

    if (name === "zucht") {
        populateBreedingDropdowns();
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

    if (!Object.keys(exterieur).length) {
        return null;
    }

    return {
        name,
        geschlecht: roleLabel,
        exterieur
    };
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

    const lines = text.split("\n");

    let capture = false;
    let result = {};

    for (let line of lines) {

        line = line.trim();

        if (line.startsWith("Exterieur")) {
            capture = true;
            continue;
        }

        if (capture && line.includes("Interieur")) break;
        if (!capture) continue;

        if (!line.includes("|")) continue;

        const [left, right] = line.split("|");

        const key = left.trim().split(/\s+/)[0];

        const leftGenes = left.trim().split(/\s+/).slice(1);
        const rightGenes = right.trim().split(/\s+/);

        result[key] = {
            score: evaluateExteriorFixed(leftGenes, rightGenes),
            genes: [...leftGenes, ...rightGenes]
        };
    }

    if (Object.keys(result).length > 0) {
        return result;
    }

    return parseExteriorFromText(text);
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
    const startIndex = lines.findIndex((line) => /exterieur\s*nach\s*text/i.test(line));

    if (startIndex === -1) {
        return text;
    }

    const collected = [];
    for (let i = startIndex + 1; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (/^(interieur|farben|leistungen|leistung|turnier|genetik)\b/i.test(trimmed)) {
            break;
        }

        collected.push(line);
    }

    return collected.join("\n");
}

function parseExteriorFromText(text) {
    const section = extractExteriorTextSection(text);
    const lines = section.split("\n").map((line) => line.trim()).filter(Boolean);
    const result = {};

    for (const trait of EXTERIOR_TEXT_TRAITS) {
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

    if (!mare || !stallion) return;

    mare.innerHTML = "";
    stallion.innerHTML = "";

    pferde.forEach((p, i) => {

        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = p.name;

        if (p.geschlecht === "Stute") mare.appendChild(opt);
        if (p.geschlecht === "Hengst") stallion.appendChild(opt.cloneNode(true));
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

    for (const key of mareKeys) {
        const genes = stallion?.exterieur?.[key]?.genes;
        if (!Array.isArray(genes) || genes.length < 8) {
            return false;
        }
    }

    return true;
}

function showStallionDetailFromMare(mareIndex, stallionIndex) {
    const mare = pferde[mareIndex];
    const stallion = pferde[stallionIndex];
    if (!mare || !stallion) {
        renderDatabase();
        return;
    }

    showStallionView(stallion, {
        backAction: `showMareCombinationsByRefresh(${mareIndex})`,
        backLabel: "Zurück zur Hengstkombi"
    });
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



function showMareCombinations(mare) {

    document.getElementById("db_sortbar").style.display = "none";
    document.querySelector("#datenbank .hero").style.display = "none";

    const container = document.getElementById("db_liste");

    let stallions = pferde.filter(p => p.geschlecht === "Hengst");

    const stallionSearchRaw = (document.getElementById("stallionSearch")?.value || "").trim().toLowerCase();

    stallions = stallions.filter((horse) => {
        const genesPass = hasCompleteExteriorGenesForPair(mare, horse);
        const searchPass = !stallionSearchRaw || (horse.name || "").toLowerCase().includes(stallionSearchRaw);
        return genesPass && searchPass;
    });

    const mode = document.getElementById("sortMode")?.value || "best";

    const rangeCache = new Map();
    const getRange = (stallion) => {
        const key = stallion.name;
        if (!rangeCache.has(key)) {
            rangeCache.set(key, calculateExteriorRange(mare, stallion));
        }
        return rangeCache.get(key);
    };

    stallions.sort((a, b) => {

        const aRange = getRange(a);
        const bRange = getRange(b);

        if (mode === "gp") {
            return b.gp - a.gp;
        }

        if (mode === "name") {
            return a.name.localeCompare(b.name);
        }

        if (mode === "best") {
            return Number(aRange.best) - Number(bRange.best);
        }

        if (mode === "worst") {
            return Number(aRange.worst) - Number(bRange.worst);
        }

    });

    const stallionRows = stallions.map((stallion, index) => {
        const range = getRange(stallion);
        const spread = (Number(range.worst) - Number(range.best)).toFixed(2);
        const owner = normalizeOwner(stallion.besitzer);

        return `
            <tr>
                <td>${index + 1}</td>
                <td><b>${escapeHtml(stallion.name)}</b></td>
                <td>${escapeHtml(owner)}</td>
                <td>${stallion.gp}</td>
                <td><span class="score-chip score-chip-good">${range.best}</span></td>
                <td><span class="score-chip score-chip-warn">${range.worst}</span></td>
                <td>${spread}</td>
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
                <label class="compare-sort-label" for="sortMode">Sortierung</label>
                <select class="compare-sort-select" id="sortMode" onchange="showMareCombinationsByRefresh(${pferde.indexOf(mare)})">

                <option value="name" ${mode === "name" ? "selected" : ""}>
                    Name
                </option>

                <option value="gp" ${mode === "gp" ? "selected" : ""}>
                    GP
                </option>

                <option value="best" ${mode === "best" ? "selected" : ""}>
                    Best
                </option>

                <option value="worst" ${mode === "worst" ? "selected" : ""}>
                    Worst
                </option>

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

            <p class="compare-summary">${stallions.length} Treffer · nur Hengste mit ausgeschlüsseltem Exterieur</p>

            <div class="compare-table-wrap">
                <table class="compare-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Name</th>
                            <th>Besitzer</th>
                            <th>GP</th>
                            <th>Best</th>
                            <th>Worst</th>
                            <th>Spanne</th>
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
    
    // Klassische Reiterei
    "Klassische Dressur": ["Klassische Dressur", "Schritt", "Trab", "Galopp", "Kraft", "Präzision", "Ausdruck", "Gelehrigkeit", "Aufmerksamkeit", "Intelligenz"],
    "Spanische Gänge": ["Spanische Gänge", "Schritt", "Trab", "Wendigkeit", "Präzision", "Ausdruck", "Gelassenheit", "Gutmütigkeit", "Aufmerksamkeit", "Intelligenz"],
    "Schulsprünge": ["Schulsprünge", "Kraft", "Präzision", "Ausdruck", "Gelassenheit", "Kondition", "Wendigkeit", "Temperament", "Leistungsbereitschaft", "Nervenstärke"],
    "Hohe Schule": ["Hohe Schule", "Schritt", "Trab", "Galopp", "Kraft", "Präzision", "Ausdruck", "Gelehrigkeit", "Leistungsbereitschaft", "Intelligenz"],
    
    // Gang-Spezialrassen
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
    
    "Flachrennen": ["Gelassenheit", "Siegeswille", "Temperament"],
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
    "Klassische Reiterei": ["Klassische Dressur", "Spanische Gänge", "Schulsprünge", "Hohe Schule"],
    "Gang-Spezialrassen": ["Tölt-Prüfung", "Passrennen", "Foxtrott Pleasure", "Racking"]
};

const CATEGORY_THEME = {
    "Western": { accent: "#7d4f2a", soft: "#f5ebe1", strong: "#5a3417" },
    "Rodeo": { accent: "#b44b3a", soft: "#fbe8e5", strong: "#7b2f23" },
    "Englisch": { accent: "#315f8f", soft: "#e8f0f9", strong: "#1f4268" },
    "Fahren": { accent: "#3b7f73", soft: "#e6f4f1", strong: "#25584f" },
    "Rennen": { accent: "#9b2f5f", soft: "#f9e6ef", strong: "#6a1f41" },
    "Klassische Reiterei": { accent: "#6b4f9e", soft: "#efe9fb", strong: "#463170" },
    "Gang-Spezialrassen": { accent: "#8c6a2c", soft: "#f8f1e3", strong: "#5f481d" }
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
    renderDatabase();
});