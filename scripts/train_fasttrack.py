"""Train the fast-track eligibility model (pure-Python logistic regression).

Run:  python -I scripts/train_fasttrack.py     (after generate_data.py)
Reads data/history.json + data/complaint_categories.json
Writes data/fasttrack_model.json and data/fasttrack_model.js

Inputs are triage-intake features only. INSURANCE IS NEVER A FEATURE; it is used only
afterwards to report per-group fairness numbers.

The feature definitions here are mirrored by Halvian.fastTrack.featurize in src/shared/core.js.
Keep the two in sync (the model JSON carries the feature names + labels).
"""
import json
import math
import os
import random

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(ROOT, "data")
SEED = 7
MAX_BOUNCE_BACK = 0.05

CATEGORIES = ["chest_cardiac", "respiratory", "neuro", "abdominal", "trauma_major", "injury_minor",
              "infection_minor", "skin", "behavioral", "obstetric"]  # "other" is the baseline
CAT_LABEL = {
    "chest_cardiac": "Chest or heart complaint", "respiratory": "Breathing complaint",
    "neuro": "Neurological complaint", "abdominal": "Abdominal / stomach complaint",
    "trauma_major": "Major trauma", "injury_minor": "Minor injury", "infection_minor": "Minor infection",
    "skin": "Skin complaint", "behavioral": "Behavioral health complaint", "obstetric": "Pregnancy-related",
}
FEATURES = (["esi_2", "esi_3", "esi_4", "esi_5", "hr_abnormal", "sbp_abnormal", "rr_abnormal", "spo2_low",
             "fever", "pain_severe", "age_0_4", "age_65_74", "age_75_plus", "arrival_ambulance",
             "arrival_transfer"] + ["cat_" + c for c in CATEGORIES])
LABELS = {
    "esi_2": "Triage level ESI 2", "esi_3": "Triage level ESI 3", "esi_4": "Triage level ESI 4",
    "esi_5": "Triage level ESI 5",
    "hr_abnormal": "Abnormal heart rate", "sbp_abnormal": "Abnormal blood pressure",
    "rr_abnormal": "Abnormal breathing rate", "spo2_low": "Low oxygen saturation", "fever": "Fever",
    "pain_severe": "Severe pain (8+)", "age_0_4": "Age under 5", "age_65_74": "Age 65-74",
    "age_75_plus": "Age 75 or older", "arrival_ambulance": "Arrived by ambulance",
    "arrival_transfer": "Transferred from another facility",
}
LABELS.update({"cat_" + c: CAT_LABEL[c] for c in CATEGORIES})


def featurize(p, cat_of):
    v = p["vitals"]
    cat = cat_of.get(p["chief_complaint"], "other")
    x = {
        "esi_2": p["esi"] == 2, "esi_3": p["esi"] == 3, "esi_4": p["esi"] == 4, "esi_5": p["esi"] == 5,
        "hr_abnormal": v["hr"] > 100 or v["hr"] < 50,
        "sbp_abnormal": v["sbp"] < 100 or v["sbp"] > 180,
        "rr_abnormal": v["rr"] > 22 or v["rr"] < 10,
        "spo2_low": v["spo2"] < 94,
        "fever": v["temp_c"] >= 38.0,
        "pain_severe": p["pain"] >= 8,
        "age_0_4": p["age"] < 5, "age_65_74": 65 <= p["age"] < 75, "age_75_plus": p["age"] >= 75,
        "arrival_ambulance": p["arrival_mode"] == "ambulance",
        "arrival_transfer": p["arrival_mode"] == "transfer",
    }
    for c in CATEGORIES:
        x["cat_" + c] = cat == c
    return [1.0 if x[f] else 0.0 for f in FEATURES]


def sigmoid(z):
    if z < -35:
        return 0.0
    return 1.0 / (1.0 + math.exp(-z))


def train(X, y, iters=1500, lr=1.0, l2=1e-3):
    n, d = len(X), len(FEATURES)
    nz = [[(j, v) for j, v in enumerate(row) if v] for row in X]  # sparse rows
    w, b = [0.0] * d, 0.0
    for _ in range(iters):
        gw, gb = [0.0] * d, 0.0
        for row, t in zip(nz, y):
            z = b
            for j, v in row:
                z += w[j] * v
            e = sigmoid(z) - t
            gb += e
            for j, v in row:
                gw[j] += e * v
        for j in range(d):
            w[j] -= lr * (gw[j] / n + l2 * w[j])
        b -= lr * gb / n
    return w, b


def predict(w, b, row):
    return sigmoid(b + sum(wj * v for wj, v in zip(w, row) if v))


def auc(scores, labels):
    pairs = sorted(zip(scores, labels))
    rank_sum, i, n = 0.0, 0, len(pairs)
    while i < n:
        j = i
        while j < n and pairs[j][0] == pairs[i][0]:
            j += 1
        avg = (i + j + 1) / 2.0
        rank_sum += avg * sum(1 for k in range(i, j) if pairs[k][1])
        i = j
    pos = sum(labels)
    neg = n - pos
    return (rank_sum - pos * (pos + 1) / 2.0) / (pos * neg)


