"""Study 2 studyrun units: dimensionality of report, body and both; shared dimensions by held-out CCA."""
import json
import sys

import numpy as np
from sklearn.decomposition import PCA

sys.dont_write_bytecode = True

PANAS = ["active", "distressed", "interested", "inspired", "annoyed", "strong", "guilty", "scared", "hostile",
         "excited", "proud", "irritable", "enthusiastic", "ashamed", "alert", "nervous", "determined",
         "attentive", "jittery", "afraid", "stressed", "frustrated", "happy", "sad"]
ITEMS = PANAS + ["stai_at_ease", "stai_nervous", "stai_jittery", "stai_relaxed", "stai_worried",
                 "stai_pleasant", "sam_valence", "sam_arousal"]


def _load(ctx):
    if "P" not in ctx["state"]:
        rows = json.loads(open(ctx["inputs"][0], encoding="utf-8").read())["rows"]
        fk = list(rows[0]["phys"])
        st = ctx["state"]
        st["fk"] = fk
        st["P"] = np.array([[r["phys"][k] for k in fk] for r in rows])
        st["S"] = np.array([r["self_report"] for r in rows], float)
        st["subj"] = np.array([r["subject"] for r in rows])
        st["cond"] = np.array([r["condition"] for r in rows])
    return ctx["state"]


def center(X, subj):
    X = X.copy()
    for s in np.unique(subj):
        X[subj == s] -= X[subj == s].mean(0)
    return X


def z(X, ref=None):
    ref = X if ref is None else ref
    sd = ref.std(0)
    sd[sd == 0] = 1
    return (X - ref.mean(0)) / sd


def eig(X):
    return np.sort(np.linalg.eigvalsh(np.corrcoef(X, rowvar=False)))[::-1]


def pr(X):
    lam = eig(X)
    return float(lam.sum() ** 2 / (lam ** 2).sum())


def pa_count(X, rng, n):
    lam = eig(X)
    null = np.array([eig(np.column_stack([rng.permutation(c) for c in X.T])) for _ in range(n)])
    q95 = np.quantile(null, 0.95, axis=0)
    k = 0
    while k < len(lam) and lam[k] > q95[k]:
        k += 1
    return k, lam[:6].tolist(), q95[:6].tolist()


def cv_ppca(X, subj, kmax):
    ks = list(range(1, min(kmax, X.shape[1] - 1) + 1))
    ll = np.zeros(len(ks))
    for s in np.unique(subj):
        tr, te = subj != s, subj == s
        Xtr, Xte = z(X[tr]), z(X[te], X[tr])
        for i, k in enumerate(ks):
            ll[i] += PCA(n_components=k).fit(Xtr).score(Xte) * te.sum()
    ll /= len(X)
    return ks[int(np.argmax(ll))], dict(zip(map(str, ks), ll.tolist()))


def _pcs(Xtr, Xte, k):
    mu = Xtr.mean(0); sd = Xtr.std(0); sd[sd == 0] = 1
    A, B = (Xtr - mu) / sd, (Xte - mu) / sd
    _, _, vt = np.linalg.svd(A, full_matrices=False)
    return A @ vt[:k].T, B @ vt[:k].T


def _isqrt(C):
    w, v = np.linalg.eigh(C)
    return v @ np.diag(1 / np.sqrt(np.maximum(w, 1e-9))) @ v.T


def cca_loso(P, S, subj, k):
    U, V = np.zeros((len(P), k)), np.zeros((len(P), k))
    for s in np.unique(subj):
        tr, te = subj != s, subj == s
        ptr, pte = _pcs(P[tr], P[te], k)
        str_, ste = _pcs(S[tr], S[te], k)
        n = tr.sum() - 1
        Wx, Wy = _isqrt(ptr.T @ ptr / n), _isqrt(str_.T @ str_ / n)
        u, _, vt = np.linalg.svd(Wx @ (ptr.T @ str_ / n) @ Wy)
        a, b = Wx @ u[:, :k], Wy @ vt[:k].T
        U[te], V[te] = pte @ a, ste @ b
    r = np.array([np.corrcoef(U[:, j], V[:, j])[0, 1] for j in range(k)])
    return r, U, V


def _time_shuffle(Sc, subj, rng):
    out = Sc.copy()
    for s in np.unique(subj):
        idx = np.nonzero(subj == s)[0]
        out[idx] = Sc[rng.permutation(idx)]
    return out


def _part_shuffle(S, subj, cond, rng):
    out = S.copy()
    for c in np.unique(cond):
        idx = np.nonzero(cond == c)[0]
        out[idx] = S[rng.permutation(idx)]
    return center(out, subj)


def _k_shared(r, null):
    q = np.quantile(null, 0.95, axis=0)
    k = 0
    while k < len(r) and r[k] > q[k]:
        k += 1
    return k, q


def bh(p):
    p = np.asarray(p, float); o = np.argsort(p); q = np.empty_like(p); prev = 1.0
    for rank, i in reversed(list(enumerate(o, 1))):
        prev = min(prev, p[i] * len(p) / rank); q[i] = prev
    return q


def _dims(X, subj, rng, prm):
    k, lam, q = pa_count(X, rng, prm["n_perm"])
    best, ll = cv_ppca(X, subj, prm["k_max"])
    return {"pr": pr(X), "pa_count": k, "eig": lam, "pa_q95": q, "cv_best_k": best, "cv_loglik": ll}


