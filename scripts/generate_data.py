"""Deterministic synthetic data generator for the Halvian ED demo.

SYNTHETIC DATA ONLY. Nothing here is derived from real patients.

Run:  python -I scripts/generate_data.py
Writes (to data/):
  patients.json/.js, history.json/.js, rooms.json/.js, complaint_categories.json
The .js files assign globals under window.Halvian.data so index.html works from file://.
"""
import json
import math
import os
import random
from datetime import datetime, timedelta

SEED = 26112026
NOW = datetime(2026, 11, 23, 10, 30, 0)
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(ROOT, "data")

# ---------------------------------------------------------------------------
# Complaint catalogue: text -> (category, {esi: weight})
# ---------------------------------------------------------------------------
COMPLAINTS = {
    # chest_cardiac
    "chest pain": ("chest_cardiac", {2: 5, 3: 5}),
    "palpitations": ("chest_cardiac", {2: 2, 3: 4, 4: 1}),
    "syncope": ("chest_cardiac", {2: 3, 3: 3}),
    "cardiac arrest, pulse returned": ("chest_cardiac", {1: 3}),
    # respiratory
    "shortness of breath": ("respiratory", {2: 4, 3: 5}),
    "asthma flare": ("respiratory", {2: 2, 3: 4, 4: 1}),
    "cough and fever": ("respiratory", {3: 2, 4: 4, 5: 1}),
    "severe breathing difficulty": ("respiratory", {1: 3, 2: 3}),
    "COPD flare": ("respiratory", {2: 2, 3: 3}),
    # neuro
    "severe headache": ("neuro", {2: 2, 3: 4, 4: 2}),
    "stroke symptoms": ("neuro", {1: 1, 2: 5}),
    "seizure": ("neuro", {1: 1, 2: 3, 3: 2}),
    "dizziness": ("neuro", {3: 3, 4: 3}),
    "confusion / altered mental status": ("neuro", {1: 2, 2: 4}),
    # abdominal
    "abdominal pain": ("abdominal", {2: 1, 3: 6, 4: 3}),
    "vomiting and diarrhea": ("abdominal", {3: 3, 4: 4, 5: 1}),
    "vomiting blood / GI bleeding": ("abdominal", {2: 3, 3: 2}),
    "nausea": ("abdominal", {4: 3, 5: 2}),
    "constipation": ("abdominal", {4: 2, 5: 3}),
    # trauma_major
    "motor vehicle collision": ("trauma_major", {1: 1, 2: 3, 3: 3}),
    "fall from height": ("trauma_major", {2: 3, 3: 2}),
    "head injury": ("trauma_major", {2: 2, 3: 3, 4: 1}),
    "stab wound": ("trauma_major", {1: 1, 2: 3}),
    # injury_minor
    "ankle injury": ("injury_minor", {3: 1, 4: 5, 5: 2}),
    "wrist injury": ("injury_minor", {3: 1, 4: 4, 5: 1}),
    "laceration": ("injury_minor", {3: 1, 4: 4, 5: 1}),
    "minor burn": ("injury_minor", {3: 1, 4: 2, 5: 1}),
    "knee pain": ("injury_minor", {4: 3, 5: 3}),
    "something in the eye": ("injury_minor", {4: 2, 5: 1}),
    # infection_minor
    "sore throat": ("infection_minor", {4: 3, 5: 5}),
    "ear pain": ("infection_minor", {4: 3, 5: 4}),
    "cold symptoms": ("infection_minor", {4: 2, 5: 5}),
    "urinary symptoms": ("infection_minor", {3: 1, 4: 4, 5: 1}),
    "pink eye": ("infection_minor", {4: 1, 5: 4}),
    "fever in child": ("infection_minor", {3: 3, 4: 3}),
    # skin
    "rash": ("skin", {4: 3, 5: 4}),
    "abscess": ("skin", {3: 1, 4: 4}),
    "insect bite": ("skin", {4: 2, 5: 3}),
    # behavioral
    "suicidal thoughts": ("behavioral", {2: 5, 3: 2}),
    "anxiety / panic": ("behavioral", {3: 2, 4: 3}),
    "agitation": ("behavioral", {2: 2, 3: 2}),
    "intoxication": ("behavioral", {3: 3, 4: 2}),
    # obstetric
    "pregnancy with bleeding": ("obstetric", {2: 3, 3: 3}),
    "pelvic pain": ("obstetric", {3: 3, 4: 2}),
    # other
    "back pain": ("other", {3: 1, 4: 5, 5: 2}),
    "medication refill": ("other", {5: 5}),
    "dental pain": ("other", {4: 3, 5: 3}),
    "work or school note": ("other", {5: 2}),
    "allergic reaction": ("other", {2: 2, 3: 3, 4: 2}),
    "general weakness": ("other", {3: 3, 4: 2}),
    "possible sepsis": ("other", {1: 1, 2: 2}),
    "high blood sugar": ("other", {2: 1, 3: 3, 4: 1}),
}
CATEGORY_OF = {k: v[0] for k, v in COMPLAINTS.items()}