def bounce_back(scores, labels, thr):
    sel = [t for s, t in zip(scores, labels) if s >= thr]
    return (sum(1 for t in sel if not t) / len(sel)) if sel else 0.0, len(sel)


def main():
    with open(os.path.join(DATA, "history.json"), encoding="utf-8") as f:
        hist = json.load(f)
    with open(os.path.join(DATA, "complaint_categories.json"), encoding="utf-8") as f:
        cat_of = json.load(f)

    rng = random.Random(SEED)
    idx = list(range(len(hist)))
    rng.shuffle(idx)
    n_tr, n_val = int(0.70 * len(idx)), int(0.15 * len(idx))
    tr, va, te = idx[:n_tr], idx[n_tr:n_tr + n_val], idx[n_tr + n_val:]

    X = [featurize(r, cat_of) for r in hist]  # NOTE: no insurance anywhere in features
    y = [1 if r["outcome"]["fast_track_appropriate"] else 0 for r in hist]

    w, b = train([X[i] for i in tr], [y[i] for i in tr])
    score = [predict(w, b, row) for row in X]

    # Threshold: lowest cutoff (most patients fast-tracked) whose bounce-back on the validation
    # split is <= 4.5% (0.5 pt safety margin under the 5% target), with at least 30 selected.
    sv, yv = [score[i] for i in va], [y[i] for i in va]
    thr = 0.99
    t = 0.50
    while t <= 0.995:
        bb, k = bounce_back(sv, yv, t)
        if bb <= MAX_BOUNCE_BACK - 0.005 and k >= 30:
            thr = round(t, 3)
            break
        t += 0.005
    st, yt = [score[i] for i in te], [y[i] for i in te]
    bb_te, k_te = bounce_back(st, yt, thr)
    bb_va, k_va = bounce_back(sv, yv, thr)
    acc = sum((s >= 0.5) == bool(t_) for s, t_ in zip(st, yt)) / len(st)

    fairness = {}
    for g in ["commercial", "medicare", "medicaid", "uninsured", "other"]:
        ids = [i for i, r in enumerate(hist) if r["insurance"] == g]
        if not ids:
            continue
        sel = [i for i in ids if score[i] >= thr]
        fairness[g] = {
            "n": len(ids),
            "mean_score": round(sum(score[i] for i in ids) / len(ids), 4),
            "selection_rate": round(len(sel) / len(ids), 4),
            "bounce_back_rate": round(sum(1 for i in sel if not y[i]) / len(sel), 4) if sel else 0.0,
        }

    model = {
        "name": "Halvian fast-track eligibility (logistic regression)",
        "note": "Synthetic data only. Insurance is NOT a feature. Trained offline; runs in the browser.",
        "features": FEATURES,
        "labels": LABELS,
        "weights": [round(v, 5) for v in w],
        "bias": round(b, 5),
        "threshold": thr,
        "min_esi_for_fast_track": 3,
        "complaint_categories": cat_of,
        "feature_notes": "Binary flags (1/0). Abnormal: HR>100|<50, SBP<100|>180, RR>22|<10, SpO2<94, temp>=38.0. "
                         "Category baseline is 'other'. Score = sigmoid(bias + sum(weight*flag)).",
        "metrics": {
            "accuracy_at_0.5": round(acc, 4),
            "auc": round(auc(st, yt), 4),
            "bounce_back_rate_at_threshold": round(bb_te, 4),
            "bounce_back_rate_validation": round(bb_va, 4),
            "selected_in_test": k_te,
            "selection_rate_test": round(k_te / len(te), 4),
            "bounce_back_target": MAX_BOUNCE_BACK,
            "n_train": len(tr), "n_validation": len(va), "n_test": len(te),
        },
        "fairness": fairness,
    }
    with open(os.path.join(DATA, "fasttrack_model.json"), "w", encoding="utf-8") as f:
        json.dump(model, f, indent=1)
    with open(os.path.join(DATA, "fasttrack_model.js"), "w", encoding="utf-8") as f:
        f.write("/* Generated by scripts/train_fasttrack.py. SYNTHETIC DATA ONLY. Do not edit by hand. */\n")
        f.write("window.Halvian = window.Halvian || {}; Halvian.data = Halvian.data || {};\n")
        f.write("Halvian.data.fasttrackModel = " + json.dumps(model, indent=1) + ";\n")

    print("threshold:", thr, "metrics:", json.dumps(model["metrics"]))
    print("fairness:")
    for g, v in fairness.items():
        print("  ", g, v)
    top = sorted(zip(FEATURES, w), key=lambda kv: -abs(kv[1]))[:8]
    print("top weights:", [(k, round(v, 2)) for k, v in top])


if __name__ == "__main__":
    main()
