"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  serverTimestamp,
  orderBy,
  query,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "../lib/firebase";

const BLANK_ADD_FORM = {
  name: "",
  regNumber: "",
  email: "",
  vitMail: "",
  phone: "",
  yearOfStudy: "",
  slot: "",
  residence: "",
  dept1: "",
  dept2: "",
  dept3: "",
  reason: "",
  experience: "",
  designPortfolio: "",
  mediaPortfolio: "",
  github: "",
};

export default function Home() {
  const [applicants, setApplicants] = useState([]);
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(BLANK_ADD_FORM);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sheetLink, setSheetLink] = useState("");
  const [importingLink, setImportingLink] = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const fileInputRef = useRef(null);

  useEffect(() => {
    const q = query(collection(db, "applicants"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setApplicants(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setError("");
      },
      (err) => {
        console.error(err);
        setError(
          "Could not connect to Firestore. Check your Firebase config and security rules."
        );
      }
    );
    return () => unsub();
  }, []);

  const counts = useMemo(() => {
    let completed = 0,
      waiting = 0,
      notArrived = 0;
    for (const a of applicants) {
      if (a.interviewed) completed++;
      else if (a.arrived) waiting++;
      else notArrived++;
    }
    return { completed, waiting, notArrived, total: applicants.length };
  }, [applicants]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return applicants;
    return applicants.filter(
      (a) =>
        (a.name || "").toLowerCase().includes(term) ||
        (a.regNumber || "").toLowerCase().includes(term) ||
        (a.dept1 || "").toLowerCase().includes(term) ||
        (a.dept2 || "").toLowerCase().includes(term) ||
        (a.dept3 || "").toLowerCase().includes(term) ||
        (a.email || "").toLowerCase().includes(term) ||
        (a.vitMail || "").toLowerCase().includes(term)
    );
  }, [applicants, search]);

  // Interview queue: arrived, not yet interviewed, ordered by check-in time (first come first served)
  const queue = useMemo(() => {
    return filtered
      .filter((a) => a.arrived && !a.interviewed)
      .sort((a, b) => {
        const ta = a.arrivedAt?.toMillis ? a.arrivedAt.toMillis() : 0;
        const tb = b.arrivedAt?.toMillis ? b.arrivedAt.toMillis() : 0;
        return ta - tb;
      });
  }, [filtered]);

  const notArrivedList = useMemo(
    () => filtered.filter((a) => !a.arrived && !a.interviewed),
    [filtered]
  );

  const completedList = useMemo(
    () => filtered.filter((a) => a.interviewed),
    [filtered]
  );

  const updateAddForm = (field) => (e) =>
    setAddForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.regNumber.trim()) return;
    try {
      await addDoc(collection(db, "applicants"), {
        name: addForm.name.trim(),
        regNumber: addForm.regNumber.trim(),
        email: addForm.email.trim(),
        vitMail: addForm.vitMail.trim(),
        phone: addForm.phone.trim(),
        yearOfStudy: addForm.yearOfStudy.trim(),
        slot: addForm.slot.trim(),
        residence: addForm.residence.trim(),
        dept1: addForm.dept1.trim(),
        dept2: addForm.dept2.trim(),
        dept3: addForm.dept3.trim(),
        reason: addForm.reason.trim(),
        experience: addForm.experience.trim(),
        designPortfolio: addForm.designPortfolio.trim(),
        mediaPortfolio: addForm.mediaPortfolio.trim(),
        github: addForm.github.trim(),
        arrived: false,
        interviewed: false,
        arrivedAt: null,
        createdAt: serverTimestamp(),
      });
      setAddForm(BLANK_ADD_FORM);
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
      setError("Failed to add applicant. Check Firestore permissions.");
    }
  };

  // Exact-header lookup: tries each key in order, returns the first non-empty match
  const pick = (row, keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
        return String(row[k]).trim();
      }
    }
    return "";
  };

  // Fuzzy fallback: finds the first column whose header contains ALL keywords in a
  // group (case-insensitive). Tries each group in order. Handles long, form-generated
  // headers like "Which department would you like to volunteer for? [1st preference]"
  const pickFuzzy = (row, keywordGroups) => {
    const headers = Object.keys(row);
    for (const keywords of keywordGroups) {
      const match = headers.find((h) => {
        const lower = h.toLowerCase();
        return keywords.every((kw) => lower.includes(kw));
      });
      if (match && String(row[match]).trim() !== "") {
        return String(row[match]).trim();
      }
    }
    return "";
  };

  const NAME_KEYS = ["Name", "name", "Student Name", "Full Name"];
  const REG_KEYS = [
    "Reg No",
    "Reg. No.",
    "RegNo",
    "regNumber",
    "Registration Number",
    "Registration No",
    "Reg Number",
  ];
  const EMAIL_KEYS = ["Email Address", "Email", "email"];
  const VIT_MAIL_KEYS = ["VIT Mail ID", "VIT Mail Id", "VIT Email", "vitMailId"];
  const PHONE_KEYS = ["Phone Number", "Phone", "Mobile Number", "Mobile", "Contact Number"];
  const YEAR_KEYS = ["Year of Study", "Year"];
  const SLOT_KEYS = ["Select your slot", "Slot"];
  const RESIDENCE_KEYS = [
    "Select from the following",
    "Hosteller/Day Scholar",
    "Residence",
    "Hosteller / Day Scholar",
  ];
  const DEPT1_GROUPS = [
    ["department", "1st preference"],
    ["department", "first preference"],
    ["department"],
  ];
  const DEPT2_GROUPS = [
    ["department", "2nd preference"],
    ["department", "second preference"],
  ];
  const DEPT3_GROUPS = [
    ["department", "3rd preference"],
    ["department", "third preference"],
  ];
  const LITERARY_GROUPS = [["literary"]];
  const REASON_GROUPS = [["reason", "chosen"], ["reason"]];
  const EXPERIENCE_GROUPS = [["experience", "skill"], ["experience"], ["skill"]];
  const DESIGN_PORTFOLIO_GROUPS = [["portfolio", "design"], ["decor"]];
  const MEDIA_PORTFOLIO_GROUPS = [["media portfolio"], ["best works"]];
  const GITHUB_GROUPS = [["github"]];

  // Turns one parsed spreadsheet row into a Firestore-ready applicant object,
  // or null if it's missing a name / reg number.
  const rowToApplicant = (row) => {
    const name = pick(row, NAME_KEYS);
    const regNumber = pick(row, REG_KEYS);
    if (!name || !regNumber) return null;
    return {
      name,
      regNumber,
      email: pick(row, EMAIL_KEYS),
      vitMail: pick(row, VIT_MAIL_KEYS),
      phone: pick(row, PHONE_KEYS),
      yearOfStudy: pick(row, YEAR_KEYS),
      slot: pick(row, SLOT_KEYS),
      residence: pick(row, RESIDENCE_KEYS),
      dept1: pickFuzzy(row, DEPT1_GROUPS),
      dept2: pickFuzzy(row, DEPT2_GROUPS),
      dept3: pickFuzzy(row, DEPT3_GROUPS),
      literaryInterest: pickFuzzy(row, LITERARY_GROUPS),
      reason: pickFuzzy(row, REASON_GROUPS),
      experience: pickFuzzy(row, EXPERIENCE_GROUPS),
      designPortfolio: pickFuzzy(row, DESIGN_PORTFOLIO_GROUPS),
      mediaPortfolio: pickFuzzy(row, MEDIA_PORTFOLIO_GROUPS),
      github: pickFuzzy(row, GITHUB_GROUPS),
      arrived: false,
      interviewed: false,
      arrivedAt: null,
      createdAt: serverTimestamp(),
    };
  };

  // Writes an array of parsed rows to Firestore in batches of 450 (Firestore's
  // batched-write cap is 500 operations).
  const importRows = async (rows) => {
    let imported = 0;
    let skipped = 0;
    const CHUNK_SIZE = 450;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const row of chunk) {
        const applicant = rowToApplicant(row);
        if (!applicant) {
          skipped++;
          continue;
        }
        const ref = doc(collection(db, "applicants"));
        batch.set(ref, applicant);
        imported++;
      }
      await batch.commit();
    }
    return { imported, skipped };
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (!rows.length) {
        setError("The file appears to be empty.");
        setUploading(false);
        return;
      }

      const { imported, skipped } = await importRows(rows);
      setNotice(
        `Imported ${imported} applicant${imported === 1 ? "" : "s"}.` +
          (skipped ? ` Skipped ${skipped} row(s) missing a name or reg. number.` : "")
      );
    } catch (err) {
      console.error(err);
      setError(
        "Failed to import file. Make sure it's a valid Excel/CSV file with a Name and Reg. Number column."
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Extracts the spreadsheet ID and (optional) gid/sheet tab from a normal
  // Google Sheets share URL, e.g.
  // https://docs.google.com/spreadsheets/d/1abc.../edit?usp=sharing#gid=123
  const parseGoogleSheetUrl = (url) => {
    const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!idMatch) return null;
    const gidMatch = url.match(/[?#&]gid=([0-9]+)/);
    return { id: idMatch[1], gid: gidMatch ? gidMatch[1] : "0" };
  };

  const handleLinkImport = async (e) => {
    e.preventDefault();
    const url = sheetLink.trim();
    if (!url) return;

    const parsed = parseGoogleSheetUrl(url);
    if (!parsed) {
      setError(
        "That doesn't look like a Google Sheets link. Paste the URL from your browser's address bar while viewing the sheet."
      );
      return;
    }

    setImportingLink(true);
    setError("");
    setNotice("");

    // Guard against the request hanging forever (e.g. the sheet isn't actually
    // link-shared and Google silently redirects to a sign-in page).
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${parsed.id}/export?format=csv&gid=${parsed.gid}`;
      const res = await fetch(csvUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Sheet fetch failed with status ${res.status}`);
      }
      const csvText = await res.text();

      // If the sheet isn't actually link-shared, Google returns an HTML sign-in
      // page instead of CSV. Detect that instead of trying to parse it as data.
      if (csvText.trim().startsWith("<")) {
        throw new Error("Received a sign-in page instead of CSV data.");
      }

      const workbook = XLSX.read(csvText, { type: "string" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (!rows.length) {
        setError("The linked sheet appears to be empty.");
        return;
      }

      const { imported, skipped } = await importRows(rows);
      setNotice(
        `Imported ${imported} applicant${imported === 1 ? "" : "s"} from the link.` +
          (skipped ? ` Skipped ${skipped} row(s) missing a name or reg. number.` : "")
      );
      setSheetLink("");
    } catch (err) {
      clearTimeout(timeoutId);
      console.error(err);
      if (err.name === "AbortError") {
        setError(
          "The request timed out. Double-check the sheet is shared as \"Anyone with the link can view,\" or use Import from Excel/CSV instead."
        );
      } else {
        setError(
          "Couldn't read that sheet directly. Make sure it's shared as \"Anyone with the link can view,\" or download it as .xlsx/.csv and use Import from Excel/CSV instead."
        );
      }
    } finally {
      setImportingLink(false);
    }
  };

  const toggleArrived = async (a) => {
    try {
      const goingArrived = !a.arrived;
      await updateDoc(doc(db, "applicants", a.id), {
        arrived: goingArrived,
        arrivedAt: goingArrived ? serverTimestamp() : null,
        // if un-checking arrival, they can't stay marked interviewed
        interviewed: goingArrived ? a.interviewed : false,
      });
    } catch (err) {
      console.error(err);
      setError("Failed to update. Check Firestore permissions.");
    }
  };

  const toggleInterviewed = async (a) => {
    try {
      await updateDoc(doc(db, "applicants", a.id), {
        interviewed: !a.interviewed,
      });
    } catch (err) {
      console.error(err);
      setError("Failed to update. Check Firestore permissions.");
    }
  };

  const removeApplicant = async (a) => {
    if (!confirm(`Remove ${a.name} from the list?`)) return;
    try {
      await deleteDoc(doc(db, "applicants", a.id));
    } catch (err) {
      console.error(err);
      setError("Failed to delete. Check Firestore permissions.");
    }
  };

  const toggleExpanded = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const ApplicantRow = ({ a, queuePosition }) => {
    const isOpen = expanded.has(a.id);
    const hasExtra =
      a.reason || a.experience || a.designPortfolio || a.mediaPortfolio || a.github;
    const depts = [a.dept1, a.dept2, a.dept3].filter(Boolean);

    return (
      <div className="applicant-card">
        <div className="applicant-main">
          <div className="applicant-info">
            <div className="applicant-name">
              {queuePosition && <span className="queue-number">#{queuePosition}</span>}
              {a.name}
            </div>
            <div className="applicant-reg">
              Reg #{a.regNumber}
              {depts.length ? ` · ${depts.join(" / ")}` : ""}
            </div>
            {(a.email || a.vitMail) && (
              <div className="applicant-contact">
                {a.email && <span>{a.email}</span>}
                {a.vitMail && <span>{a.vitMail}</span>}
              </div>
            )}
            {(a.phone || a.yearOfStudy || a.slot || a.residence) && (
              <div className="applicant-meta">
                {a.phone && <span>{a.phone}</span>}
                {a.yearOfStudy && <span>{a.yearOfStudy}</span>}
                {a.slot && <span>{a.slot}</span>}
                {a.residence && <span>{a.residence}</span>}
              </div>
            )}
          </div>
          <div className="actions">
            <button
              className={`btn ${a.arrived ? "on" : ""}`}
              onClick={() => toggleArrived(a)}
            >
              {a.arrived ? "Arrived ✓" : "Check In"}
            </button>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={!!a.interviewed}
                onChange={() => toggleInterviewed(a)}
              />
              Interviewed
            </label>
            <button className="btn danger-outline" onClick={() => removeApplicant(a)}>
              Remove
            </button>
          </div>
        </div>

        {hasExtra && (
          <>
            <button className="expand-toggle" onClick={() => toggleExpanded(a.id)}>
              {isOpen ? "Hide details ▲" : "Show details ▼"}
            </button>
            {isOpen && (
              <div className="expanded-details">
                {a.reason && (
                  <div className="detail-block">
                    <span className="detail-label">Reason for choosing depts</span>
                    <p>{a.reason}</p>
                  </div>
                )}
                {a.experience && (
                  <div className="detail-block">
                    <span className="detail-label">Experience / skills</span>
                    <p>{a.experience}</p>
                  </div>
                )}
                {a.designPortfolio && (
                  <div className="detail-block">
                    <span className="detail-label">Design portfolio</span>
                    <a href={a.designPortfolio} target="_blank" rel="noreferrer">
                      {a.designPortfolio}
                    </a>
                  </div>
                )}
                {a.mediaPortfolio && (
                  <div className="detail-block">
                    <span className="detail-label">Media portfolio</span>
                    <a href={a.mediaPortfolio} target="_blank" rel="noreferrer">
                      {a.mediaPortfolio}
                    </a>
                  </div>
                )}
                {a.github && (
                  <div className="detail-block">
                    <span className="detail-label">GitHub</span>
                    <a href={a.github} target="_blank" rel="noreferrer">
                      {a.github}
                    </a>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="container">
      <h1>Recruitment OC Queue</h1>

      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="notice-banner">{notice}</div>}

      <div className="stats">
        <div className="stat-card completed">
          <div className="stat-value">{counts.completed}</div>
          <div className="stat-label">Interviewed</div>
        </div>
        <div className="stat-card waiting">
          <div className="stat-value">{counts.waiting}</div>
          <div className="stat-label">Waiting</div>
        </div>
        <div className="stat-card notarrived">
          <div className="stat-value">{counts.notArrived}</div>
          <div className="stat-label">Not Arrived</div>
        </div>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by name, reg. number, or dept..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="add-toggle" onClick={() => setShowAddForm((s) => !s)}>
          {showAddForm ? "Close" : "+ Add"}
        </button>
      </div>

      <div className="import-bar">
        <label className="upload-btn">
          {uploading ? "Importing..." : "Import from Excel/CSV"}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            ref={fileInputRef}
            onChange={handleFileUpload}
            disabled={uploading}
            hidden
          />
        </label>
      </div>

      <form className="link-import-bar" onSubmit={handleLinkImport}>
        <input
          type="url"
          placeholder="Or paste a Google Sheets link..."
          value={sheetLink}
          onChange={(e) => setSheetLink(e.target.value)}
        />
        <button type="submit" disabled={importingLink}>
          {importingLink ? "Importing..." : "Import"}
        </button>
      </form>
      <div className="import-hint">
        Reads Name, Reg No, Email, VIT Mail, Phone, Year, Slot, Residence, all 3 dept
        preferences, plus reason/experience/portfolio links. For a link import, the
        sheet must be shared as &quot;Anyone with the link can view.&quot; Times out
        after 20s if the sheet can&apos;t be reached.
      </div>

      {showAddForm && (
        <form className="add-form" onSubmit={handleAdd}>
          <div className="add-form-section">
            <input
              placeholder="Full name *"
              value={addForm.name}
              onChange={updateAddForm("name")}
              required
            />
            <input
              placeholder="Registration number *"
              value={addForm.regNumber}
              onChange={updateAddForm("regNumber")}
              required
            />
            <input
              placeholder="Personal email"
              value={addForm.email}
              onChange={updateAddForm("email")}
            />
            <input
              placeholder="VIT mail ID"
              value={addForm.vitMail}
              onChange={updateAddForm("vitMail")}
            />
            <input
              placeholder="Phone number"
              value={addForm.phone}
              onChange={updateAddForm("phone")}
            />
            <input
              placeholder="Year of study"
              value={addForm.yearOfStudy}
              onChange={updateAddForm("yearOfStudy")}
            />
            <input
              placeholder="Slot (Morning/Evening)"
              value={addForm.slot}
              onChange={updateAddForm("slot")}
            />
            <input
              placeholder="Hosteller / Day Scholar"
              value={addForm.residence}
              onChange={updateAddForm("residence")}
            />
            <input
              placeholder="1st preference dept"
              value={addForm.dept1}
              onChange={updateAddForm("dept1")}
            />
            <input
              placeholder="2nd preference dept"
              value={addForm.dept2}
              onChange={updateAddForm("dept2")}
            />
            <input
              placeholder="3rd preference dept"
              value={addForm.dept3}
              onChange={updateAddForm("dept3")}
            />
            <input
              placeholder="Design portfolio link"
              value={addForm.designPortfolio}
              onChange={updateAddForm("designPortfolio")}
            />
            <input
              placeholder="Media portfolio link"
              value={addForm.mediaPortfolio}
              onChange={updateAddForm("mediaPortfolio")}
            />
            <input
              placeholder="GitHub link"
              value={addForm.github}
              onChange={updateAddForm("github")}
            />
          </div>
          <textarea
            placeholder="Reason for choosing these departments"
            value={addForm.reason}
            onChange={updateAddForm("reason")}
            rows={2}
          />
          <textarea
            placeholder="Previous experience / relevant skills"
            value={addForm.experience}
            onChange={updateAddForm("experience")}
            rows={2}
          />
          <button type="submit" className="add-form-submit">
            Save Applicant
          </button>
        </form>
      )}

      {queue.length > 0 && (
        <>
          <h2 className="section-heading">Interview Queue ({queue.length})</h2>
          <div className="list">
            {queue.map((a, idx) => (
              <ApplicantRow a={a} key={a.id} queuePosition={idx + 1} />
            ))}
          </div>
        </>
      )}

      {notArrivedList.length > 0 && (
        <>
          <h2 className="section-heading">Not Arrived ({notArrivedList.length})</h2>
          <div className="list">
            {notArrivedList.map((a) => (
              <ApplicantRow a={a} key={a.id} />
            ))}
          </div>
        </>
      )}

      {completedList.length > 0 && (
        <>
          <h2 className="section-heading">Completed ({completedList.length})</h2>
          <div className="list">
            {completedList.map((a) => (
              <ApplicantRow a={a} key={a.id} />
            ))}
          </div>
        </>
      )}

      {filtered.length === 0 && <div className="empty">No applicants found.</div>}
    </div>
  );
}