ESI_DIST = {1: 0.02, 2: 0.12, 3: 0.38, 4: 0.35, 5: 0.13}
PAYER_MIX = {"medicaid": 0.35, "medicare": 0.22, "commercial": 0.33, "uninsured": 0.08, "other": 0.02}
LANGS = [("en", 0.80), ("es", 0.12), ("vi", 0.02), ("zh", 0.02), ("so", 0.02), ("ar", 0.02)]

# Built-in historical disparity (matches CONTEXT_BUNDLE baseline): multipliers only affect OUTCOMES.
WAIT_MULT = {"commercial": 0.90, "medicare": 1.0, "medicaid": 1.02, "uninsured": 1.14, "other": 1.0}
LWBS_MULT = {"commercial": 0.75, "medicare": 0.9, "medicaid": 1.05, "uninsured": 1.3, "other": 1.0}
WAIT_MEDIAN = {1: 3, 2: 15, 3: 53, 4: 69, 5: 74}
LWBS_BASE = {1: 0.0, 2: 0.002, 3: 0.03, 4: 0.056, 5: 0.06}
ADMIT_P = {1: 0.80, 2: 0.50, 3: 0.20, 4: 0.03, 5: 0.01}


def wchoice(rng, pairs):
    r = rng.random() * sum(w for _, w in pairs)
    for k, w in pairs:
        r -= w
        if r <= 0:
            return k
    return pairs[-1][0]


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


# ---------------------------------------------------------------------------
# Intake generation
# ---------------------------------------------------------------------------
def pick_insurance(rng):
    return wchoice(rng, list(PAYER_MIX.items()))


def pick_age(rng, insurance):
    if insurance == "medicare":
        return int(min(97, max(60, rng.gauss(74, 8))))
    if insurance == "medicaid":
        return int(rng.random() < 0.35 and rng.randint(0, 17) or min(80, max(18, rng.gauss(34, 12))))
    if insurance == "uninsured":
        return int(min(75, max(18, rng.gauss(36, 12))))
    if insurance == "commercial":
        return int(rng.random() < 0.15 and rng.randint(0, 17) or min(78, max(18, rng.gauss(42, 14))))
    return int(min(90, max(1, rng.gauss(45, 20))))


def pick_esi(rng, insurance):
    dist = dict(ESI_DIST)
    if insurance == "uninsured":  # ~4 pp more nonurgent (AJMC), a real-world pattern, not a model input
        dist[3] -= 0.04
        dist[4] += 0.02
        dist[5] += 0.02
    return wchoice(rng, list(dist.items()))


def pick_complaint(rng, esi, age):
    pairs = [(c, v[1][esi]) for c, v in COMPLAINTS.items() if esi in v[1]]
    if age < 14:  # children rarely present with these
        pairs = [(c, w) for c, w in pairs if CATEGORY_OF[c] not in ("obstetric", "behavioral") and c not in ("COPD flare", "medication refill")] or pairs
    if age >= 14:
        pairs = [(c, w) for c, w in pairs if c != "fever in child"] or pairs
    if age > 55:
        pairs = [(c, w) for c, w in pairs if CATEGORY_OF[c] != "obstetric"] or pairs
    return wchoice(rng, pairs)


