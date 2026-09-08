"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import { db } from "../../lib/firebase";
import ThemeToggle from "../ThemeToggle";

const ADMIN_PASSWORD = "thaniadmin";

function AdminGate({ children }) {
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (input === ADMIN_PASSWORD) {
      setAuthed(true);
      setErr("");
    } else {
      setErr("Incorrect admin password.");
    }
  };

  if (!authed) {
    return (
      <div className="gate-shell">
        <div className="gate-theme-toggle">
          <ThemeToggle />
        </div>
        <form className="gate-card" onSubmit={submit}>
          <h2>Admin Access</h2>
          <p>Enter the admin password to continue</p>
          <input
            type="password"
            placeholder="Admin password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
          {err && <div className="gate-error">{err}</div>}
          <button type="submit">Enter</button>
          <Link href="/" className="back-link">← Back to main page</Link>
        </form>
      </div>
    );
  }

  return children;
}

function AdminPanel() {
  const [uploading, setUploading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [removingAll, setRemovingAll] = useState(false);
  const fileInputRef = useRef(null);

  const pick = (row, keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
        return String(row[k]).trim();
      }
    }
    return "";
  };

  const nameKeys = ["Full Name", "Name", "name", "Student Name"];
  const regKeys = ["Registration Number", "Reg No", "Reg. No.", "RegNo", "regNumber", "Registration No", "Reg Number"];
  const vitMailKeys = ["VIT Mail ID", "VIT Mail", "vitMail"];
  const phoneKeys = ["Phone Number", "Phone", "phone"];
  const yearKeys = ["Year of Study", "Year"];
  const slotKeys = ["Select your slot", "Slot"];
  const hostelKeys = ["Select from the following", "Hosteller/Day Scholar", "Hostel Type", "hostelType"];
  const dept1Keys = ["Which department would you like to volunteer for? [1st preference]", "1st preference", "Dept 1st preference", "Dept", "dept"];
  const dept2Keys = ["Which department would you like to volunteer for? [2nd preference]", "2nd preference", "Dept 2nd preference"];
  const dept3Keys = ["Which department would you like to volunteer for? [3rd preference]", "3rd preference", "Dept 3rd preference"];
  const literaryKeys = ["Are you interested in curating literary events?", "Literary Events", "literaryInterest"];
  const reasonKeys = ["Provide a reason as to why you have chosen the above 3 departments", "Reason"];
  const experienceKeys = ["Mention your previous experience/relevant skills if any", "Experience"];
  const designPortfolioKeys = ["Upload your portfolio/ any previous design or decor work/ make a poster for an imaginary event", "Design Portfolio"];
  const mediaPortfolioKeys = ["Upload your media portfolio/ any of your best works", "Media Portfolio"];
  const githubKeys = ["Attach your GitHub link", "GitHub", "Github Link", "github"];

  const importRows = async (rows) => {
    if (!rows.length) {
      setError("The file/link returned no rows.");
      return;
    }
    let imported = 0, skipped = 0;
    const CHUNK_SIZE = 450;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const row of chunk) {
        const name = pick(row, nameKeys);
        const regNumber = pick(row, regKeys);
        const dept1 = pick(row, dept1Keys);
        if (!name || !regNumber) {
          skipped++;
          continue;
        }
        const ref = doc(collection(db, "applicants"));
        batch.set(ref, {
          name,
          regNumber,
          vitMail: pick(row, vitMailKeys),
          phone: pick(row, phoneKeys),
          year: pick(row, yearKeys),
          slot: pick(row, slotKeys),
          hostelType: pick(row, hostelKeys),
          dept1,
          dept2: pick(row, dept2Keys),
          dept3: pick(row, dept3Keys),
          // kept for backward compatibility with search / older records
          dept: dept1,
          literaryInterest: pick(row, literaryKeys),
          reason: pick(row, reasonKeys),
          experience: pick(row, experienceKeys),
          designPortfolio: pick(row, designPortfolioKeys),
          mediaPortfolio: pick(row, mediaPortfolioKeys),
          github: pick(row, githubKeys),
          arrived: false,
          interviewed: false,
          arrivedAt: null,
          createdAt: serverTimestamp(),
        });
        imported++;
      }
      await batch.commit();
    }
    setNotice(
      `Imported ${imported} applicant${imported === 1 ? "" : "s"}.` +
        (skipped ? ` Skipped ${skipped} row(s) missing a name or reg. number.` : "")
    );
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
      await importRows(rows);
    } catch (err) {
      console.error(err);
      setError("Failed to import file. Make sure it's a valid Excel/CSV file with Name, Reg No, and Dept columns.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleLinkImport = async (e) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    setUploading(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(linkUrl.trim());
      if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);
      const data = await res.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      await importRows(rows);
      setLinkUrl("");
    } catch (err) {
      console.error(err);
      setError(
        "Failed to import from link. The URL must point directly to a downloadable Excel/CSV file and allow cross-origin access (e.g. a published Google Sheets CSV export link)."
      );
    } finally {
      setUploading(false);
    }
  };

  const removeAll = async () => {
    const confirmText = prompt(
      'This will permanently delete ALL applicants. Type "DELETE" to confirm.'
    );
    if (confirmText !== "DELETE") return;
    setRemovingAll(true);
    setError("");
    setNotice("");
    try {
      const snap = await getDocs(collection(db, "applicants"));
      const docs = snap.docs;
      const CHUNK_SIZE = 450;
      for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const chunk = docs.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      setNotice(`Removed all ${docs.length} applicant(s).`);
    } catch (err) {
      console.error(err);
      setError("Failed to remove all applicants. Check Firestore permissions.");
    } finally {
      setRemovingAll(false);
    }
  };

  return (
    <div className="app-shell admin-shell">
      <div className="header-row">
        <h1>Admin Panel</h1>
        <div className="header-actions">
          <ThemeToggle />
          <Link href="/" className="admin-link">← Back to Queue</Link>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="notice-banner">{notice}</div>}

      <div className="admin-section">
        <h3>Import from Excel/CSV file</h3>
        <label className="upload-btn">
          {uploading ? "Importing..." : "Choose file"}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            ref={fileInputRef}
            onChange={handleFileUpload}
            disabled={uploading}
            hidden
          />
        </label>
        <span className="import-hint">
          Matches your recruitment sheet columns (Name, Reg No, VIT Mail, Phone, Year, Slot, Hosteller/Day Scholar,
          Dept preferences, reason, experience, portfolio links, GitHub, etc). Only Name and Reg No are required.
        </span>
      </div>

      <div className="admin-section">
        <h3>Import from a link</h3>
        <form className="link-form" onSubmit={handleLinkImport}>
          <input
            type="url"
            placeholder="https://... direct link to an Excel/CSV file"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            required
          />
          <button type="submit" disabled={uploading}>
            {uploading ? "Importing..." : "Import"}
          </button>
        </form>
        <span className="import-hint">
          Must be a direct download link (e.g. a published Google Sheets CSV export URL).
        </span>
      </div>

      <div className="admin-section danger-section">
        <h3>Danger zone</h3>
        <button className="btn danger-solid" onClick={removeAll} disabled={removingAll}>
          {removingAll ? "Removing..." : "Remove All Applicants"}
        </button>
        <span className="import-hint">This permanently deletes every applicant. Cannot be undone.</span>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminGate>
      <AdminPanel />
    </AdminGate>
  );
}