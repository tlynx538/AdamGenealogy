#!/usr/bin/env python3
"""
Fetch all descendants of Adam (Q70899) from Wikidata using the same logic as the JavaScript loader.
Outputs genealogy-graph.json in the format: { nodes: [...], edges: [...] }
"""

import json
import time
import requests
from collections import deque

# ---------- CONFIG ----------
WIKI_API = "https://www.wikidata.org/w/api.php"
BATCH_SIZE = 50
MAX_PERSONS = 90000
MAX_DEPTH = 75
SLEEP_BETWEEN_BATCHES = 0.2  # seconds

# Seed QIDs (exactly the same as in your loader)
SEED_QIDS = [
    'Q70899', 'Q109188', 'Q133861', 'Q178783', 'Q204899', 'Q9181',
    'Q35840', 'Q61034', 'Q104203', 'Q60236', 'Q254', 'Q37085',
    'Q302', 'Q9455', 'Q37471', 'Q152819', 'Q160148', 'Q157006',
    'Q189106', 'Q102127', 'Q154239', 'Q34817', 'Q194938',
    'Q42521', 'Q42844', 'Q34527', 'Q44072', 'Q124920'
]

# ---------- User-Agent (required to avoid 403) ----------
HEADERS = {
    "User-Agent": "GenealogyFetcher/1.0 (https://your-site.com; your-email@example.com)"
}

def fetch_entities(qids):
    """Fetch Wikidata entities for a list of QIDs (batched)."""
    if not qids:
        return {}
    url = f"{WIKI_API}?action=wbgetentities&ids={'|'.join(qids)}&props=labels|descriptions|claims&languages=en&format=json&origin=*"
    resp = requests.get(url, headers=HEADERS)
    resp.raise_for_status()
    data = resp.json()
    return data.get("entities", {})

def is_filtered_out(entity):
    """Skip disambiguation pages and Islamic variants."""
    desc = entity.get("descriptions", {}).get("en", {}).get("value", "")
    label = entity.get("labels", {}).get("en", {}).get("value", "")
    text = (label + " " + desc).lower()
    # Disambiguation
    if "disambiguation" in text:
        return True
    # Islamic / Muslim variants (skip them)
    islamic_patterns = ["in islam", "(islam)", "islamic", "muslim", "quranic", "in the quran"]
    if any(p in text for p in islamic_patterns):
        return True
    # Also skip any "character in hazbin hotel" (as in your loader)
    if "hazbin hotel" in text:
        return True
    return False

def clean_date(d):
    if d and d.startswith("+"):
        return d[1:11] if len(d) >= 11 else d[1:]
    return d[:10] if d else None

def main():
    person_map = {}          # qid -> person data
    queued = set(SEED_QIDS)
    queue = deque([(qid, 0) for qid in SEED_QIDS])  # (qid, depth)

    print("🌐 Fetching from Wikidata using wbgetentities...")

    while queue and len(person_map) < MAX_PERSONS:
        # Pop a batch from the queue
        batch = []
        while queue and len(batch) < BATCH_SIZE:
            qid, depth = queue.popleft()
            if qid not in person_map and depth <= MAX_DEPTH:
                batch.append((qid, depth))

        if not batch:
            continue

        # Collect QIDs to fetch
        fetch_ids = [qid for qid, _ in batch if qid not in person_map]
        if not fetch_ids:
            continue

        current_depth = min(depth for _, depth in batch)
        print(f"📡 {len(person_map)} persons · depth {current_depth} · {len(queue)} queued")

        try:
            entities = fetch_entities(fetch_ids)
        except Exception as e:
            print(f"⚠️ Batch fetch failed: {e}, skipping...")
            continue

        for qid, depth in batch:
            entity = entities.get(qid)
            if not entity:
                continue

            # Skip disambiguation and Islamic variants
            if is_filtered_out(entity):
                continue

            label = entity.get("labels", {}).get("en", {}).get("value", qid)
            description = entity.get("descriptions", {}).get("en", {}).get("value", "")
            image = entity.get("claims", {}).get("P18", [{}])[0].get("mainsnak", {}).get("datavalue", {}).get("value")
            gender = entity.get("claims", {}).get("P21", [{}])[0].get("mainsnak", {}).get("datavalue", {}).get("value", {}).get("id")
            birth = entity.get("claims", {}).get("P569", [{}])[0].get("mainsnak", {}).get("datavalue", {}).get("value", {}).get("time")
            death = entity.get("claims", {}).get("P570", [{}])[0].get("mainsnak", {}).get("datavalue", {}).get("value", {}).get("time")

            # Father (P22) and mother (P25) - read exactly like the JS loader
            father_claim = entity.get("claims", {}).get("P22")
            father = father_claim[0].get("mainsnak", {}).get("datavalue", {}).get("value", {}).get("id") if father_claim else None

            mother_claim = entity.get("claims", {}).get("P25")
            mother = mother_claim[0].get("mainsnak", {}).get("datavalue", {}).get("value", {}).get("id") if mother_claim else None

            # Children (P40) – we keep for metadata but do NOT create edges from them
            children = []
            child_claims = entity.get("claims", {}).get("P40", [])
            for c in child_claims:
                cid = c.get("mainsnak", {}).get("datavalue", {}).get("value", {}).get("id")
                if cid:
                    children.append(cid)

            person = {
                "id": qid,
                "name": label,
                "aliases": [],
                "gender": gender,
                "birth": clean_date(birth),
                "death": clean_date(death),
                "father": father,
                "mother": mother,
                "spouses": [],          # we ignore spouses
                "children": children,   # keep for metadata (side panel)
                "religion": [],
                "description": description,
                "image": image,
                "sources": ["wikidata"],
            }

            person_map[qid] = person

            # Enqueue new relations: father, mother, children (same as JS loader)
            next_ids = set()
            if father:
                next_ids.add(father)
            if mother:
                next_ids.add(mother)
            for c in children:
                next_ids.add(c)

            # Also enqueue father/mother of seed nodes (same as JS loader)
            if qid in SEED_QIDS:
                if father:
                    next_ids.add(father)
                if mother:
                    next_ids.add(mother)

            for nid in next_ids:
                if nid not in person_map and nid not in queued and depth + 1 <= MAX_DEPTH:
                    queued.add(nid)
                    queue.append((nid, depth + 1))

        time.sleep(SLEEP_BETWEEN_BATCHES)

    print(f"✅ Fetched {len(person_map)} people.")

    # ---------- Build edges (only father and mother, same as JS loader) ----------
    nodes = list(person_map.values())
    edges = []
    edge_set = set()

    for person in nodes:
        qid = person["id"]
        if person["father"] and person["father"] in person_map:
            key = f"{person['father']}->{qid}"
            if key not in edge_set:
                edge_set.add(key)
                edges.append({"from": person["father"], "to": qid, "type": "father"})
        if person["mother"] and person["mother"] in person_map:
            key = f"{person['mother']}->{qid}"
            if key not in edge_set:
                edge_set.add(key)
                edges.append({"from": person["mother"], "to": qid, "type": "mother"})

    # ---------- Save to JSON ----------
    output = {"nodes": nodes, "edges": edges}
    with open("genealogy-graph.json", "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"💾 Saved {len(nodes)} nodes and {len(edges)} edges to genealogy-graph.json")

if __name__ == "__main__":
    main()