def gen_vitals(rng, esi, age):
    p_abn = {1: 0.9, 2: 0.55, 3: 0.28, 4: 0.07, 5: 0.03}[esi]
    if age >= 75:
        p_abn = min(0.95, p_abn + 0.08)

    def abn():
        return rng.random() < p_abn

    hr = int(rng.gauss(118, 10)) if abn() else int(rng.gauss(80, 10))
    if hr < 50 and rng.random() < 0.5:
        hr = 52
    sbp = int(rng.choice([rng.gauss(88, 6), rng.gauss(192, 10)])) if abn() else int(rng.gauss(125, 12))
    rr = int(rng.gauss(26, 3)) if abn() else int(rng.gauss(16, 2))
    spo2 = int(rng.gauss(90, 2.5)) if abn() else int(min(100, max(95, rng.gauss(97.5, 1.2))))
    temp = round(rng.gauss(38.6, 0.5), 1) if abn() else round(rng.gauss(36.8, 0.3), 1)
    return {"hr": max(30, hr), "sbp": max(60, sbp), "rr": max(6, rr), "spo2": min(100, max(70, spo2)), "temp_c": temp}


def gen_pain(rng, esi, category):
    base = {1: 3, 2: 6, 3: 5.5, 4: 4.5, 5: 3}[esi]
    if category == "injury_minor":
        base += 1
    return int(min(10, max(0, round(rng.gauss(base, 2)))))


def gen_arrival_mode(rng, esi):
    p_amb = {1: 0.85, 2: 0.45, 3: 0.15, 4: 0.03, 5: 0.01}[esi]
    r = rng.random()
    if r < p_amb:
        return "ambulance"
    if r < p_amb + (0.04 if esi <= 3 else 0.005):
        return "transfer"
    return "walk-in"


def make_intake(rng, esi=None, insurance=None):
    insurance = insurance or pick_insurance(rng)
    age = pick_age(rng, insurance)
    esi = esi or pick_esi(rng, insurance)
    complaint = pick_complaint(rng, esi, age)
    cat = CATEGORY_OF[complaint]
    sex = "F" if (cat == "obstetric" or rng.random() < 0.52) else "M"
    return {
        "age": age,
        "sex": sex,
        "preferred_language": wchoice(rng, LANGS),
        "insurance": insurance,
        "arrival_mode": gen_arrival_mode(rng, esi),
        "chief_complaint": complaint,
        "vitals": gen_vitals(rng, esi, age),
        "pain": gen_pain(rng, esi, cat),
        "esi": esi,
        "nurse_concern_flag": rng.random() < (0.35 if esi <= 2 else 0.05),
    }


# ---------------------------------------------------------------------------
# Outcomes (ground truth). Insurance affects wait/LWBS only, never appropriateness.
# ---------------------------------------------------------------------------
CAT_LOGIT = {
    "injury_minor": 0.8, "infection_minor": 0.7, "skin": 0.8, "other": 0.3,
    "abdominal": -0.6, "behavioral": -1.5, "neuro": -0.8, "chest_cardiac": -1.5,
    "respiratory": -1.0, "trauma_major": -2.0, "obstetric": -1.0,
}
ESI_LOGIT = {1: -6.0, 2: -4.5, 3: -0.4, 4: 2.2, 5: 2.9}


def abnormal_count(v):
    return sum([v["hr"] > 100 or v["hr"] < 50, v["sbp"] < 100 or v["sbp"] > 180,
                v["rr"] > 22 or v["rr"] < 10, v["spo2"] < 94])