def _planted(subj, rng, prm):
    n = len(subj)
    Zf = rng.normal(0, 1, (n, 2))
    X = Zf @ rng.normal(0, 1, (2, 32)) + rng.normal(0, 1.5, (n, 32))
    pa, _, _ = pa_count(center(X, subj), rng, prm["n_perm"])
    out = {"pa_count": pa}
    lat = rng.normal(0, 1, n)
    for tag, share in (("pos", 1.0), ("neg", 0.0)):
        lp = lat if share else rng.normal(0, 1, n)
        P = np.outer(lp, rng.normal(0.6, 0.1, 12)) + rng.normal(0, 1, (n, 12))
        S = np.outer(lat, rng.normal(0.6, 0.1, 32)) + rng.normal(0, 1, (n, 32))
        Pc, Sc = center(P, subj), center(S, subj)
        r, _, _ = cca_loso(Pc, Sc, subj, prm["n_pc"])
        null = np.array([cca_loso(Pc, _time_shuffle(Sc, subj, rng), subj, prm["n_pc"])[0]
                         for _ in range(prm["n_plant_shuffle"])])
        out[f"k_shared_{tag}"], _ = _k_shared(r, null)
        out[f"r_{tag}"] = r.tolist()
    return out


def _axis(U, S, subj, rng, nb):
    val, aro = center(S[:, 30:31], subj)[:, 0], center(S[:, 31:32], subj)[:, 0]
    u = U[:, 0]
    f = lambda m: abs(np.corrcoef(u[m], aro[m])[0, 1]) - abs(np.corrcoef(u[m], val[m])[0, 1])
    subs = np.unique(subj)
    boots = [f(np.concatenate([np.nonzero(subj == s)[0] for s in rng.choice(subs, len(subs))]))
             for _ in range(nb)]
    return {"r_arousal": float(np.corrcoef(u, aro)[0, 1]), "r_valence": float(np.corrcoef(u, val)[0, 1]),
            "diff": float(f(np.arange(len(u)))),
            "diff_ci": [float(np.quantile(boots, .025)), float(np.quantile(boots, .975))]}


def analysis(ctx):
    st, prm, rng = _load(ctx), ctx["params"], ctx["rng"]
    P, S, subj, cond = st["P"], st["S"], st["subj"], st["cond"]
    keep = center(S, subj).std(0) > 1e-12  # items nobody varied on within person carry no information
    items = [it for it, k in zip(ITEMS, keep) if k]
    S_all, S = S, S[:, keep]
    iv, ia = items.index("sam_valence"), items.index("sam_arousal")
    Pc, Sc = z(center(P, subj)), z(center(S, subj))
    J = np.hstack([Pc / np.sqrt(Pc.shape[1]), Sc / np.sqrt(Sc.shape[1])])
    out = {"n_rows": int(len(P)), "items_dropped_no_within_variance": [it for it, k in zip(ITEMS, keep) if not k], "n_subjects": int(len(np.unique(subj))), "phys_features": st["fk"],
           "sr": _dims(Sc, subj, rng, prm), "phys": _dims(Pc, subj, rng, prm), "joint": _dims(J, subj, rng, prm)}
    r, U, V = cca_loso(Pc, Sc, subj, prm["n_pc"])
    nt = np.array([cca_loso(Pc, _time_shuffle(Sc, subj, rng), subj, prm["n_pc"])[0] for _ in range(prm["n_perm"])])
    npart = np.array([cca_loso(Pc, z(_part_shuffle(S, subj, cond, rng)), subj, prm["n_pc"])[0]
                      for _ in range(prm["n_perm"])])
    st["null_time"], st["null_part"] = nt, npart
    k, q_t = _k_shared(r, nt)
    _, q_p = _k_shared(r, npart)
    p_t = [(np.sum(nt[:, j] >= r[j]) + 1) / (len(nt) + 1) for j in range(len(r))]
    p_p = [(np.sum(npart[:, j] >= r[j]) + 1) / (len(npart) + 1) for j in range(len(r))]
    q = bh(p_t + p_p)
    out["cca"] = {"r": r.tolist(), "k_shared": k, "time_q95": q_t.tolist(), "part_q95": q_p.tolist(),
                  "p_time": p_t, "p_part": p_p, "q_bh_time": q[:len(r)].tolist(), "q_bh_part": q[len(r):].tolist(),
                  "phys_loading_r": {f: float(np.corrcoef(Pc[:, i], U[:, 0])[0, 1]) for i, f in enumerate(st["fk"])},
                  "sr_loading_r": {it: float(np.corrcoef(Sc[:, i], V[:, 0])[0, 1]) for i, it in enumerate(items)}}
    out["axis"] = _axis(U, S_all, subj, rng, prm["n_boot"])
    pca = PCA(n_components=3).fit(Sc)
    sc = pca.transform(Sc)
    out["sr_pcs"] = {f"pc{i+1}": {"var_ratio": float(pca.explained_variance_ratio_[i]),
                                  "r_valence": float(np.corrcoef(sc[:, i], Sc[:, iv])[0, 1]),
                                  "r_arousal": float(np.corrcoef(sc[:, i], Sc[:, ia])[0, 1]),
                                  "top_items": [items[j] for j in np.argsort(-np.abs(pca.components_[i]))[:6]]}
                     for i in range(3)}
    Pr, Sr = z(P), z(S)
    out["raw_uncentred"] = {"sr_pr": pr(Sr), "phys_pr": pr(Pr),
                            "cca_r": cca_loso(Pr, Sr, subj, prm["n_pc"])[0].tolist()}
    out["planted"] = _planted(subj, rng, prm)
    return out


def time_null(ctx, analysis_result):
    return ctx["state"]["null_time"][:, 0].tolist()


def part_null(ctx, analysis_result):
    return ctx["state"]["null_part"][:, 0].tolist()
