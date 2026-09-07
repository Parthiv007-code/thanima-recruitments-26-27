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

export default function Home() {
  const [applicants, setApplicants] = useState([]);
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newReg, setNewReg] = useState("");
  const [newDept, setNewDept] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
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
        (a.dept || "").toLowerCase().includes(term)
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

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newReg.trim()) return;
    try {
      await addDoc(collection(db, "applicants"), {
        name: newName.trim(),
        regNumber: newReg.trim(),
        dept: newDept.trim(),
        arrived: false,
        interviewed: false,
        arrivedAt: null,
        createdAt: serverTimestamp(),
      });
      setNewName("");
      setNewReg("");
      setNewDept("");
      setShowAddForm(false);
    } catch (err) {
      console.error(err);
      setError("Failed to add applicant. Check Firestore permissions.");
    }
  };

  // Pull a value out of a spreadsheet row, trying a list of possible header names
  const pick = (row, keys) => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
        return String(row[k]).trim();
      }
    }
    return "";
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

      const nameKeys = ["Name", "name", "Student Name", "Full Name"];
      const regKeys = [
        "Reg No",
        "Reg. No.",
        "RegNo",
        "regNumber",
        "Registration Number",
        "Registration No",
        "Reg Number",
      ];
      const deptKeys = [
        "Dept",
        "dept",
        "Department",
        "Department Selected",
        "Dept Selected",
        "Preference",
      ];

      let imported = 0;
      let skipped = 0;

      // Firestore batched writes cap at 500 operations, so chunk larger imports
      const CHUNK_SIZE = 450;
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        for (const row of chunk) {
          const name = pick(row, nameKeys);
          const regNumber = pick(row, regKeys);
          const dept = pick(row, deptKeys);
          if (!name || !regNumber) {
            skipped++;
            continue;
          }
          const ref = doc(collection(db, "applicants"));
          batch.set(ref, {
            name,
            regNumber,
            dept,
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
    } catch (err) {
      console.error(err);
      setError(
        "Failed to import file. Make sure it's a valid Excel/CSV file with Name, Reg No, and Dept columns."
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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

  const ApplicantRow = ({ a, queuePosition }) => (
    <div className="applicant-card">
      <div className="applicant-info">
        <div className="applicant-name">
          {queuePosition && <span className="queue-number">#{queuePosition}</span>}
          {a.name}
        </div>
        <div className="applicant-reg">
          Reg #{a.regNumber}
          {a.dept ? ` · ${a.dept}` : ""}
        </div>
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
  );

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
        <span className="import-hint">Columns: Name, Reg No, Dept</span>
      </div>

      {showAddForm && (
        <form className="add-form" onSubmit={handleAdd}>
          <input
            placeholder="Full name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <input
            placeholder="Registration number"
            value={newReg}
            onChange={(e) => setNewReg(e.target.value)}
            required
          />
          <input
            placeholder="Department (optional)"
            value={newDept}
            onChange={(e) => setNewDept(e.target.value)}
          />
          <button type="submit">Save</button>
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