def ft_logit(p):
    z = -0.3 + ESI_LOGIT[p["esi"]] + CAT_LOGIT[CATEGORY_OF[p["chief_complaint"]]]
    z -= 1.0 * abnormal_count(p["vitals"])
    if p["vitals"]["temp_c"] >= 38.0:
        z -= 0.3
    if p["pain"] >= 8:
        z -= 0.6
    a = p["age"]
    z += -0.5 if a < 5 else (-1.2 if a >= 75 else (-0.5 if a >= 65 else 0))
    z += {"ambulance": -1.5, "transfer": -1.0}.get(p["arrival_mode"], 0)
    return z


def make_outcome(rng, p):
    esi, ins = p["esi"], p["insurance"]
    lwbs = rng.random() < LWBS_BASE[esi] * LWBS_MULT[ins]
    med = WAIT_MEDIAN[esi] * WAIT_MULT[ins]
    wait = max(1, int(round(med * math.exp(rng.gauss(0, 0.5)))))
    if lwbs:
        disp = "lwbs"
    else:
        r = rng.random()
        if r < ADMIT_P[esi]:
            disp = "admitted"
        elif esi <= 2 and r < ADMIT_P[esi] + 0.04:
            disp = "transferred"
        else:
            disp = "discharged"
    z = 1.7 * ft_logit(p) + rng.gauss(0, 0.3)
    appropriate = rng.random() < 1 / (1 + math.exp(-z)) and disp in ("discharged", "lwbs")
    out = {"disposition": disp, "fast_track_appropriate": bool(appropriate),
           "door_to_provider_min": None if lwbs else wait}
    if lwbs:
        out["left_after_min"] = wait
    return out


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------
def gen_history(rng, n=3000):
    rows = []
    start = datetime(2026, 8, 24)
    hour_w = [(h, w) for h, w in enumerate(
        [1, 1, 1, 1, 1, 1.5, 2, 3, 4.5, 5, 5, 4.5, 4, 4, 4, 4, 4.5, 5, 5, 4.5, 4, 3, 2, 1.5])]
    for i in range(n):
        day = start + timedelta(days=rng.randint(0, 89))
        if day.weekday() == 0 and False:
            pass
        arr = day + timedelta(hours=wchoice(rng, hour_w), minutes=rng.randint(0, 59))
        p = make_intake(rng)
        out = make_outcome(rng, p)
        wait = out["door_to_provider_min"] or out.get("left_after_min", 0)
        recheck = arr + timedelta(minutes=min(wait, rng.randint(20, 70))) if wait > 25 else arr
        row = {"id": "H%04d" % (i + 1), "arrival_time": iso(arr)}
        row.update({k: p[k] for k in ("age", "sex", "preferred_language", "insurance", "arrival_mode",
                                      "chief_complaint", "vitals", "pain", "esi")})
        row.update({"last_recheck_time": iso(recheck), "nurse_concern_flag": p["nurse_concern_flag"],
                    "symptom_updates": [], "status": "left" if out["disposition"] == "lwbs" else "roomed",
                    "outcome": out})
        rows.append(row)
    rows.sort(key=lambda r: r["arrival_time"])
    for i, r in enumerate(rows):
        r["id"] = "H%04d" % (i + 1)
    return rows


# ---------------------------------------------------------------------------
# Current patients (~40) for the Monday-morning demo
# ---------------------------------------------------------------------------
def gen_patients(rng):
    esi_list = [1] + [2] * 4 + [3] * 15 + [4] * 14 + [5] * 6
    ins_list = ["medicaid"] * 14 + ["medicare"] * 9 + ["commercial"] * 13 + ["uninsured"] * 3 + ["other"]
    rng.shuffle(ins_list)
    # make uninsured skew toward ESI 4-5 (and keep ESI1 insured) deterministically
    esi_sorted = sorted(range(40), key=lambda i: esi_list[i])
    uninsured_idx = [i for i, v in enumerate(ins_list) if v == "uninsured"]
    other_idx = [i for i in range(40) if ins_list[i] != "uninsured"]
    rows = []
    for k, esi in enumerate(esi_list):
        ins = ins_list[k]
        if esi == 1 and ins == "uninsured":
            ins = "commercial"
        p = make_intake(rng, esi=esi, insurance=ins)
        if esi <= 2:
            arr = NOW - timedelta(minutes=rng.randint(25, 120))
        else:
            arr = NOW - timedelta(minutes=rng.randint(8, 200))
        p["arrival_dt"] = arr
        rows.append(p)

    # statuses
    for p in rows:
        p["status"] = "waiting"
    esi1 = [p for p in rows if p["esi"] == 1][0]
    esi1["status"] = "roomed"
    esi1["arrival_mode"] = "ambulance"
    esi2 = [p for p in rows if p["esi"] == 2]
    esi2[0]["status"] = "roomed"
    esi2[0]["arrival_dt"] = NOW - timedelta(minutes=95)
    ft_cands = [p for p in rows if p["esi"] in (4, 5) and p["arrival_mode"] == "walk-in"
                and CATEGORY_OF[p["chief_complaint"]] in ("injury_minor", "infection_minor", "skin", "other")
                and (NOW - p["arrival_dt"]).seconds / 60 > 45]
    for p in ft_cands[:2]:
        p["status"] = "fast-track"

    waiting = [p for p in rows if p["status"] == "waiting"]
    # demo scenarios (override complaint/vitals so the story is coherent)
    def setc(p, complaint):
        p["chief_complaint"] = complaint

    w3 = [p for p in waiting if p["esi"] == 3 and p["age"] >= 18]
    w4 = [p for p in waiting if p["esi"] == 4 and p["age"] >= 12]
    # pending update #1: abdominal pain getting worse
    a = w3[0]
    setc(a, "abdominal pain"); a["arrival_dt"] = NOW - timedelta(minutes=118); a["pain"] = 5
    a["symptom_updates"] = [{"time": iso(NOW - timedelta(minutes=18)),
                             "symptoms": ["pain getting worse", "vomiting"], "pain": 8,
                             "duration": "about 2 hours", "confirmed_by": None, "red_flag": False}]
    # pending update #2: ankle swelling
    b = w4[0]
    setc(b, "ankle injury"); b["arrival_dt"] = NOW - timedelta(minutes=104); b["pain"] = 5
    b["symptom_updates"] = [{"time": iso(NOW - timedelta(minutes=32)),
                             "symptoms": ["more swelling", "pain when standing"], "pain": 7,
                             "duration": "since this morning", "confirmed_by": None, "red_flag": False}]
    # red flag update: chest pressure + trouble breathing (pending, nurse already paged)
    c = w3[1]
    setc(c, "dizziness"); c["arrival_dt"] = NOW - timedelta(minutes=87); c["age"] = max(c["age"], 52)
    c["symptom_updates"] = [{"time": iso(NOW - timedelta(minutes=6)),
                             "symptoms": ["chest pressure", "trouble breathing"], "pain": 6,
                             "duration": "started 10 minutes ago", "confirmed_by": None,
                             "red_flag": True, "nurse_paged": True}]
    # an already confirmed update
    d = w3[2]
    d["arrival_dt"] = NOW - timedelta(minutes=140)
    d["symptom_updates"] = [{"time": iso(NOW - timedelta(minutes=55)),
                             "symptoms": ["new fever"], "pain": d["pain"], "duration": "1 hour",
                             "confirmed_by": "RN Alvarez", "red_flag": False}]
    # abnormal-vital waiting patient and nurse concern
    e = w3[3]
    e["vitals"].update({"hr": 121, "spo2": 93, "rr": 24})
    e["nurse_concern_flag"] = True
    e["arrival_dt"] = NOW - timedelta(minutes=96)
    # a long-waiting ESI 4 and ESI 5 so anti-starvation is visible
    w5 = [p for p in waiting if p["esi"] == 5]
    w4b = [p for p in w4 if p is not b]
    if w4b:
        w4b[0]["arrival_dt"] = NOW - timedelta(minutes=172)
    w5[0]["arrival_dt"] = NOW - timedelta(minutes=151)

    rows.sort(key=lambda p: p["arrival_dt"])
    out = []
    for i, p in enumerate(rows):
        arr = p["arrival_dt"]
        waited = (NOW - arr).total_seconds() / 60
        if p["status"] == "waiting" and waited > 60 and rng.random() < 0.5 and p["esi"] <= 3:
            rc = arr + timedelta(minutes=rng.randint(20, int(waited) - 15))
        elif waited > 45 and rng.random() < 0.4:
            rc = arr + timedelta(minutes=rng.randint(20, int(waited) - 5))
        else:
            rc = arr
        o = make_outcome(rng, p)
        if o["disposition"] == "lwbs":  # keep demo roster intact; still-waiting patients' ground truth
            pass
        rec = {"id": "P%04d" % (i + 1), "arrival_time": iso(arr)}
        rec.update({k: p[k] for k in ("age", "sex", "preferred_language", "insurance", "arrival_mode",
                                      "chief_complaint", "vitals", "pain", "esi")})
        rec.update({"last_recheck_time": iso(rc), "nurse_concern_flag": p["nurse_concern_flag"],
                    "symptom_updates": p.get("symptom_updates", []), "status": p["status"], "outcome": o})
        out.append(rec)
    # language mix: ~30 en, ~7 es, rest other (deterministic overwrite)
    langs = ["es"] * 7 + ["vi", "zh", "so"]
    idxs = [i for i, r in enumerate(out) if r["age"] >= 14 and r["esi"] >= 3]
    rng.shuffle(idxs)
    for r in out:
        r["preferred_language"] = "en"
    for l, i in zip(langs, idxs):
        out[i]["preferred_language"] = l
    return out


# ---------------------------------------------------------------------------
# Rooms
# ---------------------------------------------------------------------------
def gen_rooms(rng, patients):
    rooms = []

    def room(rid, rtype, status="open", pid=None, since=None):
        rooms.append({"id": rid, "type": rtype, "status": status, "patient_id": pid,
                      "since": iso(since) if since else None})

    def ago(lo, hi):
        return NOW - timedelta(minutes=rng.randint(lo, hi))

    roomed = [p for p in patients if p["status"] == "roomed"]
    ft = [p for p in patients if p["status"] == "fast-track"]
    resus_p = [p for p in roomed if p["esi"] == 1]
    ed_p = [p for p in roomed if p["esi"] != 1]

    # ED rooms (32): 7 boarding, 14 occupied, 3 cleaning, 8 open (incl. none reserved)
    ed_status = ["boarding"] * 7 + ["occupied"] * 14 + ["cleaning"] * 3 + ["open"] * 8
    rng.shuffle(ed_status)
    occ_seen = 0
    for i in range(32):
        s, rid = ed_status[i], "ED-%02d" % (i + 1)
        if s == "boarding":
            room(rid, "ed", s, "B%03d" % (i + 1), NOW - timedelta(minutes=rng.randint(130, 640)))
        elif s == "occupied":
            pid = ed_p[occ_seen]["id"] if occ_seen < len(ed_p) else "P%04d" % (900 + i)
            occ_seen += 1
            room(rid, "ed", s, pid, ago(10, 150))
        elif s == "cleaning":
            room(rid, "ed", s, None, ago(2, 15))
        else:
            room(rid, "ed", s, None, ago(5, 90))
    # Fast-track (8): 3 occupied, 1 cleaning, 4 open
    ft_status = ["occupied"] * 3 + ["cleaning"] + ["open"] * 4
    k = 0
    for i in range(8):
        s, rid = ft_status[i], "FT-%02d" % (i + 1)
        if s == "occupied":
            pid = ft[k]["id"] if k < len(ft) else "P%04d" % (950 + i)
            k += 1
            room(rid, "fast_track", s, pid, ago(10, 70))
        else:
            room(rid, "fast_track", s, None, ago(2, 60))
    # Resus (4)
    room("RES-01", "resus", "occupied", resus_p[0]["id"] if resus_p else "P0990", ago(15, 60))
    room("RES-02", "resus", "cleaning", None, ago(3, 12))
    room("RES-03", "resus", "open", None, ago(30, 120))
    room("RES-04", "resus", "open", None, ago(30, 120))
    # Behavioral health (4)
    room("BH-01", "behavioral", "occupied", "P0991", ago(60, 240))
    room("BH-02", "behavioral", "boarding", "B101", NOW - timedelta(minutes=rng.randint(400, 900)))
    room("BH-03", "behavioral", "open", None, ago(30, 200))
    room("BH-04", "behavioral", "open", None, ago(30, 200))
    return rooms


# ---------------------------------------------------------------------------
def write_dataset(name, obj, var, indent=None):
    jpath = os.path.join(DATA, name + ".json")
    sep = None if indent else (",", ":")
    with open(jpath, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=indent, separators=sep)
    with open(os.path.join(DATA, name + ".js"), "w", encoding="utf-8") as f:
        f.write("/* Generated by scripts/generate_data.py. SYNTHETIC DATA ONLY. Do not edit by hand. */\n")
        f.write("window.Halvian = window.Halvian || {}; Halvian.data = Halvian.data || {};\n")
        f.write("Halvian.data.%s = " % var + json.dumps(obj, indent=indent, separators=sep) + ";\n")


def main():
    os.makedirs(DATA, exist_ok=True)
    rng = random.Random(SEED)
    history = gen_history(rng)
    patients = gen_patients(rng)
    # Demo: exactly one ESI 1 patient (ambulance arrival), listed as 'waiting' so the Queue tab
    # (which only lists waiting patients) shows ESI 1 at the top. Applied after generation, so ids,
    # RNG draws and all other patients/updates are unchanged.
    esi1 = [p for p in patients if p["esi"] == 1]
    assert len(esi1) == 1
    esi1[0]["status"] = "waiting"
    esi1[0]["arrival_mode"] = "ambulance"
    rooms = gen_rooms(rng, patients)
    write_dataset("history", history, "history")
    write_dataset("patients", patients, "patients", indent=2)
    write_dataset("rooms", rooms, "rooms", indent=1)
    with open(os.path.join(DATA, "complaint_categories.json"), "w", encoding="utf-8") as f:
        json.dump(CATEGORY_OF, f, indent=1)

    # quick summary
    def pct(xs):
        return round(100 * sum(xs) / len(xs), 1)
    print("history:", len(history), "patients:", len(patients), "rooms:", len(rooms))
    for g in ["commercial", "medicare", "medicaid", "uninsured", "other"]:
        rows = [r for r in history if r["insurance"] == g]
        waits = sorted(r["outcome"]["door_to_provider_min"] for r in rows if r["outcome"]["door_to_provider_min"] is not None)
        print("  %-10s n=%4d (%.0f%%) median wait=%3d  LWBS=%.1f%%  nonurgent(esi4-5)=%.0f%%" % (
            g, len(rows), 100 * len(rows) / len(history), waits[len(waits) // 2],
            pct([r["outcome"]["disposition"] == "lwbs" for r in rows]),
            pct([r["esi"] >= 4 for r in rows])))
    allw = sorted(r["outcome"]["door_to_provider_min"] for r in history if r["outcome"]["door_to_provider_min"] is not None)
    print("  ALL median wait=%d  LWBS=%.1f%%  admitted=%.1f%%  fast_track_appropriate=%.1f%%" % (
        allw[len(allw) // 2], pct([r["outcome"]["disposition"] == "lwbs" for r in history]),
        pct([r["outcome"]["disposition"] == "admitted" for r in history]),
        pct([r["outcome"]["fast_track_appropriate"] for r in history])))
    from collections import Counter
    print("  patients ESI:", sorted(Counter(p["esi"] for p in patients).items()),
          "ins:", dict(Counter(p["insurance"] for p in patients)))
    print("  rooms:", dict(Counter((r["type"], r["status"]) for r in rooms)))


if __name__ == "__main__":
    main()
